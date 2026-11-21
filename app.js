// Comptes — v6.0 (source JSX, compilée en app.js)
const {
  useState,
  useEffect,
  useRef,
  useMemo
} = React;
const APP_VERSION = 'v6.9';
const API_URL = 'https://script.google.com/macros/s/AKfycbxyKJD9etJlzioM09crYIGHXqxNGZXq0-jadNDz3YMGMYAoZfeZ4dNmNsdne4vilEtUHw/exec';
const COMPTES = ['Compte courant', 'Épargne France', 'Épargne Espagne'];
const LIENS = {
  nominas: 'https://docs.google.com/spreadsheets/d/1qFAGMnfFkznxkckuF5eGgY0XSo9qWAGao1vi_e5rkfw/edit',
  impots: 'https://docs.google.com/spreadsheets/d/1jThZTb0tiJE__FGkaNk9M_Qflk4QBk3tpwCq7f7z5gg/edit'
};
const CLE_CACHE = 'comptes-v6';
const CLE_ANCIENNE = 'suivi-cours-donnees';
const CLE_THEME = 'comptes-theme';
const PREFIXE_PONCT = 'Ponctuel : ';
function estPonctuel(nom) {
  return String(nom).indexOf(PREFIXE_PONCT) === 0;
}
function libelle(nom) {
  return estPonctuel(nom) ? nom.slice(PREFIXE_PONCT.length) + ' (ponctuel)' : nom;
}
const PAL_REV = ['var(--rev)', 'var(--rev2)', 'var(--rev3)', 'var(--rev4)', 'var(--rev5)'];
const PAL_DEP = ['var(--dep)', 'var(--dep2)', 'var(--dep3)', 'var(--dep4)'];

/* ---------- Dates et nombres ---------- */

const MOIS_L = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MOIS_C = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
function ymDe(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
function ymAjoute(m, n) {
  const y = +m.slice(0, 4),
    mm = +m.slice(5, 7);
  return ymDe(new Date(y, mm - 1 + n, 1));
}
function moisNom(m) {
  return MOIS_L[+m.slice(5, 7) - 1];
}
function moisLong(m) {
  return moisNom(m) + ' ' + m.slice(0, 4);
}
function moisTitre(m) {
  const s = moisLong(m);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function moisCourt(m) {
  return MOIS_C[+m.slice(5, 7) - 1];
}
function finDeMois(m) {
  const y = +m.slice(0, 4),
    mm = +m.slice(5, 7);
  return new Date(y, mm, 0).getDate() + ' ' + moisNom(m);
}
function estMois(s) {
  return /^\d{4}-\d{2}$/.test(s);
}
function num(v) {
  if (v === '' || v === null || v === undefined) return 0;
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  const n = parseFloat(String(v).replace(/[\s  €]/g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}
function vide(v) {
  return v === '' || v === null || v === undefined;
}
function eur(v) {
  return (Math.round(v * 100) / 100).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' €';
}
function eurSigne(v) {
  return (v > 0 ? '+' : v < 0 ? '−' : '') + eur(Math.abs(v));
}
function pourSaisie(v) {
  if (vide(v)) return '';
  if (typeof v === 'number') return v.toFixed(2).replace('.', ',');
  return String(v);
}
function nettoyer(v) {
  return String(v).replace(/[^\d.,-]/g, '');
}
function capital(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ---------- Données ---------- */

function moisTexte(v) {
  if (v instanceof Date) return ymDe(v);
  const s = String(v === null || v === undefined ? '' : v).trim();
  if (estMois(s)) return s;
  const d = new Date(s);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s) && !isNaN(d)) return ymDe(d);
  return s;
}
function analyser(raw) {
  const r = raw || {};
  const lignes = t => (t || []).slice(1).filter(x => x && String(x[0]).trim());
  const cats = lignes(r.finCategories).map(x => ({
    nom: String(x[0]).trim(),
    type: String(x[1]).trim() === 'depense' ? 'depense' : 'revenu',
    actif: x[2] !== false && String(x[2]).toUpperCase() !== 'FALSE'
  }));
  const arch = lignes(r.finArchives).map(x => ({
    mois: moisTexte(x[0]),
    categorie: String(x[1]).trim(),
    montant: num(x[2])
  })).filter(a => estMois(a.mois));
  const sold = lignes(r.finSoldes).map(x => ({
    mois: moisTexte(x[0]),
    compte: String(x[1]).trim(),
    montant: num(x[2])
  })).filter(s => estMois(s.mois));
  const typeDe = {};
  cats.forEach(c => {
    typeDe[c.nom] = c.type;
  });
  arch.forEach(a => {
    if (estPonctuel(a.categorie)) typeDe[a.categorie] = 'depense';
  });
  const parMois = {};
  const fiche = m => parMois[m] || (parMois[m] = {
    rev: 0,
    dep: 0,
    cats: {},
    soldes: null
  });
  arch.forEach(a => {
    const f = fiche(a.mois);
    f.cats[a.categorie] = (f.cats[a.categorie] || 0) + a.montant;
    if ((typeDe[a.categorie] || 'revenu') === 'depense') f.dep += a.montant;else f.rev += a.montant;
  });
  sold.forEach(s => {
    const f = fiche(s.mois);
    if (!f.soldes) f.soldes = {};
    f.soldes[s.compte] = (f.soldes[s.compte] || 0) + s.montant;
  });
  const moisListe = Object.keys(parMois).sort();
  const moisArch = Array.from(new Set(arch.map(a => a.mois))).sort();
  const moisSoldes = moisListe.filter(m => parMois[m].soldes);
  return {
    cats,
    arch,
    sold,
    typeDe,
    parMois,
    moisListe,
    moisArch,
    moisSoldes
  };
}
function dernierAvant(d, cible) {
  let res = null;
  d.moisListe.forEach(m => {
    if (m < cible) res = m;
  });
  return res;
}
function lireCache() {
  try {
    const brut = localStorage.getItem(CLE_CACHE);
    if (brut) {
      const o = JSON.parse(brut);
      if (o && o.raw) return o;
    }
    const ancien = localStorage.getItem(CLE_ANCIENNE);
    if (ancien) {
      const o = JSON.parse(ancien);
      if (o && o.raw && o.raw.finCategories) {
        return {
          raw: {
            finCategories: o.raw.finCategories,
            finArchives: o.raw.finArchives,
            finSoldes: o.raw.finSoldes,
            finDeclaration: o.raw.finDeclaration,
            finRevenus: o.raw.finRevenus
          },
          at: o.at
        };
      }
    }
  } catch (e) {/* stockage indisponible */}
  return null;
}
function ecrireCache(raw) {
  try {
    localStorage.setItem(CLE_CACHE, JSON.stringify({
      raw: raw,
      at: Date.now()
    }));
    localStorage.removeItem(CLE_ANCIENNE);
  } catch (e) {/* sans conséquence */}
}
async function apiGet() {
  const res = await fetch(API_URL + '?only=fin');
  const raw = await res.json();
  if (raw.error) throw new Error(raw.error);
  return {
    finCategories: raw.finCategories,
    finArchives: raw.finArchives,
    finSoldes: raw.finSoldes,
    finDeclaration: raw.finDeclaration,
    finRevenus: raw.finRevenus
  };
}
async function apiPost(action, payload) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify({
      action: action,
      payload: payload
    })
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Erreur inconnue');
  return json.result;
}

/* ---------- Virement vers l'Espagne ---------- */

function estLoyersFrance(nom) {
  return /loyer/i.test(nom) && /france/i.test(nom);
}
function CarteVirement({
  loyers,
  dep,
  compact
}) {
  const v = loyers - dep;
  return /*#__PURE__*/React.createElement("section", {
    className: compact ? 'virement compact' : 'carte virement',
    "aria-label": "Virement vers l'Espagne"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ligne-tete"
  }, /*#__PURE__*/React.createElement("span", {
    className: "v-titre"
  }, /*#__PURE__*/React.createElement(Ico, {
    d: I.fleche,
    size: 18,
    color: "var(--barOn)"
  }), " À virer en Espagne"), /*#__PURE__*/React.createElement("span", {
    className: "v-mt"
  }, v > 0 ? eur(v) : '0,00 €')), /*#__PURE__*/React.createElement("div", {
    className: "petit"
  }, "Loyers France ", eur(loyers), " − dépenses ", eur(dep), v < 0 ? ' : rien à virer, il manque ' + eur(-v) + ' en France.' : ''));
}

/* ---------- Icônes ---------- */

function Ico({
  d,
  size = 22,
  sw = 2,
  children,
  color = 'currentColor'
}) {
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: sw,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    style: {
      flexShrink: 0
    }
  }, d ? /*#__PURE__*/React.createElement("path", {
    d: d
  }) : children);
}
const I = {
  gauche: 'm15 6-6 6 6 6',
  droite: 'm9 6 6 6-6 6',
  croix: 'M6 6l12 12M18 6 6 18',
  plus: 'M12 5v14M5 12h14',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  oeil: 'M3 3l18 18M10.6 5.1A9.7 9.7 0 0 1 12 5c5 0 9 4.5 10 7-0.4 1-1.2 2.3-2.4 3.5M6.6 6.6C4.4 8 2.8 10.2 2 12c1 2.5 5 7 10 7 1.8 0 3.4-0.6 4.8-1.4',
  externe: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  lune: 'M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z',
  maison: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  histo: 'M3 20.5h18M6 17v-6M11 17V6M16 17v-4',
  doc: 'M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M9 13h6M9 17h6',
  fleche: 'M4 12h15M13 6l6 6-6 6'
};
function IcoMenu() {
  return /*#__PURE__*/React.createElement(Ico, {
    size: 20
  }, /*#__PURE__*/React.createElement("path", {
    d: "M4 7h16M4 12h16M4 17h16"
  }));
}
function IcoCal({
  size = 24
}) {
  return /*#__PURE__*/React.createElement(Ico, {
    size: size
  }, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "4.5",
    width: "18",
    height: "16",
    rx: "2.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3 9.5h18M8 3v3M16 3v3"
  }));
}
function IcoInfo({
  color
}) {
  return /*#__PURE__*/React.createElement(Ico, {
    size: 20,
    color: color
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 11v5M12 8h.01"
  }));
}
function IcoTableur() {
  return /*#__PURE__*/React.createElement(Ico, {
    color: "var(--barOn)"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "4",
    y: "3",
    width: "16",
    height: "18",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M4 9h16M4 15h16M10 9v12"
  }));
}
function IcoDoc() {
  return /*#__PURE__*/React.createElement(Ico, {
    color: "var(--barOn)"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M7 3h7l4 4v14H7z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M14 3v4h4M10 12h5M10 16h5"
  }));
}

/* ---------- Feuille (bottom sheet) ---------- */

function Feuille({
  onClose,
  fond,
  children,
  labelId
}) {
  const fermer = useRef(onClose);
  fermer.current = onClose;
  useEffect(() => {
    function k(e) {
      if (e.key === 'Escape') fermer.current();
    }
    window.addEventListener('keydown', k);
    const avant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', k);
      document.body.style.overflow = avant;
    };
  }, []);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "scrim",
    onClick: onClose
  }), /*#__PURE__*/React.createElement("div", {
    className: 'feuille' + (fond ? ' fond' : ''),
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": labelId,
    style: {
      left: 0,
      right: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "poignee"
  }), children));
}

/* ---------- Accueil (tableau de bord) ---------- */

