const {
  useState,
  useEffect,
  useCallback
} = React;
const APP_VERSION = "v5.5";
const API_URL = "https://script.google.com/macros/s/AKfycbxyKJD9etJlzioM09crYIGHXqxNGZXq0-jadNDz3YMGMYAoZfeZ4dNmNsdne4vilEtUHw/exec";
const FIN_COMPTES = ['Compte courant', 'Épargne France', 'Épargne Espagne'];
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
function moisLisible(ym) {
  const MM = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const m = String(ym).match(/^(\d{4})-(\d{2})$/);
  if (!m) return String(ym);
  return MM[+m[2] - 1] + ' ' + m[1];
}
function nettoyerSaisie(v) {
  return String(v).replace(/[^\d.,-]/g, '');
}
function num(v) {
  if (v === '' || v === null || v === undefined) return 0;
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}
function moisCourt(ym) {
  const MM = ["jan.", "fév.", "mars", "avr.", "mai", "juin", "juil.", "août", "sep.", "oct.", "nov.", "déc."];
  const m = String(ym).match(/^(\d{4})-(\d{2})$/);
  if (!m) return String(ym);
  return MM[+m[2] - 1] + ' ' + m[1];
}
function moisCourantYM() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
const STUDENT_COLORS_MAP = {
  "1": "#FF6B6B",
  "2": "#4ECDC4",
  "3": "#45B7D1",
  "4": "#96CEB4",
  "5": "#FECA57",
  "6": "#FF9F43",
  "7": "#48DBFB",
  "8": "#FF9FF3"
};
function parseDuration(val) {
  if (!val) return 0;
  if (typeof val === 'number') {
    if (val < 1) return val * 24;
    if (val < 24) return val;
    return val / 60;
  }
  return 0;
}
function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  const s = String(val);
  if (s.includes('T') && (s.endsWith('Z') || s.includes('+00'))) {
    const d = new Date(s);
    if (!isNaN(d)) {
      return new Date(d.getTime() + 60 * 60 * 1000);
    }
  }
  const m = s.match(/Date\((\d+),(\d+),(\d+),?(\d*),?(\d*)/);
  if (m) return new Date(+m[1], +m[2], +m[3], +(m[4] || 0), +(m[5] || 0));
  const p = s.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (p) return new Date(+p[3], +p[2] - 1, +p[1], +p[4], +p[5]);
  return null;
}
function parseSheetData(raw) {
  const nomina = raw.nomina || [];
  const recap = raw.recap || [];
  const mois = raw.mois || [];
  const moisM1 = raw.moisM1 || [];
  const moisP1 = raw.moisP1 || [];
  const today = String(nomina[0]?.[0] || "").replace(/[^a-zA-Z0-9éèêëàâùûüôîïç\s]/gu, '').trim();
  const month = String(nomina[1]?.[0] || "").trim();
  const presentH = nomina[23]?.[3] || 0;
  const presentE = nomina[23]?.[4] || 0;
  const futurH = nomina[23]?.[5] || 0;
  const futurE = nomina[23]?.[6] || 0;
  const totalH = nomina[23]?.[7] || 0;
  const totalE = nomina[23]?.[8] || 0;
  const nextH = nomina[10]?.[3] || 0;
  const nextE = nomina[10]?.[4] || 0;
  const avgRate = nomina[23]?.[2] || 0;
  const actifs = nomina[23]?.[10] || "";
  const students = nomina.slice(14, 23).filter(r => r[0] && typeof r[0] === 'number' && r[1]).map(r => ({
    code: String(r[0]),
    name: String(r[1]).trim(),
    rate: r[2] || 0,
    presentH: r[3] || 0,
    presentE: r[4] || 0,
    futurH: r[5] || 0,
    futurE: r[6] || 0,
    totalH: r[7] || 0,
    totalE: r[8] || 0,
    color: STUDENT_COLORS_MAP[String(r[0])] || "#888"
  }));
  const m1rows = nomina.slice(2, 12).filter(r => r[6] && !String(r[6]).includes('TOTAL') && String(r[6]).length > 1);
  const m1TotalE = nomina[11]?.[8] || 0;
  const m1Label = "Mois précédent";
  const m2rows = nomina.slice(2, 12).filter(r => r[9] && !String(r[9]).includes('TOTAL') && String(r[9]).length > 1);
  const m2TotalE = nomina[11]?.[11] || 0;
  const history = recap.slice(2).filter(r => r[0] && (r[1] || r[2])).map(r => {
    let d = r[0];
    if (typeof d === 'string') {
      if (d.includes('T') && d.endsWith('Z')) {
        const raw = new Date(d);
        d = !isNaN(raw) ? new Date(raw.getTime() + 2 * 60 * 60 * 1000) : null;
      } else {
        const m = d.match(/Date\((\d+),(\d+)/);
        if (m) d = new Date(+m[1], +m[2], 1);
      }
    }
    if (!(d instanceof Date) || isNaN(d)) return null;
    const salary = typeof r[2] === 'number' ? r[2] : 0;
    if (salary <= 0) return null;
    return {
      month: d.toLocaleString('fr-FR', {
        month: 'short',
        year: 'numeric'
      }),
      salary: salary,
      hours: typeof r[1] === 'number' ? r[1] : 0,
      client: String(r[4] || '—')
    };
  }).filter(Boolean);
  const MOIS_FR = ["jan.", "fév.", "mars", "avr.", "mai", "juin", "juil.", "août", "sep.", "oct.", "nov.", "déc."];
  function parseNum(v) {
    if (typeof v === 'number') return v;
    if (v === null || v === undefined || v === '') return 0;
    const cleaned = String(v).replace(/[€\s\u00A0\u202F]/g, '').replace(/\./g, m => m).replace(',', '.');
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }
  function parseMonthLabel(v) {
    if (v === null || v === undefined || v === '') return null;
    if (v instanceof Date && !isNaN(v)) {
      return v.toLocaleString('fr-FR', {
        month: 'short',
        year: 'numeric'
      });
    }
    const s = String(v).trim();
    let m = s.match(/^(\d{1,2})\/(\d{4})$/);
    if (m) return `${MOIS_FR[+m[1] - 1]} ${m[2]}`;
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return `${MOIS_FR[+m[1] - 1]} ${m[3]}`;
    if (s.includes('T') && s.endsWith('Z')) {
      const d = new Date(s);
      if (!isNaN(d)) {
        const local = new Date(d.getTime() + 2 * 60 * 60 * 1000);
        return local.toLocaleString('fr-FR', {
          month: 'short',
          year: 'numeric'
        });
      }
    }
    m = s.match(/Date\((\d+),(\d+)/);
    if (m) return `${MOIS_FR[+m[2]]} ${m[1]}`;
    const d = new Date(s);
    if (!isNaN(d)) return d.toLocaleString('fr-FR', {
      month: 'short',
      year: 'numeric'
    });
    return null;
  }
  const graphRows = raw.graph || [];
  const graph = graphRows.slice(1).map(r => {
    if (!r || !r[0]) return null;
    const label = parseMonthLabel(r[0]);
    if (!label) return null;
    const salaires = parseNum(r[1]);
    const loyers = parseNum(r[2]);
    const chomage = parseNum(r[3]);
    let total = parseNum(r[4]);
    if (total === 0 && (salaires > 0 || loyers > 0 || chomage > 0)) {
      total = salaires + loyers + chomage;
    }
    return {
      month: label,
      salaires,
      loyers,
      chomage,
      total
    };
  }).filter(Boolean);
  function extractYear(v) {
    if (v === null || v === undefined || v === '') return null;
    if (v instanceof Date && !isNaN(v)) return v.getFullYear();
    const s = String(v).trim();
    let m = s.match(/^(\d{4})-/);
    if (m) {
      const d = new Date(s);
      if (!isNaN(d)) return new Date(d.getTime() + 2 * 60 * 60 * 1000).getFullYear();
      return +m[1];
    }
    m = s.match(/(\d{4})/);
    if (m) return +m[1];
    return null;
  }
  const declarer = raw.declarer || [];
  const declRows = declarer.slice(3);
  const COLS_REVENU = [3, 4, 6, 7, 8, 9, 10, 11];
  const revenusParAnnee = {};
  declRows.forEach(r => {
    if (!r || !r[0]) return;
    const year = extractYear(r[0]);
    if (!year) return;
    let somme = 0;
    COLS_REVENU.forEach(ci => {
      somme += parseNum(r[ci]);
    });
    if (!revenusParAnnee[year]) revenusParAnnee[year] = {
      total: 0,
      moisAvecDonnees: 0
    };
    revenusParAnnee[year].total += somme;
    revenusParAnnee[year].moisAvecDonnees += 1;
  });
  const anneeActuelle = new Date().getFullYear();
  const moisEcoules = new Date().getMonth() + 1;
  const moyenneParAnnee = {};
  Object.keys(revenusParAnnee).forEach(y => {
    const yNum = +y;
    const diviseur = yNum === anneeActuelle ? moisEcoules : 12;
    moyenneParAnnee[yNum] = {
      total: revenusParAnnee[y].total,
      diviseur: diviseur,
      moyenne: diviseur > 0 ? revenusParAnnee[y].total / diviseur : 0
    };
  });
  const anneesDisponibles = Object.keys(moyenneParAnnee).map(Number).sort((a, b) => b - a);
  function parseCourses(rows, isDone) {
    const now = new Date();
    return rows.filter(r => r[0] && r[1] && r[3] && /^\d$/.test(String(r[3]).trim())).map(r => {
      const d = parseDate(r[1]);
      if (!d) return null;
      let durationH = 1;
      const titleMatch = String(r[0]).match(/(\d+)h(\d+)-(\d+)h(\d+)/);
      if (titleMatch) {
        const start = +titleMatch[1] * 60 + +titleMatch[2];
        const end2 = +titleMatch[3] * 60 + +titleMatch[4];
        durationH = (end2 - start) / 60;
      }
      const durMin = durationH * 60;
      const end = new Date(d.getTime() + durMin * 60000);
      const done = isDone !== undefined ? isDone : end <= now;
      const code = String(r[3]).trim();
      const st = students.find(s => s.code === code);
      return {
        code,
        name: st?.name || `Élève ${code}`,
        date: d.toLocaleDateString('fr-FR', {
          weekday: 'short',
          day: 'numeric',
          month: 'short'
        }),
        time: d.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit'
        }),
        done,
        durationH
      };
    }).filter(Boolean);
  }
  const finCategories = (raw.finCategories || []).slice(1).filter(r => r && String(r[0]).trim()).map(r => ({
    nom: String(r[0]).trim(),
    type: String(r[1]).trim() === 'depense' ? 'depense' : 'revenu',
    actif: r[2] !== false && String(r[2]).toUpperCase() !== 'FALSE'
  }));
  const finArchives = (raw.finArchives || []).slice(1).filter(r => r && String(r[0]).trim()).map(r => ({
    mois: String(r[0]).trim(),
    categorie: String(r[1]).trim(),
    montant: parseNum(r[2])
  }));
  const finSoldes = (raw.finSoldes || []).slice(1).filter(r => r && String(r[0]).trim()).map(r => ({
    mois: String(r[0]).trim(),
    compte: String(r[1]).trim(),
    montant: parseNum(r[2])
  }));
  const typeParCat = {};
  finCategories.forEach(c => {
    typeParCat[c.nom] = c.type;
  });
  const moisPresents = {};
  finArchives.forEach(a => {
    moisPresents[a.mois] = true;
  });
  finSoldes.forEach(s => {
    moisPresents[s.mois] = true;
  });
  const finMensuel = Object.keys(moisPresents).sort().map(m => {
    const lignes = finArchives.filter(a => a.mois === m);
    let revenus = 0,
      depenses = 0;
    const parCat = {};
    lignes.forEach(a => {
      if (typeParCat[a.categorie] === 'depense') depenses += a.montant;else revenus += a.montant;
      parCat[a.categorie] = (parCat[a.categorie] || 0) + a.montant;
    });
    const patrimoine = finSoldes.filter(s => s.mois === m).reduce((t, x) => t + x.montant, 0);
    return {
      mois: m,
      label: moisCourt(m),
      annee: +m.slice(0, 4),
      revenus: revenus,
      depenses: depenses,
      solde: revenus - depenses,
      patrimoine: patrimoine,
      parCat: parCat
    };
  });
  return {
    today,
    month,
    summary: {
      presentH,
      presentE,
      futurH,
      futurE,
      totalH,
      totalE,
      nextH,
      nextE,
      avgRate: Math.round(avgRate * 100) / 100,
      actifs: String(actifs)
    },
    students,
    prevMonth: {
      label: m1Label,
      total: m1TotalE,
      items: m1rows.map(r => ({
        name: String(r[6]),
        h: r[7] || 0,
        e: r[8] || 0
      }))
    },
    nextMonth: {
      label: "Mois prochain",
      total: m2TotalE,
      items: m2rows.map(r => ({
        name: String(r[9]),
        h: r[10] || 0,
        e: r[11] || 0
      }))
    },
    courses: {
      cur: parseCourses(mois),
      prev: parseCourses(moisM1, true),
      next: parseCourses(moisP1, false)
    },
    history,
    graph,
    revenuMoyen: {
      parAnnee: moyenneParAnnee,
      annees: anneesDisponibles,
      anneeActuelle
    },
    finCategories: finCategories,
    finArchives: finArchives,
    finSoldes: finSoldes,
    finMensuel: finMensuel,
    updatedAt: raw.updatedAt || null
  };
}
const DATA_FALLBACK = {
  today: "Chargement…",
  month: "—",
  summary: {
    presentH: 0,
    presentE: 0,
    futurH: 0,
    futurE: 0,
    totalH: 0,
    totalE: 0,
    nextH: 0,
    nextE: 0,
    avgRate: 0,
    actifs: "—"
  },
  students: [],
  prevMonth: {
    label: "—",
    total: 0,
    items: []
  },
  nextMonth: {
    label: "—",
    total: 0,
    items: []
  },
  courses: {
    cur: [],
    prev: [],
    next: []
  },
  history: [],
  graph: [],
  revenuMoyen: {
    parAnnee: {},
    annees: [],
    anneeActuelle: new Date().getFullYear()
  },
  finCategories: [],
  finArchives: [],
  finSoldes: [],
  finMensuel: []
};
const fmtM = v => (v || 0).toLocaleString("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
}) + " €";
const fmtH = h => {
  if (!h || h <= 0) return "0h";
  const hh = Math.floor(h),
    mm = Math.round((h - hh) * 60);
  return `${hh}h${mm > 0 ? String(mm).padStart(2, "0") : ""}`;
};
const C = {
  bg: "#D6DEE8",
  white: "#FFFFFF",
  ink: "#1A1A2E",
  ink2: "#4A4A6A",
  ink3: "#9090B0",
  border: "#E8E8F0",
  shadow: "0 2px 16px rgba(0,0,0,0.07)",
  shadowHov: "0 6px 32px rgba(0,0,0,0.13)"
};
const STUDENT_COLORS = {
  "1": "#FF6B6B",
  "2": "#4ECDC4",
  "3": "#45B7D1",
  "4": "#96CEB4",
  "5": "#FECA57",
  "6": "#FF9F43",
  "7": "#48DBFB",
  "8": "#FF9FF3"
};
const sc = code => STUDENT_COLORS[code] || "#888";
const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { overscroll-behavior-y: contain; }
  body { background: ${C.bg}; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  .fade-up { animation: fadeUp 0.4s ease both; }
  .fade-up-2 { animation: fadeUp 0.4s 0.08s ease both; }
  .fade-up-3 { animation: fadeUp 0.4s 0.16s ease both; }
  .fade-up-4 { animation: fadeUp 0.4s 0.24s ease both; }
  .card:hover { transform: translateY(-2px); box-shadow: ${C.shadowHov}; }
  .tab-btn:hover { background: #f0f0f8; }
  .nav-tab.active { border-bottom: 3px solid ${C.ink}; color: ${C.ink}; }
  .nav-tab:hover:not(.active) { color: ${C.ink2}; }
`;
function KpiCard({
  label,
  value,
  sub,
  color,
  delay = ""
}) {
  return React.createElement("div", {
    className: `card fade-up${delay}`,
    style: {
      background: C.white,
      borderRadius: 16,
      padding: "20px 22px",
      boxShadow: C.shadow,
      transition: "all .25s ease",
      borderTop: `4px solid ${color}`
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11,
      fontFamily: "DM Sans",
      fontWeight: 600,
      color: C.ink3,
      textTransform: "uppercase",
      letterSpacing: ".1em",
      marginBottom: 6
    }
  }, label), React.createElement("div", {
    style: {
      fontSize: 26,
      fontFamily: "Playfair Display",
      fontWeight: 700,
      color: C.ink,
      lineHeight: 1
    }
  }, value), sub && React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.ink3,
      marginTop: 5,
      fontFamily: "DM Sans"
    }
  }, sub));
}
function StudentChip({
  code,
  name,
  color,
  small
}) {
  return React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      background: color + "18",
      border: `1.5px solid ${color}44`,
      borderRadius: 20,
      padding: small ? "3px 10px" : "5px 14px",
      fontFamily: "DM Sans",
      fontSize: small ? 10 : 12,
      fontWeight: 600,
      color: color
    }
  }, React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: "50%",
      background: color,
      flexShrink: 0
    }
  }), small ? code : `${code} · ${name}`);
}
function SectionTitle({
  children,
  accent
}) {
  return React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginBottom: 20
    }
  }, accent && React.createElement("div", {
    style: {
      width: 4,
      height: 28,
      borderRadius: 2,
      background: accent
    }
  }), React.createElement("h2", {
    style: {
      fontFamily: "Playfair Display",
      fontSize: 20,
      fontWeight: 700,
      color: C.ink
    }
  }, children));
}
function PageAccueil({
  data,
  onRefresh
}) {
  const s = data.summary;
  const actifs = data.students.filter(s => s.totalH > 0);
  const totalE = actifs.reduce((a, s) => a + s.totalE, 0);
  const pct = s.totalH > 0 ? Math.round(s.presentH / s.totalH * 100) : 0;
  const rm = data.revenuMoyen || {
    parAnnee: {},
    annees: [],
    anneeActuelle: new Date().getFullYear()
  };
  const [selYear, setSelYear] = useState(null);
  const yearToShow = selYear || (rm.annees.length > 0 ? rm.annees[0] : rm.anneeActuelle);
  const rmData = rm.parAnnee[yearToShow] || {
    moyenne: 0,
    total: 0,
    diviseur: 12
  };
  return React.createElement("div", {
    style: {
      padding: "32px 28px",
      maxWidth: 980,
      margin: "0 auto"
    }
  }, rm.annees.length > 0 && React.createElement("div", {
    className: "fade-up",
    style: {
      background: C.white,
      borderRadius: 20,
      padding: "22px 26px",
      marginBottom: 20,
      boxShadow: C.shadow,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 16,
      borderLeft: `5px solid #96CEB4`
    }
  }, React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 11,
      fontFamily: "DM Sans",
      fontWeight: 600,
      color: C.ink3,
      textTransform: "uppercase",
      letterSpacing: ".1em",
      marginBottom: 6
    }
  }, "Revenu moyen mensuel — ", yearToShow), React.createElement("div", {
    style: {
      fontFamily: "Playfair Display",
      fontSize: 32,
      fontWeight: 900,
      color: C.ink,
      lineHeight: 1
    }
  }, fmtM(rmData.moyenne)), React.createElement("div", {
    style: {
      fontSize: 11,
      color: C.ink3,
      fontFamily: "DM Sans",
      marginTop: 5
    }
  }, fmtM(rmData.total), " sur ", rmData.diviseur, " mois")), React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, React.createElement("span", {
    style: {
      fontSize: 10,
      color: C.ink3,
      fontFamily: "DM Sans",
      textTransform: "uppercase",
      letterSpacing: ".08em"
    }
  }, "Année"), React.createElement("select", {
    value: yearToShow,
    onChange: e => setSelYear(+e.target.value),
    style: {
      padding: "10px 16px",
      borderRadius: 10,
      border: `2px solid ${C.border}`,
      background: C.bg,
      color: C.ink,
      fontFamily: "DM Sans",
      fontSize: 15,
      fontWeight: 700,
      cursor: "pointer",
      outline: "none"
    }
  }, rm.annees.map(y => React.createElement("option", {
    key: y,
    value: y
  }, y))))), React.createElement("div", {
    className: "fade-up",
    style: {
      background: `linear-gradient(135deg, ${C.ink} 0%, #2d2d5e 100%)`,
      borderRadius: 24,
      padding: "32px 36px",
      marginBottom: 28,
      color: "white",
      position: "relative",
      overflow: "hidden"
    }
  }, React.createElement("div", {
    style: {
      position: "absolute",
      top: -40,
      right: -40,
      width: 200,
      height: 200,
      borderRadius: "50%",
      background: "rgba(255,255,255,0.04)"
    }
  }), React.createElement("div", {
    style: {
      position: "absolute",
      bottom: -60,
      right: 80,
      width: 140,
      height: 140,
      borderRadius: "50%",
      background: "rgba(255,255,255,0.04)"
    }
  }), React.createElement("div", {
    style: {
      fontFamily: "DM Sans",
      fontSize: 12,
      fontWeight: 500,
      opacity: .6,
      letterSpacing: ".12em",
      textTransform: "uppercase",
      marginBottom: 8
    }
  }, data.today), React.createElement("div", {
    style: {
      fontFamily: "Playfair Display",
      fontSize: 34,
      fontWeight: 900,
      lineHeight: 1.1,
      marginBottom: 16
    }
  }, data.month), React.createElement("div", {
    style: {
      marginBottom: 20
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      fontSize: 12,
      opacity: .7,
      fontFamily: "DM Sans",
      marginBottom: 6
    }
  }, React.createElement("span", null, fmtH(s.presentH), " réalisé"), React.createElement("span", null, pct, "% du mois"), React.createElement("span", null, fmtH(s.futurH), " restant")), React.createElement("div", {
    style: {
      height: 8,
      background: "rgba(255,255,255,0.15)",
      borderRadius: 4,
      overflow: "hidden"
    }
  }, React.createElement("div", {
    style: {
      width: `${pct}%`,
      height: "100%",
      background: "linear-gradient(90deg,#FECA57,#FF6B6B)",
      borderRadius: 4,
      transition: "width 1s ease"
    }
  }))), React.createElement("div", {
    style: {
      display: "flex",
      gap: 32,
      flexWrap: "wrap"
    }
  }, React.createElement("div", null, React.createElement("div", {
    style: {
      fontFamily: "Playfair Display",
      fontSize: 38,
      fontWeight: 900,
      lineHeight: 1
    }
  }, fmtM(totalE)), React.createElement("div", {
    style: {
      fontSize: 12,
      opacity: .6,
      fontFamily: "DM Sans",
      marginTop: 3
    }
  }, "Total mois en cours")), React.createElement("div", {
    style: {
      width: 1,
      background: "rgba(255,255,255,0.15)",
      margin: "4px 0"
    }
  }), React.createElement("div", null, React.createElement("div", {
    style: {
      fontFamily: "Playfair Display",
      fontSize: 28,
      fontWeight: 700,
      color: "#FECA57",
      lineHeight: 1
    }
  }, fmtM(data.nextMonth?.total || 0)), React.createElement("div", {
    style: {
      fontSize: 12,
      opacity: .6,
      fontFamily: "DM Sans",
      marginTop: 3
    }
  }, "Mois prochain estimé")))), React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
      gap: 14,
      marginBottom: 28
    }
  }, React.createElement(KpiCard, {
    label: "Heures réalisées",
    value: fmtH(s.presentH),
    color: "#FF6B6B",
    delay: ""
  }), React.createElement(KpiCard, {
    label: "Heures restantes",
    value: fmtH(s.futurH),
    color: "#45B7D1",
    delay: "-2"
  }), React.createElement(KpiCard, {
    label: "Total heures mois",
    value: fmtH(s.totalH),
    color: "#4ECDC4",
    delay: "-3"
  }), React.createElement(KpiCard, {
    label: "Prix moyen / h",
    value: `${Number(s.avgRate).toFixed(2)} €`,
    color: "#FECA57",
    delay: "-4"
  }), React.createElement(KpiCard, {
    label: "Clients actifs",
    value: String(s.actifs).replace(/Actifs\s*:\s*/i, ""),
    color: "#96CEB4",
    delay: "-4"
  })), React.createElement("div", {
    className: "fade-up-2",
    style: {
      background: C.white,
      borderRadius: 20,
      padding: "24px 28px",
      boxShadow: C.shadow,
      marginBottom: 28
    }
  }, React.createElement(SectionTitle, {
    accent: "#45B7D1"
  }, "Élèves — ", data.month || "mois en cours"), React.createElement("div", {
    style: {
      overflowX: "auto"
    }
  }, React.createElement("table", {
    style: {
      width: "100%",
      borderCollapse: "separate",
      borderSpacing: "0 4px",
      fontFamily: "DM Sans",
      fontSize: 13
    }
  }, React.createElement("thead", null, React.createElement("tr", null, ["", "Élève", "Tarif", "Réalisé", "€ réal.", "Restant", "€ rest.", "Total h", "Total €"].map(h => React.createElement("th", {
    key: h,
    style: {
      textAlign: "left",
      padding: "8px 12px",
      fontSize: 10,
      fontWeight: 600,
      color: C.ink3,
      textTransform: "uppercase",
      letterSpacing: ".08em",
      borderBottom: `2px solid ${C.border}`
    }
  }, h)))), React.createElement("tbody", null, data.students.map((st, i) => {
    const col = sc(st.code);
    const active = st.totalH > 0;
    return React.createElement("tr", {
      key: i,
      style: {
        opacity: active ? 1 : .45
      }
    }, React.createElement("td", {
      style: {
        padding: "10px 12px"
      }
    }, React.createElement("div", {
      style: {
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: col
      }
    })), React.createElement("td", {
      style: {
        padding: "10px 12px",
        fontWeight: 600,
        color: C.ink
      }
    }, st.name), React.createElement("td", {
      style: {
        padding: "10px 12px",
        color: C.ink3
      }
    }, st.rate, " €/h"), React.createElement("td", {
      style: {
        padding: "10px 12px",
        fontWeight: 600,
        color: "#FF6B6B"
      }
    }, fmtH(st.presentH)), React.createElement("td", {
      style: {
        padding: "10px 12px",
        color: "#FF6B6B"
      }
    }, fmtM(st.presentE)), React.createElement("td", {
      style: {
        padding: "10px 12px",
        fontWeight: 600,
        color: "#45B7D1"
      }
    }, fmtH(st.futurH)), React.createElement("td", {
      style: {
        padding: "10px 12px",
        color: "#45B7D1"
      }
    }, fmtM(st.futurE)), React.createElement("td", {
      style: {
        padding: "10px 12px",
        fontWeight: 700,
        color: C.ink
      }
    }, fmtH(st.totalH)), React.createElement("td", {
      style: {
        padding: "10px 12px"
      }
    }, active ? React.createElement("span", {
      style: {
        background: col + "18",
        color: col,
        fontWeight: 700,
        padding: "4px 10px",
        borderRadius: 8,
        fontSize: 12
      }
    }, fmtM(st.totalE)) : React.createElement("span", {
      style: {
        color: C.ink3
      }
    }, "—")));
  }), React.createElement("tr", {
    style: {
      borderTop: `2px solid ${C.border}`
    }
  }, React.createElement("td", {
    colSpan: 3,
    style: {
      padding: "12px 12px",
      fontWeight: 700,
      fontFamily: "DM Sans",
      color: C.ink
    }
  }, "TOTAL"), React.createElement("td", {
    style: {
      padding: "12px 12px",
      fontWeight: 700,
      color: "#FF6B6B"
    }
  }, fmtH(s.presentH)), React.createElement("td", {
    style: {
      padding: "12px 12px",
      fontWeight: 700,
      color: "#FF6B6B"
    }
  }, fmtM(s.presentE)), React.createElement("td", {
    style: {
      padding: "12px 12px",
      fontWeight: 700,
      color: "#45B7D1"
    }
  }, fmtH(s.futurH)), React.createElement("td", {
    style: {
      padding: "12px 12px",
      fontWeight: 700,
      color: "#45B7D1"
    }
  }, fmtM(s.futurE)), React.createElement("td", {
    style: {
      padding: "12px 12px",
      fontWeight: 700,
      color: C.ink
    }
  }, fmtH(s.totalH)), React.createElement("td", {
    style: {
      padding: "12px 12px"
    }
  }, React.createElement("span", {
    style: {
      background: "#1A1A2E",
      color: "white",
      fontWeight: 700,
      padding: "5px 12px",
      borderRadius: 8,
      fontSize: 13
    }
  }, fmtM(totalE)))))))), React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 16
    }
  }, [{
    data: data.prevMonth,
    accent: "#FF6B6B",
    icon: "◀",
    label: "Mois précédent"
  }, {
    data: data.nextMonth,
    accent: "#4ECDC4",
    icon: "▶",
    label: "Mois prochain"
  }].map(({
    data: m,
    accent,
    icon,
    label
  }, i) => React.createElement("div", {
    key: i,
    className: `card fade-up-${i + 3}`,
    style: {
      background: C.white,
      borderRadius: 20,
      padding: "22px 24px",
      boxShadow: C.shadow,
      transition: "all .25s ease"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 14
    }
  }, React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 10,
      fontFamily: "DM Sans",
      fontWeight: 600,
      color: C.ink3,
      textTransform: "uppercase",
      letterSpacing: ".1em",
      marginBottom: 3
    }
  }, label), React.createElement("div", {
    style: {
      fontFamily: "Playfair Display",
      fontSize: 16,
      fontWeight: 700,
      color: C.ink
    }
  }, m.label)), React.createElement("div", {
    style: {
      fontFamily: "Playfair Display",
      fontSize: 22,
      fontWeight: 900,
      color: accent
    }
  }, fmtM(m.total))), React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6
    }
  }, m.items.map((it, j) => React.createElement("div", {
    key: j,
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      width: "100%",
      padding: "7px 12px",
      background: accent + "10",
      borderRadius: 8,
      fontSize: 12,
      fontFamily: "DM Sans"
    }
  }, React.createElement("span", {
    style: {
      color: C.ink,
      fontWeight: 500
    }
  }, it.name), React.createElement("span", {
    style: {
      color: accent,
      fontWeight: 700
    }
  }, fmtH(it.h), " · ", fmtM(it.e)))))))));
}
function PageCours({
  data
}) {
  const [tab, setTab] = useState("cur");
  const MOIS_TABS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  const now = new Date();
  const curM = now.getMonth(),
    curY = now.getFullYear();
  const prevM = curM === 0 ? 11 : curM - 1,
    prevY = curM === 0 ? curY - 1 : curY;
  const nextM = curM === 11 ? 0 : curM + 1,
    nextY = curM === 11 ? curY + 1 : curY;
  const tabs = [{
    id: "cur",
    label: `${MOIS_TABS[curM]} ${curY}`
  }, {
    id: "prev",
    label: `${MOIS_TABS[prevM]} ${prevY}`
  }, {
    id: "next",
    label: `${MOIS_TABS[nextM]} ${nextY}`
  }];
  const courses = data.courses && data.courses[tab] || [];
  const byCode = courses.reduce((a, e) => {
    if (!a[e.code]) a[e.code] = [];
    a[e.code].push(e);
    return a;
  }, {});
  return React.createElement("div", {
    style: {
      padding: "32px 28px",
      maxWidth: 980,
      margin: "0 auto"
    }
  }, React.createElement("div", {
    className: "fade-up",
    style: {
      marginBottom: 28
    }
  }, React.createElement(SectionTitle, {
    accent: "#4ECDC4"
  }, "Calendrier des cours"), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, tabs.map(t => React.createElement("button", {
    key: t.id,
    onClick: () => setTab(t.id),
    style: {
      padding: "9px 20px",
      borderRadius: 20,
      border: `2px solid ${tab === t.id ? C.ink : C.border}`,
      background: tab === t.id ? C.ink : C.white,
      color: tab === t.id ? "white" : C.ink2,
      fontFamily: "DM Sans",
      fontSize: 13,
      fontWeight: 600,
      cursor: "pointer",
      transition: "all .2s"
    }
  }, t.label)))), React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 16
    }
  }, Object.entries(byCode).map(([code, evs], i) => {
    const col = sc(code);
    const name = evs[0].name;
    const doneCount = evs.filter(e => e.done).length;
    return React.createElement("div", {
      key: code,
      className: `card fade-up-${Math.min(i + 1, 4)}`,
      style: {
        background: C.white,
        borderRadius: 20,
        padding: "22px 26px",
        boxShadow: C.shadow,
        transition: "all .25s ease",
        borderLeft: `5px solid ${col}`
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
        flexWrap: "wrap",
        gap: 8
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 12
      }
    }, React.createElement("div", {
      style: {
        width: 44,
        height: 44,
        borderRadius: 12,
        background: col + "20",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 20,
        fontWeight: 900,
        color: col,
        fontFamily: "Playfair Display"
      }
    }, code), React.createElement("div", null, React.createElement("div", {
      style: {
        fontFamily: "Playfair Display",
        fontSize: 18,
        fontWeight: 700,
        color: C.ink
      }
    }, name), React.createElement("div", {
      style: {
        fontSize: 11,
        color: C.ink3,
        fontFamily: "DM Sans",
        marginTop: 2
      }
    }, doneCount, "/", evs.length, " séances réalisées"))), React.createElement("div", {
      style: {
        display: "flex",
        gap: 6,
        alignItems: "center"
      }
    }, React.createElement("div", {
      style: {
        height: 8,
        width: 80,
        borderRadius: 4,
        background: col + "22",
        overflow: "hidden"
      }
    }, React.createElement("div", {
      style: {
        width: `${evs.length > 0 ? doneCount / evs.length * 100 : 0}%`,
        height: "100%",
        background: col,
        borderRadius: 4
      }
    })), React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: 700,
        color: col,
        fontFamily: "DM Sans"
      }
    }, evs.length > 0 ? Math.round(doneCount / evs.length * 100) : 0, "%"))), React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 8
      }
    }, evs.map((e, j) => React.createElement("div", {
      key: j,
      style: {
        padding: "8px 14px",
        borderRadius: 10,
        background: e.done ? col + "15" : C.bg,
        border: `1.5px solid ${e.done ? col + "60" : C.border}`,
        fontFamily: "DM Sans",
        fontSize: 12
      }
    }, React.createElement("span", {
      style: {
        fontWeight: 600,
        color: e.done ? col : C.ink
      }
    }, e.date), React.createElement("span", {
      style: {
        color: C.ink3,
        marginLeft: 6
      }
    }, e.time), e.done && React.createElement("span", {
      style: {
        marginLeft: 6,
        color: col
      }
    }, "✓")))));
  }), courses.length === 0 && React.createElement("p", {
    style: {
      color: C.ink3,
      textAlign: "center",
      padding: 40,
      fontFamily: "DM Sans"
    }
  }, "Aucun cours pour cette période.")));
}
function PageAnalyse({
  data
}) {
  const serie = data.finMensuel || [];
  const cats = data.finCategories || [];
  const typeDe = {};
  cats.forEach(c => {
    typeDe[c.nom] = c.type;
  });
  const [selY, setSelY] = useState(null);
  const [zoom, setZoom] = useState(null);
  if (serie.length === 0) {
    return React.createElement("div", {
      style: {
        padding: "40px 28px",
        maxWidth: 980,
        margin: "0 auto",
        textAlign: "center",
        color: C.ink3,
        fontFamily: "DM Sans",
        lineHeight: 1.7
      }
    }, "Aucune donnée à analyser pour l'instant.", React.createElement("br", null), "Saisis un mois dans ", React.createElement("strong", null, "Situation"), ", ou importe ton historique depuis Google\xA0Sheets (menu ", React.createElement("strong", null, "⚙️ Finances → Importer l'historique"), ").");
  }
  const totRev = serie.reduce((a, r) => a + r.revenus, 0);
  const totDep = serie.reduce((a, r) => a + r.depenses, 0);
  const moisAvecFlux = serie.filter(r => r.revenus > 0 || r.depenses > 0);
  const soldeMoyen = moisAvecFlux.length ? (totRev - totDep) / moisAvecFlux.length : 0;
  const avecPat = serie.filter(r => r.patrimoine > 0);
  const patActuel = avecPat.length ? avecPat[avecPat.length - 1].patrimoine : 0;
  const patPrec = avecPat.length > 1 ? avecPat[avecPat.length - 2].patrimoine : null;
  const varPat = patPrec && patPrec > 0 ? (patActuel - patPrec) / patPrec * 100 : null;
  const parAnnee = {};
  serie.forEach(r => {
    if (!parAnnee[r.annee]) parAnnee[r.annee] = {
      revenus: 0,
      depenses: 0,
      mois: 0,
      patrimoine: 0
    };
    parAnnee[r.annee].revenus += r.revenus;
    parAnnee[r.annee].depenses += r.depenses;
    if (r.revenus > 0 || r.depenses > 0) parAnnee[r.annee].mois += 1;
    if (r.patrimoine > 0) parAnnee[r.annee].patrimoine = r.patrimoine;
  });
  const annees = Object.keys(parAnnee).map(Number).sort((a, b) => a - b);
  const anneeRep = selY || (annees.length ? annees[annees.length - 1] : null);
  const repart = {};
  serie.filter(r => r.annee === anneeRep).forEach(r => {
    Object.keys(r.parCat).forEach(k => {
      if (typeDe[k] === 'depense') return;
      repart[k] = (repart[k] || 0) + r.parCat[k];
    });
  });
  const PALETTE = ['#45B7D1', '#FF6B6B', '#FECA57', '#96CEB4', '#A78BFA', '#FB923C', '#4ECDC4', '#F472B6'];
  const partsRep = Object.keys(repart).map((k, i) => ({
    nom: k,
    value: repart[k],
    color: PALETTE[i % PALETTE.length]
  })).filter(p => p.value > 0).sort((a, b) => b.value - a.value);
  const totRep = partsRep.reduce((a, p) => a + p.value, 0);
  function donut(parts, size) {
    const tot = parts.reduce((a, p) => a + p.value, 0);
    if (tot <= 0) return React.createElement("div", {
      style: {
        color: C.ink3,
        fontSize: 12,
        fontFamily: "DM Sans"
      }
    }, "Aucune donnée");
    const R = size / 2,
      r = R * 0.62,
      cx = R,
      cy = R;
    let angle = -Math.PI / 2;
    const arcs = parts.map(p => {
      const frac = p.value / tot,
        a0 = angle,
        a1 = angle + frac * 2 * Math.PI;
      angle = a1;
      const large = frac > 0.5 ? 1 : 0;
      const x0 = cx + R * Math.cos(a0),
        y0 = cy + R * Math.sin(a0);
      const x1 = cx + R * Math.cos(a1),
        y1 = cy + R * Math.sin(a1);
      const xi1 = cx + r * Math.cos(a1),
        yi1 = cy + r * Math.sin(a1);
      const xi0 = cx + r * Math.cos(a0),
        yi0 = cy + r * Math.sin(a0);
      return {
        d: `M${x0},${y0} A${R},${R} 0 ${large} 1 ${x1},${y1} L${xi1},${yi1} A${r},${r} 0 ${large} 0 ${xi0},${yi0} Z`,
        color: p.color
      };
    });
    return React.createElement("svg", {
      viewBox: `0 0 ${size} ${size}`,
      style: {
        width: size,
        height: size,
        flexShrink: 0
      }
    }, arcs.map((a, i) => React.createElement("path", {
      key: i,
      d: a.d,
      fill: a.color
    })), React.createElement("circle", {
      cx: cx,
      cy: cy,
      r: r - 1,
      fill: C.white
    }), React.createElement("text", {
      x: cx,
      y: cy - 4,
      textAnchor: "middle",
      fontSize: 11,
      fill: C.ink3,
      fontFamily: "DM Sans"
    }, "Total"), React.createElement("text", {
      x: cx,
      y: cy + 14,
      textAnchor: "middle",
      fontSize: 14,
      fontWeight: "700",
      fill: C.ink,
      fontFamily: "Playfair Display"
    }, Math.round(tot), "€"));
  }
  function courbe(series, grand, cle) {
    const W = 820,
      H = grand ? 380 : 190;
    const P = {
      t: 18,
      r: 16,
      b: grand ? 48 : 30,
      l: grand ? 58 : 48
    };
    const iW = W - P.l - P.r,
      iH = H - P.t - P.b;
    const n = serie.length;
    let maxV = 100;
    series.forEach(s => serie.forEach(r => {
      if (r[s.champ] > maxV) maxV = r[s.champ];
    }));
    const X = i => P.l + (n <= 1 ? iW / 2 : i * iW / (n - 1));
    const Y = v => P.t + iH * (1 - v / maxV);
    const pas = grand ? 1 : Math.max(1, Math.ceil(n / 8));
    return React.createElement("svg", {
      viewBox: `0 0 ${W} ${H}`,
      style: {
        width: "100%",
        fontFamily: "DM Sans"
      }
    }, React.createElement("defs", null, series.map((s, si) => React.createElement("linearGradient", {
      key: si,
      id: `g-${cle}-${si}${grand ? '-b' : ''}`,
      x1: "0",
      y1: "0",
      x2: "0",
      y2: "1"
    }, React.createElement("stop", {
      offset: "0%",
      stopColor: s.couleur,
      stopOpacity: "0.22"
    }), React.createElement("stop", {
      offset: "100%",
      stopColor: s.couleur,
      stopOpacity: "0"
    })))), [0, .25, .5, .75, 1].map((f, i) => {
      const y = P.t + iH * (1 - f);
      return React.createElement("g", {
        key: i
      }, React.createElement("line", {
        x1: P.l,
        x2: P.l + iW,
        y1: y,
        y2: y,
        stroke: "#f0f0f8",
        strokeWidth: 1
      }), React.createElement("text", {
        x: P.l - 6,
        y: y + 4,
        textAnchor: "end",
        fontSize: grand ? 11 : 9,
        fill: C.ink3
      }, Math.round(maxV * f), "€"));
    }), series.map((s, si) => {
      const pts = serie.map((r, i) => ({
        x: X(i),
        y: Y(r[s.champ]),
        v: r[s.champ]
      }));
      const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
      const aire = `${path} L${pts[pts.length - 1].x.toFixed(1)},${P.t + iH} L${pts[0].x.toFixed(1)},${P.t + iH} Z`;
      return React.createElement("g", {
        key: si
      }, series.length === 1 && React.createElement("path", {
        d: aire,
        fill: `url(#g-${cle}-${si}${grand ? '-b' : ''})`
      }), React.createElement("path", {
        d: path,
        fill: "none",
        stroke: s.couleur,
        strokeWidth: grand ? 3 : 2.4,
        strokeLinejoin: "round"
      }), pts.map((p, i) => {
        const dernier = i === pts.length - 1;
        return React.createElement("g", {
          key: i
        }, React.createElement("circle", {
          cx: p.x,
          cy: p.y,
          r: dernier ? grand ? 6 : 4.5 : grand ? 4 : 2.6,
          fill: s.couleur
        }), grand && p.v > 0 && React.createElement("text", {
          x: p.x,
          y: p.y - 11,
          textAnchor: "middle",
          fontSize: 9,
          fill: s.couleur,
          fontWeight: dernier ? 700 : 500
        }, Math.round(p.v), "€"));
      }));
    }), serie.map((r, i) => (i === 0 || i === n - 1 || i % pas === 0) && React.createElement("text", {
      key: i,
      x: X(i),
      y: P.t + iH + (grand ? 20 : 16),
      textAnchor: "middle",
      fontSize: grand ? 9 : 7.5,
      fill: i === n - 1 ? C.ink : C.ink3,
      fontWeight: i === n - 1 ? 700 : 400,
      transform: grand ? `rotate(-35 ${X(i)} ${P.t + iH + 20})` : undefined
    }, r.label)));
  }
  const SERIE_FLUX = [{
    champ: 'revenus',
    couleur: '#2E8B57',
    nom: 'Revenus'
  }, {
    champ: 'depenses',
    couleur: '#E04848',
    nom: 'Dépenses'
  }];
  const SERIE_PAT = [{
    champ: 'patrimoine',
    couleur: '#1F7A99',
    nom: 'Patrimoine'
  }];
  const titreZoom = zoom === 'flux' ? 'Revenus et dépenses' : 'Évolution du patrimoine';
  return React.createElement("div", {
    style: {
      padding: "32px 28px",
      maxWidth: 980,
      margin: "0 auto"
    }
  }, zoom && React.createElement("div", {
    onClick: () => setZoom(null),
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.7)",
      zIndex: 1000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20
    }
  }, React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      background: C.white,
      borderRadius: 24,
      padding: "28px 24px",
      width: "100%",
      maxWidth: 1100,
      maxHeight: "90vh",
      overflow: "auto",
      boxShadow: "0 24px 80px rgba(0,0,0,0.3)"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16
    }
  }, React.createElement(SectionTitle, {
    accent: zoom === 'flux' ? '#2E8B57' : '#1F7A99'
  }, titreZoom), React.createElement("button", {
    onClick: () => setZoom(null),
    style: {
      border: "none",
      background: C.bg,
      borderRadius: 8,
      width: 36,
      height: 36,
      fontSize: 18,
      cursor: "pointer",
      color: C.ink2,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, "✕")), zoom === 'flux' ? courbe(SERIE_FLUX, true, 'flux') : courbe(SERIE_PAT, true, 'pat'))), React.createElement("div", {
    className: "fade-up",
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
      gap: 14,
      marginBottom: 24
    }
  }, React.createElement(KpiCard, {
    label: "Patrimoine actuel",
    value: fmtM(patActuel),
    color: "#1F7A99",
    sub: varPat !== null ? `${varPat >= 0 ? '▲' : '▼'} ${Math.abs(varPat).toFixed(1)}% vs mois précédent` : null
  }), React.createElement(KpiCard, {
    label: "Solde moyen / mois",
    value: fmtM(soldeMoyen),
    color: soldeMoyen >= 0 ? "#2E8B57" : "#E04848",
    delay: "-2"
  }), React.createElement(KpiCard, {
    label: "Revenus cumulés",
    value: fmtM(totRev),
    color: "#45B7D1",
    delay: "-3"
  }), React.createElement(KpiCard, {
    label: "Dépenses cumulées",
    value: fmtM(totDep),
    color: "#E04848",
    delay: "-4"
  })), React.createElement("div", {
    className: "fade-up-2",
    style: {
      background: C.white,
      borderRadius: 20,
      padding: "24px 28px",
      boxShadow: C.shadow,
      marginBottom: 20
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 8
    }
  }, React.createElement(SectionTitle, {
    accent: "#2E8B57"
  }, "Revenus et dépenses"), React.createElement("button", {
    onClick: () => setZoom('flux'),
    style: {
      border: `1px solid ${C.border}`,
      background: C.bg,
      borderRadius: 8,
      padding: "5px 10px",
      fontSize: 12,
      cursor: "pointer",
      color: C.ink2,
      fontFamily: "DM Sans",
      flexShrink: 0
    }
  }, "⛶ Agrandir")), React.createElement("div", {
    onClick: () => setZoom('flux'),
    style: {
      overflowX: "auto",
      cursor: "pointer"
    }
  }, courbe(SERIE_FLUX, false, 'flux')), React.createElement("div", {
    style: {
      display: "flex",
      gap: 16,
      marginTop: 10,
      paddingLeft: 4
    }
  }, SERIE_FLUX.map((s, i) => React.createElement("span", {
    key: i,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      fontSize: 11,
      color: C.ink2,
      fontFamily: "DM Sans"
    }
  }, React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: 3,
      background: s.couleur
    }
  }), s.nom)))), React.createElement("div", {
    className: "fade-up-2",
    style: {
      background: C.white,
      borderRadius: 20,
      padding: "24px 28px",
      boxShadow: C.shadow,
      marginBottom: 20
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 8
    }
  }, React.createElement(SectionTitle, {
    accent: "#1F7A99"
  }, "Évolution du patrimoine"), React.createElement("button", {
    onClick: () => setZoom('patrimoine'),
    style: {
      border: `1px solid ${C.border}`,
      background: C.bg,
      borderRadius: 8,
      padding: "5px 10px",
      fontSize: 12,
      cursor: "pointer",
      color: C.ink2,
      fontFamily: "DM Sans",
      flexShrink: 0
    }
  }, "⛶ Agrandir")), avecPat.length === 0 ? React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.ink3,
      fontFamily: "DM Sans",
      padding: "16px 0"
    }
  }, "Saisis tes soldes d'épargne dans ", React.createElement("strong", null, "Situation"), " pour voir la courbe apparaître.") : React.createElement("div", {
    onClick: () => setZoom('patrimoine'),
    style: {
      overflowX: "auto",
      cursor: "pointer"
    }
  }, courbe(SERIE_PAT, false, 'pat'))), React.createElement("div", {
    className: "fade-up-3",
    style: {
      background: C.white,
      borderRadius: 20,
      padding: "24px 28px",
      boxShadow: C.shadow,
      marginBottom: 20
    }
  }, React.createElement(SectionTitle, {
    accent: "#96CEB4"
  }, "Comparaison par année"), React.createElement("div", {
    style: {
      overflowX: "auto"
    }
  }, React.createElement("table", {
    style: {
      width: "100%",
      borderCollapse: "separate",
      borderSpacing: "0 4px",
      fontFamily: "DM Sans",
      fontSize: 12
    }
  }, React.createElement("thead", null, React.createElement("tr", null, ["Année", "Revenus", "Dépenses", "Solde", "Moy./mois", "Patrimoine"].map(h => React.createElement("th", {
    key: h,
    style: {
      textAlign: "left",
      padding: "8px 12px",
      fontSize: 10,
      fontWeight: 600,
      color: C.ink3,
      textTransform: "uppercase",
      letterSpacing: ".08em",
      borderBottom: `2px solid ${C.border}`
    }
  }, h)))), React.createElement("tbody", null, annees.map((y, i) => {
    const a = parAnnee[y];
    const solde = a.revenus - a.depenses;
    const moy = a.mois > 0 ? solde / a.mois : 0;
    return React.createElement("tr", {
      key: i,
      style: {
        background: i % 2 === 0 ? "#F4F7FA" : C.white
      }
    }, React.createElement("td", {
      style: {
        padding: "10px 12px",
        fontWeight: 700,
        color: C.ink
      }
    }, y), React.createElement("td", {
      style: {
        padding: "10px 12px",
        color: "#2E8B57",
        fontWeight: 500
      }
    }, fmtM(a.revenus)), React.createElement("td", {
      style: {
        padding: "10px 12px",
        color: "#E04848",
        fontWeight: 500
      }
    }, a.depenses > 0 ? fmtM(a.depenses) : "—"), React.createElement("td", {
      style: {
        padding: "10px 12px"
      }
    }, React.createElement("span", {
      style: {
        background: solde >= 0 ? "#2E8B5718" : "#E0484818",
        color: solde >= 0 ? "#2E8B57" : "#E04848",
        padding: "4px 10px",
        borderRadius: 6,
        fontWeight: 700
      }
    }, fmtM(solde))), React.createElement("td", {
      style: {
        padding: "10px 12px",
        color: C.ink2,
        fontWeight: 600
      }
    }, fmtM(moy)), React.createElement("td", {
      style: {
        padding: "10px 12px",
        color: "#1F7A99",
        fontWeight: 500
      }
    }, a.patrimoine > 0 ? fmtM(a.patrimoine) : "—"));
  }))))), React.createElement("div", {
    className: "fade-up-3",
    style: {
      background: C.white,
      borderRadius: 20,
      padding: "24px 28px",
      boxShadow: C.shadow
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
      flexWrap: "wrap",
      gap: 10
    }
  }, React.createElement(SectionTitle, {
    accent: "#FECA57"
  }, "Répartition des revenus"), React.createElement("select", {
    value: anneeRep || '',
    onChange: e => setSelY(+e.target.value),
    style: {
      padding: "8px 14px",
      borderRadius: 10,
      border: `2px solid ${C.border}`,
      background: C.bg,
      color: C.ink,
      fontFamily: "DM Sans",
      fontSize: 14,
      fontWeight: 700,
      cursor: "pointer",
      outline: "none"
    }
  }, annees.map(y => React.createElement("option", {
    key: y,
    value: y
  }, y)))), partsRep.length === 0 ? React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.ink3,
      fontFamily: "DM Sans"
    }
  }, "Aucun revenu enregistré pour ", anneeRep, ".") : React.createElement("div", {
    style: {
      display: "flex",
      gap: 32,
      alignItems: "center",
      flexWrap: "wrap",
      justifyContent: "center"
    }
  }, donut(partsRep, 170), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 220
    }
  }, partsRep.map((p, i) => {
    const pct = totRep > 0 ? p.value / totRep * 100 : 0;
    return React.createElement("div", {
      key: i,
      style: {
        marginBottom: 13
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 4
      }
    }, React.createElement("span", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 13,
        color: C.ink,
        fontWeight: 500,
        fontFamily: "DM Sans"
      }
    }, React.createElement("span", {
      style: {
        width: 12,
        height: 12,
        borderRadius: 3,
        background: p.color,
        flexShrink: 0
      }
    }), p.nom), React.createElement("span", {
      style: {
        fontSize: 13,
        fontWeight: 700,
        color: C.ink,
        fontFamily: "DM Sans"
      }
    }, fmtM(p.value))), React.createElement("div", {
      style: {
        height: 8,
        background: "#f0f0f5",
        borderRadius: 4,
        overflow: "hidden"
      }
    }, React.createElement("div", {
      style: {
        width: `${pct}%`,
        height: "100%",
        background: p.color,
        borderRadius: 4
      }
    })), React.createElement("div", {
      style: {
        fontSize: 10,
        color: C.ink3,
        marginTop: 2,
        textAlign: "right",
        fontFamily: "DM Sans"
      }
    }, pct.toFixed(1), "%"));
  })))));
}
function PageLiens() {
  const liens = [{
    titre: "Nóminas",
    desc: "Feuille de suivi des salaires, cours et revenus",
    url: "https://docs.google.com/spreadsheets/d/1qFAGMnfFkznxkckuF5eGgY0XSo9qWAGao1vi_e5rkfw/edit",
    color: "#45B7D1",
    icon: "📊"
  }, {
    titre: "Impôts",
    desc: "Feuille de gestion fiscale",
    url: "https://docs.google.com/spreadsheets/d/1jThZTb0tiJE__FGkaNk9M_Qflk4QBk3tpwCq7f7z5gg/edit",
    color: "#FF6B6B",
    icon: "🧾"
  }];
  return React.createElement("div", {
    style: {
      padding: "32px 28px",
      maxWidth: 980,
      margin: "0 auto"
    }
  }, React.createElement("div", {
    className: "fade-up",
    style: {
      marginBottom: 24
    }
  }, React.createElement(SectionTitle, {
    accent: "#96CEB4"
  }, "Mes documents")), React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
      gap: 16
    }
  }, liens.map((l, i) => React.createElement("a", {
    key: i,
    href: l.url,
    target: "_blank",
    rel: "noopener noreferrer",
    className: `card fade-up${i > 0 ? "-2" : ""}`,
    style: {
      display: "block",
      textDecoration: "none",
      background: C.white,
      borderRadius: 20,
      padding: "26px 28px",
      boxShadow: C.shadow,
      transition: "all .25s ease",
      borderLeft: `5px solid ${l.color}`
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 14,
      marginBottom: 12
    }
  }, React.createElement("div", {
    style: {
      width: 52,
      height: 52,
      borderRadius: 14,
      flexShrink: 0,
      background: l.color + "18",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 26
    }
  }, l.icon), React.createElement("div", null, React.createElement("div", {
    style: {
      fontFamily: "Playfair Display",
      fontSize: 20,
      fontWeight: 700,
      color: C.ink,
      lineHeight: 1.1
    }
  }, l.titre), React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.ink3,
      fontFamily: "DM Sans",
      marginTop: 3
    }
  }, l.desc))), React.createElement("div", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      color: l.color,
      fontFamily: "DM Sans",
      fontSize: 13,
      fontWeight: 600,
      marginTop: 4
    }
  }, "Ouvrir la feuille", React.createElement("span", {
    style: {
      fontSize: 16,
      lineHeight: 1
    }
  }, "→"))))));
}
function EditeurMois({
  data,
  mois,
  onSaved,
  compact,
  onDirty
}) {
  const cats = (data.finCategories || []).filter(c => c.actif);
  const revenus = cats.filter(c => c.type === 'revenu');
  const depenses = cats.filter(c => c.type === 'depense');
  const [vals, setVals] = useState({});
  const [sold, setSold] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [nouvelle, setNouvelle] = useState('');
  const [typeNouv, setTypeNouv] = useState('depense');
  const [reconduitDe, setReconduitDe] = useState(null);

  // Dernier mois ANTÉRIEUR contenant des données, pour la reconduction
  function moisSourceAvant(cible) {
    const arch = data.finArchives || [];
    const sol = data.finSoldes || [];
    const dispo = {};
    arch.forEach(a => {
      if (a.mois < cible) dispo[a.mois] = true;
    });
    sol.forEach(x => {
      if (x.mois < cible) dispo[x.mois] = true;
    });
    const liste = Object.keys(dispo).sort();
    return liste.length ? liste[liste.length - 1] : null;
  }

  // Remplit le formulaire à partir d'un mois donné (sans rien enregistrer)
  function chargerDepuis(source, marquer) {
    const v = {};
    cats.forEach(c => {
      v[c.nom] = '';
    });
    (data.finArchives || []).filter(a => a.mois === source).forEach(a => {
      v[a.categorie] = a.montant;
    });
    const s = {};
    FIN_COMPTES.forEach(c => {
      s[c] = '';
    });
    (data.finSoldes || []).filter(x => x.mois === source).forEach(x => {
      s[x.compte] = x.montant;
    });
    setVals(v);
    setSold(s);
    setReconduitDe(marquer ? source : null);
    if (marquer && onDirty) onDirty(true);
  }

  useEffect(() => {
    const aDesDonnees = (data.finArchives || []).some(a => a.mois === mois) || (data.finSoldes || []).some(x => x.mois === mois);
    if (aDesDonnees) {
      chargerDepuis(mois, false);
    } else {
      // Mois vierge : on reconduit le dernier mois renseigné
      const source = moisSourceAvant(mois);
      if (source) {
        chargerDepuis(source, true);
      } else {
        chargerDepuis(mois, false);
      }
    }
    setMsg(null);
    if (!((data.finArchives || []).some(a => a.mois === mois))) {
      // onDirty géré dans chargerDepuis
    } else if (onDirty) onDirty(false);
  }, [mois, data]);
  const totRev = revenus.reduce((a, c) => a + num(vals[c.nom]), 0);
  const totDep = depenses.reduce((a, c) => a + num(vals[c.nom]), 0);
  const solde = totRev - totDep;
  const patrimoine = FIN_COMPTES.reduce((a, c) => a + num(sold[c]), 0);
  async function sauvegarder() {
    setSaving(true);
    setMsg(null);
    try {
      await apiPost('saveArchives', {
        mois: mois,
        lignes: Object.keys(vals).map(k => ({
          categorie: k,
          montant: num(vals[k])
        }))
      });
      await apiPost('saveSoldes', {
        mois: mois,
        soldes: FIN_COMPTES.map(c => ({
          compte: c,
          montant: num(sold[c])
        }))
      });
      setMsg({
        ok: true,
        txt: 'Enregistré'
      });
      setReconduitDe(null);
      if (onDirty) onDirty(false);
      if (onSaved) await onSaved();
    } catch (e) {
      setMsg({
        ok: false,
        txt: e.message
      });
    } finally {
      setSaving(false);
    }
  }
  async function supprimerCategorie(nom) {
    const toutes = data.finCategories || [];
    const aHistorique = (data.finArchives || []).some(a => a.categorie === nom && a.montant !== 0);
    const question = aHistorique ? 'Retirer « ' + nom + ' » du formulaire ?\n\nLes montants déjà enregistrés resteront visibles dans les Archives.' : 'Supprimer définitivement « ' + nom + ' » ?';
    if (!window.confirm(question)) return;
    setSaving(true);
    setMsg(null);
    try {
      const liste = aHistorique ? toutes.map(c => c.nom === nom ? Object.assign({}, c, {
        actif: false
      }) : c) : toutes.filter(c => c.nom !== nom);
      await apiPost('saveCategories', {
        categories: liste
      });
      setMsg({
        ok: true,
        txt: aHistorique ? 'Ligne retirée, historique conservé' : 'Ligne supprimée'
      });
      if (onSaved) await onSaved();
    } catch (e) {
      setMsg({
        ok: false,
        txt: e.message
      });
    } finally {
      setSaving(false);
    }
  }
  async function restaurerCategorie(nom) {
    setSaving(true);
    setMsg(null);
    try {
      const liste = (data.finCategories || []).map(c => c.nom === nom ? Object.assign({}, c, {
        actif: true
      }) : c);
      await apiPost('saveCategories', {
        categories: liste
      });
      setMsg({
        ok: true,
        txt: 'Ligne restaurée'
      });
      if (onSaved) await onSaved();
    } catch (e) {
      setMsg({
        ok: false,
        txt: e.message
      });
    } finally {
      setSaving(false);
    }
  }
  async function ajouterCategorie() {
    const nom = nouvelle.trim();
    if (!nom) return;
    if (cats.some(c => c.nom.toLowerCase() === nom.toLowerCase())) {
      setMsg({
        ok: false,
        txt: 'Cette catégorie existe déjà'
      });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const liste = (data.finCategories || []).concat([{
        nom: nom,
        type: typeNouv,
        actif: true
      }]);
      await apiPost('saveCategories', {
        categories: liste
      });
      setNouvelle('');
      setMsg({
        ok: true,
        txt: 'Catégorie ajoutée'
      });
      if (onSaved) await onSaved();
    } catch (e) {
      setMsg({
        ok: false,
        txt: e.message
      });
    } finally {
      setSaving(false);
    }
  }
  const colonne = (titre, liste, couleur, total) => React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 260
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginBottom: 8
    }
  }, React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: couleur,
      textTransform: "uppercase",
      letterSpacing: ".1em",
      fontFamily: "DM Sans"
    }
  }, titre), React.createElement("span", {
    style: {
      fontFamily: "Playfair Display",
      fontSize: 17,
      fontWeight: 700,
      color: couleur
    }
  }, fmtM(total))), liste.length === 0 ? React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.ink3,
      fontStyle: "italic",
      padding: "8px 0"
    }
  }, "Aucune ligne") : liste.map((c, i) => React.createElement("div", {
    key: c.nom,
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      padding: "7px 0",
      borderBottom: `1px solid ${C.border}`
    }
  }, React.createElement("span", {
    style: {
      fontSize: 13,
      color: C.ink2,
      fontFamily: "DM Sans",
      flex: 1,
      minWidth: 0
    }
  }, c.nom), React.createElement("input", {
    type: "text",
    inputMode: "decimal",
    value: vals[c.nom] === undefined ? '' : vals[c.nom],
    onChange: e => {
      if (onDirty) onDirty(true);
      setVals(Object.assign({}, vals, {
        [c.nom]: nettoyerSaisie(e.target.value)
      }));
    },
    placeholder: "0",
    style: {
      width: 110,
      padding: "7px 10px",
      textAlign: "right",
      border: `1.5px solid ${C.border}`,
      borderRadius: 8,
      fontFamily: "DM Sans",
      fontSize: 13,
      fontWeight: 600,
      color: couleur,
      background: C.bg,
      outline: "none"
    }
  }), !compact && React.createElement("button", {
    onClick: () => supprimerCategorie(c.nom),
    disabled: saving,
    title: 'Retirer ' + c.nom,
    style: {
      border: "none",
      background: "transparent",
      cursor: saving ? "default" : "pointer",
      color: C.ink3,
      fontSize: 16,
      lineHeight: 1,
      padding: "4px 2px",
      fontFamily: "DM Sans",
      opacity: saving ? .4 : .65
    }
  }, "×"))));
  return React.createElement("div", null, React.createElement("div", {
    style: {
      display: "flex",
      gap: 28,
      flexWrap: "wrap",
      marginBottom: 20
    }
  }, colonne('Revenus', revenus, '#2E8B57', totRev), colonne('Dépenses', depenses, '#E04848', totDep)), reconduitDe && React.createElement("div", {
    style: {
      background: "#EAF4FA",
      border: "1px solid #BBD9EA",
      borderRadius: 12,
      padding: "10px 16px",
      marginBottom: 16,
      fontSize: 12,
      fontFamily: "DM Sans",
      color: "#1F5C7A",
      display: "flex",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap"
    }
  }, React.createElement("span", null, "↻ Montants reconduits depuis ", React.createElement("strong", null, moisLisible(reconduitDe)), ". Vérifie-les puis enregistre."), React.createElement("button", {
    onClick: () => chargerDepuis(mois, false),
    style: {
      border: "1px solid #BBD9EA",
      background: "transparent",
      borderRadius: 8,
      padding: "4px 10px",
      cursor: "pointer",
      fontFamily: "DM Sans",
      fontSize: 11,
      fontWeight: 600,
      color: "#1F5C7A",
      marginLeft: "auto"
    }
  }, "Repartir de zéro")), React.createElement("div", {
    style: {
      background: solde >= 0 ? '#EAF6EF' : '#FDECEC',
      border: `1px solid ${solde >= 0 ? '#BFE3CD' : '#F5C6C6'}`,
      borderRadius: 12,
      padding: "12px 18px",
      marginBottom: 20,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }
  }, React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: C.ink2,
      textTransform: "uppercase",
      letterSpacing: ".08em",
      fontFamily: "DM Sans"
    }
  }, "Solde du mois"), React.createElement("span", {
    style: {
      fontFamily: "Playfair Display",
      fontSize: 24,
      fontWeight: 900,
      color: solde >= 0 ? '#2E8B57' : '#E04848'
    }
  }, fmtM(solde))), !compact && React.createElement("div", {
    style: {
      marginBottom: 20
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: '#1F7A99',
      textTransform: "uppercase",
      letterSpacing: ".1em",
      fontFamily: "DM Sans",
      marginBottom: 8
    }
  }, "Comptes — solde en fin de mois"), FIN_COMPTES.map((c, i) => React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      padding: "7px 0",
      borderBottom: `1px solid ${C.border}`
    }
  }, React.createElement("span", {
    style: {
      fontSize: 13,
      color: C.ink2,
      fontFamily: "DM Sans"
    }
  }, c), React.createElement("input", {
    type: "text",
    inputMode: "decimal",
    value: sold[c] === undefined ? '' : sold[c],
    onChange: e => {
      if (onDirty) onDirty(true);
      setSold(Object.assign({}, sold, {
        [c]: nettoyerSaisie(e.target.value)
      }));
    },
    placeholder: "0",
    style: {
      width: 120,
      padding: "7px 10px",
      textAlign: "right",
      border: `1.5px solid ${C.border}`,
      borderRadius: 8,
      fontFamily: "DM Sans",
      fontSize: 13,
      fontWeight: 600,
      color: '#1F7A99',
      background: C.bg,
      outline: "none"
    }
  }))), React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      marginTop: 10,
      paddingTop: 8,
      borderTop: `2px solid ${C.border}`
    }
  }, React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: C.ink2,
      fontFamily: "DM Sans"
    }
  }, "Total patrimoine"), React.createElement("span", {
    style: {
      fontFamily: "Playfair Display",
      fontSize: 19,
      fontWeight: 800,
      color: '#1F7A99'
    }
  }, fmtM(patrimoine)))), React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      alignItems: "center",
      flexWrap: "wrap"
    }
  }, React.createElement("button", {
    onClick: sauvegarder,
    disabled: saving,
    style: {
      padding: "11px 24px",
      borderRadius: 10,
      border: "none",
      background: saving ? C.ink3 : C.ink,
      color: "#fff",
      fontFamily: "DM Sans",
      fontSize: 14,
      fontWeight: 700,
      cursor: saving ? "default" : "pointer"
    }
  }, saving ? 'Enregistrement…' : 'Enregistrer'), msg && React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      fontFamily: "DM Sans",
      color: msg.ok ? '#2E8B57' : '#E04848'
    }
  }, msg.ok ? '✓ ' : '✗ ', msg.txt)), !compact && React.createElement("div", {
    style: {
      marginTop: 22,
      paddingTop: 18,
      borderTop: `1px solid ${C.border}`
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: C.ink3,
      textTransform: "uppercase",
      letterSpacing: ".1em",
      fontFamily: "DM Sans",
      marginBottom: 10
    }
  }, "Ajouter une ligne"), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, React.createElement("input", {
    value: nouvelle,
    onChange: e => setNouvelle(e.target.value),
    placeholder: "Nom (ex. Mutuelle)",
    style: {
      flex: 1,
      minWidth: 160,
      padding: "9px 12px",
      border: `1.5px solid ${C.border}`,
      borderRadius: 10,
      fontFamily: "DM Sans",
      fontSize: 13,
      background: C.bg,
      outline: "none"
    }
  }), React.createElement("select", {
    value: typeNouv,
    onChange: e => setTypeNouv(e.target.value),
    style: {
      padding: "9px 12px",
      border: `1.5px solid ${C.border}`,
      borderRadius: 10,
      fontFamily: "DM Sans",
      fontSize: 13,
      fontWeight: 600,
      background: C.bg,
      outline: "none",
      cursor: "pointer"
    }
  }, React.createElement("option", {
    value: "depense"
  }, "Dépense"), React.createElement("option", {
    value: "revenu"
  }, "Revenu")), React.createElement("button", {
    onClick: ajouterCategorie,
    disabled: saving || !nouvelle.trim(),
    style: {
      padding: "9px 18px",
      borderRadius: 10,
      border: `1.5px solid ${C.ink}`,
      background: "transparent",
      color: C.ink,
      fontFamily: "DM Sans",
      fontSize: 13,
      fontWeight: 700,
      cursor: saving || !nouvelle.trim() ? "default" : "pointer",
      opacity: saving || !nouvelle.trim() ? .45 : 1
    }
  }, "Ajouter")), (data.finCategories || []).filter(c => !c.actif).length > 0 && React.createElement("div", {
    style: {
      marginTop: 16
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: C.ink3,
      textTransform: "uppercase",
      letterSpacing: ".1em",
      fontFamily: "DM Sans",
      marginBottom: 8
    }
  }, "Lignes masquées"), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, (data.finCategories || []).filter(c => !c.actif).map((c, i) => React.createElement("button", {
    key: i,
    onClick: () => restaurerCategorie(c.nom),
    disabled: saving,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      border: `1.5px dashed ${C.border}`,
      background: "transparent",
      borderRadius: 20,
      padding: "5px 12px",
      cursor: saving ? "default" : "pointer",
      fontFamily: "DM Sans",
      fontSize: 12,
      fontWeight: 600,
      color: C.ink3
    }
  }, c.nom, React.createElement("span", {
    style: {
      fontSize: 14,
      lineHeight: 1
    }
  }, "↩")))))));
}
function PageSituation({
  data,
  onRefresh,
  onDirty
}) {
  const [mois, setMois] = useState(moisCourantYM());
  const options = [];
  const d0 = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(d0.getFullYear(), d0.getMonth() - i, 1);
    options.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
  }
  const pret = (data.finCategories || []).length > 0;
  return React.createElement("div", {
    style: {
      padding: "32px 28px",
      maxWidth: 980,
      margin: "0 auto"
    }
  }, React.createElement("div", {
    className: "fade-up",
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 12,
      marginBottom: 20
    }
  }, React.createElement(SectionTitle, {
    accent: "#96CEB4"
  }, "Situation"), React.createElement("select", {
    value: mois,
    onChange: e => setMois(e.target.value),
    style: {
      padding: "10px 16px",
      borderRadius: 10,
      border: `2px solid ${C.border}`,
      background: C.white,
      color: C.ink,
      fontFamily: "DM Sans",
      fontSize: 14,
      fontWeight: 700,
      cursor: "pointer",
      outline: "none"
    }
  }, options.map(m => React.createElement("option", {
    key: m,
    value: m
  }, moisLisible(m))))), React.createElement("div", {
    className: "fade-up-2",
    style: {
      background: C.white,
      borderRadius: 20,
      padding: "26px 28px",
      boxShadow: C.shadow
    }
  }, pret ? React.createElement(EditeurMois, {
    data: data,
    mois: mois,
    onSaved: onRefresh,
    onDirty: onDirty
  }) : React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.ink3,
      fontFamily: "DM Sans",
      lineHeight: 1.6
    }
  }, "Les catégories ne sont pas encore initialisées.", React.createElement("br", null), "Dans Google\xA0Sheets : menu ", React.createElement("strong", null, "⚙️ Finances → Initialiser"), ", puis reviens ici et actualise.")));
}
function PageArchives({
  data,
  onRefresh,
  onDirty
}) {
  const archives = data.finArchives || [];
  const soldes = data.finSoldes || [];
  const cats = data.finCategories || [];
  const typeDe = {};
  cats.forEach(c => {
    typeDe[c.nom] = c.type;
  });
  const [annee, setAnnee] = useState('toutes');
  const [secteur, setSecteur] = useState('tous');
  const [editMois, setEditMois] = useState(null);
  const moisSet = {};
  archives.forEach(a => {
    moisSet[a.mois] = true;
  });
  soldes.forEach(s => {
    moisSet[s.mois] = true;
  });
  const tousMois = Object.keys(moisSet).sort().reverse();
  const annees = [];
  tousMois.forEach(m => {
    const y = m.slice(0, 4);
    if (annees.indexOf(y) === -1) annees.push(y);
  });
  const moisFiltres = tousMois.filter(m => annee === 'toutes' || m.slice(0, 4) === annee);
  const lignes = moisFiltres.map(m => {
    const duMois = archives.filter(a => a.mois === m).filter(a => secteur === 'tous' || a.categorie === secteur);
    const rev = duMois.filter(a => typeDe[a.categorie] !== 'depense').reduce((s, a) => s + a.montant, 0);
    const dep = duMois.filter(a => typeDe[a.categorie] === 'depense').reduce((s, a) => s + a.montant, 0);
    const pat = soldes.filter(s => s.mois === m).reduce((s, x) => s + x.montant, 0);
    return {
      mois: m,
      rev,
      dep,
      solde: rev - dep,
      pat
    };
  });
  const totRev = lignes.reduce((a, l) => a + l.rev, 0);
  const totDep = lignes.reduce((a, l) => a + l.dep, 0);
  const selStyle = {
    padding: "9px 14px",
    borderRadius: 10,
    border: `2px solid ${C.border}`,
    background: C.white,
    color: C.ink,
    fontFamily: "DM Sans",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    outline: "none"
  };
  return React.createElement("div", {
    style: {
      padding: "32px 28px",
      maxWidth: 980,
      margin: "0 auto"
    }
  }, React.createElement("div", {
    className: "fade-up",
    style: {
      marginBottom: 18
    }
  }, React.createElement(SectionTitle, {
    accent: "#45B7D1"
  }, "Archives"), React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap"
    }
  }, React.createElement("select", {
    value: annee,
    onChange: e => setAnnee(e.target.value),
    style: selStyle
  }, React.createElement("option", {
    value: "toutes"
  }, "Toutes les années"), annees.map(y => React.createElement("option", {
    key: y,
    value: y
  }, y))), React.createElement("select", {
    value: secteur,
    onChange: e => setSecteur(e.target.value),
    style: selStyle
  }, React.createElement("option", {
    value: "tous"
  }, "Tous les secteurs"), cats.map((c, i) => React.createElement("option", {
    key: i,
    value: c.nom
  }, c.nom))))), React.createElement("div", {
    className: "fade-up",
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
      gap: 14,
      marginBottom: 22
    }
  }, React.createElement(KpiCard, {
    label: "Revenus",
    value: fmtM(totRev),
    color: "#2E8B57"
  }), React.createElement(KpiCard, {
    label: "Dépenses",
    value: fmtM(totDep),
    color: "#E04848",
    delay: "-2"
  }), React.createElement(KpiCard, {
    label: "Solde cumulé",
    value: fmtM(totRev - totDep),
    color: totRev - totDep >= 0 ? "#45B7D1" : "#E04848",
    delay: "-3"
  }), React.createElement(KpiCard, {
    label: "Mois enregistrés",
    value: String(lignes.length),
    color: "#FECA57",
    delay: "-4"
  })), React.createElement("div", {
    className: "fade-up-2",
    style: {
      background: C.white,
      borderRadius: 20,
      padding: "24px 28px",
      boxShadow: C.shadow
    }
  }, lignes.length === 0 ? React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.ink3,
      fontFamily: "DM Sans",
      textAlign: "center",
      padding: "20px 0"
    }
  }, "Aucune donnée enregistrée pour cette sélection.") : React.createElement("div", {
    style: {
      overflowX: "auto"
    }
  }, React.createElement("table", {
    style: {
      width: "100%",
      borderCollapse: "separate",
      borderSpacing: "0 3px",
      fontFamily: "DM Sans",
      fontSize: 12
    }
  }, React.createElement("thead", null, React.createElement("tr", null, ["Mois", "Revenus", "Dépenses", "Solde", "Patrimoine", ""].map(h => React.createElement("th", {
    key: h,
    style: {
      textAlign: "left",
      padding: "8px 12px",
      fontSize: 10,
      fontWeight: 600,
      color: C.ink3,
      textTransform: "uppercase",
      letterSpacing: ".08em",
      borderBottom: `2px solid ${C.border}`
    }
  }, h)))), React.createElement("tbody", null, lignes.map((l, i) => React.createElement("tr", {
    key: i,
    style: {
      background: i % 2 === 0 ? "#F4F7FA" : C.white
    }
  }, React.createElement("td", {
    style: {
      padding: "10px 12px",
      fontWeight: 600,
      color: C.ink
    }
  }, moisLisible(l.mois)), React.createElement("td", {
    style: {
      padding: "10px 12px",
      color: "#2E8B57",
      fontWeight: 500
    }
  }, l.rev > 0 ? fmtM(l.rev) : "—"), React.createElement("td", {
    style: {
      padding: "10px 12px",
      color: "#E04848",
      fontWeight: 500
    }
  }, l.dep > 0 ? fmtM(l.dep) : "—"), React.createElement("td", {
    style: {
      padding: "10px 12px"
    }
  }, React.createElement("span", {
    style: {
      background: l.solde >= 0 ? "#2E8B5718" : "#E0484818",
      color: l.solde >= 0 ? "#2E8B57" : "#E04848",
      padding: "4px 10px",
      borderRadius: 6,
      fontWeight: 700
    }
  }, fmtM(l.solde))), React.createElement("td", {
    style: {
      padding: "10px 12px",
      color: "#1F7A99",
      fontWeight: 500
    }
  }, l.pat > 0 ? fmtM(l.pat) : "—"), React.createElement("td", {
    style: {
      padding: "10px 12px"
    }
  }, React.createElement("button", {
    onClick: () => setEditMois(editMois === l.mois ? null : l.mois),
    style: {
      border: `1.5px solid ${C.border}`,
      background: "transparent",
      borderRadius: 8,
      padding: "5px 12px",
      cursor: "pointer",
      fontFamily: "DM Sans",
      fontSize: 12,
      fontWeight: 600,
      color: C.ink2
    }
  }, editMois === l.mois ? 'Fermer' : 'Corriger'))))))), editMois && React.createElement("div", {
    style: {
      marginTop: 22,
      paddingTop: 20,
      borderTop: `2px solid ${C.border}`
    }
  }, React.createElement("div", {
    style: {
      fontFamily: "Playfair Display",
      fontSize: 17,
      fontWeight: 700,
      color: C.ink,
      marginBottom: 14
    }
  }, "Correction — ", moisLisible(editMois)), React.createElement(EditeurMois, {
    data: data,
    mois: editMois,
    onSaved: onRefresh,
    onDirty: onDirty
  }))));
}
const TABS = [{
  id: "situation",
  label: "Situation"
}, {
  id: "archives",
  label: "Archives"
}, {
  id: "analyse",
  label: "Analyse"
}, {
  id: "cours",
  label: "Séances"
}, {
  id: "accueil",
  label: "Élèves"
}, {
  id: "liens",
  label: "Liens"
}];
const CLE_CACHE = "suivi-cours-donnees";

