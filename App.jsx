import { useState, useEffect, useCallback } from "react";

// ── DATA (hardcoded from Google Sheet for demo) ───────────────────────────────
const DATA = {
  today: "Samedi 21 mars 2026",
  month: "Mars 2026",
  sheetId: "1XmLHIsf9P20tj2Art47qG7188WCP-SwCCRePjb-252c",
  summary: {
    presentH: 5,  presentE: 105,
    futurH:   4,  futurE:   105,
    totalH:   9,  totalE:   210,
    nextH:    14, nextE:    345,
    avgRate:  23.33, actifs: 2,
  },
  students: [
    { code:"1", name:"Institut français", rate:25.45, presentH:0, presentE:0,  futurH:0, futurE:0,  totalH:0, totalE:0,   color:"#FF6B6B" },
    { code:"2", name:"King's Corner",     rate:10.00, presentH:0, presentE:0,  futurH:0, futurE:0,  totalH:0, totalE:0,   color:"#4ECDC4" },
    { code:"3", name:"Mark",              rate:15.00, presentH:3, presentE:45, futurH:1, futurE:15, totalH:4, totalE:60,  color:"#45B7D1" },
    { code:"4", name:"Lycée Molière",     rate:14.33, presentH:0, presentE:0,  futurH:0, futurE:0,  totalH:0, totalE:0,   color:"#96CEB4" },
    { code:"5", name:"Javi",              rate:30.00, presentH:2, presentE:60, futurH:3, futurE:90, totalH:5, totalE:150, color:"#FECA57" },
  ],
  prevMonth: {
    label:"Février 2026", total:1114.05,
    items:[
      {name:"Institut français", h:41.42, e:1054.05},
      {name:"Mark",              h:4,     e:60},
    ]
  },
  nextMonth: {
    label:"Avril 2026", total:345,
    items:[
      {name:"Mark", h:5, e:75},
      {name:"Javi", h:9, e:270},
    ]
  },
  courses: {
    cur: [
      {code:"3",name:"Mark",date:"Jeu 5 mars", time:"18:00",done:true},
      {code:"3",name:"Mark",date:"Jeu 12 mars",time:"18:00",done:true},
      {code:"3",name:"Mark",date:"Jeu 19 mars",time:"18:00",done:true},
      {code:"3",name:"Mark",date:"Mar 24 mars",time:"18:00",done:false},
      {code:"5",name:"Javi",date:"Lun 16 mars",time:"18:45",done:true},
      {code:"5",name:"Javi",date:"Lun 23 mars",time:"18:45",done:false},
      {code:"5",name:"Javi",date:"Mer 25 mars",time:"18:45",done:false},
      {code:"5",name:"Javi",date:"Lun 30 mars",time:"18:45",done:false},
    ],
    prev: [
      {code:"1",name:"Institut français",date:"Lun 2 fév", time:"10:30",done:true},
      {code:"1",name:"Institut français",date:"Lun 2 fév", time:"16:30",done:true},
      {code:"1",name:"Institut français",date:"Mar 3 fév", time:"16:00",done:true},
      {code:"1",name:"Institut français",date:"Mer 5 fév", time:"10:30",done:true},
      {code:"1",name:"Institut français",date:"Dim 9 fév", time:"15:00",done:true},
      {code:"1",name:"Institut français",date:"Lun 10 fév",time:"09:00",done:true},
      {code:"1",name:"Institut français",date:"Jeu 12 fév",time:"09:30",done:true},
      {code:"1",name:"Institut français",date:"Ven 13 fév",time:"09:00",done:true},
      {code:"1",name:"Institut français",date:"Lun 17 fév",time:"09:30",done:true},
      {code:"1",name:"Institut français",date:"Mar 18 fév",time:"18:00",done:true},
      {code:"3",name:"Mark",date:"Jeu 5 fév", time:"18:00",done:true},
      {code:"3",name:"Mark",date:"Jeu 12 fév",time:"18:00",done:true},
      {code:"3",name:"Mark",date:"Jeu 19 fév",time:"18:00",done:true},
      {code:"3",name:"Mark",date:"Jeu 26 fév",time:"18:00",done:true},
    ],
    next: [
      {code:"3",name:"Mark",date:"Jeu 2 avr", time:"18:00",done:false},
      {code:"3",name:"Mark",date:"Jeu 9 avr", time:"18:00",done:false},
      {code:"3",name:"Mark",date:"Jeu 16 avr",time:"18:00",done:false},
      {code:"3",name:"Mark",date:"Jeu 23 avr",time:"18:00",done:false},
      {code:"3",name:"Mark",date:"Jeu 30 avr",time:"18:00",done:false},
      {code:"5",name:"Javi",date:"Mer 1 avr", time:"18:45",done:false},
      {code:"5",name:"Javi",date:"Lun 6 avr", time:"18:45",done:false},
      {code:"5",name:"Javi",date:"Mer 8 avr", time:"18:45",done:false},
      {code:"5",name:"Javi",date:"Lun 13 avr",time:"18:45",done:false},
      {code:"5",name:"Javi",date:"Mer 15 avr",time:"18:45",done:false},
      {code:"5",name:"Javi",date:"Lun 20 avr",time:"18:45",done:false},
      {code:"5",name:"Javi",date:"Mer 22 avr",time:"18:45",done:false},
    ],
  },
  history: [
    {month:"Jan 2025",salary:1692.79,hours:0,   client:"Institut français"},
    {month:"Fév 2025",salary:1692.79,hours:0,   client:"Institut français"},
    {month:"Mar 2025",salary:1561.27,hours:0,   client:"Institut français"},
    {month:"Avr 2025",salary:0,      hours:0,   client:"—"},
    {month:"Mai 2025",salary:1593.76,hours:42.67,client:"Institut français"},
    {month:"Jun 2025",salary:1746.97,hours:77.87,client:"Institut français"},
    {month:"Jul 2025",salary:0,      hours:0,   client:"—"},
    {month:"Aoû 2025",salary:1160.99,hours:0,   client:"Chômage"},
    {month:"Sep 2025",salary:2047.04,hours:110, client:"King's Corner + Chômage"},
    {month:"Oct 2025",salary:1895.21,hours:110, client:"King's Corner + Mark"},
    {month:"Nov 2025",salary:715.96, hours:42,  client:"Lycée Molière + IFZ + Mark"},
    {month:"Déc 2025",salary:361.71, hours:2,   client:"Mark + Chômage"},
    {month:"Jan 2026",salary:1040,   hours:3,   client:"Mark + Chômage"},
    {month:"Fév 2026",salary:1955,   hours:45.42,client:"Mark + IFZ + Chômage"},
    {month:"Mar 2026",salary:210,    hours:9,   client:"Mark + Javi"},
  ],
};