function pct(v, dec) {
  return v.toLocaleString('fr-FR', {
    minimumFractionDigits: dec || 0,
    maximumFractionDigits: dec || 0
  }) + ' %';
}
function Ecart({
  actuel,
  avant,
  inverse
}) {
  // inverse : une hausse est défavorable (dépenses)
  if (!avant) return /*#__PURE__*/React.createElement("span", {
    className: "ecart neutre"
  }, "pas de comparaison");
  const diff = actuel - avant;
  if (Math.abs(diff) < 0.005) return /*#__PURE__*/React.createElement("span", {
    className: "ecart neutre"
  }, "= identique");
  const bon = inverse ? diff < 0 : diff > 0;
  return /*#__PURE__*/React.createElement("span", {
    className: 'ecart ' + (bon ? 'bon' : 'mauvais')
  }, diff > 0 ? '▲' : '▼', " ", eurSigne(diff), " (", diff > 0 ? '+' : '−', pct(Math.abs(diff) / avant * 100, Math.abs(diff) / avant < 0.1 ? 1 : 0), ")");
}
function Anneau({
  taux
}) {
  const R = 20,
    C = 2 * Math.PI * R;
  const t = Math.max(0, Math.min(1, taux));
  return /*#__PURE__*/React.createElement("svg", {
    width: "52",
    height: "52",
    viewBox: "0 0 52 52",
    "aria-hidden": "true",
    style: {
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "26",
    cy: "26",
    r: R,
    fill: "none",
    stroke: "var(--track)",
    strokeWidth: "6"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "26",
    cy: "26",
    r: R,
    fill: "none",
    stroke: "var(--ok)",
    strokeWidth: "6",
    strokeLinecap: "round",
    strokeDasharray: (t * C).toFixed(1) + ' ' + C.toFixed(1),
    transform: "rotate(-90 26 26)"
  }));
}
function CourbePatrimoine({
  d,
  total
}) {
  const mois = d.moisSoldes.slice(-12);
  if (mois.length < 2) return null;
  const vals = mois.map(total);
  const W = 320,
    H = 56,
    P = 5;
  const min = Math.min.apply(null, vals),
    max = Math.max.apply(null, vals);
  const amp = max - min || 1;
  const pts = vals.map((v, i) => [P + i * (W - 2 * P) / (vals.length - 1), H - P - (v - min) / amp * (H - 2 * P)]);
  const line = pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const dernier = pts[pts.length - 1];
  return /*#__PURE__*/React.createElement("div", {
    className: "courbe-pat"
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: '0 0 ' + W + ' ' + H,
    width: "100%",
    height: "56",
    preserveAspectRatio: "none",
    role: "img",
    "aria-label": 'Évolution du patrimoine de ' + moisLong(mois[0]) + ' à ' + moisLong(mois[mois.length - 1])
  }, /*#__PURE__*/React.createElement("polygon", {
    points: P + ',' + H + ' ' + line + ' ' + (W - P) + ',' + H,
    fill: "rgba(255,255,255,0.10)"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: line,
    fill: "none",
    stroke: "#FFFFFF",
    strokeWidth: "2.5",
    strokeLinejoin: "round",
    strokeLinecap: "round",
    vectorEffect: "non-scaling-stroke"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: dernier[0],
    cy: dernier[1],
    r: "4",
    fill: "#FFFFFF"
  })), /*#__PURE__*/React.createElement("div", {
    className: "axes"
  }, /*#__PURE__*/React.createElement("span", null, moisCourt(mois[0]), " ", mois[0].slice(2, 4)), /*#__PURE__*/React.createElement("span", null, moisCourt(mois[mois.length - 1]), " ", mois[mois.length - 1].slice(2, 4))));
}
function Comparaison({
  titre,
  actuel,
  avant,
  mActuel,
  mAvant,
  max,
  couleur,
  inverse
}) {
  const larg = v => Math.max(v > 0 ? 2 : 0, Math.round(v / max * 100)) + '%';
  return /*#__PURE__*/React.createElement("div", {
    className: "cmp"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ligne-tete"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cmp-titre"
  }, titre), /*#__PURE__*/React.createElement(Ecart, {
    actuel: actuel,
    avant: avant,
    inverse: inverse
  })), /*#__PURE__*/React.createElement("div", {
    className: "cmp-l"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cmp-m"
  }, capital(moisCourt(mActuel))), /*#__PURE__*/React.createElement("span", {
    className: "cmp-b"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: larg(actuel),
      background: couleur
    }
  })), /*#__PURE__*/React.createElement("span", {
    className: "cmp-v"
  }, eur(actuel))), /*#__PURE__*/React.createElement("div", {
    className: "cmp-l"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cmp-m"
  }, capital(moisCourt(mAvant))), /*#__PURE__*/React.createElement("span", {
    className: "cmp-b"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: larg(avant),
      background: couleur,
      opacity: 0.4
    }
  })), /*#__PURE__*/React.createElement("span", {
    className: "cmp-v doux"
  }, avant ? eur(avant) : '—')));
}
function PageAccueil({
  d,
  aujourdhui,
  onMenu,
  onGoMois,
  onGoHist,
  horsLigne
}) {
  const courant = ymDe(aujourdhui);
  const dateTxt = JOURS[aujourdhui.getDay()] + ' ' + aujourdhui.getDate() + ' ' + MOIS_L[aujourdhui.getMonth()];
  const mSoldes = d.moisSoldes.length ? d.moisSoldes[d.moisSoldes.length - 1] : null;
  const mPrecS = d.moisSoldes.length > 1 ? d.moisSoldes[d.moisSoldes.length - 2] : null;
  const total = m => Object.keys((d.parMois[m] || {}).soldes || {}).reduce((a, c) => a + d.parMois[m].soldes[c], 0);
  const courantSaisi = d.moisArch.indexOf(courant) >= 0;
  const passes = d.moisArch.filter(m => m <= courant);
  const M = passes.length ? passes[passes.length - 1] : null;
  const P = passes.length > 1 ? passes[passes.length - 2] : null;
  const f = M ? d.parMois[M] : null;
  const fp = P ? d.parMois[P] : null;
  const loyers = f ? Object.keys(f.cats).filter(estLoyersFrance).reduce((a, c) => a + f.cats[c], 0) : 0;
  const topDep = f ? Object.keys(f.cats).filter(c => (d.typeDe[c] || 'revenu') === 'depense' && f.cats[c] > 0).map(c => ({
    nom: c,
    v: f.cats[c]
  })).sort((a, b) => b.v - a.v) : [];
  const top5 = topDep.slice(0, 5);
  const autres = topDep.slice(5).reduce((a, c) => a + c.v, 0);
  const maxTop = top5.length ? top5[0].v : 1;
  const taux = f && f.rev > 0 && f.dep > 0 ? (f.rev - f.dep) / f.rev : null;
  const an = M ? M.slice(0, 4) : null;
  const moisAn = an ? d.moisArch.filter(m => m.slice(0, 4) === an && m <= courant) : [];
  const cumRev = moisAn.reduce((a, m) => a + d.parMois[m].rev, 0);
  const cumDep = moisAn.reduce((a, m) => a + d.parMois[m].dep, 0);
  const meilleur = moisAn.reduce((b, m) => !b || d.parMois[m].rev > d.parMois[b].rev ? m : b, null);
  const maxCmp = f ? Math.max(f.rev, f.dep, fp ? fp.rev : 0, fp ? fp.dep : 0, 1) : 1;
  return /*#__PURE__*/React.createElement("div", {
    className: "page"
  }, /*#__PURE__*/React.createElement("header", {
    className: "entete"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "date"
  }, dateTxt), /*#__PURE__*/React.createElement("h1", null, "Comptes")), /*#__PURE__*/React.createElement("button", {
    className: "rond",
    onClick: onMenu,
    "aria-label": "Ouvrir le menu"
  }, /*#__PURE__*/React.createElement(IcoMenu, null))), horsLigne && /*#__PURE__*/React.createElement("div", {
    className: "hors-ligne"
  }, horsLigne), !courantSaisi && /*#__PURE__*/React.createElement("section", {
    className: "rappel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "txt"
  }, /*#__PURE__*/React.createElement("strong", null, moisTitre(courant), " à saisir"), /*#__PURE__*/React.createElement("span", null, dernierAvant(d, courant) ? 'Montants de ' + moisNom(dernierAvant(d, courant)) + ' repris, à vérifier.' : 'Revenus, dépenses et soldes.')), /*#__PURE__*/React.createElement("button", {
    onClick: () => onGoMois(courant)
  }, "Saisir")), /*#__PURE__*/React.createElement("section", {
    className: "hero",
    "aria-label": "Patrimoine"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ligne-tete"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lib"
  }, "Patrimoine total"), mSoldes && /*#__PURE__*/React.createElement("span", {
    className: "pill"
  }, "au ", finDeMois(mSoldes))), mSoldes ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "total"
  }, eur(total(mSoldes))), mPrecS && /*#__PURE__*/React.createElement("div", {
    className: "varia"
  }, eurSigne(total(mSoldes) - total(mPrecS)), " depuis fin ", moisNom(mPrecS)), /*#__PURE__*/React.createElement(CourbePatrimoine, {
    d: d,
    total: total
  }), /*#__PURE__*/React.createElement("div", {
    className: "comptes"
  }, COMPTES.map(c => /*#__PURE__*/React.createElement("div", {
    className: "compte",
    key: c
  }, /*#__PURE__*/React.createElement("span", null, c), /*#__PURE__*/React.createElement("span", null, eur((d.parMois[mSoldes].soldes || {})[c] || 0)))))) : /*#__PURE__*/React.createElement("div", {
    className: "vide"
  }, "Aucun solde saisi pour l'instant. Renseigne tes comptes dans l'onglet Mois pour suivre ton patrimoine.")), f && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "section-tete",
    style: {
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("h2", null, moisTitre(M)), /*#__PURE__*/React.createElement("button", {
    className: "lien",
    style: {
      minHeight: 0
    },
    onClick: () => onGoMois(M)
  }, "Modifier")), /*#__PURE__*/React.createElement("div", {
    className: "tuiles"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tuile"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lib"
  }, "Revenus"), /*#__PURE__*/React.createElement("span", {
    className: "val c-rev"
  }, eur(f.rev))), /*#__PURE__*/React.createElement("div", {
    className: "tuile"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lib"
  }, "Dépenses"), /*#__PURE__*/React.createElement("span", {
    className: "val c-dep"
  }, f.dep ? eur(f.dep) : '—'), !f.dep && /*#__PURE__*/React.createElement("span", {
    className: "sous"
  }, "non saisies")), /*#__PURE__*/React.createElement("div", {
    className: "tuile"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lib"
  }, "Solde du mois"), /*#__PURE__*/React.createElement("span", {
    className: "val"
  }, eurSigne(f.rev - f.dep)), /*#__PURE__*/React.createElement("span", {
    className: "sous"
  }, "revenus − dépenses")), /*#__PURE__*/React.createElement("div", {
    className: "tuile rang-anneau"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "lib"
  }, "Taux d'épargne"), /*#__PURE__*/React.createElement("span", {
    className: "val"
  }, taux === null ? '—' : pct(Math.round(taux * 100))), /*#__PURE__*/React.createElement("span", {
    className: "sous"
  }, taux === null ? 'dépenses à saisir' : 'des revenus gardés')), taux !== null && /*#__PURE__*/React.createElement(Anneau, {
    taux: taux
  }))), /*#__PURE__*/React.createElement(CarteVirement, {
    loyers: loyers,
    dep: f.dep
  }), fp && /*#__PURE__*/React.createElement("section", {
    className: "carte bloc"
  }, /*#__PURE__*/React.createElement("h2", null, capital(moisNom(M)), " face à ", moisNom(P)), /*#__PURE__*/React.createElement(Comparaison, {
    titre: "Revenus",
    actuel: f.rev,
    avant: fp.rev,
    mActuel: M,
    mAvant: P,
    max: maxCmp,
    couleur: "var(--rev)"
  }), /*#__PURE__*/React.createElement(Comparaison, {
    titre: "Dépenses",
    actuel: f.dep,
    avant: fp.dep,
    mActuel: M,
    mAvant: P,
    max: maxCmp,
    couleur: "var(--dep)",
    inverse: true
  })), top5.length > 0 && /*#__PURE__*/React.createElement("section", {
    className: "carte bloc"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ligne-tete"
  }, /*#__PURE__*/React.createElement("h2", null, "Principales dépenses"), /*#__PURE__*/React.createElement("span", {
    className: "petit"
  }, capital(moisNom(M)))), /*#__PURE__*/React.createElement("div", {
    className: "top"
  }, top5.map(c => /*#__PURE__*/React.createElement("div", {
    className: "top-l",
    key: c.nom
  }, /*#__PURE__*/React.createElement("div", {
    className: "ligne-tete"
  }, /*#__PURE__*/React.createElement("span", {
    className: "top-n"
  }, estPonctuel(c.nom) ? c.nom.slice(PREFIXE_PONCT.length) : c.nom, estPonctuel(c.nom) && /*#__PURE__*/React.createElement("span", {
    className: "tag-ponct",
    style: {
      marginLeft: 8
    }
  }, "ponctuel")), /*#__PURE__*/React.createElement("span", {
    className: "top-v"
  }, eur(c.v))), /*#__PURE__*/React.createElement("span", {
    className: "top-b"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: Math.max(2, Math.round(c.v / maxTop * 100)) + '%'
    }
  })))), autres > 0 && /*#__PURE__*/React.createElement("div", {
    className: "petit"
  }, "Autres lignes : ", eur(autres)))), /*#__PURE__*/React.createElement("section", {
    className: "carte bloc"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ligne-tete"
  }, /*#__PURE__*/React.createElement("h2", null, "Année ", an), /*#__PURE__*/React.createElement("span", {
    className: "petit"
  }, moisAn.length, " mois saisi", moisAn.length > 1 ? 's' : '')), /*#__PURE__*/React.createElement("div", {
    className: "grille2"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "lib"
  }, "Revenus cumulés"), /*#__PURE__*/React.createElement("div", {
    className: "val c-rev"
  }, eur(cumRev))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "lib"
  }, "Dépenses cumulées"), /*#__PURE__*/React.createElement("div", {
    className: "val c-dep"
  }, cumDep ? eur(cumDep) : '—')), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "lib"
  }, "Revenu mensuel moyen"), /*#__PURE__*/React.createElement("div", {
    className: "val"
  }, eur(moisAn.length ? cumRev / moisAn.length : 0))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "lib"
  }, "Meilleur mois"), /*#__PURE__*/React.createElement("div", {
    className: "val"
  }, meilleur ? capital(moisNom(meilleur)) : '—'), /*#__PURE__*/React.createElement("div", {
    className: "sous"
  }, meilleur ? eur(d.parMois[meilleur].rev) : ''))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("button", {
    className: "lien",
    onClick: onGoHist
  }, "Voir l'historique ", /*#__PURE__*/React.createElement(Ico, {
    d: I.droite,
    size: 16
  }))))));
}

