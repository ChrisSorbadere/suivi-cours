const { useState, useEffect, useCallback } = React;

const APP_VERSION = "v4.2";

// ── API Apps Script ───────────────────────────────────────────────────────────
const API_URL = "https://script.google.com/macros/s/AKfycbxiOA_ZhZFg1FSWf7JEII1xUbJNutGek20sg17Vr5_sWwPsTj3AI1VKim803oo7BGYGPg/exec";

// Comptes d'épargne suivis (patrimoine)
const FIN_COMPTES = ['Épargne France', 'Épargne Espagne'];

/**
 * Envoi de données vers Apps Script.
 * Content-Type text/plain : évite le pre-flight CORS que Apps Script ne gère pas.
 */
async function apiPost(action, payload) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: action, payload: payload })
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Erreur inconnue');
  return json.result;
}

/** "2026-08" -> "août 2026" */
function moisLisible(ym) {
  const MM = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  const m = String(ym).match(/^(\d{4})-(\d{2})$/);
  if (!m) return String(ym);
  return MM[(+m[2]) - 1] + ' ' + m[1];
}

/** N'autorise que chiffres, virgule/point et signe moins pendant la saisie */
function nettoyerSaisie(v) {
  return String(v).replace(/[^\d.,-]/g, '');
}

/** Convertit une saisie en nombre ("1 234,56" -> 1234.56) */
function num(v) {
  if (v === '' || v === null || v === undefined) return 0;
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

/** Mois courant au format "AAAA-MM" */
function moisCourantYM() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

// Couleurs élèves par code
const STUDENT_COLORS_MAP = {"1":"#FF6B6B","2":"#4ECDC4","3":"#45B7D1","4":"#96CEB4","5":"#FECA57","6":"#FF9F43","7":"#48DBFB","8":"#FF9FF3"};

// Parse une durée depuis Apps Script
// Apps Script exporte timedelta comme fraction de jour : 60min = 60/1440 = 0.04166...
function parseDuration(val) {
  if (!val) return 0;
  if (typeof val === 'number') {
    if (val < 1) return val * 24; // fraction de jour → heures (ex: 0.04166 → 1h)
    if (val < 24) return val;     // déjà en heures
    return val / 60;              // minutes → heures
  }
  return 0;
}

// Parse une date depuis Apps Script
// Apps Script exporte les dates en ISO UTC : "2026-03-05T17:00:00.000Z"
// Pour avoir l'heure locale (CET = UTC+1 ou UTC+2), on ajoute 1h
function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  const s = String(val);
  // Format ISO UTC : "2026-03-05T17:00:00.000Z"
  if (s.includes('T') && (s.endsWith('Z') || s.includes('+00'))) {
    const d = new Date(s);
    if (!isNaN(d)) {
      // Ajouter 1h pour CET (approximation correcte pour l'Europe)
      return new Date(d.getTime() + 60*60*1000);
    }
  }
  // Format gviz : Date(year, month0, day, h, m)
  const m = s.match(/Date\((\d+),(\d+),(\d+),?(\d*),?(\d*)/);
  if (m) return new Date(+m[1], +m[2], +m[3], +(m[4]||0), +(m[5]||0));
  // Format dd/MM/yyyy HH:mm
  const p = s.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (p) return new Date(+p[3], +p[2]-1, +p[1], +p[4], +p[5]);
  return null;
}

// Transforme les données brutes du sheet en DATA structurée
function parseSheetData(raw) {
  const nomina = raw.nomina || [];
  const recap  = raw.recap  || [];
  const mois   = raw.mois   || [];
  const moisM1 = raw.moisM1 || [];
  const moisP1 = raw.moisP1 || [];

  // ── NOMINA ──────────────────────────────────────────────────────────────────
  // L1 : date du jour (col A), L2 : mois (col A)
  const today = String(nomina[0]?.[0] || "").replace(/[^a-zA-Z0-9éèêëàâùûüôîïç\s]/gu, '').trim();
  const month = String(nomina[1]?.[0] || "").trim();

  // L24 (idx 23) : B=label, C=avgRate, D=presentH, E=presentE, F=futurH, G=futurE, H=totalH, I=totalE, K=actifs
  // L4  (idx 3)  : col D = présent en minutes (105 = 1h45), col E = vide
  // L8  (idx 7)  : TOTAL MOIS col D=totalH, col E=totalE
  // L11 (idx 10) : mois prochain col D=nextH, col E=nextE

  const presentH = nomina[23]?.[3] || 0;  // D24 = 5h
  const presentE = nomina[23]?.[4] || 0;  // E24 = 105€
  const futurH   = nomina[23]?.[5] || 0;  // F24 = 4h
  const futurE   = nomina[23]?.[6] || 0;  // G24 = 105€
  const totalH   = nomina[23]?.[7] || 0;  // H24 = 9h
  const totalE   = nomina[23]?.[8] || 0;  // I24 = 210€
  const nextH    = nomina[10]?.[3] || 0;  // D11 = 147h
  const nextE    = nomina[10]?.[4] || 0;  // E11 = 1675€
  const avgRate  = nomina[23]?.[2] || 0;  // C24 = 23.33
  const actifs   = nomina[23]?.[10] || ""; // K24 = "Actifs : 2"

  // Élèves lignes 15-23 (index 14-22) :
  // Col A=N°, B=CLIENT, C=Tarif, D=H.Present, E=€Present, F=H.Futur, G=€Futur, H=H.Mois, I=€Mois
  const students = nomina.slice(14, 23)
    .filter(r => r[0] && typeof r[0] === 'number' && r[1])
    .map(r => ({
      code:     String(r[0]),
      name:     String(r[1]).trim(),
      rate:     r[2] || 0,
      presentH: r[3] || 0,
      presentE: r[4] || 0,
      futurH:   r[5] || 0,
      futurE:   r[6] || 0,
      totalH:   r[7] || 0,
      totalE:   r[8] || 0,
      color:    STUDENT_COLORS_MAP[String(r[0])] || "#888",
    }));

  // Vérification : les valeurs L24 sont les bonnes (calculées par les formules Sheets)

  // Mois -1 (col G=idx6, H=idx7, I=idx8) lignes 3-12
  const m1rows = nomina.slice(2, 12).filter(r => r[6] && !String(r[6]).includes('TOTAL') && String(r[6]).length > 1);
  const m1TotalE = nomina[11]?.[8] || 0;
  const m1Label  = "Mois précédent";

  // Mois +1 (col J=idx9, K=idx10, L=idx11)
  const m2rows = nomina.slice(2, 12).filter(r => r[9] && !String(r[9]).includes('TOTAL') && String(r[9]).length > 1);
  const m2TotalE = nomina[11]?.[11] || 0;

  // ── RÉCAP ───────────────────────────────────────────────────────────────────
  // Colonnes : A=DATE(idx0), B=HEURES(idx1), C=SALAIRE(idx2), D=NBRE(idx3), E=PRINCIPAL(idx4), F=%(idx5)
  // L1 = header "DOSSIER DES PDF", L2 = headers colonnes → on skip 2 lignes
  const history = recap.slice(2)
    .filter(r => r[0] && (r[1] || r[2]))
    .map(r => {
      let d = r[0];
      if (typeof d === 'string') {
        // Format ISO UTC : "2025-03-31T22:00:00.000Z" → ajouter 2h pour CET
        if (d.includes('T') && d.endsWith('Z')) {
          const raw = new Date(d);
          d = !isNaN(raw) ? new Date(raw.getTime() + 2*60*60*1000) : null;
        } else {
          // Format gviz Date(year,month0,...)
          const m = d.match(/Date\((\d+),(\d+)/);
          if (m) d = new Date(+m[1], +m[2], 1);
        }
      }
      if (!(d instanceof Date) || isNaN(d)) return null;
      // Salaire = col C (index 2)
      const salary = typeof r[2] === 'number' ? r[2] : 0;
      if (salary <= 0) return null;
      return {
        month:  d.toLocaleString('fr-FR', {month:'short', year:'numeric'}),
        salary: salary,
        hours:  typeof r[1] === 'number' ? r[1] : 0,
        client: String(r[4] || '—'),
      };
    })
    .filter(Boolean);

  // ── GRAPH ───────────────────────────────────────────────────────────────────
  // Colonnes : A=DATES, B=SALAIRES, C=LOYERS FRANCE, D=CHÔMAGE, E=TOTAL
  const MOIS_FR = ["jan.","fév.","mars","avr.","mai","juin","juil.","août","sep.","oct.","nov.","déc."];

  // Parseur de nombre ultra-robuste : gère 1692.78, "1692,78", "1 692,78 €", etc.
  function parseNum(v) {
    if (typeof v === 'number') return v;
    if (v === null || v === undefined || v === '') return 0;
    const cleaned = String(v)
      .replace(/[€\s\u00A0\u202F]/g, '')  // retire €, espaces, espaces insécables
      .replace(/\./g, m => m)              // garde les points
      .replace(',', '.');                   // virgule décimale → point
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }

  // Parseur de libellé de mois : gère "MM/YYYY", Date ISO, Date gviz, ou Date JS
  function parseMonthLabel(v) {
    if (v === null || v === undefined || v === '') return null;
    // Date JS native
    if (v instanceof Date && !isNaN(v)) {
      return v.toLocaleString('fr-FR', {month:'short', year:'numeric'});
    }
    const s = String(v).trim();
    // Format "MM/YYYY" ou "M/YYYY"
    let m = s.match(/^(\d{1,2})\/(\d{4})$/);
    if (m) return `${MOIS_FR[(+m[1])-1]} ${m[2]}`;
    // Format "MM/DD/YYYY" ou "DD/MM/YYYY" (on prend mois/année)
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return `${MOIS_FR[(+m[1])-1]} ${m[3]}`;
    // Format ISO UTC "2025-01-31T23:00:00.000Z" → +2h pour CET
    if (s.includes('T') && s.endsWith('Z')) {
      const d = new Date(s);
      if (!isNaN(d)) {
        const local = new Date(d.getTime() + 2*60*60*1000);
        return local.toLocaleString('fr-FR', {month:'short', year:'numeric'});
      }
    }
    // Format gviz "Date(2025,0,1)"
    m = s.match(/Date\((\d+),(\d+)/);
    if (m) return `${MOIS_FR[+m[2]]} ${m[1]}`;
    // Dernier recours : tenter Date()
    const d = new Date(s);
    if (!isNaN(d)) return d.toLocaleString('fr-FR', {month:'short', year:'numeric'});
    return null;
  }

  const graphRows = raw.graph || [];
  const graph = graphRows.slice(1) // skip header
    .map(r => {
      if (!r || !r[0]) return null;
      const label = parseMonthLabel(r[0]);
      if (!label) return null;
      const salaires = parseNum(r[1]);
      const loyers   = parseNum(r[2]);
      const chomage  = parseNum(r[3]);
      let   total    = parseNum(r[4]);
      // Si total absent mais composantes présentes, recalculer
      if (total === 0 && (salaires > 0 || loyers > 0 || chomage > 0)) {
        total = salaires + loyers + chomage;
      }
      return { month: label, salaires, loyers, chomage, total };
    })
    .filter(Boolean);

  // ── DÉCLARER (revenu moyen mensuel par année) ────────────────────────────────
  // Structure : idx0 = titre/totaux, idx1 = en-têtes, idx2 = totaux catégories, idx3+ = données mensuelles
  // Colonnes par mois : A(0)=DATE, B(1)=Salaire, C(2)=Clients, D(3)=IFZ, E(4)=Loyers,
  //                     F(5)=Loyers Espagne [EXCLU], G(6)=Chômage, H(7)=Kings, I(8)=Lycée,
  //                     J(9)=Remb.Hacienda, K(10)=Classes perso, L(11)=Autres
  // Calcul = (D+E) + (G+H+I+J+K+L) sommé sur les mois de l'année, ÷ (mois écoulés si année courante, sinon 12)
  function extractYear(v) {
    if (v === null || v === undefined || v === '') return null;
    if (v instanceof Date && !isNaN(v)) return v.getFullYear();
    const s = String(v).trim();
    // ISO "2025-03-31T..."
    let m = s.match(/^(\d{4})-/);
    if (m) {
      // ISO UTC fin de mois → peut basculer d'une année ; on ajoute 2h pour CET
      const d = new Date(s);
      if (!isNaN(d)) return new Date(d.getTime() + 2*60*60*1000).getFullYear();
      return +m[1];
    }
    // Texte "janvier 2025" ou "01/2025"
    m = s.match(/(\d{4})/);
    if (m) return +m[1];
    return null;
  }

  const declarer = raw.declarer || [];
  const declRows = declarer.slice(3); // sauter titre + en-tête + totaux
  const COLS_REVENU = [3, 4, 6, 7, 8, 9, 10, 11]; // D,E,G,H,I,J,K,L (exclut F=5=Loyers Espagne)

  // Regrouper par année
  const revenusParAnnee = {};
  declRows.forEach(r => {
    if (!r || !r[0]) return;
    const year = extractYear(r[0]);
    if (!year) return;
    let somme = 0;
    COLS_REVENU.forEach(ci => { somme += parseNum(r[ci]); });
    if (!revenusParAnnee[year]) revenusParAnnee[year] = { total: 0, moisAvecDonnees: 0 };
    revenusParAnnee[year].total += somme;
    revenusParAnnee[year].moisAvecDonnees += 1;
  });

  const anneeActuelle = new Date().getFullYear();
  const moisEcoules = new Date().getMonth() + 1; // 1-12
  const moyenneParAnnee = {};
  Object.keys(revenusParAnnee).forEach(y => {
    const yNum = +y;
    const diviseur = yNum === anneeActuelle ? moisEcoules : 12;
    moyenneParAnnee[yNum] = {
      total:    revenusParAnnee[y].total,
      diviseur: diviseur,
      moyenne:  diviseur > 0 ? revenusParAnnee[y].total / diviseur : 0,
    };
  });
  const anneesDisponibles = Object.keys(moyenneParAnnee).map(Number).sort((a,b) => b - a);

  // ── COURS ──────────────────────────────────────────────────────────────────
  // Format Apps Script : col A = titre, col B = date "dd/MM/yyyy HH:mm", col C = durée (minutes), col D = code
  function parseCourses(rows, isDone) {
    const now = new Date();
    return rows
      .filter(r => r[0] && r[1] && r[3] && /^\d$/.test(String(r[3]).trim()))
      .map(r => {
        const d = parseDate(r[1]);
        if (!d) return null;
        // Durée : Apps Script exporte les timedelta en format ISO inutilisable
        // On extrait la durée depuis le titre si possible (ex: "18h45-19h45" = 1h)
        // Sinon on utilise 1h par défaut (toutes les séances sont d'1h)
        let durationH = 1;
        const titleMatch = String(r[0]).match(/(\d+)h(\d+)-(\d+)h(\d+)/);
        if (titleMatch) {
          const start = +titleMatch[1] * 60 + +titleMatch[2];
          const end2  = +titleMatch[3] * 60 + +titleMatch[4];
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
          date: d.toLocaleDateString('fr-FR', {weekday:'short', day:'numeric', month:'short'}),
          time: d.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}),
          done,
          durationH,
        };
      })
      .filter(Boolean);
  }

  // ── FINANCES (Fin_Categories / Fin_Archives / Fin_Soldes) ───────────────────
  // Feuilles en format long : une ligne = (mois, clé, montant)
  const finCategories = (raw.finCategories || []).slice(1)
    .filter(r => r && String(r[0]).trim())
    .map(r => ({
      nom:   String(r[0]).trim(),
      type:  String(r[1]).trim() === 'depense' ? 'depense' : 'revenu',
      actif: r[2] !== false && String(r[2]).toUpperCase() !== 'FALSE'
    }));

  const finArchives = (raw.finArchives || []).slice(1)
    .filter(r => r && String(r[0]).trim())
    .map(r => ({
      mois:      String(r[0]).trim(),
      categorie: String(r[1]).trim(),
      montant:   parseNum(r[2])
    }));

  const finSoldes = (raw.finSoldes || []).slice(1)
    .filter(r => r && String(r[0]).trim())
    .map(r => ({
      mois:    String(r[0]).trim(),
      compte:  String(r[1]).trim(),
      montant: parseNum(r[2])
    }));

  return {
    today, month,
    summary: {
      presentH, presentE,
      futurH,   futurE,
      totalH,   totalE,
      nextH, nextE,
      avgRate: Math.round(avgRate * 100) / 100,
      actifs: String(actifs),
    },
    students,
    prevMonth: {
      label: m1Label, total: m1TotalE,
      items: m1rows.map(r => ({ name: String(r[6]), h: r[7]||0, e: r[8]||0 }))
    },
    nextMonth: {
      label: "Mois prochain", total: m2TotalE,
      items: m2rows.map(r => ({ name: String(r[9]), h: r[10]||0, e: r[11]||0 }))
    },
    courses: {
      cur:  parseCourses(mois),
      prev: parseCourses(moisM1, true),
      next: parseCourses(moisP1, false),
    },
    history,
    graph,
    revenuMoyen: { parAnnee: moyenneParAnnee, annees: anneesDisponibles, anneeActuelle },
    finCategories: finCategories,
    finArchives:   finArchives,
    finSoldes:     finSoldes,
    updatedAt: raw.updatedAt || null,
  };
}

// ── DATA FALLBACK (affiché pendant le chargement) ─────────────────────────────
const DATA_FALLBACK = {
  today: "Chargement…", month: "—",
  summary: { presentH:0,presentE:0,futurH:0,futurE:0,totalH:0,totalE:0,nextH:0,nextE:0,avgRate:0,actifs:"—" },
  students: [], prevMonth:{label:"—",total:0,items:[]}, nextMonth:{label:"—",total:0,items:[]},
  courses:{cur:[],prev:[],next:[]}, history:[], graph:[],
  revenuMoyen:{parAnnee:{},annees:[],anneeActuelle:new Date().getFullYear()},
  finCategories:[], finArchives:[], finSoldes:[],
};

// ── HELPERS ───────────────────────────────────────────────────────────────────
const fmtM = v => (v||0).toLocaleString("fr-FR",{minimumFractionDigits:2,maximumFractionDigits:2})+" €";
const fmtH = h => { if(!h||h<=0) return "0h"; const hh=Math.floor(h),mm=Math.round((h-hh)*60); return `${hh}h${mm>0?String(mm).padStart(2,"0"):""}`; };

// ── DESIGN SYSTEM ─────────────────────────────────────────────────────────────
const C = {
  bg:     "#D6DEE8",
  white:  "#FFFFFF",
  ink:    "#1A1A2E",
  ink2:   "#4A4A6A",
  ink3:   "#9090B0",
  border: "#E8E8F0",
  shadow: "0 2px 16px rgba(0,0,0,0.07)",
  shadowHov: "0 6px 32px rgba(0,0,0,0.13)",
};

const STUDENT_COLORS = {
  "1":"#FF6B6B","2":"#4ECDC4","3":"#45B7D1","4":"#96CEB4","5":"#FECA57",
  "6":"#FF9F43","7":"#48DBFB","8":"#FF9FF3",
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

// ── COMPONENTS ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color, delay="" }) {
  return (
    <div className={`card fade-up${delay}`} style={{
      background: C.white, borderRadius:16, padding:"20px 22px",
      boxShadow: C.shadow, transition:"all .25s ease",
      borderTop: `4px solid ${color}`,
    }}>
      <div style={{fontSize:11,fontFamily:"DM Sans",fontWeight:600,color:C.ink3,textTransform:"uppercase",letterSpacing:".1em",marginBottom:6}}>{label}</div>
      <div style={{fontSize:26,fontFamily:"Playfair Display",fontWeight:700,color:C.ink,lineHeight:1}}>{value}</div>
      {sub && <div style={{fontSize:12,color:C.ink3,marginTop:5,fontFamily:"DM Sans"}}>{sub}</div>}
    </div>
  );
}

function StudentChip({ code, name, color, small }) {
  return (
    <span style={{
      display:"inline-flex",alignItems:"center",gap:6,
      background: color+"18", border:`1.5px solid ${color}44`,
      borderRadius:20, padding: small?"3px 10px":"5px 14px",
      fontFamily:"DM Sans", fontSize: small?10:12, fontWeight:600, color: color,
    }}>
      <span style={{width:7,height:7,borderRadius:"50%",background:color,flexShrink:0}}/>
      {small ? code : `${code} · ${name}`}
    </span>
  );
}

function SectionTitle({ children, accent }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
      {accent && <div style={{width:4,height:28,borderRadius:2,background:accent}}/>}
      <h2 style={{fontFamily:"Playfair Display",fontSize:20,fontWeight:700,color:C.ink}}>{children}</h2>
    </div>
  );
}