// ── HELPERS ───────────────────────────────────────────────────────────────────
const fmtM = v => (v||0).toLocaleString("fr-FR",{minimumFractionDigits:2,maximumFractionDigits:2})+" €";
const fmtH = h => { if(!h||h<=0) return "0h"; const hh=Math.floor(h),mm=Math.round((h-hh)*60); return `${hh}h${mm>0?String(mm).padStart(2,"0"):""}`; };

// ── DESIGN SYSTEM ─────────────────────────────────────────────────────────────
const C = {
  bg:     "#FAFAF8",
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
function PageAccueil() {
  const s = DATA.summary;
  const actifs = DATA.students.filter(s=>s.totalH>0);
  const totalE = actifs.reduce((a,s)=>a+s.totalE,0);
  const pct = s.totalH>0 ? Math.round((s.presentH/s.totalH)*100) : 0;

  return (
    <div style={{padding:"32px 28px",maxWidth:980,margin:"0 auto"}}>

      {/* Hero header */}
      <div className="fade-up" style={{
        background:`linear-gradient(135deg, ${C.ink} 0%, #2d2d5e 100%)`,
        borderRadius:24, padding:"32px 36px", marginBottom:28, color:"white",
        position:"relative", overflow:"hidden",
      }}>
        {/* Decorative circles */}
        <div style={{position:"absolute",top:-40,right:-40,width:200,height:200,borderRadius:"50%",background:"rgba(255,255,255,0.04)"}}/>
        <div style={{position:"absolute",bottom:-60,right:80,width:140,height:140,borderRadius:"50%",background:"rgba(255,255,255,0.04)"}}/>
        <div style={{fontFamily:"DM Sans",fontSize:12,fontWeight:500,opacity:.6,letterSpacing:".12em",textTransform:"uppercase",marginBottom:8}}>{DATA.today}</div>
        <div style={{fontFamily:"Playfair Display",fontSize:34,fontWeight:900,lineHeight:1.1,marginBottom:16}}>{DATA.month}</div>

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
            <div style={{fontFamily:"Playfair Display",fontSize:28,fontWeight:700,color:"#FECA57",lineHeight:1}}>{fmtM(DATA.nextMonth.total)}</div>
            <div style={{fontSize:12,opacity:.6,fontFamily:"DM Sans",marginTop:3}}>Mois prochain estimé</div>
          </div>
        </div>
      </div>

      {/* KPIs grid */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:14,marginBottom:28}}>
        <KpiCard label="Heures réalisées" value={fmtH(s.presentH)} color="#FF6B6B" delay=""/>
        <KpiCard label="Heures restantes" value={fmtH(s.futurH)} color="#45B7D1" delay="-2"/>
        <KpiCard label="Total heures mois" value={fmtH(s.totalH)} color="#4ECDC4" delay="-3"/>
        <KpiCard label="Prix moyen / h" value={`${s.avgRate} €`} color="#FECA57" delay="-4"/>
        <KpiCard label="Clients actifs" value={String(s.actifs)} color="#96CEB4" delay="-4"/>
      </div>

      {/* Tableau élèves */}
      <div className="fade-up-2" style={{background:C.white,borderRadius:20,padding:"24px 28px",boxShadow:C.shadow,marginBottom:28}}>
        <SectionTitle accent="#45B7D1">Élèves — mars 2026</SectionTitle>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"0 4px",fontFamily:"DM Sans",fontSize:13}}>
            <thead>
              <tr>{["","Élève","Tarif","Réalisé","€ réal.","Restant","€ rest.","Total h","Total €"].map(h=>(
                <th key={h} style={{textAlign:"left",padding:"8px 12px",fontSize:10,fontWeight:600,color:C.ink3,textTransform:"uppercase",letterSpacing:".08em",borderBottom:`2px solid ${C.border}`}}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {DATA.students.map((st,i) => {
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
          {data:DATA.prevMonth, accent:"#FF6B6B", icon:"◀", label:"Mois précédent"},
          {data:DATA.nextMonth, accent:"#4ECDC4", icon:"▶", label:"Mois prochain"},
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
function PageCours() {
  const [tab, setTab] = useState("cur");
  const tabs = [{id:"cur",label:"Mars 2026"},{id:"prev",label:"Fév 2026"},{id:"next",label:"Avr 2026"}];
  const courses = DATA.courses[tab];

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
function PageRecap() {
  const [tooltip, setTooltip] = useState(null);
  const [chartModal, setChartModal] = useState(false);
  const hist = DATA.history;
  const maxS = Math.max(...hist.map(r=>r.salary), 100);
  const totalS = hist.reduce((a,r)=>a+r.salary,0);
  const withS = hist.filter(r=>r.salary>0);
  const avgS = withS.length>0 ? totalS/withS.length : 0;
  const best = [...hist].sort((a,b)=>b.salary-a.salary)[0];
  const last2 = hist.slice(-2);
  const trend = last2.length===2&&last2[0].salary>0 ? ((last2[1].salary-last2[0].salary)/last2[0].salary*100) : null;

  // SVG bar chart
  const W=820, H=220, PL=48, PR=16, PT=16, PB=36;
  const iW=W-PL-PR, iH=H-PT-PB;
  const n=hist.length, bW=iW/n;
  function yp(v){ return iH*(1-v/Math.max(maxS,1)); }
  function yp2(v){ return (H*2-PT-PB)*(1-v/Math.max(maxS,1)); }

  const gradColors = ["#FF6B6B","#FECA57","#4ECDC4","#45B7D1","#96CEB4"];

  return (
    <div style={{padding:"32px 28px",maxWidth:980,margin:"0 auto"}}>

      {/* KPIs */}
      <div className="fade-up" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:14,marginBottom:28}}>
        <KpiCard label="Total période" value={fmtM(totalS)} color="#FF6B6B"/>
        <KpiCard label="Moyenne / mois" value={fmtM(avgS)} color="#4ECDC4" delay="-2"/>
        <KpiCard label={`Record ${best?.month||""}`} value={fmtM(best?.salary||0)} color="#FECA57" delay="-3"/>
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
              <defs>{gradColors.map((c,i)=>(<linearGradient key={i} id={`gm${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={c} stopOpacity=".9"/><stop offset="100%" stopColor={c} stopOpacity=".3"/></linearGradient>))}</defs>
              {[0,.25,.5,.75,1].map((f,i)=>{const v=maxS*f,y=PT+yp2(v);return <g key={i}><line x1={PL} x2={PL+iW} y1={y} y2={y} stroke="#f0f0f8" strokeWidth={1}/><text x={PL-6} y={y+4} textAnchor="end" fontSize={11} fill={C.ink3}>{Math.round(v)}€</text></g>;})}
              {hist.map((r,i)=>{
                const x=PL+i*bW+bW*.1,bw=bW*.8;
                const bh=Math.max((r.salary/Math.max(maxS,1))*(H*2-PT-PB),0);
                const by=PT+(H*2-PT-PB)-bh;
                const isLast=i===hist.length-1;
                const gi=i%gradColors.length;
                return <g key={i}>
                  <rect x={x} y={by} width={bw} height={bh} fill={`url(#gm${gi})`} rx={5} opacity={isLast?1:.8}/>
                  <text x={PL+i*bW+bW/2} y={PT+(H*2-PT-PB)+22} textAnchor="middle" fontSize={10} fill={isLast?C.ink:C.ink3} fontWeight={isLast?700:400}>{r.month}</text>
                  {r.salary>0&&<text x={PL+i*bW+bW/2} y={by-7} textAnchor="middle" fontSize={isLast?12:10} fill={isLast?C.ink:C.ink2} fontWeight={700}>{Math.round(r.salary)}€</text>}
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
            <defs>
              {gradColors.map((c,i)=>(
                <linearGradient key={i} id={`g${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={c} stopOpacity=".9"/>
                  <stop offset="100%" stopColor={c} stopOpacity=".3"/>
                </linearGradient>
              ))}
            </defs>
            {/* Grid */}
            {[0,.25,.5,.75,1].map((f,i)=>{
              const v=maxS*f, y=PT+yp(v);
              return <g key={i}>
                <line x1={PL} x2={PL+iW} y1={y} y2={y} stroke="#f0f0f8" strokeWidth={1}/>
                <text x={PL-6} y={y+4} textAnchor="end" fontSize={9} fill={C.ink3}>{Math.round(v)}€</text>
              </g>;
            })}
            {/* Bars */}
            {hist.map((r,i)=>{
              const x=PL+i*bW+bW*.15, bw=bW*.7;
              const bh=Math.max((r.salary/Math.max(maxS,1))*iH,0);
              const by=PT+iH-bh;
              const isLast=i===hist.length-1;
              const gradIdx=i%gradColors.length;
              return <g key={i}
                onMouseEnter={()=>setTooltip({r,cx:PL+i*bW+bW/2})}
                onMouseLeave={()=>setTooltip(null)}
                style={{cursor:r.salary>0?"pointer":"default"}}>
                <rect x={x} y={by} width={bw} height={bh}
                  fill={isLast?`url(#g${gradIdx})`:`url(#g${gradIdx})`}
                  rx={4}
                  opacity={isLast?1:.75}/>
                {isLast&&r.salary>0&&<rect x={x} y={by} width={bw} height={4} fill={gradColors[gradIdx]} rx={2}/>}
                <text x={PL+i*bW+bW/2} y={PT+iH+20} textAnchor="middle" fontSize={8}
                  fill={isLast?C.ink:C.ink3} fontWeight={isLast?700:400}>{r.month}</text>
                {r.salary>0&&<text x={PL+i*bW+bW/2} y={by-5} textAnchor="middle" fontSize={isLast?9:7}
                  fill={isLast?C.ink:C.ink3} fontWeight={isLast?700:400}>{Math.round(r.salary)}€</text>}
              </g>;
            })}
            {/* Trend line */}
            {(()=>{
              const pts=hist.map((r,i)=>r.salary>0?{x:PL+i*bW+bW/2,y:PT+yp(r.salary)}:null).filter(Boolean);
              return pts.length>1&&<polyline points={pts.map(p=>`${p.x},${p.y}`).join(" ")} fill="none" stroke={C.ink} strokeWidth={1.5} strokeDasharray="4,3" opacity={.25}/>;
            })()}
            {/* Tooltip */}
            {tooltip&&tooltip.r.salary>0&&(()=>{
              const tx=Math.min(tooltip.cx+8,W-PR-170),ty=Math.max(PT+yp(tooltip.r.salary)-12,PT);
              return <g>
                <rect x={tx-6} y={ty-14} width={170} height={58} fill="white" stroke={C.border} rx={8}
                  style={{filter:"drop-shadow(0 4px 12px rgba(0,0,0,0.1))"}}/>
                <text x={tx+5} y={ty} fontSize={10} fill={C.ink} fontWeight={700}>{tooltip.r.month}</text>
                <text x={tx+5} y={ty+16} fontSize={9} fill="#FF6B6B" fontWeight={600}>{fmtM(tooltip.r.salary)}</text>
                <text x={tx+5} y={ty+30} fontSize={9} fill="#45B7D1">{fmtH(tooltip.r.hours)}</text>
                <text x={tx+5} y={ty+44} fontSize={8} fill={C.ink3}>{tooltip.r.client||""}</text>
              </g>;
            })()}
          </svg>
        </div>
      </div>

      {/* Tableau */}
      <div className="fade-up-3" style={{background:C.white,borderRadius:20,padding:"24px 28px",boxShadow:C.shadow}}>
        <SectionTitle accent="#96CEB4">Historique mensuel</SectionTitle>
        <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"0 3px",fontFamily:"DM Sans",fontSize:12}}>
          <thead>
            <tr>{["Mois","Heures","Revenus","Clients","Tendance"].map(h=>(
              <th key={h} style={{textAlign:"left",padding:"8px 14px",fontSize:10,fontWeight:600,color:C.ink3,textTransform:"uppercase",letterSpacing:".08em",borderBottom:`2px solid ${C.border}`}}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {[...hist].reverse().map((r,i)=>{
              const prev=hist[hist.length-2-i];
              const delta=prev&&prev.salary>0?((r.salary-prev.salary)/prev.salary*100):null;
              const isLast=i===0;
              return (
                <tr key={i} style={{background:isLast?"#FAFAF8":C.white}}>
                  <td style={{padding:"10px 14px",fontWeight:isLast?700:400,color:isLast?C.ink:C.ink2}}>{r.month}</td>
                  <td style={{padding:"10px 14px",color:"#45B7D1",fontWeight:500}}>{r.hours>0?fmtH(r.hours):"—"}</td>
                  <td style={{padding:"10px 14px"}}>
                    <span style={{
                      background: r.salary>0?"#FF6B6B18":"transparent",
                      color: r.salary>0?"#FF6B6B":C.ink3,
                      padding: r.salary>0?"4px 10px":"0",
                      borderRadius:6, fontWeight:r.salary>0?700:400,
                    }}>{r.salary>0?fmtM(r.salary):"—"}</span>
                  </td>
                  <td style={{padding:"10px 14px",color:C.ink3,fontSize:11}}>{r.client||"—"}</td>
                  <td style={{padding:"10px 14px",fontSize:11,color:delta===null?C.ink3:delta>=0?"#96CEB4":"#FF6B6B",fontWeight:500}}>
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

// ── ROOT ──────────────────────────────────────────────────────────────────────
const TABS = [
  {id:"accueil",label:"Tableau de bord"},
  {id:"cours",  label:"Cours du mois"},
  {id:"recap",  label:"Historique"},
];

export default function App() {
  const [page, setPage] = useState("accueil");
  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"DM Sans, sans-serif"}}>
      <style>{globalCSS}</style>

      {/* Navigation responsive 2 lignes */}
      <nav style={{background:C.white,borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,zIndex:20,boxShadow:"0 1px 12px rgba(0,0,0,0.05)"}}>
        {/* Ligne 1 : logo + date */}
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
            <span style={{fontFamily:"Playfair Display",fontWeight:700,fontSize:14,color:C.ink}}>Suivi cours</span>
          </div>
          <span style={{background:"#1A1A2E",color:"white",borderRadius:20,padding:"4px 12px",fontSize:10,fontFamily:"DM Sans",fontWeight:500,letterSpacing:".04em"}}>Mars 2026</span>
        </div>
        {/* Ligne 2 : onglets flex-wrap, jamais de scroll horizontal */}
        <div style={{maxWidth:980,margin:"0 auto",display:"flex",flexWrap:"wrap"}}>
          {TABS.map(t=>(
            <button key={t.id} className={`nav-tab${page===t.id?" active":""}`} onClick={()=>setPage(t.id)} style={{
              flex:"1 1 auto",minWidth:0,
              padding:"0 8px",border:"none",background:"transparent",
              fontFamily:"DM Sans",fontSize:12,fontWeight:page===t.id?600:400,
              color:page===t.id?C.ink:C.ink3,cursor:"pointer",
              borderBottom:`3px solid ${page===t.id?C.ink:"transparent"}`,
              height:40,transition:"all .2s",whiteSpace:"nowrap",textAlign:"center",
            }}>{t.label}</button>
          ))}
        </div>
      </nav>

      {/* Pages */}
      {page==="accueil" && <PageAccueil/>}
      {page==="cours"   && <PageCours/>}
      {page==="recap"   && <PageRecap/>}
    </div>
  );
}