/* ---------- Mois ---------- */

function PageMois({
  d,
  mois,
  changerMois,
  dirty,
  setDirty,
  recharger,
  notifier
}) {
  const actives = d.cats.filter(c => c.actif);
  const revenus = actives.filter(c => c.type === 'revenu');
  const depenses = actives.filter(c => c.type === 'depense');
  const [vals, setVals] = useState({});
  const [sold, setSold] = useState({});
  const [reconduit, setReconduit] = useState(null);
  const [edit, setEdit] = useState(null);
  const [ajout, setAjout] = useState(null);
  const [ponct, setPonct] = useState([]);
  const [editPonct, setEditPonct] = useState(null);
  const [saving, setSaving] = useState(false);
  const etat = useRef({
    mois: null,
    dirty: false
  });
  etat.current.dirty = dirty;
  const aDesDonnees = !!d.parMois[mois];
  const source = dernierAvant(d, mois);
  function valeursDe(m) {
    const v = {};
    actives.forEach(c => {
      v[c.nom] = '';
    });
    d.arch.filter(a => a.mois === m).forEach(a => {
      if (a.categorie in v) v[a.categorie] = a.montant;
    });
    const s = {};
    COMPTES.forEach(c => {
      s[c] = '';
    });
    d.sold.filter(x => x.mois === m).forEach(x => {
      if (x.compte in s) s[x.compte] = x.montant;
    });
    return {
      v,
      s
    };
  }
  useEffect(() => {
    const memeMois = etat.current.mois === mois;
    etat.current.mois = mois;
    if (memeMois && etat.current.dirty) {
      // Données rafraîchies pendant une saisie : on garde la saisie, on ajoute les nouvelles lignes
      setVals(old => {
        const n = {};
        actives.forEach(c => {
          n[c.nom] = c.nom in old ? old[c.nom] : '';
        });
        return n;
      });
      return;
    }
    // Les dépenses ponctuelles ne sont jamais reconduites
    setPonct(d.arch.filter(x => x.mois === mois && estPonctuel(x.categorie)).map((x, i) => ({
      id: 'p' + i,
      nom: x.categorie.slice(PREFIXE_PONCT.length),
      montant: x.montant
    })));
    if (aDesDonnees || !source) {
      const r = valeursDe(mois);
      setVals(r.v);
      setSold(r.s);
      setReconduit(null);
    } else {
      const r = valeursDe(source);
      setVals(r.v);
      setSold(r.s);
      setReconduit(source);
    }
  }, [mois, d]);
  const totRev = revenus.reduce((a, c) => a + num(vals[c.nom]), 0);
  const totPonct = ponct.reduce((a, p) => a + num(p.montant), 0);
  const totDep = depenses.reduce((a, c) => a + num(vals[c.nom]), 0) + totPonct;
  const loyersFr = revenus.filter(c => estLoyersFrance(c.nom)).reduce((a, c) => a + num(vals[c.nom]), 0);
  const soldesRemplis = COMPTES.some(c => !vide(sold[c]));
  const patrimoine = COMPTES.reduce((a, c) => a + num(sold[c]), 0);
  function repartirDeZero() {
    const v = {};
    actives.forEach(c => {
      v[c.nom] = '';
    });
    const s = {};
    COMPTES.forEach(c => {
      s[c] = '';
    });
    setVals(v);
    setSold(s);
    setPonct([]);
    setReconduit(null);
    setDirty(true);
  }
  function validerPonct(p) {
    setPonct(l => l.some(x => x.id === p.id) ? l.map(x => x.id === p.id ? p : x) : l.concat([p]));
    setDirty(true);
    setEditPonct(null);
  }
  function supprimerPonct(id) {
    setPonct(l => l.filter(x => x.id !== id));
    setDirty(true);
    setEditPonct(null);
  }
  function reference(e) {
    if (!source) return null;
    if (e.kind === 'compte') {
      const x = d.sold.find(s => s.mois === source && s.compte === e.nom);
      return x ? x.montant : null;
    }
    return d.parMois[source] && d.parMois[source].cats[e.nom] || null;
  }
  function valider(valeur) {
    if (edit.kind === 'compte') setSold(s => Object.assign({}, s, {
      [edit.nom]: valeur
    }));else setVals(v => Object.assign({}, v, {
      [edit.nom]: valeur
    }));
    setDirty(true);
    setEdit(null);
  }
  async function enregistrer() {
    setSaving(true);
    try {
      const lignes = actives.map(c => ({
        categorie: c.nom,
        montant: num(vals[c.nom])
      }));
      // Conserve les montants déjà enregistrés des lignes masquées ou inconnues
      ponct.filter(p => p.nom.trim() && num(p.montant) !== 0).forEach(p => lignes.push({
        categorie: PREFIXE_PONCT + p.nom.trim(),
        montant: num(p.montant)
      }));
      d.arch.filter(a => a.mois === mois && !estPonctuel(a.categorie) && !actives.some(c => c.nom === a.categorie)).forEach(a => lignes.push({
        categorie: a.categorie,
        montant: a.montant
      }));
      await apiPost('saveArchives', {
        mois: mois,
        lignes: lignes
      });
      await apiPost('saveSoldes', {
        mois: mois,
        soldes: COMPTES.filter(c => !vide(sold[c])).map(c => ({
          compte: c,
          montant: num(sold[c])
        }))
      });
      setDirty(false);
      etat.current.dirty = false;
      setReconduit(null);
      notifier(capital(moisLong(mois)) + ' enregistré');
      await recharger(true);
    } catch (e) {
      notifier('Échec de l\'enregistrement : ' + e.message, true);
    } finally {
      setSaving(false);
    }
  }
  async function sauverCategories(liste, msg) {
    setSaving(true);
    try {
      await apiPost('saveCategories', {
        categories: liste
      });
      notifier(msg);
      await recharger(true);
    } catch (e) {
      notifier('Échec : ' + e.message, true);
    } finally {
      setSaving(false);
    }
  }
  function masquer(nom) {
    const aHisto = d.arch.some(a => a.categorie === nom && a.montant !== 0);
    const q = aHisto ? 'Masquer « ' + nom + ' » ?\n\nLes montants déjà enregistrés restent dans l\'historique. Tu pourras la réafficher depuis le menu.' : 'Supprimer « ' + nom + ' » ? Elle n\'a encore aucun montant enregistré.';
    if (!window.confirm(q)) return;
    setEdit(null);
    const liste = aHisto ? d.cats.map(c => c.nom === nom ? Object.assign({}, c, {
      actif: false
    }) : c) : d.cats.filter(c => c.nom !== nom);
    sauverCategories(liste, aHisto ? 'Ligne masquée' : 'Ligne supprimée');
  }
  function ajouter(nom, type) {
    const n = nom.trim();
    if (!n) return;
    if (d.cats.some(c => c.nom.toLowerCase() === n.toLowerCase())) {
      const ex = d.cats.find(c => c.nom.toLowerCase() === n.toLowerCase());
      if (ex.actif) {
        notifier('Cette ligne existe déjà', true);
        return;
      }
      setAjout(null);
      sauverCategories(d.cats.map(c => c === ex ? Object.assign({}, c, {
        actif: true
      }) : c), 'Ligne réaffichée');
      return;
    }
    setAjout(null);
    sauverCategories(d.cats.concat([{
      nom: n,
      type: type,
      actif: true
    }]), 'Ligne ajoutée');
  }
  const aEnregistrer = dirty || !!reconduit;
  let etatTxt = 'Aucune donnée',
    etatCls = '';
  if (saving) {
    etatTxt = 'Enregistrement…';
  } else if (dirty) {
    etatTxt = 'Brouillon non enregistré';
    etatCls = 'attente';
  } else if (reconduit) {
    etatTxt = 'Pré-rempli, non enregistré';
    etatCls = 'attente';
  } else if (aDesDonnees) {
    etatTxt = 'Enregistré';
    etatCls = 'ok';
  }
  function Rang({
    key,
    nom,
    valeur,
    couleur,
    rond,
    onClick,
    premier
  }) {
    return /*#__PURE__*/React.createElement("button", {
      key: key,
      className: "rang",
      onClick: onClick,
      style: premier ? {
        borderTop: 'none'
      } : null
    }, /*#__PURE__*/React.createElement("span", {
      className: "pt",
      style: {
        background: couleur,
        borderRadius: rond ? 5 : 3
      }
    }), /*#__PURE__*/React.createElement("span", {
      className: "nom"
    }, nom), /*#__PURE__*/React.createElement("span", {
      className: 'mt' + (vide(valeur) ? ' vide' : '')
    }, vide(valeur) ? '—' : eur(num(valeur))), /*#__PURE__*/React.createElement(Ico, {
      d: I.droite,
      size: 18,
      color: "var(--ink4)"
    }));
  }
  function Section({
    titre,
    total,
    cls,
    liste,
    type,
    couleur
  }) {
    return /*#__PURE__*/React.createElement("div", {
      className: "section"
    }, /*#__PURE__*/React.createElement("div", {
      className: "section-tete"
    }, /*#__PURE__*/React.createElement("h2", null, titre), /*#__PURE__*/React.createElement("span", {
      className: cls
    }, eur(total))), /*#__PURE__*/React.createElement("div", {
      className: "liste"
    }, liste.map((c, i) => Rang({
      key: c.nom,
      nom: c.nom,
      valeur: vals[c.nom],
      couleur: couleur,
      premier: i === 0,
      onClick: () => setEdit({
        kind: 'cat',
        nom: c.nom,
        type: c.type
      })
    })), type === 'depense' && ponct.map((p, i) => /*#__PURE__*/React.createElement("button", {
      key: p.id,
      className: "rang",
      onClick: () => setEditPonct(p),
      style: !liste.length && i === 0 ? {
        borderTop: 'none'
      } : null
    }, /*#__PURE__*/React.createElement("span", {
      className: "pt",
      style: {
        background: 'var(--dep2)'
      }
    }), /*#__PURE__*/React.createElement("span", {
      className: "nom"
    }, p.nom), /*#__PURE__*/React.createElement("span", {
      className: "tag-ponct"
    }, "ponctuel"), /*#__PURE__*/React.createElement("span", {
      className: "mt"
    }, eur(num(p.montant))), /*#__PURE__*/React.createElement(Ico, {
      d: I.droite,
      size: 18,
      color: "var(--ink4)"
    }))), /*#__PURE__*/React.createElement("button", {
      className: "rang ajout",
      onClick: () => setAjout(type),
      style: liste.length || type === 'depense' && ponct.length ? null : {
        borderTop: 'none'
      }
    }, /*#__PURE__*/React.createElement(Ico, {
      d: I.plus,
      size: 18,
      sw: 2.2
    }), "Ajouter une ligne"), type === 'depense' && /*#__PURE__*/React.createElement("button", {
      className: "rang ajout",
      onClick: () => setEditPonct({
        id: 'n' + Date.now(),
        nom: '',
        montant: '',
        nouveau: true
      })
    }, /*#__PURE__*/React.createElement(Ico, {
      d: I.plus,
      size: 18,
      sw: 2.2
    }), "Dépense ponctuelle")));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "page avec-barre"
  }, /*#__PURE__*/React.createElement("div", {
    className: "nav-mois"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => changerMois(ymAjoute(mois, -1)),
    "aria-label": "Mois précédent"
  }, /*#__PURE__*/React.createElement(Ico, {
    d: I.gauche,
    sw: 2.2
  })), /*#__PURE__*/React.createElement("div", {
    className: "centre"
  }, /*#__PURE__*/React.createElement("h1", null, moisTitre(mois)), /*#__PURE__*/React.createElement("span", {
    className: 'etat ' + etatCls
  }, etatTxt)), /*#__PURE__*/React.createElement("button", {
    onClick: () => changerMois(ymAjoute(mois, 1)),
    "aria-label": "Mois suivant"
  }, /*#__PURE__*/React.createElement(Ico, {
    d: I.droite,
    sw: 2.2
  }))), reconduit && /*#__PURE__*/React.createElement("div", {
    className: "bandeau info"
  }, /*#__PURE__*/React.createElement(Ico, {
    d: I.refresh,
    size: 20
  }), /*#__PURE__*/React.createElement("span", {
    className: "txt"
  }, "Montants reconduits depuis ", /*#__PURE__*/React.createElement("strong", null, moisLong(reconduit)), ". Vérifie-les puis enregistre."), /*#__PURE__*/React.createElement("button", {
    className: "mini",
    onClick: repartirDeZero
  }, "Repartir de zéro")), /*#__PURE__*/React.createElement("div", {
    className: "carte trio",
    style: {
      padding: '14px 16px'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "lib"
  }, "Revenus"), /*#__PURE__*/React.createElement("div", {
    className: "val c-rev"
  }, eur(totRev))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "lib"
  }, "Dépenses"), /*#__PURE__*/React.createElement("div", {
    className: "val c-dep"
  }, eur(totDep))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "lib"
  }, "Solde"), /*#__PURE__*/React.createElement("div", {
    className: "val"
  }, eurSigne(totRev - totDep)))), /*#__PURE__*/React.createElement(CarteVirement, {
    loyers: loyersFr,
    dep: totDep
  }), Section({
    titre: 'Revenus',
    total: totRev,
    cls: 'c-rev',
    liste: revenus,
    type: 'revenu',
    couleur: 'var(--rev)'
  }), Section({
    titre: 'Dépenses',
    total: totDep,
    cls: 'c-dep',
    liste: depenses,
    type: 'depense',
    couleur: 'var(--dep)'
  }), /*#__PURE__*/React.createElement("div", {
    className: "section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-tete"
  }, /*#__PURE__*/React.createElement("h2", null, "Comptes · fin de mois"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--barOn)'
    }
  }, soldesRemplis ? eur(patrimoine) : '—')), /*#__PURE__*/React.createElement("div", {
    className: "liste"
  }, COMPTES.map((c, i) => Rang({
    key: c,
    nom: c,
    valeur: sold[c],
    couleur: 'var(--hero)',
    rond: true,
    premier: i === 0,
    onClick: () => setEdit({
      kind: 'compte',
      nom: c
    })
  })))), /*#__PURE__*/React.createElement("div", {
    className: "barre-save"
  }, /*#__PURE__*/React.createElement("div", {
    className: "in"
  }, /*#__PURE__*/React.createElement("button", {
    className: "bouton",
    onClick: enregistrer,
    disabled: saving || !aEnregistrer
  }, /*#__PURE__*/React.createElement(Ico, {
    d: saving ? I.refresh : I.check,
    size: 18,
    sw: 2.4
  }), saving ? 'Enregistrement…' : aEnregistrer ? 'Enregistrer ' + moisNom(mois) : capital(moisNom(mois)) + ' enregistré'))), edit && /*#__PURE__*/React.createElement(FeuilleSaisie, {
    edit: edit,
    mois: mois,
    valeur: edit.kind === 'compte' ? sold[edit.nom] : vals[edit.nom],
    reference: reference(edit),
    source: source,
    onClose: () => setEdit(null),
    onValider: valider,
    onMasquer: edit.kind === 'cat' ? () => masquer(edit.nom) : null
  }), editPonct && /*#__PURE__*/React.createElement(FeuillePonctuel, {
    p: editPonct,
    mois: mois,
    onClose: () => setEditPonct(null),
    onValider: validerPonct,
    onSupprimer: editPonct.nouveau ? null : () => supprimerPonct(editPonct.id)
  }), ajout && /*#__PURE__*/React.createElement(FeuilleAjout, {
    type: ajout,
    onClose: () => setAjout(null),
    onAjouter: ajouter
  }));
}
function FeuilleSaisie({
  edit,
  mois,
  valeur,
  reference,
  source,
  onClose,
  onValider,
  onMasquer
}) {
  const [txt, setTxt] = useState(pourSaisie(valeur));
  const ref = useRef(null);
  useEffect(() => {
    const t = setTimeout(() => {
      if (ref.current) {
        ref.current.focus();
        ref.current.select();
      }
    }, 60);
    return () => clearTimeout(t);
  }, []);
  const sous = edit.kind === 'compte' ? 'Solde au ' + finDeMois(mois) + ' ' + mois.slice(0, 4) : (edit.type === 'depense' ? 'Dépense' : 'Revenu') + ' · ' + moisLong(mois);
  function ok() {
    onValider(txt.trim() === '' ? '' : txt.trim());
  }
  return /*#__PURE__*/React.createElement(Feuille, {
    onClose: onClose,
    labelId: "titre-saisie"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ligne-tete",
    style: {
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("h2", {
    id: "titre-saisie"
  }, edit.nom), /*#__PURE__*/React.createElement("span", {
    className: "petit"
  }, sous)), /*#__PURE__*/React.createElement("button", {
    className: "rond",
    style: {
      background: 'var(--surface2)',
      border: 'none'
    },
    onClick: onClose,
    "aria-label": "Fermer"
  }, /*#__PURE__*/React.createElement(Ico, {
    d: I.croix,
    size: 18,
    sw: 2.2
  }))), /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      ok();
    },
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: "montant",
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--ink2)'
    }
  }, "Montant"), /*#__PURE__*/React.createElement("div", {
    className: "champ"
  }, /*#__PURE__*/React.createElement("input", {
    id: "montant",
    ref: ref,
    type: "text",
    inputMode: "decimal",
    autoComplete: "off",
    enterKeyHint: "done",
    value: txt,
    onChange: e => setTxt(nettoyer(e.target.value)),
    placeholder: "0,00"
  }), /*#__PURE__*/React.createElement("span", {
    className: "eur"
  }, "€"))), /*#__PURE__*/React.createElement("div", {
    className: "chips"
  }, reference !== null && reference !== undefined && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setTxt(pourSaisie(reference))
  }, "Comme ", moisNom(source), " · ", eur(reference)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setTxt('0,00')
  }, "Mettre à 0"), txt !== '' && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setTxt('')
  }, "Effacer")), /*#__PURE__*/React.createElement("div", {
    className: "deux"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "bouton second",
    onClick: onClose
  }, "Annuler"), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "bouton"
  }, "Valider"))), onMasquer && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "sep"
  }), /*#__PURE__*/React.createElement("button", {
    className: "masquer",
    onClick: onMasquer
  }, /*#__PURE__*/React.createElement(Ico, {
    d: I.oeil,
    size: 20
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 700
    }
  }, "Masquer cette ligne"), /*#__PURE__*/React.createElement("span", {
    className: "petit",
    style: {
      fontSize: 12
    }
  }, "Les montants déjà enregistrés restent dans l'historique.")))));
}
function FeuillePonctuel({
  p,
  mois,
  onClose,
  onValider,
  onSupprimer
}) {
  const [nom, setNom] = useState(p.nom);
  const [txt, setTxt] = useState(pourSaisie(p.montant));
  const refNom = useRef(null),
    refMt = useRef(null);
  useEffect(() => {
    const t = setTimeout(() => {
      const el = p.nouveau ? refNom.current : refMt.current;
      if (el) {
        el.focus();
        if (!p.nouveau) el.select();
      }
    }, 60);
    return () => clearTimeout(t);
  }, []);
  const ok = nom.trim() && num(txt) !== 0;
  return /*#__PURE__*/React.createElement(Feuille, {
    onClose: onClose,
    labelId: "titre-ponct"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ligne-tete",
    style: {
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("h2", {
    id: "titre-ponct"
  }, p.nouveau ? 'Dépense ponctuelle' : p.nom), /*#__PURE__*/React.createElement("span", {
    className: "petit"
  }, "Uniquement en ", moisLong(mois), " · non reconduite")), /*#__PURE__*/React.createElement("button", {
    className: "rond",
    style: {
      background: 'var(--surface2)',
      border: 'none'
    },
    onClick: onClose,
    "aria-label": "Fermer"
  }, /*#__PURE__*/React.createElement(Ico, {
    d: I.croix,
    size: 18,
    sw: 2.2
  }))), /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      if (ok) onValider({
        id: p.id,
        nom: nom.trim(),
        montant: txt.trim()
      });
    },
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: "nom-ponct",
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--ink2)'
    }
  }, "Libellé"), /*#__PURE__*/React.createElement("input", {
    id: "nom-ponct",
    ref: refNom,
    className: "champ-texte",
    value: nom,
    onChange: e => setNom(e.target.value),
    placeholder: "Ex. : Plomberie",
    autoComplete: "off"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: "mt-ponct",
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--ink2)'
    }
  }, "Montant"), /*#__PURE__*/React.createElement("div", {
    className: "champ"
  }, /*#__PURE__*/React.createElement("input", {
    id: "mt-ponct",
    ref: refMt,
    type: "text",
    inputMode: "decimal",
    autoComplete: "off",
    enterKeyHint: "done",
    value: txt,
    onChange: e => setTxt(nettoyer(e.target.value)),
    placeholder: "0,00"
  }), /*#__PURE__*/React.createElement("span", {
    className: "eur"
  }, "€"))), /*#__PURE__*/React.createElement("div", {
    className: "deux"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "bouton second",
    onClick: onClose
  }, "Annuler"), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "bouton",
    disabled: !ok
  }, "Valider"))), onSupprimer && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "sep"
  }), /*#__PURE__*/React.createElement("button", {
    className: "masquer",
    onClick: onSupprimer
  }, /*#__PURE__*/React.createElement(Ico, {
    d: I.croix,
    size: 20
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 700
    }
  }, "Supprimer cette dépense"))));
}
function FeuilleAjout({
  type,
  onClose,
  onAjouter
}) {
  const [nom, setNom] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    const t = setTimeout(() => ref.current && ref.current.focus(), 60);
    return () => clearTimeout(t);
  }, []);
  return /*#__PURE__*/React.createElement(Feuille, {
    onClose: onClose,
    labelId: "titre-ajout"
  }, /*#__PURE__*/React.createElement("h2", {
    id: "titre-ajout"
  }, type === 'depense' ? 'Nouvelle dépense' : 'Nouveau revenu'), /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      onAjouter(nom, type);
    },
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: "nom-ligne",
    className: "petit",
    style: {
      fontWeight: 600,
      color: 'var(--ink2)'
    }
  }, "Nom de la ligne"), /*#__PURE__*/React.createElement("input", {
    id: "nom-ligne",
    ref: ref,
    className: "champ-texte",
    value: nom,
    onChange: e => setNom(e.target.value),
    placeholder: type === 'depense' ? 'Ex. : Assurance habitation' : 'Ex. : Salaire lycée',
    autoComplete: "off"
  }), /*#__PURE__*/React.createElement("div", {
    className: "deux"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "bouton second",
    onClick: onClose
  }, "Annuler"), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "bouton",
    disabled: !nom.trim()
  }, "Ajouter"))));
}