// ── PAGE TABLEAU DE BORD ──────────────────────────────────────────────────────
function PageAccueil({ data, onRefresh }) {
  const s = data.summary;
  const actifs = data.students.filter(s=>s.totalH>0);
  const totalE = actifs.reduce((a,s)=>a+s.totalE,0);
  const pct = s.totalH>0 ? Math.round((s.presentH/s.totalH)*100) : 0;

  // Revenu moyen mensuel par année
  const rm = data.revenuMoyen || { parAnnee:{}, annees:[], anneeActuelle:new Date().getFullYear() };
  const [selYear, setSelYear] = useState(null);
  const yearToShow = selYear || (rm.annees.length > 0 ? rm.annees[0] : rm.anneeActuelle);
  const rmData = rm.parAnnee[yearToShow] || { moyenne:0, total:0, diviseur:12 };

  return (
    <div style={{padding:"32px 28px",maxWidth:980,margin:"0 auto"}}>

      {/* Bloc revenu moyen mensuel + sélecteur d'année */}
      {rm.annees.length > 0 && (
        <div className="fade-up" style={{
          background:C.white, borderRadius:20, padding:"22px 26px", marginBottom:20,
          boxShadow:C.shadow, display:"flex", justifyContent:"space-between",
          alignItems:"center", flexWrap:"wrap", gap:16,
          borderLeft:`5px solid #96CEB4`,
        }}>
          <div>
            <div style={{fontSize:11,fontFamily:"DM Sans",fontWeight:600,color:C.ink3,textTransform:"uppercase",letterSpacing:".1em",marginBottom:6}}>
              Revenu moyen mensuel — {yearToShow}
            </div>
            <div style={{fontFamily:"Playfair Display",fontSize:32,fontWeight:900,color:C.ink,lineHeight:1}}>
              {fmtM(rmData.moyenne)}
            </div>
            <div style={{fontSize:11,color:C.ink3,fontFamily:"DM Sans",marginTop:5}}>
              {fmtM(rmData.total)} sur {rmData.diviseur} mois
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            <span style={{fontSize:10,color:C.ink3,fontFamily:"DM Sans",textTransform:"uppercase",letterSpacing:".08em"}}>Année</span>
            <select value={yearToShow} onChange={e=>setSelYear(+e.target.value)} style={{
              padding:"10px 16px", borderRadius:10, border:`2px solid ${C.border}`,
              background:C.bg, color:C.ink, fontFamily:"DM Sans", fontSize:15, fontWeight:700,
              cursor:"pointer", outline:"none",
            }}>
              {rm.annees.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Hero header */}
      <div className="fade-up" style={{
        background:`linear-gradient(135deg, ${C.ink} 0%, #2d2d5e 100%)`,
        borderRadius:24, padding:"32px 36px", marginBottom:28, color:"white",
        position:"relative", overflow:"hidden",
      }}>
        {/* Decorative circles */}
        <div style={{position:"absolute",top:-40,right:-40,width:200,height:200,borderRadius:"50%",background:"rgba(255,255,255,0.04)"}}/>
        <div style={{position:"absolute",bottom:-60,right:80,width:140,height:140,borderRadius:"50%",background:"rgba(255,255,255,0.04)"}}/>
        <div style={{fontFamily:"DM Sans",fontSize:12,fontWeight:500,opacity:.6,letterSpacing:".12em",textTransform:"uppercase",marginBottom:8}}>{data.today}</div>
        <div style={{fontFamily:"Playfair Display",fontSize:34,fontWeight:900,lineHeight:1.1,marginBottom:16}}>{data.month}</div>

        {/* Progress bar mois */}
        <div style={{marginBottom:20}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,opacity:.7,fontFamily:"DM Sans",marginBottom:6}}>
            <span>{fmtH(s.presentH)} réalisé</span>
            <span>{pct}% du mois</span>
            <span>{fmtH(s.futurH)} restant</span>
          </div>
          <div style={{height:8,background:"rgba(255,255,255,0.15)",borderRadius:4,overflow:"hidden"}}>
            <div style={{width:`${pct}%`,height:"100%",background:"linear-gradient(90deg,#FECA57,#FF6B6B)",borderRadius:4,transition:"width 1s ease"}}/>
          </div>
        </div>

        <div style={{display:"flex",gap:32,flexWrap:"wrap"}}>
          <div>
            <div style={{fontFamily:"Playfair Display",fontSize:38,fontWeight:900,lineHeight:1}}>{fmtM(totalE)}</div>
            <div style={{fontSize:12,opacity:.6,fontFamily:"DM Sans",marginTop:3}}>Total mois en cours</div>
          </div>
          <div style={{width:1,background:"rgba(255,255,255,0.15)",margin:"4px 0"}}/>
          <div>
            <div style={{fontFamily:"Playfair Display",fontSize:28,fontWeight:700,color:"#FECA57",lineHeight:1}}>{fmtM(data.nextMonth?.total||0)}</div>
            <div style={{fontSize:12,opacity:.6,fontFamily:"DM Sans",marginTop:3}}>Mois prochain estimé</div>
          </div>
        </div>
      </div>

      {/* KPIs grid */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:14,marginBottom:28}}>
        <KpiCard label="Heures réalisées" value={fmtH(s.presentH)} color="#FF6B6B" delay=""/>
        <KpiCard label="Heures restantes" value={fmtH(s.futurH)} color="#45B7D1" delay="-2"/>
        <KpiCard label="Total heures mois" value={fmtH(s.totalH)} color="#4ECDC4" delay="-3"/>
        <KpiCard label="Prix moyen / h" value={`${Number(s.avgRate).toFixed(2)} €`} color="#FECA57" delay="-4"/>
        <KpiCard label="Clients actifs" value={String(s.actifs).replace(/Actifs\s*:\s*/i,"")} color="#96CEB4" delay="-4"/>
      </div>

      {/* Tableau élèves */}
      <div className="fade-up-2" style={{background:C.white,borderRadius:20,padding:"24px 28px",boxShadow:C.shadow,marginBottom:28}}>
        <SectionTitle accent="#45B7D1">Élèves — {data.month || "mois en cours"}</SectionTitle>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"0 4px",fontFamily:"DM Sans",fontSize:13}}>
            <thead>
              <tr>{["","Élève","Tarif","Réalisé","€ réal.","Restant","€ rest.","Total h","Total €"].map(h=>(
                <th key={h} style={{textAlign:"left",padding:"8px 12px",fontSize:10,fontWeight:600,color:C.ink3,textTransform:"uppercase",letterSpacing:".08em",borderBottom:`2px solid ${C.border}`}}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {data.students.map((st,i) => {
                const col = sc(st.code);
                const active = st.totalH > 0;
                return (
                  <tr key={i} style={{opacity: active?1:.45}}>
                    <td style={{padding:"10px 12px"}}><div style={{width:10,height:10,borderRadius:"50%",background:col}}/></td>
                    <td style={{padding:"10px 12px",fontWeight:600,color:C.ink}}>{st.name}</td>
                    <td style={{padding:"10px 12px",color:C.ink3}}>{st.rate} €/h</td>
                    <td style={{padding:"10px 12px",fontWeight:600,color:"#FF6B6B"}}>{fmtH(st.presentH)}</td>
                    <td style={{padding:"10px 12px",color:"#FF6B6B"}}>{fmtM(st.presentE)}</td>
                    <td style={{padding:"10px 12px",fontWeight:600,color:"#45B7D1"}}>{fmtH(st.futurH)}</td>
                    <td style={{padding:"10px 12px",color:"#45B7D1"}}>{fmtM(st.futurE)}</td>
                    <td style={{padding:"10px 12px",fontWeight:700,color:C.ink}}>{fmtH(st.totalH)}</td>
                    <td style={{padding:"10px 12px"}}>
                      {active ? (
                        <span style={{background:col+"18",color:col,fontWeight:700,padding:"4px 10px",borderRadius:8,fontSize:12}}>{fmtM(st.totalE)}</span>
                      ) : <span style={{color:C.ink3}}>—</span>}
                    </td>
                  </tr>
                );
              })}
              <tr style={{borderTop:`2px solid ${C.border}`}}>
                <td colSpan={3} style={{padding:"12px 12px",fontWeight:700,fontFamily:"DM Sans",color:C.ink}}>TOTAL</td>
                <td style={{padding:"12px 12px",fontWeight:700,color:"#FF6B6B"}}>{fmtH(s.presentH)}</td>
                <td style={{padding:"12px 12px",fontWeight:700,color:"#FF6B6B"}}>{fmtM(s.presentE)}</td>
                <td style={{padding:"12px 12px",fontWeight:700,color:"#45B7D1"}}>{fmtH(s.futurH)}</td>
                <td style={{padding:"12px 12px",fontWeight:700,color:"#45B7D1"}}>{fmtM(s.futurE)}</td>
                <td style={{padding:"12px 12px",fontWeight:700,color:C.ink}}>{fmtH(s.totalH)}</td>
                <td style={{padding:"12px 12px"}}>
                  <span style={{background:"#1A1A2E",color:"white",fontWeight:700,padding:"5px 12px",borderRadius:8,fontSize:13}}>{fmtM(totalE)}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Mois -1 / +1 */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        {[
          {data:data.prevMonth, accent:"#FF6B6B", icon:"◀", label:"Mois précédent"},
          {data:data.nextMonth, accent:"#4ECDC4", icon:"▶", label:"Mois prochain"},
        ].map(({data:m,accent,icon,label},i)=>(
          <div key={i} className={`card fade-up-${i+3}`} style={{background:C.white,borderRadius:20,padding:"22px 24px",boxShadow:C.shadow,transition:"all .25s ease"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
              <div>
                <div style={{fontSize:10,fontFamily:"DM Sans",fontWeight:600,color:C.ink3,textTransform:"uppercase",letterSpacing:".1em",marginBottom:3}}>{label}</div>
                <div style={{fontFamily:"Playfair Display",fontSize:16,fontWeight:700,color:C.ink}}>{m.label}</div>
              </div>
              <div style={{fontFamily:"Playfair Display",fontSize:22,fontWeight:900,color:accent}}>{fmtM(m.total)}</div>
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {m.items.map((it,j)=>(
                <div key={j} style={{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",padding:"7px 12px",background:accent+"10",borderRadius:8,fontSize:12,fontFamily:"DM Sans"}}>
                  <span style={{color:C.ink,fontWeight:500}}>{it.name}</span>
                  <span style={{color:accent,fontWeight:700}}>{fmtH(it.h)} · {fmtM(it.e)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── PAGE COURS ────────────────────────────────────────────────────────────────
function PageCours({ data }) {
  const [tab, setTab] = useState("cur");
  const MOIS_TABS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
  const now = new Date();
  const curM = now.getMonth(), curY = now.getFullYear();
  const prevM = curM === 0 ? 11 : curM - 1, prevY = curM === 0 ? curY - 1 : curY;
  const nextM = curM === 11 ? 0 : curM + 1, nextY = curM === 11 ? curY + 1 : curY;
  const tabs = [
    {id:"cur",  label:`${MOIS_TABS[curM]} ${curY}`},
    {id:"prev", label:`${MOIS_TABS[prevM]} ${prevY}`},
    {id:"next", label:`${MOIS_TABS[nextM]} ${nextY}`},
  ];
  const courses = (data.courses && data.courses[tab]) || [];

  // Group by student
  const byCode = courses.reduce((a,e)=>{ if(!a[e.code]) a[e.code]=[]; a[e.code].push(e); return a; },{});

  return (
    <div style={{padding:"32px 28px",maxWidth:980,margin:"0 auto"}}>
      <div className="fade-up" style={{marginBottom:28}}>
        <SectionTitle accent="#4ECDC4">Calendrier des cours</SectionTitle>
        <div style={{display:"flex",gap:8}}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              padding:"9px 20px",borderRadius:20,border:`2px solid ${tab===t.id?C.ink:C.border}`,
              background:tab===t.id?C.ink:C.white,color:tab===t.id?"white":C.ink2,
              fontFamily:"DM Sans",fontSize:13,fontWeight:600,cursor:"pointer",transition:"all .2s",
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        {Object.entries(byCode).map(([code,evs],i)=>{
          const col = sc(code);
          const name = evs[0].name;
          const doneCount = evs.filter(e=>e.done).length;
          return (
            <div key={code} className={`card fade-up-${Math.min(i+1,4)}`} style={{
              background:C.white,borderRadius:20,padding:"22px 26px",
              boxShadow:C.shadow,transition:"all .25s ease",
              borderLeft:`5px solid ${col}`,
            }}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:44,height:44,borderRadius:12,background:col+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:900,color:col,fontFamily:"Playfair Display"}}>{code}</div>
                  <div>
                    <div style={{fontFamily:"Playfair Display",fontSize:18,fontWeight:700,color:C.ink}}>{name}</div>
                    <div style={{fontSize:11,color:C.ink3,fontFamily:"DM Sans",marginTop:2}}>{doneCount}/{evs.length} séances réalisées</div>
                  </div>
                </div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <div style={{height:8,width:80,borderRadius:4,background:col+"22",overflow:"hidden"}}>
                    <div style={{width:`${evs.length>0?doneCount/evs.length*100:0}%`,height:"100%",background:col,borderRadius:4}}/>
                  </div>
                  <span style={{fontSize:12,fontWeight:700,color:col,fontFamily:"DM Sans"}}>{evs.length>0?Math.round(doneCount/evs.length*100):0}%</span>
                </div>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {evs.map((e,j)=>(
                  <div key={j} style={{
                    padding:"8px 14px",borderRadius:10,
                    background: e.done ? col+"15" : C.bg,
                    border: `1.5px solid ${e.done ? col+"60" : C.border}`,
                    fontFamily:"DM Sans",fontSize:12,
                  }}>
                    <span style={{fontWeight:600,color:e.done?col:C.ink}}>{e.date}</span>
                    <span style={{color:C.ink3,marginLeft:6}}>{e.time}</span>
                    {e.done && <span style={{marginLeft:6,color:col}}>✓</span>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {courses.length===0&&<p style={{color:C.ink3,textAlign:"center",padding:40,fontFamily:"DM Sans"}}>Aucun cours pour cette période.</p>}
      </div>
    </div>
  );
}

// ── PAGE HISTORIQUE + GRAPHIQUE ───────────────────────────────────────────────
function PageRecap({ data }) {
  const [tooltip, setTooltip] = useState(null);
  const [chartModal, setChartModal] = useState(false);
  const hist = data.history;
  const graphMissing = !data.graph || data.graph.length === 0;
  const graphData = !graphMissing ? data.graph : hist.map(r=>({month:r.month,salaires:r.salary,loyers:0,chomage:0,total:r.salary}));

  const totalS = graphData.reduce((a,r)=>a+r.total,0);
  const withS = graphData.filter(r=>r.total>0);
  const avgS = withS.length>0 ? totalS/withS.length : 0;
  const best = [...graphData].sort((a,b)=>b.total-a.total)[0];
  const last2 = graphData.slice(-2);
  const trend = last2.length===2&&last2[0].total>0 ? ((last2[1].total-last2[0].total)/last2[0].total*100) : null;

  const maxS = Math.max(...graphData.map(r=>r.total), 100);

  // SVG stacked bar chart
  const W=820, H=220, PL=48, PR=16, PT=16, PB=36;
  const iW=W-PL-PR, iH=H-PT-PB;
  const n=graphData.length, bW=iW/Math.max(n,1);
  function yp(v){ return iH*(1-v/Math.max(maxS,1)); }
  function yp2(v){ return (H*2-PT-PB)*(1-v/Math.max(maxS,1)); }

  // Couleurs des 3 composantes empilées
  const SERIES = [
    { key:'salaires', label:'Salaires',      color:'#45B7D1' },
    { key:'loyers',   label:'Loyers France',  color:'#FECA57' },
    { key:'chomage',  label:'Chômage',        color:'#96CEB4' },
  ];

  return (
    <div style={{padding:"32px 28px",maxWidth:980,margin:"0 auto"}}>

      {/* Diagnostic : feuille Graph2 absente de l'API */}
      {graphMissing && (
        <div style={{background:"#FFF8E1",border:"1px solid #FFD54F",borderRadius:12,padding:"12px 18px",marginBottom:20,fontSize:12,fontFamily:"DM Sans",color:"#8D6E00"}}>
          ⚠️ La feuille "Graph2" n'est pas reçue depuis Google Sheets. Vérifie que le script Apps Script a bien été <strong>redéployé en nouvelle version</strong> après modification. Données de secours affichées (Récap).
        </div>
      )}

      {/* KPIs */}
      <div className="fade-up" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:14,marginBottom:28}}>
        <KpiCard label="Total période" value={fmtM(totalS)} color="#FF6B6B"/>
        <KpiCard label="Moyenne / mois" value={fmtM(avgS)} color="#4ECDC4" delay="-2"/>
        <KpiCard label={`Record ${best?.month||""}`} value={fmtM(best?.total||0)} color="#FECA57" delay="-3"/>
        {trend!==null&&<KpiCard label="Tendance récente" value={`${trend>=0?"+":""}${trend.toFixed(1)}%`} color={trend>=0?"#96CEB4":"#FF6B6B"} delay="-4"/>}
      </div>

      {/* Modal graphique plein écran */}
      {chartModal&&(
        <div onClick={()=>setChartModal(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:C.white,borderRadius:24,padding:"28px 24px",width:"100%",maxWidth:1100,maxHeight:"90vh",overflow:"auto",boxShadow:"0 24px 80px rgba(0,0,0,0.3)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <SectionTitle accent="#FECA57">Évolution des revenus</SectionTitle>
              <button onClick={()=>setChartModal(false)} style={{border:"none",background:C.bg,borderRadius:8,width:36,height:36,fontSize:18,cursor:"pointer",color:C.ink2,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            </div>
            <svg viewBox={`0 0 ${W} ${H*2}`} style={{width:"100%",fontFamily:"DM Sans"}}>
              {[0,.25,.5,.75,1].map((f,i)=>{const v=maxS*f,y=PT+yp2(v);return <g key={i}><line x1={PL} x2={PL+iW} y1={y} y2={y} stroke="#f0f0f8" strokeWidth={1}/><text x={PL-6} y={y+4} textAnchor="end" fontSize={11} fill={C.ink3}>{Math.round(v)}€</text></g>;})}
              {graphData.map((r,i)=>{
                const x=PL+i*bW+bW*.1,bw=bW*.8;
                const isLast=i===graphData.length-1;
                const fullH = H*2-PT-PB;
                let cumul=0;
                return <g key={i}>
                  {SERIES.map((s,si)=>{
                    const val=r[s.key]||0;
                    if(val<=0) return null;
                    const bh=Math.max((val/Math.max(maxS,1))*fullH,0);
                    const by=PT+fullH-cumul-bh;
                    cumul+=bh;
                    return <rect key={si} x={x} y={by} width={bw} height={bh} fill={s.color} opacity={isLast?1:.8} rx={si===0?5:0}/>;
                  })}
                  <text x={PL+i*bW+bW/2} y={PT+fullH+22} textAnchor="middle" fontSize={10} fill={isLast?C.ink:C.ink3} fontWeight={isLast?700:400}>{r.month}</text>
                  {r.total>0&&<text x={PL+i*bW+bW/2} y={PT+fullH-cumul-7} textAnchor="middle" fontSize={isLast?12:10} fill={isLast?C.ink:C.ink2} fontWeight={700}>{Math.round(r.total)}€</text>}
                </g>;
              })}
              <line x1={PL} x2={PL} y1={PT} y2={PT+(H*2-PT-PB)} stroke={C.border} strokeWidth={1}/>
              <line x1={PL} x2={PL+iW} y1={PT+(H*2-PT-PB)} y2={PT+(H*2-PT-PB)} stroke={C.border} strokeWidth={1}/>
            </svg>
          </div>
        </div>
      )}

      {/* Graphique */}
      <div className="fade-up-2" style={{background:C.white,borderRadius:20,padding:"24px 28px",boxShadow:C.shadow,marginBottom:28}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
          <SectionTitle accent="#FECA57">Évolution des revenus</SectionTitle>
          <button onClick={()=>setChartModal(true)} title="Agrandir" style={{border:`1px solid ${C.border}`,background:C.bg,borderRadius:8,padding:"5px 10px",fontSize:12,cursor:"pointer",color:C.ink2,display:"flex",alignItems:"center",gap:5,fontFamily:"DM Sans"}}>
            ⛶ Agrandir
          </button>
        </div>
        <div style={{overflowX:"auto"}}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",fontFamily:"DM Sans"}}>
            {/* Grid */}
            {[0,.25,.5,.75,1].map((f,i)=>{
              const v=maxS*f, y=PT+yp(v);
              return <g key={i}>
                <line x1={PL} x2={PL+iW} y1={y} y2={y} stroke="#f0f0f8" strokeWidth={1}/>
                <text x={PL-6} y={y+4} textAnchor="end" fontSize={9} fill={C.ink3}>{Math.round(v)}€</text>
              </g>;
            })}
            {/* Stacked bars */}
            {graphData.map((r,i)=>{
              const x=PL+i*bW+bW*.15, bw=bW*.7;
              const isLast=i===graphData.length-1;
              let cumul=0;
              return <g key={i}
                onMouseEnter={()=>setTooltip({r,cx:PL+i*bW+bW/2})}
                onMouseLeave={()=>setTooltip(null)}
                style={{cursor:r.total>0?"pointer":"default"}}>
                {SERIES.map((s,si)=>{
                  const val=r[s.key]||0;
                  if(val<=0) return null;
                  const bh=Math.max((val/Math.max(maxS,1))*iH,0);
                  const by=PT+iH-cumul-bh;
                  cumul+=bh;
                  return <rect key={si} x={x} y={by} width={bw} height={bh} fill={s.color} opacity={isLast?1:.75} rx={si===0?4:0}/>;
                })}
                <text x={PL+i*bW+bW/2} y={PT+iH+20} textAnchor="middle" fontSize={8}
                  fill={isLast?C.ink:C.ink3} fontWeight={isLast?700:400}>{r.month}</text>
                {r.total>0&&<text x={PL+i*bW+bW/2} y={PT+iH-cumul-5} textAnchor="middle" fontSize={isLast?9:7}
                  fill={isLast?C.ink:C.ink3} fontWeight={isLast?700:400}>{Math.round(r.total)}€</text>}
              </g>;
            })}
            {/* Trend line */}
            {(()=>{
              const pts=graphData.map((r,i)=>r.total>0?{x:PL+i*bW+bW/2,y:PT+yp(r.total)}:null).filter(Boolean);
              return pts.length>1&&<polyline points={pts.map(p=>`${p.x},${p.y}`).join(" ")} fill="none" stroke={C.ink} strokeWidth={1.5} strokeDasharray="4,3" opacity={.25}/>;
            })()}
            {/* Tooltip */}
            {tooltip&&tooltip.r.total>0&&(()=>{
              const tx=Math.min(tooltip.cx+8,W-PR-170),ty=Math.max(PT+yp(tooltip.r.total)-12,PT);
              const lines = SERIES.filter(s=>(tooltip.r[s.key]||0)>0);
              const h = 24 + lines.length*14 + 6;
              return <g>
                <rect x={tx-6} y={ty-14} width={170} height={h} fill="white" stroke={C.border} rx={8}
                  style={{filter:"drop-shadow(0 4px 12px rgba(0,0,0,0.1))"}}/>
                <text x={tx+5} y={ty} fontSize={10} fill={C.ink} fontWeight={700}>{tooltip.r.month} — {fmtM(tooltip.r.total)}</text>
                {lines.map((s,i)=>(
                  <text key={i} x={tx+5} y={ty+18+i*14} fontSize={9} fill={s.color} fontWeight={600}>{s.label} : {fmtM(tooltip.r[s.key])}</text>
                ))}
              </g>;
            })()}
          </svg>
        </div>
        {/* Légende */}
        <div style={{display:"flex",gap:16,flexWrap:"wrap",marginTop:12,paddingLeft:4}}>
          {SERIES.map((s,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:C.ink2,fontFamily:"DM Sans"}}>
              <div style={{width:10,height:10,borderRadius:3,background:s.color}}/>
              {s.label}
            </div>
          ))}
        </div>
      </div>

      {/* Tableau */}
      <div className="fade-up-3" style={{background:C.white,borderRadius:20,padding:"24px 28px",boxShadow:C.shadow}}>
        <SectionTitle accent="#96CEB4">Historique mensuel</SectionTitle>
        <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"0 3px",fontFamily:"DM Sans",fontSize:12}}>
          <thead>
            <tr>{["Mois","Salaires","Loyers France","Chômage","Total","Tendance"].map(h=>(
              <th key={h} style={{textAlign:"left",padding:"8px 14px",fontSize:10,fontWeight:600,color:C.ink3,textTransform:"uppercase",letterSpacing:".08em",borderBottom:`2px solid ${C.border}`}}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {[...graphData].reverse().map((r,i)=>{
              const prev=graphData[graphData.length-2-i];
              const delta=prev&&prev.total>0?((r.total-prev.total)/prev.total*100):null;
              const isLast=i===0;
              // Couleurs assombries pour la ligne du mois en cours (meilleure lisibilité sur fond gris)
              const cSal = isLast ? "#1F7A99" : SERIES[0].color;  // bleu foncé
              const cLoy = isLast ? "#B8860B" : SERIES[1].color;  // jaune foncé (dark goldenrod)
              const cCho = isLast ? "#2E8B57" : SERIES[2].color;  // vert foncé (sea green)
              const cTrend = delta===null ? C.ink3 : delta>=0 ? (isLast?"#2E8B57":"#96CEB4") : "#FF6B6B";
              return (
                <tr key={i} style={{background:isLast?"#C8D4E0":C.white}}>
                  <td style={{padding:"10px 14px",fontWeight:isLast?700:400,color:isLast?C.ink:C.ink2}}>{r.month}</td>
                  <td style={{padding:"10px 14px",color:cSal,fontWeight:isLast?700:500}}>{r.salaires>0?fmtM(r.salaires):"—"}</td>
                  <td style={{padding:"10px 14px",color:cLoy,fontWeight:isLast?700:500}}>{r.loyers>0?fmtM(r.loyers):"—"}</td>
                  <td style={{padding:"10px 14px",color:cCho,fontWeight:isLast?700:500}}>{r.chomage>0?fmtM(r.chomage):"—"}</td>
                  <td style={{padding:"10px 14px"}}>
                    <span style={{
                      background: r.total>0?(isLast?"#FF6B6B28":"#FF6B6B18"):"transparent",
                      color: r.total>0?"#E04848":C.ink3,
                      padding: r.total>0?"4px 10px":"0",
                      borderRadius:6, fontWeight:r.total>0?700:400,
                    }}>{r.total>0?fmtM(r.total):"—"}</span>
                  </td>
                  <td style={{padding:"10px 14px",fontSize:11,color:cTrend,fontWeight:isLast?700:500}}>
                    {delta===null?"—":`${delta>=0?"▲":"▼"} ${Math.abs(delta).toFixed(1)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── PAGE ANALYSE — vue analytique des revenus ────────────────────────────────
function PageAnalyse({ data }) {
  const graphData = (data.graph && data.graph.length > 0) ? data.graph : [];

  // Extraire l'année depuis le label "mois année" (ex: "jan. 2025")
  function yearOf(label) {
    const m = String(label).match(/(\d{4})/);
    return m ? +m[1] : null;
  }

  // Regrouper par année
  const parAnnee = {};
  graphData.forEach(r => {
    const y = yearOf(r.month);
    if (!y) return;
    if (!parAnnee[y]) parAnnee[y] = { salaires:0, loyers:0, chomage:0, total:0, mois:0 };
    parAnnee[y].salaires += r.salaires;
    parAnnee[y].loyers   += r.loyers;
    parAnnee[y].chomage  += r.chomage;
    parAnnee[y].total    += r.total;
    parAnnee[y].mois     += 1;
  });
  const annees = Object.keys(parAnnee).map(Number).sort((a,b)=>a-b);

  // Année sélectionnée pour la répartition (par défaut la plus récente)
  const [selY, setSelY] = useState(null);
  const anneeRep = selY || (annees.length ? annees[annees.length-1] : null);
  const repartition = anneeRep ? parAnnee[anneeRep] : null;

  // Totaux globaux par source (toute la période)
  const totSalaires = graphData.reduce((a,r)=>a+r.salaires,0);
  const totLoyers   = graphData.reduce((a,r)=>a+r.loyers,0);
  const totChomage  = graphData.reduce((a,r)=>a+r.chomage,0);
  const totGlobal   = totSalaires + totLoyers + totChomage;

  const SOURCES = [
    { key:'salaires', label:'Salaires',     color:'#45B7D1' },
    { key:'loyers',   label:'Loyers France', color:'#FF6B6B' },
    { key:'chomage',  label:'Chômage',       color:'#FECA57' },
  ];

  // Moyenne mensuelle glissante (3 derniers mois vs 3 précédents)
  const last3 = graphData.slice(-3);
  const prev3 = graphData.slice(-6, -3);
  const avgLast3 = last3.length ? last3.reduce((a,r)=>a+r.total,0)/last3.length : 0;
  const avgPrev3 = prev3.length ? prev3.reduce((a,r)=>a+r.total,0)/prev3.length : 0;
  const momentum = avgPrev3 > 0 ? ((avgLast3-avgPrev3)/avgPrev3*100) : null;

  // Donut SVG pour la répartition
  function Donut({ parts, size=160 }) {
    const tot = parts.reduce((a,p)=>a+p.value,0);
    if (tot <= 0) return <div style={{color:C.ink3,fontSize:12}}>Aucune donnée</div>;
    const R=size/2, r=R*0.62, cx=R, cy=R;
    let angle=-Math.PI/2;
    const arcs = parts.map(p => {
      const frac = p.value/tot;
      const a0=angle, a1=angle+frac*2*Math.PI;
      angle=a1;
      const large = frac>0.5?1:0;
      const x0=cx+R*Math.cos(a0), y0=cy+R*Math.sin(a0);
      const x1=cx+R*Math.cos(a1), y1=cy+R*Math.sin(a1);
      const xi1=cx+r*Math.cos(a1), yi1=cy+r*Math.sin(a1);
      const xi0=cx+r*Math.cos(a0), yi0=cy+r*Math.sin(a0);
      return { d:`M${x0},${y0} A${R},${R} 0 ${large} 1 ${x1},${y1} L${xi1},${yi1} A${r},${r} 0 ${large} 0 ${xi0},${yi0} Z`, color:p.color, frac };
    });
    return (
      <svg viewBox={`0 0 ${size} ${size}`} style={{width:size,height:size}}>
        {arcs.map((a,i)=><path key={i} d={a.d} fill={a.color}/>)}
        <circle cx={cx} cy={cy} r={r-1} fill={C.white}/>
        <text x={cx} y={cy-6} textAnchor="middle" fontSize={11} fill={C.ink3} fontFamily="DM Sans">Total</text>
        <text x={cx} y={cy+12} textAnchor="middle" fontSize={14} fontWeight="700" fill={C.ink} fontFamily="Playfair Display">{Math.round(tot)}€</text>
      </svg>
    );
  }

  // Mini graphe en ligne — total mensuel sur toute la période
  function LineChart() {
    const W=820,H=180,P={t:16,r:16,b:30,l:46};
    const iW=W-P.l-P.r, iH=H-P.t-P.b;
    const n=graphData.length;
    const maxV=Math.max(...graphData.map(r=>r.total),100);
    const pts=graphData.map((r,i)=>({
      x:P.l+(n<=1?iW/2:i*iW/(n-1)),
      y:P.t+iH*(1-r.total/maxV),
      r,
    }));
    const path=pts.map((p,i)=>`${i===0?'M':'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const area=`${path} L${pts[pts.length-1].x.toFixed(1)},${P.t+iH} L${pts[0].x.toFixed(1)},${P.t+iH} Z`;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",fontFamily:"DM Sans"}}>
        <defs>
          <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#45B7D1" stopOpacity="0.25"/>
            <stop offset="100%" stopColor="#45B7D1" stopOpacity="0"/>
          </linearGradient>
        </defs>
        {[0,.25,.5,.75,1].map((f,i)=>{const v=maxV*f,y=P.t+iH*(1-f);return <g key={i}>
          <line x1={P.l} x2={P.l+iW} y1={y} y2={y} stroke="#f0f0f8" strokeWidth={1}/>
          <text x={P.l-6} y={y+4} textAnchor="end" fontSize={9} fill={C.ink3}>{Math.round(v)}€</text>
        </g>;})}
        <path d={area} fill="url(#lineFill)"/>
        <path d={path} fill="none" stroke="#45B7D1" strokeWidth={2.5} strokeLinejoin="round"/>
        {pts.map((p,i)=>(
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={i===pts.length-1?5:3} fill={i===pts.length-1?"#FF6B6B":"#45B7D1"}/>
            {(i===0||i===pts.length-1||i%3===0)&&<text x={p.x} y={P.t+iH+16} textAnchor="middle" fontSize={7} fill={C.ink3}>{p.r.month}</text>}
          </g>
        ))}
      </svg>
    );
  }

  if (graphData.length === 0) {
    return <div style={{padding:"40px 28px",maxWidth:980,margin:"0 auto",textAlign:"center",color:C.ink3,fontFamily:"DM Sans"}}>
      Aucune donnée d'analyse disponible.
    </div>;
  }

  return (
    <div style={{padding:"32px 28px",maxWidth:980,margin:"0 auto"}}>

      {/* Synthèse momentum */}
      <div className="fade-up" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:14,marginBottom:24}}>
        <KpiCard label="Moyenne 3 derniers mois" value={fmtM(avgLast3)} color="#45B7D1"/>
        {momentum!==null && <KpiCard label="vs 3 mois précédents" value={`${momentum>=0?"+":""}${momentum.toFixed(1)}%`} color={momentum>=0?"#96CEB4":"#FF6B6B"} delay="-2"/>}
        <KpiCard label="Cumul Salaires" value={fmtM(totSalaires)} color="#45B7D1" delay="-3"/>
        <KpiCard label="Cumul Loyers" value={fmtM(totLoyers)} color="#FF6B6B" delay="-4"/>
        <KpiCard label="Cumul Chômage" value={fmtM(totChomage)} color="#FECA57" delay="-4"/>
      </div>

      {/* Courbe d'évolution */}
      <div className="fade-up-2" style={{background:C.white,borderRadius:20,padding:"24px 28px",boxShadow:C.shadow,marginBottom:24}}>
        <SectionTitle accent="#45B7D1">Évolution du revenu total</SectionTitle>
        <div style={{overflowX:"auto"}}><LineChart/></div>
      </div>

      {/* Comparaison annuelle */}
      <div className="fade-up-2" style={{background:C.white,borderRadius:20,padding:"24px 28px",boxShadow:C.shadow,marginBottom:24}}>
        <SectionTitle accent="#96CEB4">Comparaison par année</SectionTitle>
        <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"0 4px",fontFamily:"DM Sans",fontSize:12}}>
          <thead>
            <tr>{["Année","Salaires","Loyers","Chômage","Total","Moy./mois"].map(h=>(
              <th key={h} style={{textAlign:"left",padding:"8px 12px",fontSize:10,fontWeight:600,color:C.ink3,textTransform:"uppercase",letterSpacing:".08em",borderBottom:`2px solid ${C.border}`}}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {annees.map((y,i)=>{
              const a=parAnnee[y];
              const moy = a.mois>0 ? a.total/a.mois : 0;
              return (
                <tr key={i} style={{background:i%2===0?"#F4F7FA":C.white}}>
                  <td style={{padding:"10px 12px",fontWeight:700,color:C.ink}}>{y}</td>
                  <td style={{padding:"10px 12px",color:"#45B7D1",fontWeight:500}}>{fmtM(a.salaires)}</td>
                  <td style={{padding:"10px 12px",color:"#FF6B6B",fontWeight:500}}>{fmtM(a.loyers)}</td>
                  <td style={{padding:"10px 12px",color:"#D4A015",fontWeight:500}}>{fmtM(a.chomage)}</td>
                  <td style={{padding:"10px 12px"}}><span style={{background:"#96CEB422",color:"#5BA86F",fontWeight:700,padding:"4px 10px",borderRadius:6}}>{fmtM(a.total)}</span></td>
                  <td style={{padding:"10px 12px",color:C.ink2,fontWeight:600}}>{fmtM(moy)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Répartition par source (donut) */}
      <div className="fade-up-3" style={{background:C.white,borderRadius:20,padding:"24px 28px",boxShadow:C.shadow}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
          <SectionTitle accent="#FECA57">Répartition des revenus</SectionTitle>
          <select value={anneeRep||''} onChange={e=>setSelY(+e.target.value)} style={{
            padding:"8px 14px",borderRadius:10,border:`2px solid ${C.border}`,background:C.bg,
            color:C.ink,fontFamily:"DM Sans",fontSize:14,fontWeight:700,cursor:"pointer",outline:"none",
          }}>
            {annees.map(y=><option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        {repartition && (
          <div style={{display:"flex",gap:32,alignItems:"center",flexWrap:"wrap",justifyContent:"center"}}>
            <Donut parts={SOURCES.map(s=>({value:repartition[s.key],color:s.color}))}/>
            <div style={{flex:1,minWidth:200}}>
              {SOURCES.map((s,i)=>{
                const val=repartition[s.key];
                const pct=repartition.total>0?(val/repartition.total*100):0;
                return (
                  <div key={i} style={{marginBottom:14}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                      <span style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:C.ink,fontWeight:500}}>
                        <span style={{width:12,height:12,borderRadius:3,background:s.color}}/>{s.label}
                      </span>
                      <span style={{fontSize:13,fontWeight:700,color:C.ink}}>{fmtM(val)}</span>
                    </div>
                    <div style={{height:8,background:"#f0f0f5",borderRadius:4,overflow:"hidden"}}>
                      <div style={{width:`${pct}%`,height:"100%",background:s.color,borderRadius:4}}/>
                    </div>
                    <div style={{fontSize:10,color:C.ink3,marginTop:2,textAlign:"right"}}>{pct.toFixed(1)}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── PAGE LIENS — raccourcis vers les feuilles Google Sheets ──────────────────
function PageLiens() {
  const liens = [
    {
      titre: "Nóminas",
      desc: "Feuille de suivi des salaires, cours et revenus",
      url: "https://docs.google.com/spreadsheets/d/1qFAGMnfFkznxkckuF5eGgY0XSo9qWAGao1vi_e5rkfw/edit",
      color: "#45B7D1",
      icon: "📊",
    },
    {
      titre: "Impôts",
      desc: "Feuille de gestion fiscale",
      url: "https://docs.google.com/spreadsheets/d/1jThZTb0tiJE__FGkaNk9M_Qflk4QBk3tpwCq7f7z5gg/edit",
      color: "#FF6B6B",
      icon: "🧾",
    },
  ];

  return (
    <div style={{padding:"32px 28px",maxWidth:980,margin:"0 auto"}}>
      <div className="fade-up" style={{marginBottom:24}}>
        <SectionTitle accent="#96CEB4">Mes documents</SectionTitle>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:16}}>
        {liens.map((l,i)=>(
          <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
            className={`card fade-up${i>0?"-2":""}`}
            style={{
              display:"block", textDecoration:"none",
              background:C.white, borderRadius:20, padding:"26px 28px",
              boxShadow:C.shadow, transition:"all .25s ease",
              borderLeft:`5px solid ${l.color}`,
            }}>
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:12}}>
              <div style={{
                width:52,height:52,borderRadius:14,flexShrink:0,
                background:l.color+"18",display:"flex",alignItems:"center",
                justifyContent:"center",fontSize:26,
              }}>{l.icon}</div>
              <div>
                <div style={{fontFamily:"Playfair Display",fontSize:20,fontWeight:700,color:C.ink,lineHeight:1.1}}>{l.titre}</div>
                <div style={{fontSize:12,color:C.ink3,fontFamily:"DM Sans",marginTop:3}}>{l.desc}</div>
              </div>
            </div>
            <div style={{
              display:"inline-flex",alignItems:"center",gap:6,
              color:l.color,fontFamily:"DM Sans",fontSize:13,fontWeight:600,
              marginTop:4,
            }}>
              Ouvrir la feuille
              <span style={{fontSize:16,lineHeight:1}}>→</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// ── ÉDITEUR D'UN MOIS (partagé Situation / Archives) ─────────────────────────
function EditeurMois({ data, mois, onSaved, compact }) {
  const cats = (data.finCategories || []).filter(c => c.actif);
  const revenus  = cats.filter(c => c.type === 'revenu');
  const depenses = cats.filter(c => c.type === 'depense');

  const [vals, setVals]       = useState({});
  const [sold, setSold]       = useState({});
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState(null);
  const [nouvelle, setNouvelle] = useState('');
  const [typeNouv, setTypeNouv] = useState('depense');

  // Charger les valeurs du mois sélectionné
  useEffect(() => {
    const v = {};
    cats.forEach(c => { v[c.nom] = ''; });
    (data.finArchives || []).filter(a => a.mois === mois)
      .forEach(a => { v[a.categorie] = a.montant; });
    setVals(v);

    const s = {};
    FIN_COMPTES.forEach(c => { s[c] = ''; });
    (data.finSoldes || []).filter(x => x.mois === mois)
      .forEach(x => { s[x.compte] = x.montant; });
    setSold(s);
    setMsg(null);
  }, [mois, data]);

  const totRev = revenus.reduce((a,c)=>a + num(vals[c.nom]), 0);
  const totDep = depenses.reduce((a,c)=>a + num(vals[c.nom]), 0);
  const solde  = totRev - totDep;
  const patrimoine = FIN_COMPTES.reduce((a,c)=>a + num(sold[c]), 0);

  async function sauvegarder() {
    setSaving(true); setMsg(null);
    try {
      await apiPost('saveArchives', {
        mois: mois,
        lignes: Object.keys(vals).map(k => ({ categorie: k, montant: num(vals[k]) }))
      });
      await apiPost('saveSoldes', {
        mois: mois,
        soldes: FIN_COMPTES.map(c => ({ compte: c, montant: num(sold[c]) }))
      });
      setMsg({ ok:true, txt:'Enregistré' });
      if (onSaved) await onSaved();
    } catch (e) {
      setMsg({ ok:false, txt:e.message });
    } finally { setSaving(false); }
  }

  // Retire une ligne : masquage si elle a un historique, suppression si elle est vide
  async function supprimerCategorie(nom) {
    const toutes = data.finCategories || [];
    const aHistorique = (data.finArchives || []).some(a => a.categorie === nom && a.montant !== 0);
    const question = aHistorique
      ? 'Retirer « ' + nom + ' » du formulaire ?\n\nLes montants déjà enregistrés resteront visibles dans les Archives.'
      : 'Supprimer définitivement « ' + nom + ' » ?';
    if (!window.confirm(question)) return;

    setSaving(true); setMsg(null);
    try {
      const liste = aHistorique
        ? toutes.map(c => c.nom === nom ? Object.assign({}, c, { actif: false }) : c)
        : toutes.filter(c => c.nom !== nom);
      await apiPost('saveCategories', { categories: liste });
      setMsg({ ok:true, txt: aHistorique ? 'Ligne retirée, historique conservé' : 'Ligne supprimée' });
      if (onSaved) await onSaved();
    } catch (e) {
      setMsg({ ok:false, txt:e.message });
    } finally { setSaving(false); }
  }

  // Réaffiche une ligne précédemment masquée
  async function restaurerCategorie(nom) {
    setSaving(true); setMsg(null);
    try {
      const liste = (data.finCategories || [])
        .map(c => c.nom === nom ? Object.assign({}, c, { actif: true }) : c);
      await apiPost('saveCategories', { categories: liste });
      setMsg({ ok:true, txt:'Ligne restaurée' });
      if (onSaved) await onSaved();
    } catch (e) {
      setMsg({ ok:false, txt:e.message });
    } finally { setSaving(false); }
  }

  async function ajouterCategorie() {
    const nom = nouvelle.trim();
    if (!nom) return;
    if (cats.some(c => c.nom.toLowerCase() === nom.toLowerCase())) {
      setMsg({ ok:false, txt:'Cette catégorie existe déjà' }); return;
    }
    setSaving(true); setMsg(null);
    try {
      const liste = (data.finCategories || []).concat([{ nom: nom, type: typeNouv, actif: true }]);
      await apiPost('saveCategories', { categories: liste });
      setNouvelle('');
      setMsg({ ok:true, txt:'Catégorie ajoutée' });
      if (onSaved) await onSaved();
    } catch (e) {
      setMsg({ ok:false, txt:e.message });
    } finally { setSaving(false); }
  }

  const colonne = (titre, liste, couleur, total) => (
    <div style={{flex:1,minWidth:260}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
        <span style={{fontSize:11,fontWeight:700,color:couleur,textTransform:"uppercase",letterSpacing:".1em",fontFamily:"DM Sans"}}>{titre}</span>
        <span style={{fontFamily:"Playfair Display",fontSize:17,fontWeight:700,color:couleur}}>{fmtM(total)}</span>
      </div>
      {liste.length === 0
        ? <div style={{fontSize:12,color:C.ink3,fontStyle:"italic",padding:"8px 0"}}>Aucune ligne</div>
        : liste.map((c,i) => (
            <div key={c.nom} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"7px 0",borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontSize:13,color:C.ink2,fontFamily:"DM Sans",flex:1,minWidth:0}}>{c.nom}</span>
              <input
                type="text" inputMode="decimal"
                value={vals[c.nom] === undefined ? '' : vals[c.nom]}
                onChange={e => setVals(Object.assign({}, vals, { [c.nom]: nettoyerSaisie(e.target.value) }))}
                placeholder="0"
                style={{
                  width:110, padding:"7px 10px", textAlign:"right",
                  border:`1.5px solid ${C.border}`, borderRadius:8,
                  fontFamily:"DM Sans", fontSize:13, fontWeight:600,
                  color: couleur, background:C.bg, outline:"none",
                }}/>
              {!compact && (
                <button onClick={()=>supprimerCategorie(c.nom)} disabled={saving}
                  title={'Retirer ' + c.nom}
                  style={{
                    border:"none", background:"transparent", cursor: saving?"default":"pointer",
                    color:C.ink3, fontSize:16, lineHeight:1, padding:"4px 2px",
                    fontFamily:"DM Sans", opacity: saving?.4:.65,
                  }}>×</button>
              )}
            </div>
          ))}
    </div>
  );

  return (
    <div>
      <div style={{display:"flex",gap:28,flexWrap:"wrap",marginBottom:20}}>
        {colonne('Revenus',  revenus,  '#2E8B57', totRev)}
        {colonne('Dépenses', depenses, '#E04848', totDep)}
      </div>

      {/* Solde du mois */}
      <div style={{
        background: solde>=0 ? '#EAF6EF' : '#FDECEC',
        border:`1px solid ${solde>=0 ? '#BFE3CD' : '#F5C6C6'}`,
        borderRadius:12, padding:"12px 18px", marginBottom:20,
        display:"flex", justifyContent:"space-between", alignItems:"center",
      }}>
        <span style={{fontSize:12,fontWeight:600,color:C.ink2,textTransform:"uppercase",letterSpacing:".08em",fontFamily:"DM Sans"}}>Solde du mois</span>
        <span style={{fontFamily:"Playfair Display",fontSize:24,fontWeight:900,color: solde>=0 ? '#2E8B57' : '#E04848'}}>{fmtM(solde)}</span>
      </div>

      {/* Patrimoine (stocks) */}
      {!compact && (
        <div style={{marginBottom:20}}>
          <div style={{fontSize:11,fontWeight:700,color:'#1F7A99',textTransform:"uppercase",letterSpacing:".1em",fontFamily:"DM Sans",marginBottom:8}}>
            Épargne — solde en fin de mois
          </div>
          {FIN_COMPTES.map((c,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"7px 0",borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontSize:13,color:C.ink2,fontFamily:"DM Sans"}}>{c}</span>
              <input
                type="text" inputMode="decimal"
                value={sold[c] === undefined ? '' : sold[c]}
                onChange={e => setSold(Object.assign({}, sold, { [c]: nettoyerSaisie(e.target.value) }))}
                placeholder="0"
                style={{
                  width:120, padding:"7px 10px", textAlign:"right",
                  border:`1.5px solid ${C.border}`, borderRadius:8,
                  fontFamily:"DM Sans", fontSize:13, fontWeight:600,
                  color:'#1F7A99', background:C.bg, outline:"none",
                }}/>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",marginTop:10,paddingTop:8,borderTop:`2px solid ${C.border}`}}>
            <span style={{fontSize:12,fontWeight:600,color:C.ink2,fontFamily:"DM Sans"}}>Total patrimoine</span>
            <span style={{fontFamily:"Playfair Display",fontSize:19,fontWeight:800,color:'#1F7A99'}}>{fmtM(patrimoine)}</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <button onClick={sauvegarder} disabled={saving} style={{
          padding:"11px 24px", borderRadius:10, border:"none",
          background: saving ? C.ink3 : C.ink, color:"#fff",
          fontFamily:"DM Sans", fontSize:14, fontWeight:700,
          cursor: saving ? "default" : "pointer",
        }}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
        {msg && (
          <span style={{fontSize:13,fontWeight:600,fontFamily:"DM Sans",color: msg.ok ? '#2E8B57' : '#E04848'}}>
            {msg.ok ? '✓ ' : '✗ '}{msg.txt}
          </span>
        )}
      </div>

      {/* Ajout de catégorie */}
      {!compact && (
        <div style={{marginTop:22,paddingTop:18,borderTop:`1px solid ${C.border}`}}>
          <div style={{fontSize:11,fontWeight:700,color:C.ink3,textTransform:"uppercase",letterSpacing:".1em",fontFamily:"DM Sans",marginBottom:10}}>
            Ajouter une ligne
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <input
              value={nouvelle} onChange={e=>setNouvelle(e.target.value)}
              placeholder="Nom (ex. Mutuelle)"
              style={{
                flex:1, minWidth:160, padding:"9px 12px",
                border:`1.5px solid ${C.border}`, borderRadius:10,
                fontFamily:"DM Sans", fontSize:13, background:C.bg, outline:"none",
              }}/>
            <select value={typeNouv} onChange={e=>setTypeNouv(e.target.value)} style={{
              padding:"9px 12px", border:`1.5px solid ${C.border}`, borderRadius:10,
              fontFamily:"DM Sans", fontSize:13, fontWeight:600, background:C.bg, outline:"none", cursor:"pointer",
            }}>
              <option value="depense">Dépense</option>
              <option value="revenu">Revenu</option>
            </select>
            <button onClick={ajouterCategorie} disabled={saving || !nouvelle.trim()} style={{
              padding:"9px 18px", borderRadius:10, border:`1.5px solid ${C.ink}`,
              background:"transparent", color:C.ink,
              fontFamily:"DM Sans", fontSize:13, fontWeight:700,
              cursor: (saving || !nouvelle.trim()) ? "default" : "pointer",
              opacity: (saving || !nouvelle.trim()) ? .45 : 1,
            }}>Ajouter</button>
          </div>

          {/* Lignes masquées : restauration possible */}
          {(data.finCategories || []).filter(c => !c.actif).length > 0 && (
            <div style={{marginTop:16}}>
              <div style={{fontSize:11,fontWeight:700,color:C.ink3,textTransform:"uppercase",letterSpacing:".1em",fontFamily:"DM Sans",marginBottom:8}}>
                Lignes masquées
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {(data.finCategories || []).filter(c => !c.actif).map((c,i) => (
                  <button key={i} onClick={()=>restaurerCategorie(c.nom)} disabled={saving}
                    style={{
                      display:"inline-flex", alignItems:"center", gap:6,
                      border:`1.5px dashed ${C.border}`, background:"transparent",
                      borderRadius:20, padding:"5px 12px", cursor: saving?"default":"pointer",
                      fontFamily:"DM Sans", fontSize:12, fontWeight:600, color:C.ink3,
                    }}>
                    {c.nom}<span style={{fontSize:14,lineHeight:1}}>↩</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── PAGE SITUATION — actif / passif du mois + patrimoine ─────────────────────
function PageSituation({ data, onRefresh }) {
  const [mois, setMois] = useState(moisCourantYM());

  // Liste des mois proposés : 24 derniers mois
  const options = [];
  const d0 = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(d0.getFullYear(), d0.getMonth() - i, 1);
    options.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
  }

  const pret = (data.finCategories || []).length > 0;

  return (
    <div style={{padding:"32px 28px",maxWidth:980,margin:"0 auto"}}>
      <div className="fade-up" style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12,marginBottom:20}}>
        <SectionTitle accent="#96CEB4">Situation</SectionTitle>
        <select value={mois} onChange={e=>setMois(e.target.value)} style={{
          padding:"10px 16px", borderRadius:10, border:`2px solid ${C.border}`,
          background:C.white, color:C.ink, fontFamily:"DM Sans",
          fontSize:14, fontWeight:700, cursor:"pointer", outline:"none",
        }}>
          {options.map(m => <option key={m} value={m}>{moisLisible(m)}</option>)}
        </select>
      </div>

      <div className="fade-up-2" style={{background:C.white,borderRadius:20,padding:"26px 28px",boxShadow:C.shadow}}>
        {pret
          ? <EditeurMois data={data} mois={mois} onSaved={onRefresh}/>
          : <div style={{fontSize:13,color:C.ink3,fontFamily:"DM Sans",lineHeight:1.6}}>
              Les catégories ne sont pas encore initialisées.<br/>
              Dans Google&nbsp;Sheets : menu <strong>⚙️ Finances → Initialiser</strong>, puis reviens ici et actualise.
            </div>}
      </div>
    </div>
  );
}

// ── PAGE ARCHIVES — historique complet, filtres, correction ──────────────────
function PageArchives({ data, onRefresh }) {
  const archives = data.finArchives || [];
  const soldes   = data.finSoldes   || [];
  const cats     = data.finCategories || [];
  const typeDe   = {};
  cats.forEach(c => { typeDe[c.nom] = c.type; });

  const [annee, setAnnee]   = useState('toutes');
  const [secteur, setSecteur] = useState('tous');
  const [editMois, setEditMois] = useState(null);

  // Mois présents dans les archives ou les soldes
  const moisSet = {};
  archives.forEach(a => { moisSet[a.mois] = true; });
  soldes.forEach(s => { moisSet[s.mois] = true; });
  const tousMois = Object.keys(moisSet).sort().reverse();

  const annees = [];
  tousMois.forEach(m => { const y = m.slice(0,4); if (annees.indexOf(y) === -1) annees.push(y); });

  const moisFiltres = tousMois.filter(m => annee === 'toutes' || m.slice(0,4) === annee);

  // Agrégats par mois
  const lignes = moisFiltres.map(m => {
    const duMois = archives.filter(a => a.mois === m)
      .filter(a => secteur === 'tous' || a.categorie === secteur);
    const rev = duMois.filter(a => typeDe[a.categorie] !== 'depense').reduce((s,a)=>s+a.montant, 0);
    const dep = duMois.filter(a => typeDe[a.categorie] === 'depense').reduce((s,a)=>s+a.montant, 0);
    const pat = soldes.filter(s => s.mois === m).reduce((s,x)=>s+x.montant, 0);
    return { mois:m, rev, dep, solde: rev - dep, pat };
  });

  const totRev = lignes.reduce((a,l)=>a+l.rev, 0);
  const totDep = lignes.reduce((a,l)=>a+l.dep, 0);

  const selStyle = {
    padding:"9px 14px", borderRadius:10, border:`2px solid ${C.border}`,
    background:C.white, color:C.ink, fontFamily:"DM Sans",
    fontSize:13, fontWeight:600, cursor:"pointer", outline:"none",
  };

  return (
    <div style={{padding:"32px 28px",maxWidth:980,margin:"0 auto"}}>
      <div className="fade-up" style={{marginBottom:18}}>
        <SectionTitle accent="#45B7D1">Archives</SectionTitle>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <select value={annee} onChange={e=>setAnnee(e.target.value)} style={selStyle}>
            <option value="toutes">Toutes les années</option>
            {annees.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={secteur} onChange={e=>setSecteur(e.target.value)} style={selStyle}>
            <option value="tous">Tous les secteurs</option>
            {cats.map((c,i) => <option key={i} value={c.nom}>{c.nom}</option>)}
          </select>
        </div>
      </div>

      {/* Synthèse de la sélection */}
      <div className="fade-up" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:14,marginBottom:22}}>
        <KpiCard label="Revenus" value={fmtM(totRev)} color="#2E8B57"/>
        <KpiCard label="Dépenses" value={fmtM(totDep)} color="#E04848" delay="-2"/>
        <KpiCard label="Solde cumulé" value={fmtM(totRev - totDep)} color={totRev-totDep>=0?"#45B7D1":"#E04848"} delay="-3"/>
        <KpiCard label="Mois enregistrés" value={String(lignes.length)} color="#FECA57" delay="-4"/>
      </div>

      {/* Tableau */}
      <div className="fade-up-2" style={{background:C.white,borderRadius:20,padding:"24px 28px",boxShadow:C.shadow}}>
        {lignes.length === 0 ? (
          <div style={{fontSize:13,color:C.ink3,fontFamily:"DM Sans",textAlign:"center",padding:"20px 0"}}>
            Aucune donnée enregistrée pour cette sélection.
          </div>
        ) : (
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"0 3px",fontFamily:"DM Sans",fontSize:12}}>
              <thead>
                <tr>{["Mois","Revenus","Dépenses","Solde","Patrimoine",""].map(h=>(
                  <th key={h} style={{textAlign:"left",padding:"8px 12px",fontSize:10,fontWeight:600,color:C.ink3,textTransform:"uppercase",letterSpacing:".08em",borderBottom:`2px solid ${C.border}`}}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {lignes.map((l,i)=>(
                  <tr key={i} style={{background:i%2===0?"#F4F7FA":C.white}}>
                    <td style={{padding:"10px 12px",fontWeight:600,color:C.ink}}>{moisLisible(l.mois)}</td>
                    <td style={{padding:"10px 12px",color:"#2E8B57",fontWeight:500}}>{l.rev>0?fmtM(l.rev):"—"}</td>
                    <td style={{padding:"10px 12px",color:"#E04848",fontWeight:500}}>{l.dep>0?fmtM(l.dep):"—"}</td>
                    <td style={{padding:"10px 12px"}}>
                      <span style={{background:l.solde>=0?"#2E8B5718":"#E0484818",color:l.solde>=0?"#2E8B57":"#E04848",padding:"4px 10px",borderRadius:6,fontWeight:700}}>{fmtM(l.solde)}</span>
                    </td>
                    <td style={{padding:"10px 12px",color:"#1F7A99",fontWeight:500}}>{l.pat>0?fmtM(l.pat):"—"}</td>
                    <td style={{padding:"10px 12px"}}>
                      <button onClick={()=>setEditMois(editMois===l.mois?null:l.mois)} style={{
                        border:`1.5px solid ${C.border}`, background:"transparent",
                        borderRadius:8, padding:"5px 12px", cursor:"pointer",
                        fontFamily:"DM Sans", fontSize:12, fontWeight:600, color:C.ink2,
                      }}>{editMois===l.mois ? 'Fermer' : 'Corriger'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Éditeur inline du mois sélectionné */}
        {editMois && (
          <div style={{marginTop:22,paddingTop:20,borderTop:`2px solid ${C.border}`}}>
            <div style={{fontFamily:"Playfair Display",fontSize:17,fontWeight:700,color:C.ink,marginBottom:14}}>
              Correction — {moisLisible(editMois)}
            </div>
            <EditeurMois data={data} mois={editMois} onSaved={onRefresh}/>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
const TABS = [
  {id:"accueil",label:"Tableau de bord"},
  {id:"cours",  label:"Cours du mois"},
  {id:"recap",  label:"Historique"},
  {id:"analyse",label:"Analyse"},
  {id:"situation",label:"Situation"},
  {id:"archives", label:"Archives"},
  {id:"liens",  label:"Liens"},
];

function App() {
  const [page, setPage]   = useState("accueil");
  const [data, setData]   = useState(DATA_FALLBACK);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  async function fetchData() {
    setLoading(true); setError(null);
    try {
      const res = await fetch(API_URL);
      const raw = await res.json();
      if (raw.error) throw new Error(raw.error);
      const parsed = parseSheetData(raw);
      setData(parsed);
      setLastUpdate(new Date());
    } catch(e) {
      setError("Impossible de charger les données : " + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  // Navigation par swipe gauche/droite
  const touchRef = React.useRef({ x:0, y:0 });
  function onTouchStart(e) {
    touchRef.current = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  }
  function onTouchEnd(e) {
    const dx = e.changedTouches[0].clientX - touchRef.current.x;
    const dy = e.changedTouches[0].clientY - touchRef.current.y;
    // Geste horizontal franc (et pas un scroll vertical)
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      const idx = TABS.findIndex(t => t.id === page);
      if (dx < 0 && idx < TABS.length - 1) setPage(TABS[idx + 1].id); // swipe gauche → page suivante
      if (dx > 0 && idx > 0)               setPage(TABS[idx - 1].id); // swipe droite → page précédente
    }
  }

  return (
    <div
      style={{minHeight:"100vh",background:C.bg,fontFamily:"DM Sans, sans-serif",overscrollBehaviorY:"contain"}}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <style>{globalCSS}</style>

      {/* Navigation responsive 2 lignes */}
      <nav style={{background:C.white,borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,zIndex:20,boxShadow:"0 1px 12px rgba(0,0,0,0.05)"}}>
        {/* Ligne 1 : logo + date + refresh */}
        <div style={{maxWidth:980,margin:"0 auto",padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:46,borderBottom:`1px solid ${C.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:9}}>
            <div style={{width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,#1A1A2E,#2d2d5e)",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <svg width="14" height="14" viewBox="0 0 28 28" fill="none">
                <rect x="4" y="4" width="9" height="9" rx="2" fill="#FECA57"/>
                <rect x="15" y="4" width="9" height="9" rx="2" fill="#FF6B6B" opacity=".7"/>
                <rect x="4" y="15" width="9" height="9" rx="2" fill="#4ECDC4" opacity=".7"/>
                <rect x="15" y="15" width="9" height="9" rx="2" fill="#45B7D1"/>
              </svg>
            </div>
            <span style={{fontFamily:"Playfair Display",fontWeight:700,fontSize:14,color:C.ink}}>Suivi cours <span style={{fontSize:9,color:C.ink3,fontFamily:"DM Sans"}}>{APP_VERSION}</span></span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {loading && <div style={{width:14,height:14,border:`2px solid #E8E8F0`,borderTopColor:C.ink,borderRadius:"50%",animation:"spin .7s linear infinite"}}/>}
            {!loading && lastUpdate && <span style={{fontSize:9,color:C.ink3}}>{lastUpdate.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</span>}
            <button onClick={fetchData} disabled={loading} style={{background:"#1A1A2E",color:"white",borderRadius:20,padding:"4px 12px",fontSize:10,fontFamily:"DM Sans",fontWeight:500,letterSpacing:".04em",border:"none",cursor:"pointer"}}>
              {data.month !== "—" && data.month !== "Chargement…" ? data.month : "↻"}
            </button>
          </div>
        </div>
        {/* Ligne 2 : onglets flex-wrap */}
        <div style={{maxWidth:980,margin:"0 auto",display:"flex",flexWrap:"wrap"}}>
          {TABS.map(t=>(
            <button key={t.id} className={`nav-tab${page===t.id?" active":""}`} onClick={()=>setPage(t.id)} style={{
              flex:"1 1 auto",minWidth:0,padding:"0 8px",border:"none",background:"transparent",
              fontFamily:"DM Sans",fontSize:12,fontWeight:page===t.id?600:400,
              color:page===t.id?C.ink:C.ink3,cursor:"pointer",
              borderBottom:`3px solid ${page===t.id?C.ink:"transparent"}`,
              height:40,transition:"all .2s",whiteSpace:"nowrap",textAlign:"center",
            }}>{t.label}</button>
          ))}
        </div>
      </nav>

      {/* Erreur */}
      {error && (
        <div style={{background:"#FFF0F0",border:"1px solid #FFD0D0",borderRadius:10,margin:"16px",padding:"12px 16px",fontSize:12,color:"#c0392b",fontFamily:"DM Sans",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span>{error}</span>
          <button onClick={fetchData} style={{background:"#c0392b",color:"white",border:"none",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:11}}>Réessayer</button>
        </div>
      )}

      {/* Écran de chargement initial */}
      {loading && data.month === "—" && (
        <div style={{textAlign:"center",padding:"80px 0",color:C.ink3,fontFamily:"DM Sans"}}>
          <div style={{width:32,height:32,border:`3px solid ${C.border}`,borderTopColor:C.ink,borderRadius:"50%",animation:"spin .7s linear infinite",margin:"0 auto 16px"}}/>
          <div style={{fontSize:14}}>Chargement depuis Google Sheets…</div>
        </div>
      )}

      {/* Pages */}
      {(!loading || data.month !== "—") && page==="accueil" && <PageAccueil data={data} onRefresh={fetchData}/>}
      {(!loading || data.month !== "—") && page==="cours"   && <PageCours   data={data}/>}
      {(!loading || data.month !== "—") && page==="recap"   && <PageRecap   data={data}/>}
      {(!loading || data.month !== "—") && page==="analyse" && <PageAnalyse data={data}/>}
      {(!loading || data.month !== "—") && page==="situation" && <PageSituation data={data} onRefresh={fetchData}/>}
      {(!loading || data.month !== "—") && page==="archives"  && <PageArchives  data={data} onRefresh={fetchData}/>}
      {page==="liens" && <PageLiens/>}
    </div>
  );
}


ReactDOM.createRoot(document.getElementById("root")).render(<App />);
