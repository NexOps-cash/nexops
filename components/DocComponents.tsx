import React from 'react';

// ─── Design System ──────────────────────────────────────────────────────────
const em = (color: string) => `#${color}`;
const G = '#00D855'; // nexus emerald

export const H1: React.FC<{ children: React.ReactNode }> = ({ children }) => null; // unused stub

export const Tag: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 12px', borderRadius:99, background:`${G}12`, border:`1px solid ${G}30`, color:G, fontSize:9, fontWeight:900, letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:28 }}>{children}</div>
);

export const Lead: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p style={{ fontSize:18, color:'rgba(255,255,255,0.9)', lineHeight:1.7, marginBottom:40, maxWidth:720, fontWeight:400 }}>{children}</p>
);

export const SectionH2: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 style={{ fontSize:22, fontWeight:700, color:'#fafafa', marginTop:56, marginBottom:16, paddingBottom:10, borderBottom:'1px solid rgba(255,255,255,0.1)', letterSpacing:'-0.03em' }}>{children}</h2>
);

export const SectionH3: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 style={{ fontSize:16, fontWeight:700, color:'#e4e4e7', marginTop:32, marginBottom:10 }}>{children}</h3>
);

export const Para: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p style={{ fontSize:14, color:'#d4d4d8', lineHeight:1.8, marginBottom:16 }}>{children}</p>
);

export const Code: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <code style={{ fontFamily:'monospace', fontSize:11, color:G, background:`${G}12`, padding:'2px 6px', borderRadius:4 }}>{children}</code>
);

export const CodeBlock: React.FC<{ lang?: string; code: string }> = ({ lang = 'code', code }) => (
  <div style={{ margin:'24px 0', borderRadius:16, border:'1px solid rgba(255,255,255,0.06)', overflow:'hidden', background:'#080908' }}>
    <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(255,255,255,0.02)' }}>
      <span style={{ width:8,height:8,borderRadius:'50%',background:'rgba(239,68,68,0.4)',display:'inline-block'}} />
      <span style={{ width:8,height:8,borderRadius:'50%',background:'rgba(234,179,8,0.4)',display:'inline-block'}} />
      <span style={{ width:8,height:8,borderRadius:'50%',background:`${G}60`,display:'inline-block'}} />
      <span style={{ marginLeft:8, fontSize:9, fontWeight:900, color:'#3f3f46', textTransform:'uppercase', letterSpacing:'0.2em' }}>{lang}</span>
    </div>
    <pre style={{ margin:0, padding:'24px', fontSize:11, fontFamily:'monospace', color:'#d4d4d8', overflowX:'auto', lineHeight:1.7, whiteSpace:'pre-wrap', wordBreak:'break-word' }}><code style={{ color:'#d4d4d8' }}>{code}</code></pre>
  </div>
);

export const InfoBox: React.FC<{ type?: 'info'|'warn'|'critical'; children: React.ReactNode }> = ({ type = 'info', children }) => {
  const cfg = {
    info:     { icon:'ℹ', border:'rgba(59,130,246,0.3)',  bg:'rgba(59,130,246,0.05)',  color:'#93c5fd' },
    warn:     { icon:'⚠', border:'rgba(234,179,8,0.3)',   bg:'rgba(234,179,8,0.05)',   color:'#fde047' },
    critical: { icon:'⛔',border:'rgba(239,68,68,0.3)',   bg:'rgba(239,68,68,0.05)',   color:'#fca5a5' },
  }[type];
  return (
    <div style={{ margin:'20px 0', padding:'14px 18px', borderRadius:12, border:`1px solid ${cfg.border}`, background:cfg.bg, display:'flex', gap:12 }}>
      <span style={{ fontSize:14 }}>{cfg.icon}</span>
      <p style={{ margin:0, fontSize:12, color:cfg.color, lineHeight:1.7 }}>{children}</p>
    </div>
  );
};

