import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

// ── SCORE COLOR ──
function scoreColor(s) {
  if (s <= 25) return '#4ade80';
  if (s <= 50) return '#fbbf24';
  if (s <= 75) return '#fb923c';
  return '#f87171';
}

function scoreLabel(s) {
  if (s <= 25) return 'Low Risk';
  if (s <= 50) return 'Medium Risk';
  if (s <= 75) return 'High Risk';
  return 'Critical Risk';
}

function scoreEmoji(s) {
  if (s <= 25) return '✅';
  if (s <= 50) return '⚠️';
  if (s <= 75) return '🔶';
  return '🚨';
}

function trunc(s, n = 10) {
  return s ? s.slice(0, n) + '…' + s.slice(-6) : '—';
}

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0f0f0f; --bg1: #161616; --bg2: #1c1c1c;
    --line: #2a2a2a; --line2: #333;
    --accent: #7c6cfa; --t1: #f0f0f0; --t2: #888; --t3: #444;
    --mono: 'JetBrains Mono', monospace; --sans: 'Inter', sans-serif;
  }
  html { scroll-behavior: smooth; }
  body { background: var(--bg); color: var(--t1); font-family: var(--sans); font-size: 15px; line-height: 1.6; -webkit-font-smoothing: antialiased; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-thumb { background: var(--line2); border-radius: 2px; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes spin { to{transform:rotate(360deg)} }
  @keyframes fillBar { from{width:0} to{width:var(--w)} }
`;

export default function Result() {
  const router  = useRouter();
  const { address } = router.query;

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!address) return;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(`/api/score?address=${encodeURIComponent(address)}`);
        const d = await r.json();
        if (d.error) throw new Error(d.error);
        setData(d);
      } catch(e) {
        setError(e.message);
      }
      setLoading(false);
    }
    run();
  }, [address]);

  const score     = data?.score     || 0;
  const color     = scoreColor(score);
  const label     = scoreLabel(score);
  const emoji     = scoreEmoji(score);
  const breakdown = data?.breakdown || [];
  const recs      = data?.recommendations || [];
  const meta      = data?.meta || {};

  return (
    <>
      <Head>
        <title>{data ? `Score ${score}/100 — CryptoScore` : 'CryptoScore'}</title>
        <meta name="description" content={`Crypto wallet risk score: ${score}/100 — ${label}`} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </Head>

      {/* HEADER */}
      <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',height:56,padding:'0 32px',borderBottom:'1px solid #2a2a2a',position:'sticky',top:0,background:'rgba(15,15,15,.96)',backdropFilter:'blur(20px)',zIndex:99}}>
        <a href="/" style={{fontFamily:'JetBrains Mono, monospace',fontSize:16,fontWeight:500,letterSpacing:'-.5px',color:'#f0f0f0',textDecoration:'none'}}>
          crypto<b style={{color:'#7c6cfa'}}>score</b>
        </a>
        <a href="/" style={{fontSize:13,color:'#888',border:'1px solid #2a2a2a',borderRadius:5,padding:'5px 14px'}}>
          ← New check
        </a>
      </header>

      <main style={{maxWidth:700,margin:'0 auto',padding:'48px 24px 80px'}}>

        {/* ADDRESS */}
        <div style={{fontFamily:'JetBrains Mono, monospace',fontSize:12,color:'#444',marginBottom:32,wordBreak:'break-all'}}>
          {address}
        </div>

        {/* LOADING */}
        {loading && (
          <div style={{textAlign:'center',padding:'80px 0',color:'#444'}}>
            <div style={{width:32,height:32,borderRadius:'50%',border:'2px solid #2a2a2a',borderTopColor:'#7c6cfa',animation:'spin .7s linear infinite',margin:'0 auto 20px'}} />
            <div style={{fontSize:14}}>Analyzing wallet…</div>
            <div style={{fontSize:12,marginTop:8,color:'#333'}}>Checking blacklists, transactions, exchange interactions…</div>
          </div>
        )}

        {/* ERROR */}
        {error && !loading && (
          <div style={{border:'1px solid #2a2a2a',borderRadius:8,padding:'48px 24px',textAlign:'center'}}>
            <div style={{fontSize:28,marginBottom:14}}>⚠️</div>
            <div style={{fontSize:16,fontWeight:500,color:'#f87171',marginBottom:8}}>{error}</div>
            <div style={{fontSize:13,color:'#444',marginBottom:24}}>Check the address and try again.</div>
            <a href="/" style={{background:'#7c6cfa',color:'#fff',borderRadius:6,padding:'10px 20px',fontSize:13,fontWeight:500,textDecoration:'none'}}>Try again →</a>
          </div>
        )}

        {/* RESULT */}
        {data && !loading && (
          <div style={{animation:'fadeUp .3s ease'}}>

            {/* SCORE CARD */}
            <div style={{border:'1px solid #2a2a2a',borderRadius:8,overflow:'hidden',marginBottom:24}}>

              {/* Score header */}
              <div style={{padding:'32px 28px',borderBottom:'1px solid #2a2a2a',display:'flex',alignItems:'center',justifyContent:'space-between',gap:20,flexWrap:'wrap'}}>
                <div>
                  <div style={{fontSize:13,color:'#888',marginBottom:8,fontFamily:'JetBrains Mono, monospace'}}>
                    {meta.chain || 'Bitcoin'} · {meta.txCount || 0} transactions
                  </div>
                  <div style={{display:'flex',alignItems:'baseline',gap:10,marginBottom:12}}>
                    <div style={{fontFamily:'JetBrains Mono, monospace',fontSize:56,fontWeight:600,lineHeight:1,color}}>{score}</div>
                    <div style={{fontSize:20,color:'#444',fontFamily:'JetBrains Mono, monospace'}}>/100</div>
                  </div>
                  <div style={{fontSize:15,fontWeight:500,color}}>{emoji} {label}</div>
                </div>

                {/* Circular score */}
                <div style={{position:'relative',width:100,height:100,flexShrink:0}}>
                  <svg width="100" height="100" style={{transform:'rotate(-90deg)'}}>
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#2a2a2a" strokeWidth="6"/>
                    <circle cx="50" cy="50" r="42" fill="none" stroke={color} strokeWidth="6"
                      strokeDasharray={`${2*Math.PI*42}`}
                      strokeDashoffset={`${2*Math.PI*42*(1-score/100)}`}
                      strokeLinecap="round"
                      style={{transition:'stroke-dashoffset .8s ease'}}
                    />
                  </svg>
                  <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'JetBrains Mono, monospace',fontSize:18,fontWeight:600,color}}>
                    {score}
                  </div>
                </div>
              </div>

              {/* Score bar */}
              <div style={{padding:'20px 28px',borderBottom:'1px solid #2a2a2a'}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#444',fontFamily:'JetBrains Mono, monospace',marginBottom:8}}>
                  <span>Safe</span><span>Low</span><span>Medium</span><span>High</span><span>Critical</span>
                </div>
                <div style={{height:6,background:'#2a2a2a',borderRadius:3,overflow:'hidden'}}>
                  <div style={{
                    height:'100%',
                    width:`${score}%`,
                    background:`linear-gradient(90deg, #4ade80, #fbbf24, #fb923c, #f87171)`,
                    borderRadius:3,
                    transition:'width .8s ease'
                  }}/>
                </div>
              </div>

              {/* Meta grid */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)'}}>
                {[
                  { l:'Balance',    v: meta.balance    || '—' },
                  { l:'Tx count',   v: meta.txCount    || '—' },
                  { l:'First seen', v: meta.firstSeen  || '—' },
                  { l:'Last active',v: meta.lastActive || '—' },
                ].map((c,i) => (
                  <div key={i} style={{padding:'16px 20px',borderRight: i<3 ? '1px solid #2a2a2a' : 'none'}}>
                    <div style={{fontSize:11,color:'#444',textTransform:'uppercase',letterSpacing:1,marginBottom:5}}>{c.l}</div>
                    <div style={{fontFamily:'JetBrains Mono, monospace',fontSize:13,fontWeight:500}}>{c.v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* BREAKDOWN */}
            <div style={{border:'1px solid #2a2a2a',borderRadius:8,overflow:'hidden',marginBottom:24}}>
              <div style={{padding:'14px 20px',fontSize:11,color:'#444',textTransform:'uppercase',letterSpacing:1,borderBottom:'1px solid #2a2a2a'}}>
                Risk breakdown
              </div>
              {breakdown.map((item, i) => (
                <div key={i} style={{display:'flex',alignItems:'center',gap:16,padding:'16px 20px',borderBottom: i<breakdown.length-1 ? '1px solid #2a2a2a' : 'none',background:'#161616'}}>
                  <div style={{fontSize:16,flexShrink:0}}>{item.icon}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:500,marginBottom:3}}>{item.label}</div>
                    <div style={{fontSize:12,color:'#888'}}>{item.detail}</div>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <div style={{fontFamily:'JetBrains Mono, monospace',fontSize:14,fontWeight:600,color: item.points > 0 ? scoreColor(item.points * 3) : '#4ade80'}}>
                      {item.points > 0 ? `+${item.points}` : '0'}
                    </div>
                    <div style={{fontSize:10,color:'#444',marginTop:2}}>risk pts</div>
                  </div>
                  {/* Mini bar */}
                  <div style={{width:60,height:3,background:'#2a2a2a',borderRadius:2,overflow:'hidden',flexShrink:0}}>
                    <div style={{width:`${(item.points/item.max)*100}%`,height:'100%',background: item.points > 0 ? scoreColor(item.points * 3) : '#4ade80',borderRadius:2}}/>
                  </div>
                </div>
              ))}
            </div>

            {/* RECOMMENDATIONS */}
            {recs.length > 0 && (
              <div style={{border:'1px solid #2a2a2a',borderRadius:8,overflow:'hidden',marginBottom:24}}>
                <div style={{padding:'14px 20px',fontSize:11,color:'#444',textTransform:'uppercase',letterSpacing:1,borderBottom:'1px solid #2a2a2a'}}>
                  Recommendations
                </div>
                {recs.map((rec, i) => (
                  <div key={i} style={{padding:'18px 20px',borderBottom: i<recs.length-1 ? '1px solid #2a2a2a' : 'none',background:'#161616'}}>
                    <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
                      <div style={{fontSize:16,flexShrink:0,marginTop:1}}>{rec.icon}</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:500,marginBottom:4}}>{rec.title}</div>
                        <div style={{fontSize:12,color:'#888',lineHeight:1.6,marginBottom: rec.cta ? 12 : 0}}>{rec.desc}</div>
                        {rec.cta && (
                          <a
                            href={rec.ctaUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{display:'inline-flex',alignItems:'center',gap:6,background:'#7c6cfa',color:'#fff',borderRadius:5,padding:'7px 14px',fontSize:12,fontWeight:500,textDecoration:'none'}}
                          >
                            {rec.cta} →
                          </a>
                        )}
                      </div>
                      <div style={{fontSize:11,color:'#444',flexShrink:0,fontFamily:'JetBrains Mono, monospace',marginTop:2}}>
                        {rec.priority}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* SHARE */}
            <div style={{border:'1px solid #2a2a2a',borderRadius:8,padding:'20px',background:'#161616',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
              <div>
                <div style={{fontSize:13,fontWeight:500,marginBottom:3}}>Share this report</div>
                <div style={{fontSize:12,color:'#888',fontFamily:'JetBrains Mono, monospace'}}>{typeof window !== 'undefined' ? window.location.href.slice(0,50)+'…' : ''}</div>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(typeof window !== 'undefined' ? window.location.href : '')}
                style={{background:'#2a2a2a',color:'#f0f0f0',border:'none',borderRadius:5,padding:'8px 16px',fontSize:12,cursor:'pointer'}}
              >
                Copy link
              </button>
            </div>

          </div>
        )}
      </main>

      <footer style={{borderTop:'1px solid #2a2a2a',padding:'20px 32px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
        <div style={{fontFamily:'JetBrains Mono, monospace',fontSize:11,color:'#444'}}>
          cryptoscore · data by <a href="https://mempool.space" target="_blank" rel="noreferrer">mempool.space</a> &amp; <a href="https://3xpl.com" target="_blank" rel="noreferrer">3xpl</a>
        </div>
        <div style={{fontSize:11,color:'#444'}}>For informational purposes only</div>
      </footer>
    </>
  );
}