/* ---------- Historique ---------- */

function PageHistorique({
  d,
  onGoMois
}) {
  const [vue, setVue] = useState('mois');
  const [filtre, setFiltre] = useState('rev');
  const [sel, setSel] = useState(null);
  const [selY, setSelY] = useState(null);
  if (!d.moisArch.length) {
    return /*#__PURE__*/React.createElement("div", {
      className: "page"
    }, /*#__PURE__*/React.createElement("header", {
      className: "entete"
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", null, "Historique"))), /*#__PURE__*/React.createElement("div", {
      className: "carte petit"
    }, "Aucun mois enregistré pour l'instant."));
  }

  // Mois continus du premier au dernier mois saisi
  const premier = d.moisArch[0],
    dernier = d.moisArch[d.moisArch.length - 1];
  const tous = [];
  for (let m = premier; m <= dernier; m = ymAjoute(m, 1)) tous.push(m);
  const catsRev = Array.from(new Set(d.arch.filter(a => (d.typeDe[a.categorie] || 'revenu') === 'revenu' && a.montant).map(a => a.categorie)));
  const aDepenses = d.arch.some(a => d.typeDe[a.categorie] === 'depense' && a.montant);
  const filtres = [['rev', 'Tous revenus']].concat(catsRev.map(c => [c, c]));
  if (aDepenses) filtres.push(['dep', 'Dépenses']);
  const f = filtres.some(x => x[0] === filtre) ? filtre : 'rev';
  const nomFiltre = f === 'rev' ? 'Revenus' : f === 'dep' ? 'Dépenses' : f;
  const val = m => {
    const p = d.parMois[m];
    if (!p) return 0;
    if (f === 'rev') return p.rev;
    if (f === 'dep') return p.dep;
    return p.cats[f] || 0;
  };
  const visibles = tous.slice(-24);
  const iSel = sel !== null && sel < visibles.length ? sel : visibles.length - 1;
  const max = Math.max.apply(null, tous.map(val).concat([1]));
  const annees = Array.from(new Set(tous.map(m => m.slice(0, 4))));
  const parAn = annees.map(y => {
    const ms = tous.filter(m => m.slice(0, 4) === y);
    const saisis = ms.filter(m => d.moisArch.indexOf(m) >= 0);
    return {
      y,
      tot: ms.reduce((a, m) => a + val(m), 0),
      n: saisis.length
    };
  });
  const yCourant = selY && annees.indexOf(selY) >= 0 ? selY : annees[annees.length - 1];
  const aSel = parAn.find(a => a.y === yCourant);
  const maxY = Math.max.apply(null, parAn.map(a => a.tot).concat([1]));
  const groupesAn = [];
  visibles.forEach(m => {
    const y = m.slice(0, 4);
    const g = groupesAn[groupesAn.length - 1];
    if (g && g.y === y) g.n++;else groupesAn.push({
      y,
      n: 1
    });
  });
  const premiereDep = d.moisArch.find(m => d.parMois[m].dep > 0);
  const avertissement = !premiereDep ? 'Aucune dépense n\'a encore été saisie : les soldes mensuels ne tiennent compte que des revenus.' : premiereDep > premier ? 'Avant ' + moisLong(premiereDep) + ', seuls les revenus ont été importés. Les soldes de cette période n\'incluent donc aucune dépense.' : null;
  return /*#__PURE__*/React.createElement("div", {
    className: "page"
  }, /*#__PURE__*/React.createElement("header", {
    className: "entete"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", null, "Historique"))), /*#__PURE__*/React.createElement("div", {
    className: "seg",
    role: "group",
    "aria-label": "Période"
  }, /*#__PURE__*/React.createElement("button", {
    "aria-pressed": vue === 'mois',
    onClick: () => setVue('mois')
  }, "Par mois"), /*#__PURE__*/React.createElement("button", {
    "aria-pressed": vue === 'annee',
    onClick: () => setVue('annee')
  }, "Par année")), avertissement && /*#__PURE__*/React.createElement("div", {
    className: "bandeau warn"
  }, /*#__PURE__*/React.createElement(IcoInfo, {
    color: "var(--warnInk)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "txt"
  }, avertissement)), /*#__PURE__*/React.createElement("section", {
    className: "carte",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "sur-titre"
  }, nomFiltre, " · ", vue === 'mois' ? 'par mois' : 'par année'), /*#__PURE__*/React.createElement("span", {
    className: "petit",
    style: {
      color: 'var(--ink2)'
    }
  }, vue === 'mois' ? capital(moisLong(visibles[iSel])) : yCourant + (aSel.n < 12 ? ' · ' + aSel.n + ' mois saisis' : '')), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 26,
      fontWeight: 800,
      letterSpacing: '-0.01em',
      color: 'var(--barOn)'
    }
  }, eur(vue === 'mois' ? val(visibles[iSel]) : aSel.tot))), vue === 'mois' ? /*#__PURE__*/React.createElement("div", {
    "data-noswipe": "1",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "barres"
  }, visibles.map((m, i) => /*#__PURE__*/React.createElement("button", {
    key: m,
    "aria-pressed": i === iSel,
    "aria-label": moisLong(m) + ', ' + eur(val(m)),
    onClick: () => setSel(i)
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      height: Math.max(3, Math.round(val(m) / max * 146))
    }
  })))), /*#__PURE__*/React.createElement("div", {
    className: "annees"
  }, groupesAn.map(g => /*#__PURE__*/React.createElement("span", {
    key: g.y,
    style: {
      flex: g.n + ' 1 0'
    }
  }, g.n >= 2 ? g.y : '')))) : /*#__PURE__*/React.createElement("div", {
    className: "barres-an",
    "data-noswipe": "1"
  }, parAn.map(a => /*#__PURE__*/React.createElement("button", {
    key: a.y,
    "aria-pressed": a.y === yCourant,
    "aria-label": a.y + ', ' + eur(a.tot),
    onClick: () => setSelY(a.y)
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: 'center'
    }
  }, a.y), /*#__PURE__*/React.createElement("span", {
    className: "b",
    style: {
      height: Math.max(3, Math.round(a.tot / maxY * 150))
    }
  })))), /*#__PURE__*/React.createElement("div", {
    className: "chips",
    role: "group",
    "aria-label": "Filtrer"
  }, filtres.map(x => /*#__PURE__*/React.createElement("button", {
    key: x[0],
    "aria-pressed": x[0] === f,
    onClick: () => setFiltre(x[0])
  }, x[1])))), vue === 'mois' ? annees.slice().reverse().map(y => {
    const ms = tous.filter(m => m.slice(0, 4) === y).reverse();
    return /*#__PURE__*/React.createElement("div", {
      className: "section",
      key: y
    }, /*#__PURE__*/React.createElement("div", {
      className: "section-tete"
    }, /*#__PURE__*/React.createElement("h2", null, y), /*#__PURE__*/React.createElement("span", {
      className: f === 'dep' ? 'c-dep' : 'c-rev'
    }, eur(ms.reduce((a, m) => a + val(m), 0)))), /*#__PURE__*/React.createElement("div", {
      className: "liste"
    }, ms.map(m => /*#__PURE__*/React.createElement("button", {
      className: "hist-rang",
      key: m,
      onClick: () => onGoMois(m)
    }, /*#__PURE__*/React.createElement("span", {
      className: "l1"
    }, /*#__PURE__*/React.createElement("span", {
      className: "nom"
    }, capital(moisNom(m))), /*#__PURE__*/React.createElement("span", {
      className: "mt"
    }, val(m) ? eur(val(m)) : '—'), /*#__PURE__*/React.createElement(Ico, {
      d: I.droite,
      size: 16,
      color: "var(--ink4)"
    })), /*#__PURE__*/React.createElement("span", {
      className: "jauge"
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: Math.round(val(m) / max * 100) + '%',
        background: f === 'dep' ? 'var(--dep2)' : undefined
      }
    }))))));
  }) : /*#__PURE__*/React.createElement("div", {
    className: "liste"
  }, parAn.slice().reverse().map(a => /*#__PURE__*/React.createElement("div", {
    key: a.y,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      padding: '14px 16px',
      borderTop: a.y === parAn[parAn.length - 1].y ? 'none' : '1px solid var(--line2)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ligne-tete"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 17,
      fontWeight: 800
    }
  }, a.y), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 17,
      fontWeight: 800
    },
    className: f === 'dep' ? 'c-dep' : 'c-rev'
  }, eur(a.tot))), /*#__PURE__*/React.createElement("span", {
    className: "petit"
  }, a.n, " mois saisis · moyenne ", eur(a.n ? a.tot / a.n : 0), " par mois")))));
}