export const BulletList: React.FC<{ items: string[] }> = ({ items }) => (
  <ul style={{ listStyle:'none', padding:0, margin:'16px 0 24px', display:'flex', flexDirection:'column', gap:10 }}>
    {items.map((item, i) => (
      <li key={i} style={{ display:'flex', alignItems:'flex-start', gap:12, fontSize:14, color:'#d4d4d8', lineHeight:1.6 }}>
        <span style={{ marginTop:6, width:6, height:6, borderRadius:'50%', background:G, flexShrink:0, boxShadow:`0 0 8px ${G}` }} />
        <span dangerouslySetInnerHTML={{ __html: item.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#fafafa;font-weight:600">$1</strong>').replace(/`(.+?)`/g, `<code style="font-family:monospace;font-size:11px;color:${G};background:${G}12;padding:2px 6px;border-radius:4px;border:1px solid ${G}20">$1</code>`) }} />
      </li>
    ))}
  </ul>
);

export const OrderedList: React.FC<{ items: string[] }> = ({ items }) => (
  <ol style={{ listStyle:'none', padding:0, margin:'16px 0 24px', display:'flex', flexDirection:'column', gap:10, counterReset:'item' }}>
    {items.map((item, i) => (
      <li key={i} style={{ display:'flex', alignItems:'flex-start', gap:12, fontSize:14, color:'#d4d4d8', lineHeight:1.6 }}>
        <span style={{ flexShrink:0, width:22, height:22, borderRadius:'50%', border:`1px solid ${G}40`, color:G, fontSize:10, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center', marginTop:1 }}>{i+1}</span>
        <span dangerouslySetInnerHTML={{ __html: item.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#d4d4d8;font-weight:600">$1</strong>').replace(/`(.+?)`/g, `<code style="font-family:monospace;font-size:10px;color:${G};background:${G}12;padding:1px 5px;border-radius:4px">$1</code>`) }} />
      </li>
    ))}
  </ol>
);

export const Table: React.FC<{ head: string[]; rows: string[][] }> = ({ head, rows }) => (
  <div style={{ margin:'32px 0', borderRadius:16, border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden', background:'rgba(5,5,5,0.5)', backdropFilter:'blur(10px)' }}>
    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
      <thead>
        <tr style={{ background:`linear-gradient(90deg, ${G}15, rgba(59,130,246,0.15))` }}>
          {head.map(h => <th key={h} style={{ padding:'14px 20px', textAlign:'left', fontWeight:800, color:'#fafafa', whiteSpace:'nowrap', borderBottom:'1px solid rgba(255,255,255,0.1)', textTransform:'uppercase', fontSize:11, letterSpacing:'0.05em' }}>{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri} style={{ 
            background: ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
            transition: 'background 0.2s',
          }}>
            {row.map((cell, ci) => (
              <td key={ci} style={{ padding:'14px 20px', color:'#d4d4d8', borderBottom: ri < rows.length-1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
                dangerouslySetInnerHTML={{ __html: cell.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#00D855;font-weight:600">$1</strong>').replace(/`(.+?)`/g, `<code style="font-family:monospace;font-size:11px;color:#818cf8;background:rgba(129,140,248,0.1);padding:2px 6px;border-radius:4px">$1</code>`) }} />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const Pipeline: React.FC<{ steps: { label: string; desc?: string; color?: string }[] }> = ({ steps }) => (
  <div style={{ margin:'32px 0', display:'flex', flexDirection:'column', alignItems:'center', gap:0 }}>
    {steps.map((s, i) => (
      <React.Fragment key={i}>
        <div style={{ padding:'12px 28px', borderRadius:12, border:`1px solid ${s.color||G}30`, background:`${s.color||G}08`, minWidth:280, maxWidth:420, textAlign:'center' }}>
          <p style={{ margin:0, fontSize:12, fontWeight:700, color:s.color||G, fontFamily:'monospace' }}>{s.label}</p>
          {s.desc && <p style={{ margin:'4px 0 0', fontSize:10, color:'#a1a1aa' }}>{s.desc}</p>}
        </div>
        {i < steps.length-1 && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'4px 0' }}>
            <div style={{ width:1, height:16, background:'rgba(255,255,255,0.08)' }} />
            <span style={{ fontSize:10, color:'#3f3f46' }}>↓</span>
          </div>
        )}
      </React.Fragment>
    ))}
  </div>
);

export const CardGrid: React.FC<{ cards: { title: string; body: string; accent?: string }[] }> = ({ cards }) => (
  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px,1fr))', gap:12, margin:'24px 0' }}>
    {cards.map((c, i) => (
      <div key={i} style={{ padding:'20px', borderRadius:14, border:`1px solid ${c.accent||G}20`, background:`${c.accent||G}06`, transition:'border-color 0.2s' }}>
        <p style={{ margin:'0 0 8px', fontSize:12, fontWeight:700, color:c.accent||G }}>{c.title}</p>
        <p style={{ margin:0, fontSize:11, color:'#a1a1aa', lineHeight:1.6 }}>{c.body}</p>
      </div>
    ))}
  </div>
);

export const Quote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <blockquote style={{ margin:'28px 0', padding:'16px 24px', borderLeft:`3px solid ${G}`, background:`${G}06`, borderRadius:'0 12px 12px 0' }}>
    <p style={{ margin:0, fontSize:13, color:'#d4d4d8', lineHeight:1.7, fontStyle:'italic' }}>{children}</p>
  </blockquote>
);

export const PageTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h1 style={{ fontSize:28, fontWeight:800, color:'#fafafa', letterSpacing:'-0.03em', marginBottom:12, lineHeight:1.2 }}>{children}</h1>
);

export const SeverityBadge: React.FC<{ level: string }> = ({ level }) => {
  const cfg: Record<string, { bg: string; color: string }> = {
    CRITICAL: { bg:'rgba(239,68,68,0.12)', color:'#fca5a5' },
    HIGH:     { bg:'rgba(234,179,8,0.12)', color:'#fde047' },
    MEDIUM:   { bg:'rgba(249,115,22,0.12)',color:'#fdba74' },
    LOW:      { bg:'rgba(34,197,94,0.12)', color:'#86efac' },
  };
  const c = cfg[level] || cfg.LOW;
  return <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:99, fontSize:9, fontWeight:900, background:c.bg, color:c.color, letterSpacing:'0.1em' }}>{level}</span>;
};

export const StepRow: React.FC<{ n: number; title: string; desc: string }> = ({ n, title, desc }) => (
  <div style={{ display:'flex', gap:16, marginBottom:20 }}>
    <div style={{ flexShrink:0, width:28, height:28, borderRadius:'50%', border:`1px solid ${G}50`, color:G, fontSize:11, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center', marginTop:2 }}>{n}</div>
    <div>
      <p style={{ margin:'0 0 4px', fontSize:13, fontWeight:700, color:'#d4d4d8' }}>{title}</p>
      <p style={{ margin:0, fontSize:12, color:'#a1a1aa', lineHeight:1.6 }}>{desc}</p>
    </div>
  </div>
);