/** Dernier jeu de données reçu, conservé sur l'appareil */
function lireCache() {
  try {
    const brut = window.localStorage.getItem(CLE_CACHE);
    if (!brut) return null;
    const o = JSON.parse(brut);
    return (o && o.raw) ? o : null;
  } catch (e) {
    return null;
  }
}

function ecrireCache(raw) {
  try {
    window.localStorage.setItem(CLE_CACHE, JSON.stringify({ raw: raw, at: Date.now() }));
  } catch (e) {
    // quota dépassé ou stockage indisponible : sans conséquence
  }
}

function App() {
  const cache = lireCache();
  const [page, setPage] = useState("situation");
  const [data, setData] = useState(cache ? parseSheetData(cache.raw) : DATA_FALLBACK);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(cache ? new Date(cache.at) : null);
  const [dirty, setDirty] = useState(false);
  const brut = React.useRef(cache ? cache.raw : null);
  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_URL);
      const raw = await res.json();
      if (raw.error) throw new Error(raw.error);
      brut.current = raw;
      ecrireCache(raw);
      setData(parseSheetData(raw));
      setLastUpdate(new Date());
    } catch (e) {
      setError("Impossible de charger les données : " + e.message);
    } finally {
      setLoading(false);
    }
  }
  async function refreshFinances() {
    try {
      const res = await fetch(API_URL + '?only=fin');
      const part = await res.json();
      if (part.error) throw new Error(part.error);
      const complet = Object.assign({}, brut.current || {}, {
        finCategories: part.finCategories,
        finArchives: part.finArchives,
        finSoldes: part.finSoldes
      });
      brut.current = complet;
      ecrireCache(complet);
      setData(parseSheetData(complet));
      setLastUpdate(new Date());
      setDirty(false);
    } catch (e) {
      await fetchData();
      setDirty(false);
    }
  }
  useEffect(() => {
    fetchData();
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
  function allerVers(id) {
    if (id === page) return;
    if (dirty && !window.confirm("Des montants saisis n'ont pas été enregistrés.\n\nQuitter cette page et les perdre ?")) return;
    setDirty(false);
    setPage(id);
  }
  const touchRef = React.useRef({
    x: 0,
    y: 0
  });
  function onTouchStart(e) {
    let n = e.target,
      bloque = false;
    for (let i = 0; n && i < 6; i++) {
      const t = (n.tagName || '').toUpperCase();
      if (t === 'INPUT' || t === 'SELECT' || t === 'TEXTAREA' || t === 'BUTTON') {
        bloque = true;
        break;
      }
      if (n.scrollWidth && n.clientWidth && n.scrollWidth > n.clientWidth + 4) {
        bloque = true;
        break;
      }
      n = n.parentElement;
    }
    touchRef.current = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
      bloque: bloque
    };
  }
  function onTouchEnd(e) {
    if (dirty) return;
    if (touchRef.current.bloque) return;
    const dx = e.changedTouches[0].clientX - touchRef.current.x;
    const dy = e.changedTouches[0].clientY - touchRef.current.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      const idx = TABS.findIndex(t => t.id === page);
      if (dx < 0 && idx < TABS.length - 1) setPage(TABS[idx + 1].id);
      if (dx > 0 && idx > 0) setPage(TABS[idx - 1].id);
    }
  }
  return React.createElement("div", {
    style: {
      minHeight: "100vh",
      background: C.bg,
      fontFamily: "DM Sans, sans-serif",
      overscrollBehaviorY: "contain"
    },
    onTouchStart: onTouchStart,
    onTouchEnd: onTouchEnd
  }, React.createElement("style", null, globalCSS), React.createElement("nav", {
    style: {
      background: C.white,
      borderBottom: `1px solid ${C.border}`,
      position: "sticky",
      top: 0,
      zIndex: 20,
      boxShadow: "0 1px 12px rgba(0,0,0,0.05)"
    }
  }, React.createElement("div", {
    style: {
      maxWidth: 980,
      margin: "0 auto",
      padding: "0 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      height: 46,
      borderBottom: `1px solid ${C.border}`
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 9
    }
  }, React.createElement("div", {
    style: {
      width: 28,
      height: 28,
      borderRadius: 8,
      background: "linear-gradient(135deg,#1A1A2E,#2d2d5e)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 28 28",
    fill: "none"
  }, React.createElement("rect", {
    x: "4",
    y: "4",
    width: "9",
    height: "9",
    rx: "2",
    fill: "#FECA57"
  }), React.createElement("rect", {
    x: "15",
    y: "4",
    width: "9",
    height: "9",
    rx: "2",
    fill: "#FF6B6B",
    opacity: ".7"
  }), React.createElement("rect", {
    x: "4",
    y: "15",
    width: "9",
    height: "9",
    rx: "2",
    fill: "#4ECDC4",
    opacity: ".7"
  }), React.createElement("rect", {
    x: "15",
    y: "15",
    width: "9",
    height: "9",
    rx: "2",
    fill: "#45B7D1"
  }))), React.createElement("span", {
    style: {
      fontFamily: "Playfair Display",
      fontWeight: 700,
      fontSize: 14,
      color: C.ink
    }
  }, "Comptes ", React.createElement("span", {
    style: {
      fontSize: 9,
      color: C.ink3,
      fontFamily: "DM Sans"
    }
  }, APP_VERSION))), React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, loading && React.createElement("div", {
    style: {
      width: 14,
      height: 14,
      border: `2px solid #E8E8F0`,
      borderTopColor: C.ink,
      borderRadius: "50%",
      animation: "spin .7s linear infinite"
    }
  }), !loading && lastUpdate && React.createElement("span", {
    style: {
      fontSize: 9,
      color: C.ink3
    }
  }, lastUpdate.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  })), React.createElement("button", {
    onClick: fetchData,
    disabled: loading,
    style: {
      background: "#1A1A2E",
      color: "white",
      borderRadius: 20,
      padding: "4px 12px",
      fontSize: 10,
      fontFamily: "DM Sans",
      fontWeight: 500,
      letterSpacing: ".04em",
      border: "none",
      cursor: "pointer"
    }
  }, data.month !== "—" && data.month !== "Chargement…" ? data.month : "↻"))), React.createElement("div", {
    style: {
      maxWidth: 980,
      margin: "0 auto",
      display: "flex",
      flexWrap: "wrap"
    }
  }, TABS.map(t => React.createElement("button", {
    key: t.id,
    className: `nav-tab${page === t.id ? " active" : ""}`,
    onClick: () => allerVers(t.id),
    style: {
      flex: "1 1 auto",
      minWidth: 0,
      padding: "0 8px",
      border: "none",
      background: "transparent",
      fontFamily: "DM Sans",
      fontSize: 12,
      fontWeight: page === t.id ? 600 : 400,
      color: page === t.id ? C.ink : C.ink3,
      cursor: "pointer",
      borderBottom: `3px solid ${page === t.id ? C.ink : "transparent"}`,
      height: 40,
      transition: "all .2s",
      whiteSpace: "nowrap",
      textAlign: "center"
    }
  }, t.label)))), error && React.createElement("div", {
    style: {
      background: "#FFF0F0",
      border: "1px solid #FFD0D0",
      borderRadius: 10,
      margin: "16px",
      padding: "12px 16px",
      fontSize: 12,
      color: "#c0392b",
      fontFamily: "DM Sans",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }
  }, React.createElement("span", null, error), React.createElement("button", {
    onClick: fetchData,
    style: {
      background: "#c0392b",
      color: "white",
      border: "none",
      borderRadius: 6,
      padding: "4px 10px",
      cursor: "pointer",
      fontSize: 11
    }
  }, "Réessayer")), loading && data.month === "—" && React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "80px 0",
      color: C.ink3,
      fontFamily: "DM Sans"
    }
  }, React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      border: `3px solid ${C.border}`,
      borderTopColor: C.ink,
      borderRadius: "50%",
      animation: "spin .7s linear infinite",
      margin: "0 auto 16px"
    }
  }), React.createElement("div", {
    style: {
      fontSize: 14
    }
  }, "Chargement depuis Google Sheets…")), (!loading || data.month !== "—") && page === "accueil" && React.createElement(PageAccueil, {
    data: data,
    onRefresh: fetchData
  }), (!loading || data.month !== "—") && page === "cours" && React.createElement(PageCours, {
    data: data
  }), (!loading || data.month !== "—") && page === "analyse" && React.createElement(PageAnalyse, {
    data: data
  }), (!loading || data.month !== "—") && page === "situation" && React.createElement(PageSituation, {
    data: data,
    onRefresh: refreshFinances,
    onDirty: setDirty
  }), (!loading || data.month !== "—") && page === "archives" && React.createElement(PageArchives, {
    data: data,
    onRefresh: refreshFinances,
    onDirty: setDirty
  }), page === "liens" && React.createElement(PageLiens, null));
}
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App, null));