/* ---------- Déclaration de revenus ---------- */

const CLE_CLASSES = 'comptes-decl-classes';
const CLASSES = [['france', 'France'], ['expat', 'Expatriation'], ['non', 'Ignorer']];
function lireClasses() {
  try {
    return JSON.parse(localStorage.getItem(CLE_CLASSES) || '{}') || {};
  } catch (e) {
    return {};
  }
}
function classeDefaut(nom) {
  if (estLoyersFrance(nom)) return 'fonciers';
  if (/institut/i.test(nom)) return 'france';
  return 'expat';
}

// Feuille Fin_Declaration écrite par Mes Locations : [Annee, Mois, Cle, Libelle, <logements…>, Total]
function analyserDeclaration(t) {
  if (!t || t.length < 2) return null;
  const tete = t[0].map(String);
  const logs = tete.slice(4, tete.length - 1);
  const annees = {};
  t.slice(1).forEach(r => {
    const y = String(r[0]).trim();
    if (!/^\d{4}$/.test(y)) return;
    const A = annees[y] || (annees[y] = {
      lignes: {},
      ordre: [],
      mois: {}
    });
    const vals = logs.map((_, i) => num(r[4 + i]));
    const total = num(r[4 + logs.length]);
    const mois = String(r[1]).trim();
    const cle = String(r[2]).trim();
    if (mois) {
      const M = A.mois[mois] || (A.mois[mois] = {});
      M[cle] = total;
    } else {
      A.lignes[cle] = {
        lib: String(r[3]),
        vals,
        total
      };
      A.ordre.push(cle);
    }
  });
  return {
    logs,
    annees
  };
}

// Feuille Fin_Revenus (copie du fichier « Déclarations impôts ») : [Annee, Groupe (france|hors|conjoint), Nom, Mois, Montant]
function analyserRevenus(t) {
  if (!t || t.length < 2) return null;
  const out = {};
  t.slice(1).forEach(r => {
    const y = String(r[0]).trim();
    if (!/^\d{4}$/.test(y)) return;
    const A = out[y] || (out[y] = {
      france: {},
      hors: {},
      conjoint: []
    });
    const g = String(r[1]).trim(),
      nom = String(r[2]).trim(),
      mm = String(r[3]).trim(),
      mt = num(r[4]);
    if (g === 'conjoint') {
      A.conjoint.push({
        nom,
        total: mt
      });
      return;
    }
    const grp = g === 'hors' ? A.hors : A.france;
    const c = grp[nom] || (grp[nom] = {
      nom,
      total: 0,
      mois: {},
      fonciers: /fonciers/i.test(nom)
    });
    c.total += mt;
    if (mm) c.mois[mm] = (c.mois[mm] || 0) + mt;
  });
  return out;
}
function calculDeclaration(d, decl, y, classes, rev) {
  if (rev && rev[y]) {
    const R = rev[y];
    const france = Object.values(R.france).filter(c => !c.fonciers);
    const expat = Object.values(R.hors);
    const fon = decl && decl.annees[y] ? decl.annees[y] : null;
    const mois = Array.from({
      length: 12
    }, (_, i) => {
      const mm = String(i + 1).padStart(2, '0');
      const fm = fon && fon.mois[mm] ? fon.mois[mm] : {};
      return {
        mm,
        france: france.reduce((t, c) => t + (c.mois[mm] || 0), 0),
        loyers: fm.loyers || 0,
        frais: fm.frais || 0,
        expat: expat.reduce((t, c) => t + (c.mois[mm] || 0), 0)
      };
    });
    return {
      source: 'fichier',
      liste: [],
      france,
      expat,
      fon,
      mois,
      conjoint: R.conjoint,
      classe: () => '',
      totFrance: france.reduce((t, c) => t + c.total, 0),
      totExpat: expat.reduce((t, c) => t + c.total, 0)
    };
  }
  const classe = nom => classes[nom] || classeDefaut(nom);
  const cats = {};
  d.arch.forEach(a => {
    if (a.mois.slice(0, 4) !== y || (d.typeDe[a.categorie] || 'revenu') !== 'revenu' || !a.montant) return;
    const c = cats[a.categorie] || (cats[a.categorie] = {
      nom: a.categorie,
      total: 0,
      mois: {}
    });
    c.total += a.montant;
    c.mois[a.mois.slice(5, 7)] = (c.mois[a.mois.slice(5, 7)] || 0) + a.montant;
  });
  const liste = Object.values(cats).sort((p, q) => q.total - p.total);
  const france = liste.filter(c => classe(c.nom) === 'france');
  const expat = liste.filter(c => classe(c.nom) === 'expat');
  const fon = decl && decl.annees[y] ? decl.annees[y] : null;
  const mois = Array.from({
    length: 12
  }, (_, i) => {
    const mm = String(i + 1).padStart(2, '0');
    const fm = fon && fon.mois[mm] ? fon.mois[mm] : {};
    return {
      mm,
      france: france.reduce((t, c) => t + (c.mois[mm] || 0), 0),
      loyers: fm.loyers || 0,
      frais: fm.frais || 0,
      expat: expat.reduce((t, c) => t + (c.mois[mm] || 0), 0)
    };
  });
  return {
    source: 'comptes',
    conjoint: [],
    liste,
    france,
    expat,
    fon,
    mois,
    classe,
    totFrance: france.reduce((t, c) => t + c.total, 0),
    totExpat: expat.reduce((t, c) => t + c.total, 0)
  };
}
const LIGNES_AFFICHEES = ['211', '221', '222', '223', '224', '227', '229', '250', '240', 'resultat'];
function lignesFoncieres(fon) {
  if (!fon) return [];
  return LIGNES_AFFICHEES.filter(k => fon.lignes[k] && (fon.lignes[k].total || ['211', '221', '222', '223', '224', '227', '240', 'resultat'].indexOf(k) >= 0)).map(k => Object.assign({
    cle: k
  }, fon.lignes[k]));
}
function chargerScript(src) {
  return new Promise((ok, ko) => {
    if (document.querySelector('script[src="' + src + '"]')) return ok();
    const s = document.createElement('script');
    s.src = src;
    s.onload = ok;
    s.onerror = () => ko(new Error('module PDF introuvable (connexion ?)'));
    document.head.appendChild(s);
  });
}
function telecharger(blob, nom) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
const f2 = n => (Math.round(n * 100) / 100).toFixed(2).replace('.', ',');
function tableauxExport(c, decl, y) {
  const t = [];
  t.push({
    titre: '1. Revenus de source française — salaires',
    tete: ['Revenu', 'Montant ' + y],
    lignes: c.france.map(x => [x.nom, f2(x.total)]).concat([['Total', f2(c.totFrance)]])
  });
  if (c.fon) {
    t.push({
      titre: '2. Revenus fonciers en France (déclaration 2044)',
      tete: ['Ligne'].concat(decl.logs, ['Total']),
      lignes: lignesFoncieres(c.fon).map(l => [(l.cle === 'resultat' ? '' : l.cle + ' - ') + l.lib].concat(l.vals.map(f2), [f2(l.total)]))
    });
  }
  t.push({
    titre: '3. Revenus réalisés en expatriation (autre partie de la déclaration)',
    tete: ['Revenu', 'Montant ' + y],
    lignes: c.expat.map(x => [x.nom, f2(x.total)]).concat([['Total', f2(c.totExpat)]])
  });
  if (c.conjoint.length) t.push({
    titre: 'Revenus du conjoint',
    tete: ['Revenu', 'Montant ' + y],
    lignes: c.conjoint.map(x => [x.nom, f2(x.total)])
  });
  t.push({
    titre: '4. Mois par mois',
    tete: ['Mois', 'Salaires France', 'Loyers France HC', 'Frais fonciers', 'Expatriation'],
    lignes: c.mois.map(m => [capital(MOIS_L[+m.mm - 1]), f2(m.france), f2(m.loyers), f2(m.frais), f2(m.expat)]).concat([['Total', f2(c.totFrance), f2(c.mois.reduce((s, m) => s + m.loyers, 0)), f2(c.mois.reduce((s, m) => s + m.frais, 0)), f2(c.totExpat)]])
  });
  return t;
}
const NOTE_DECL = 'Salaires et revenus hors France : fichier « Déclarations impôts » (ou, à défaut, montants saisis dans Comptes). Pour les salaires, reporte le net imposable de tes bulletins ou attestations. Revenus fonciers calculés par Mes Locations : loyers hors charges à leur date d\'encaissement, frais déductibles. Document d\'aide, à vérifier avec la notice.';
function PageDeclaration({
  d,
  raw,
  aujourdhui,
  notifier
}) {
  const decl = useMemo(() => analyserDeclaration(raw && raw.finDeclaration), [raw]);
  const rev = useMemo(() => analyserRevenus(raw && raw.finRevenus), [raw]);
  const [classes, setClasses] = useState(lireClasses);
  const annees = Array.from(new Set(d.arch.map(a => a.mois.slice(0, 4)).concat(rev ? Object.keys(rev) : [], decl ? Object.keys(decl.annees).filter(x => x >= String(aujourdhui.getFullYear() - 2)) : []))).filter(x => x <= String(aujourdhui.getFullYear())).sort();
  const parDefaut = aujourdhui.getMonth() < 6 && annees.indexOf(String(aujourdhui.getFullYear() - 1)) >= 0 ? String(aujourdhui.getFullYear() - 1) : annees[annees.length - 1];
  const [anSel, setAnSel] = useState(null);
  const y = anSel && annees.indexOf(anSel) >= 0 ? anSel : parDefaut;
  const [voirClasses, setVoirClasses] = useState(false);
  const [voirMois, setVoirMois] = useState(false);
  if (!y) return /*#__PURE__*/React.createElement("div", {
    className: "page"
  }, /*#__PURE__*/React.createElement("header", {
    className: "entete"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", null, "Impôts"))), /*#__PURE__*/React.createElement("div", {
    className: "carte petit"
  }, "Aucune donnée."));
  const c = calculDeclaration(d, decl, y, classes, rev);
  const fon = lignesFoncieres(c.fon);
  const res = c.fon && c.fon.lignes.resultat ? c.fon.lignes.resultat.total : null;
  function demanderVerification() {
    const l = k => c.fon && c.fon.lignes[k] ? eur(c.fon.lignes[k].total) : '—';
    const q = 'Vérifie que l\'onglet Impôts de mon appli Comptes est à jour pour ma déclaration ' + (+y + 1) + ' (revenus ' + y + '). ' + 'Contrôle les règles en vigueur cette année (déclaration 2044 au régime réel : lignes 211 à 250, forfait de la ligne 222, seuil du micro-foncier, ' + 'déclaration des salaires de source française et des revenus d\'expatriation pour un résident fiscal espagnol) ' + 'et dis-moi si Mes Locations ou Comptes doivent être mis à jour. ' + 'Chiffres affichés : salaires de source française ' + eur(c.totFrance) + ' ; revenus fonciers : ligne 211 ' + l('211') + ', ligne 221 ' + l('221') + ', ligne 222 ' + l('222') + ', ligne 223 ' + l('223') + ', ligne 224 ' + l('224') + ', ligne 227 ' + l('227') + ', total des frais ' + l('240') + ', résultat foncier ' + l('resultat') + ' ; revenus en expatriation ' + eur(c.totExpat) + '.';
    window.open('https://claude.ai/new?q=' + encodeURIComponent(q.replace(/[\u202f\u00a0]/g, ' ')), '_blank');
  }
  function changerClasse(nom, v) {
    const n = Object.assign({}, classes, {
      [nom]: v
    });
    setClasses(n);
    try {
      localStorage.setItem(CLE_CLASSES, JSON.stringify(n));
    } catch (e) {/* rien */}
  }
  function exportCsv() {
    const lignes = [['Revenus ' + y + ' — déclaration ' + (+y + 1)], []];
    tableauxExport(c, decl, y).forEach(t => {
      lignes.push([t.titre], t.tete);
      t.lignes.forEach(l => lignes.push(l));
      lignes.push([]);
    });
    if (res !== null) lignes.push([res >= 0 ? 'Bénéfice foncier (2042, case 4BA)' : 'Déficit foncier', f2(Math.abs(res))], []);
    lignes.push([NOTE_DECL]);
    const csv = '﻿' + lignes.map(r => r.map(x => '"' + String(x === undefined ? '' : x).replace(/"/g, '""') + '"').join(';')).join('\r\n');
    telecharger(new Blob([csv], {
      type: 'text/csv;charset=utf-8'
    }), 'declaration-revenus-' + y + '.csv');
    notifier('Fichier CSV téléchargé');
  }
  async function exportPdf() {
    try {
      await chargerScript('lib/jspdf.umd.min.js');
      await chargerScript('lib/jspdf.plugin.autotable.min.js');
      const pdf = new window.jspdf.jsPDF({
        unit: 'mm',
        format: 'a4'
      });
      const net = s => String(s).replace(/[  ]/g, ' ');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.text('Revenus ' + y, 14, 18);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(90);
      pdf.text(net('Aide à la déclaration ' + (+y + 1) + ' · éditée le ' + new Date().toLocaleDateString('fr-FR')), 14, 25);
      pdf.setTextColor(0);
      let yy = 32;
      tableauxExport(c, decl, y).forEach(t => {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        if (yy > 260) {
          pdf.addPage();
          yy = 18;
        }
        pdf.text(net(t.titre), 14, yy);
        const droite = {};
        t.tete.forEach((_, i) => {
          if (i) droite[i] = {
            halign: 'right'
          };
        });
        pdf.autoTable({
          startY: yy + 3,
          head: [t.tete],
          body: t.lignes,
          styles: {
            font: 'helvetica',
            fontSize: 9,
            cellPadding: 1.8
          },
          headStyles: {
            fillColor: [40, 90, 160]
          },
          columnStyles: droite,
          didParseCell: k => {
            if (k.section === 'body' && /^(Total|240|Résultat)/.test(String(k.row.raw[0]))) k.cell.styles.fontStyle = 'bold';
          }
        });
        yy = pdf.lastAutoTable.finalY + 9;
      });
      if (res !== null) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.text(net((res >= 0 ? 'Bénéfice foncier à reporter (2042, case 4BA) : ' : 'Déficit foncier : ') + eur(Math.abs(res))), 14, Math.min(yy, 280));
        yy += 7;
      }
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(110);
      if (yy > 270) {
        pdf.addPage();
        yy = 18;
      }
      pdf.text(pdf.splitTextToSize(net(NOTE_DECL), 182), 14, yy);
      telecharger(pdf.output('blob'), 'declaration-revenus-' + y + '.pdf');
      notifier('PDF téléchargé');
    } catch (e) {
      notifier('PDF impossible : ' + e.message, true);
    }
  }
  const Rang = ({
    nom,
    mt,
    sous,
    fort
  }) => /*#__PURE__*/React.createElement("div", {
    className: "rang",
    style: {
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "nom",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      whiteSpace: 'normal',
      fontWeight: fort ? 700 : undefined
    }
  }, /*#__PURE__*/React.createElement("span", null, nom), sous && /*#__PURE__*/React.createElement("span", {
    className: "petit",
    style: {
      fontSize: 12.5
    }
  }, sous)), /*#__PURE__*/React.createElement("span", {
    className: "mt",
    style: {
      fontWeight: fort ? 800 : undefined
    }
  }, eur(mt)));
  return /*#__PURE__*/React.createElement("div", {
    className: "page"
  }, /*#__PURE__*/React.createElement("header", {
    className: "entete"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", null, "Impôts"))), /*#__PURE__*/React.createElement("div", {
    className: "chips",
    role: "group",
    "aria-label": "Année des revenus"
  }, annees.slice().reverse().map(a => /*#__PURE__*/React.createElement("button", {
    key: a,
    "aria-pressed": a === y,
    onClick: () => setAnSel(a)
  }, a))), /*#__PURE__*/React.createElement("div", {
    className: "petit",
    style: {
      margin: '-4px 4px 0'
    }
  }, "Revenus ", y, ", à déclarer en ", +y + 1, "."), /*#__PURE__*/React.createElement("button", {
    className: "bandeau info",
    onClick: demanderVerification,
    style: {
      width: '100%',
      textAlign: 'left',
      cursor: 'pointer',
      font: 'inherit',
      color: 'inherit'
    }
  }, /*#__PURE__*/React.createElement(IcoInfo, {
    color: "var(--chipInk)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "txt"
  }, /*#__PURE__*/React.createElement("b", null, "Ces chiffres sont-ils à jour pour ma déclaration ", +y + 1, " ?"), /*#__PURE__*/React.createElement("br", null), "Demander à Claude de vérifier les règles et les montants de cet onglet.")), /*#__PURE__*/React.createElement("div", {
    className: "section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-tete"
  }, /*#__PURE__*/React.createElement("h2", null, "Salaires de source française"), /*#__PURE__*/React.createElement("span", {
    className: "c-rev"
  }, eur(c.totFrance))), /*#__PURE__*/React.createElement("div", {
    className: "liste"
  }, c.france.length ? c.france.map(x => /*#__PURE__*/React.createElement(Rang, {
    key: x.nom,
    nom: x.nom,
    mt: x.total,
    sous: Object.keys(x.mois).length + ' mois'
  })) : /*#__PURE__*/React.createElement("div", {
    className: "rang"
  }, /*#__PURE__*/React.createElement("span", {
    className: "nom petit"
  }, "Aucun revenu classé « France » en ", y, "."))), /*#__PURE__*/React.createElement("div", {
    className: "petit",
    style: {
      margin: '6px 4px 0'
    }
  }, "Sommes perçues : reporte le net imposable indiqué sur tes bulletins ou ton attestation.")), /*#__PURE__*/React.createElement("div", {
    className: "section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-tete"
  }, /*#__PURE__*/React.createElement("h2", null, "Revenus fonciers en France"), res !== null && /*#__PURE__*/React.createElement("span", {
    className: "c-rev"
  }, eur(res))), c.fon ? /*#__PURE__*/React.createElement("div", {
    className: "liste"
  }, fon.map(l => /*#__PURE__*/React.createElement(Rang, {
    key: l.cle,
    nom: (l.cle === 'resultat' ? '' : l.cle + ' · ') + l.lib,
    mt: l.total,
    fort: l.cle === '240' || l.cle === 'resultat',
    sous: decl.logs.map((n, i) => n + ' ' + eur(l.vals[i])).join(' · ')
  }))) : /*#__PURE__*/React.createElement("div", {
    className: "bandeau warn"
  }, /*#__PURE__*/React.createElement(IcoInfo, {
    color: "var(--warnInk)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "txt"
  }, decl ? 'Aucun revenu foncier pour ' + y + '.' : 'Les chiffres de Mes Locations ne sont pas encore reçus : ajoute « finDeclaration » au script Comptes (voir les instructions), puis actualise.')), res !== null && /*#__PURE__*/React.createElement("div", {
    className: "bandeau info",
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(IcoInfo, {
    color: "var(--chipInk)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "txt"
  }, res >= 0 ? 'Bénéfice foncier à reporter sur la 2042, case 4BA : ' : 'Déficit foncier (cases 4BB / 4BC, voir notice) : ', /*#__PURE__*/React.createElement("b", null, eur(Math.abs(res))), ".", c.fon.lignes.charges && c.fon.lignes.charges.total ? ' Charges récupérées auprès des locataires (non déclarées) : ' + eur(c.fon.lignes.charges.total) + '.' : ''))), /*#__PURE__*/React.createElement("div", {
    className: "section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-tete"
  }, /*#__PURE__*/React.createElement("h2", null, "Revenus en expatriation"), /*#__PURE__*/React.createElement("span", {
    className: "c-rev"
  }, eur(c.totExpat))), /*#__PURE__*/React.createElement("div", {
    className: "liste"
  }, c.expat.length ? c.expat.map(x => /*#__PURE__*/React.createElement(Rang, {
    key: x.nom,
    nom: x.nom,
    mt: x.total,
    sous: Object.keys(x.mois).length + ' mois'
  })) : /*#__PURE__*/React.createElement("div", {
    className: "rang"
  }, /*#__PURE__*/React.createElement("span", {
    className: "nom petit"
  }, "Aucun revenu classé « Expatriation » en ", y, "."))), /*#__PURE__*/React.createElement("div", {
    className: "petit",
    style: {
      margin: '6px 4px 0'
    }
  }, "À déclarer dans la partie revenus réalisés en expatriation.", c.source === 'comptes' ? ' Les revenus de ton épouse ne sont pas suivis dans Comptes.' : '')), c.conjoint.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-tete"
  }, /*#__PURE__*/React.createElement("h2", null, "Revenus du conjoint"), /*#__PURE__*/React.createElement("span", {
    className: "c-rev"
  }, eur(c.conjoint.reduce((t, x) => t + x.total, 0)))), /*#__PURE__*/React.createElement("div", {
    className: "liste"
  }, c.conjoint.map(x => /*#__PURE__*/React.createElement(Rang, {
    key: x.nom,
    nom: x.nom,
    mt: x.total
  })))), /*#__PURE__*/React.createElement("div", {
    className: "bandeau info"
  }, /*#__PURE__*/React.createElement(IcoInfo, {
    color: "var(--chipInk)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "txt"
  }, c.source === 'fichier' ? 'Salaires et revenus hors France lus dans ton fichier « Déclarations impôts », onglet Revenus ' + y + '.' : 'Pas d\'onglet « Revenus ' + y + ' » dans ton fichier impôts : montants tirés de Comptes.')), /*#__PURE__*/React.createElement("div", {
    className: "section"
  }, /*#__PURE__*/React.createElement("button", {
    className: "section-tete",
    style: {
      width: '100%',
      background: 'none',
      border: 0,
      padding: 0,
      cursor: 'pointer',
      color: 'inherit'
    },
    onClick: () => setVoirMois(!voirMois),
    "aria-expanded": voirMois
  }, /*#__PURE__*/React.createElement("h2", null, "Mois par mois"), /*#__PURE__*/React.createElement("span", {
    className: "lien"
  }, voirMois ? 'Masquer' : 'Afficher')), voirMois && /*#__PURE__*/React.createElement("div", {
    className: "carte",
    style: {
      padding: '6px 10px',
      overflowX: 'auto'
    },
    "data-noswipe": "1"
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      color: 'var(--ink3)'
    }
  }, /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: 'left',
      padding: '6px 4px'
    }
  }, "Mois"), /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: 'right'
    }
  }, "Sal. FR"), /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: 'right'
    }
  }, "Loyers HC"), /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: 'right'
    }
  }, "Frais"), /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: 'right'
    }
  }, "Expat."))), /*#__PURE__*/React.createElement("tbody", null, c.mois.map(m => /*#__PURE__*/React.createElement("tr", {
    key: m.mm,
    style: {
      borderTop: '1px solid var(--line2)'
    }
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '6px 4px'
    }
  }, MOIS_C[+m.mm - 1]), /*#__PURE__*/React.createElement("td", {
    style: {
      textAlign: 'right'
    }
  }, m.france ? f2(m.france) : '—'), /*#__PURE__*/React.createElement("td", {
    style: {
      textAlign: 'right'
    }
  }, m.loyers ? f2(m.loyers) : '—'), /*#__PURE__*/React.createElement("td", {
    style: {
      textAlign: 'right'
    }
  }, m.frais ? f2(m.frais) : '—'), /*#__PURE__*/React.createElement("td", {
    style: {
      textAlign: 'right'
    }
  }, m.expat ? f2(m.expat) : '—'))))))), c.source === 'comptes' && /*#__PURE__*/React.createElement("div", {
    className: "section"
  }, /*#__PURE__*/React.createElement("button", {
    className: "section-tete",
    style: {
      width: '100%',
      background: 'none',
      border: 0,
      padding: 0,
      cursor: 'pointer',
      color: 'inherit'
    },
    onClick: () => setVoirClasses(!voirClasses),
    "aria-expanded": voirClasses
  }, /*#__PURE__*/React.createElement("h2", null, "Classer mes revenus"), /*#__PURE__*/React.createElement("span", {
    className: "lien"
  }, voirClasses ? 'Masquer' : 'Modifier')), voirClasses && /*#__PURE__*/React.createElement("div", {
    className: "liste"
  }, c.liste.filter(x => c.classe(x.nom) !== 'fonciers').map(x => /*#__PURE__*/React.createElement("div", {
    className: "rang",
    key: x.nom,
    style: {
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "nom"
  }, x.nom), /*#__PURE__*/React.createElement("div", {
    className: "seg",
    role: "group",
    "aria-label": 'Classement de ' + x.nom,
    style: {
      margin: 0
    }
  }, CLASSES.map(([k, v]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    "aria-pressed": c.classe(x.nom) === k,
    onClick: () => changerClasse(x.nom, k)
  }, v))))), /*#__PURE__*/React.createElement("div", {
    className: "rang"
  }, /*#__PURE__*/React.createElement("span", {
    className: "nom petit",
    style: {
      whiteSpace: 'normal'
    }
  }, "« Loyers France » est remplacé par le détail des revenus fonciers calculé par Mes Locations.")))), /*#__PURE__*/React.createElement("div", {
    className: "deux",
    style: {
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "bouton second",
    onClick: exportCsv
  }, "Export CSV"), /*#__PURE__*/React.createElement("button", {
    className: "bouton second",
    onClick: exportPdf
  }, "Export PDF")), /*#__PURE__*/React.createElement("div", {
    className: "petit",
    style: {
      margin: '0 4px 8px'
    }
  }, NOTE_DECL));
}

/* ---------- Menu ---------- */

function FeuilleMenu({
  d,
  onClose,
  onRefresh,
  theme,
  setTheme,
  maj,
  onRestaurer,
  chargement
}) {
  const [ouvert, setOuvert] = useState(false);
  const masquees = d.cats.filter(c => !c.actif);
  const heure = maj ? maj.toDateString() === new Date().toDateString() ? 'aujourd\'hui à ' + maj.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  }) : 'le ' + maj.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long'
  }) : 'jamais';
  return /*#__PURE__*/React.createElement(Feuille, {
    onClose: onClose,
    fond: true,
    labelId: "titre-menu"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ligne-tete",
    style: {
      padding: '0 4px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("h2", {
    id: "titre-menu"
  }, "Comptes"), /*#__PURE__*/React.createElement("span", {
    className: "petit"
  }, "Version ", APP_VERSION.slice(1), " · données mises à jour ", heure)), /*#__PURE__*/React.createElement("button", {
    className: "rond",
    onClick: onClose,
    "aria-label": "Fermer"
  }, /*#__PURE__*/React.createElement(Ico, {
    d: I.croix,
    size: 18,
    sw: 2.2
  }))), /*#__PURE__*/React.createElement("div", {
    className: "liste"
  }, /*#__PURE__*/React.createElement("button", {
    className: "menu-rang",
    onClick: onRefresh,
    disabled: chargement
  }, /*#__PURE__*/React.createElement(Ico, {
    d: I.refresh,
    color: "var(--barOn)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "txt"
  }, /*#__PURE__*/React.createElement("span", {
    className: "t1"
  }, chargement ? 'Actualisation…' : 'Actualiser les données'))), /*#__PURE__*/React.createElement("a", {
    className: "menu-rang",
    href: LIENS.nominas,
    target: "_blank",
    rel: "noopener"
  }, /*#__PURE__*/React.createElement(IcoTableur, null), /*#__PURE__*/React.createElement("span", {
    className: "txt"
  }, /*#__PURE__*/React.createElement("span", {
    className: "t1"
  }, "Nóminas"), /*#__PURE__*/React.createElement("span", {
    className: "t2"
  }, "Feuille Google Sheets")), /*#__PURE__*/React.createElement(Ico, {
    d: I.externe,
    size: 18,
    color: "var(--ink4)"
  })), /*#__PURE__*/React.createElement("a", {
    className: "menu-rang",
    href: LIENS.impots,
    target: "_blank",
    rel: "noopener"
  }, /*#__PURE__*/React.createElement(IcoDoc, null), /*#__PURE__*/React.createElement("span", {
    className: "txt"
  }, /*#__PURE__*/React.createElement("span", {
    className: "t1"
  }, "Impôts"), /*#__PURE__*/React.createElement("span", {
    className: "t2"
  }, "Feuille Google Sheets")), /*#__PURE__*/React.createElement(Ico, {
    d: I.externe,
    size: 18,
    color: "var(--ink4)"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "liste"
  }, /*#__PURE__*/React.createElement("button", {
    className: "menu-rang",
    onClick: () => setOuvert(!ouvert),
    "aria-expanded": ouvert,
    disabled: !masquees.length
  }, /*#__PURE__*/React.createElement(Ico, {
    d: I.oeil,
    color: "var(--barOn)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "txt"
  }, /*#__PURE__*/React.createElement("span", {
    className: "t1"
  }, "Lignes masquées"), /*#__PURE__*/React.createElement("span", {
    className: "t2"
  }, masquees.length ? masquees.map(c => c.nom).join(', ') : 'Aucune')), masquees.length > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      transform: ouvert ? 'rotate(90deg)' : 'none',
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement(Ico, {
    d: I.droite,
    size: 18,
    color: "var(--ink4)"
  }))), ouvert && masquees.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "menu-sous"
  }, masquees.map(c => /*#__PURE__*/React.createElement("div", {
    className: "it",
    key: c.nom
  }, /*#__PURE__*/React.createElement("span", null, c.nom), /*#__PURE__*/React.createElement("button", {
    onClick: () => onRestaurer(c.nom)
  }, "Réafficher")))), /*#__PURE__*/React.createElement("div", {
    className: "menu-rang",
    style: {
      flexWrap: 'wrap',
      paddingTop: 12,
      paddingBottom: 12
    }
  }, /*#__PURE__*/React.createElement(Ico, {
    d: I.lune,
    color: "var(--barOn)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "txt"
  }, /*#__PURE__*/React.createElement("span", {
    className: "t1"
  }, "Apparence")), /*#__PURE__*/React.createElement("div", {
    className: "seg",
    role: "group",
    "aria-label": "Apparence",
    style: {
      width: '100%'
    }
  }, [['auto', 'Automatique'], ['light', 'Clair'], ['dark', 'Sombre']].map(x => /*#__PURE__*/React.createElement("button", {
    key: x[0],
    "aria-pressed": theme === x[0],
    onClick: () => setTheme(x[0])
  }, x[1]))))));
}

/* ---------- Application ---------- */

const ONGLETS = [{
  id: 'accueil',
  label: 'Accueil'
}, {
  id: 'mois',
  label: 'Mois'
}, {
  id: 'historique',
  label: 'Historique'
}, {
  id: 'declaration',
  label: 'Impôts'
}];
function lireTheme() {
  try {
    const t = localStorage.getItem(CLE_THEME);
    return t === 'light' || t === 'dark' ? t : 'auto';
  } catch (e) {
    return 'auto';
  }
}
function App() {
  const cache = useMemo(lireCache, []);
  const [raw, setRaw] = useState(cache ? cache.raw : null);
  const [maj, setMaj] = useState(cache && cache.at ? new Date(cache.at) : null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [page, setPage] = useState(() => /impots|declaration/i.test(location.hash) ? 'declaration' : 'accueil');
  useEffect(() => {
    const surHash = () => {
      if (/impots|declaration/i.test(location.hash)) setPage('declaration');
    };
    window.addEventListener('hashchange', surHash);
    return () => window.removeEventListener('hashchange', surHash);
  }, []);
  const [mois, setMois] = useState(ymDe(new Date()));
  const [dirty, setDirty] = useState(false);
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState(null);
  const [theme, setThemeState] = useState(lireTheme);
  const [aujourdhui] = useState(new Date());
  const d = useMemo(() => analyser(raw), [raw]);
  const toastT = useRef(null);
  function notifier(txt, err) {
    clearTimeout(toastT.current);
    setToast({
      txt,
      err: !!err
    });
    toastT.current = setTimeout(() => setToast(null), err ? 4500 : 2200);
  }
  async function recharger(silencieux) {
    setChargement(true);
    try {
      const r = await apiGet();
      ecrireCache(r);
      setRaw(r);
      setMaj(new Date());
      setErreur(null);
      if (!silencieux) notifier('Données à jour');
    } catch (e) {
      setErreur(e.message);
      if (!silencieux || !raw) notifier('Impossible de charger les données : ' + e.message, true);
    } finally {
      setChargement(false);
    }
  }
  useEffect(() => {
    recharger(true);
  }, []);
  useEffect(() => {
    function avant(e) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', avant);
    return () => window.removeEventListener('beforeunload', avant);
  }, [dirty]);
  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute('data-theme', theme);
    try {
      if (theme === 'auto') localStorage.removeItem(CLE_THEME);else localStorage.setItem(CLE_THEME, theme);
    } catch (e) {/* rien */}
    const meta = document.querySelector('meta[name="theme-color"]');
    const sombre = theme === 'dark' || theme === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (meta) meta.setAttribute('content', sombre ? '#111317' : '#F3F1EC');
  }, [theme]);
  function quitterSaisie() {
    if (!dirty) return true;
    if (!window.confirm('Des montants saisis n\'ont pas été enregistrés.\n\nLes abandonner ?')) return false;
    setDirty(false);
    return true;
  }
  function allerVers(id) {
    if (id === page) return;
    if (page === 'mois' && !quitterSaisie()) return;
    setPage(id);
    window.scrollTo(0, 0);
  }
  function ouvrirMois(m) {
    if (page === 'mois' && m !== mois && !quitterSaisie()) return;
    setMois(m);
    setPage('mois');
    window.scrollTo(0, 0);
  }
  function changerMois(m) {
    if (!quitterSaisie()) return;
    setMois(m);
    window.scrollTo(0, 0);
  }
  async function restaurer(nom) {
    try {
      await apiPost('saveCategories', {
        categories: d.cats.map(c => c.nom === nom ? Object.assign({}, c, {
          actif: true
        }) : c)
      });
      notifier('« ' + nom + ' » réaffichée');
      await recharger(true);
    } catch (e) {
      notifier('Échec : ' + e.message, true);
    }
  }

  // Balayage horizontal entre onglets
  const touche = useRef(null);
  function debut(e) {
    if (menu || document.querySelector('.feuille')) {
      touche.current = null;
      return;
    }
    if (e.target.closest && e.target.closest('[data-noswipe]')) {
      touche.current = null;
      return;
    }
    const t = e.touches[0];
    touche.current = {
      x: t.clientX,
      y: t.clientY
    };
  }
  function fin(e) {
    if (!touche.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touche.current.x,
      dy = t.clientY - touche.current.y;
    touche.current = null;
    if (Math.abs(dx) < 70 || Math.abs(dy) > 50) return;
    const i = ONGLETS.findIndex(o => o.id === page);
    const j = dx < 0 ? i + 1 : i - 1;
    if (j >= 0 && j < ONGLETS.length) allerVers(ONGLETS[j].id);
  }
  if (!raw) {
    return /*#__PURE__*/React.createElement("div", {
      id: "loading"
    }, erreur ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", null, "Impossible de charger les données."), /*#__PURE__*/React.createElement("div", {
      className: "err"
    }, erreur), /*#__PURE__*/React.createElement("button", {
      className: "bouton",
      style: {
        marginTop: 20,
        maxWidth: 240
      },
      onClick: () => recharger(false)
    }, "Réessayer")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      className: "spin"
    }), /*#__PURE__*/React.createElement("div", null, "Chargement des comptes…")));
  }
  const horsLigne = erreur && maj ? 'Hors ligne : données du ' + maj.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long'
  }) + '.' : null;
  return /*#__PURE__*/React.createElement("div", {
    className: "app",
    onTouchStart: debut,
    onTouchEnd: fin
  }, /*#__PURE__*/React.createElement("main", null, page === 'accueil' && /*#__PURE__*/React.createElement(PageAccueil, {
    d: d,
    aujourdhui: aujourdhui,
    horsLigne: horsLigne,
    onMenu: () => setMenu(true),
    onGoMois: ouvrirMois,
    onGoHist: () => allerVers('historique')
  }), page === 'mois' && /*#__PURE__*/React.createElement(PageMois, {
    d: d,
    mois: mois,
    changerMois: changerMois,
    dirty: dirty,
    setDirty: setDirty,
    recharger: recharger,
    notifier: notifier
  }), page === 'historique' && /*#__PURE__*/React.createElement(PageHistorique, {
    d: d,
    onGoMois: ouvrirMois
  }), page === 'declaration' && /*#__PURE__*/React.createElement(PageDeclaration, {
    d: d,
    raw: raw,
    aujourdhui: aujourdhui,
    notifier: notifier
  })), /*#__PURE__*/React.createElement("nav", {
    className: "onglets",
    "aria-label": "Navigation principale"
  }, /*#__PURE__*/React.createElement("div", {
    className: "in"
  }, ONGLETS.map(o => /*#__PURE__*/React.createElement("button", {
    key: o.id,
    "aria-current": page === o.id ? 'page' : undefined,
    onClick: () => o.id === 'mois' && page !== 'mois' ? ouvrirMois(ymDe(aujourdhui)) : allerVers(o.id)
  }, o.id === 'accueil' && /*#__PURE__*/React.createElement(Ico, {
    d: I.maison,
    size: 24
  }), o.id === 'mois' && /*#__PURE__*/React.createElement(IcoCal, null), o.id === 'historique' && /*#__PURE__*/React.createElement(Ico, {
    d: I.histo,
    size: 24
  }), o.id === 'declaration' && /*#__PURE__*/React.createElement(Ico, {
    d: I.doc,
    size: 24
  }), o.label)))), menu && /*#__PURE__*/React.createElement(FeuilleMenu, {
    d: d,
    onClose: () => setMenu(false),
    onRefresh: () => recharger(false),
    theme: theme,
    setTheme: setThemeState,
    maj: maj,
    onRestaurer: restaurer,
    chargement: chargement
  }), toast && /*#__PURE__*/React.createElement("div", {
    className: 'toast' + (toast.err ? ' err' : ''),
    role: "status"
  }, toast.txt));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));
