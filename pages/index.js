// pages/index.js
import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';

// ─────────────────────────────────────────
// CHAIN DETECTION — regex locale, 0 API calls
// ─────────────────────────────────────────
function detectChainLocal(addr) {
  if (!addr) return null;
  if (/^(bc1|1|3)[a-zA-HJ-NP-Z0-9]{25,62}$/.test(addr))  return 'bitcoin';
  if (/^0x[a-fA-F0-9]{40}$/.test(addr))                   return 'evm';
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr))         return 'solana';
  if (/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(addr))        return 'xrp-ledger';
  if (/^T[a-zA-Z0-9]{33}$/.test(addr))                    return 'tron';
  if (/^D[5-9A-HJ-NP-Za-km-z]{33}$/.test(addr))           return 'dogecoin';
  if (/^(L|M|ltc1)[a-zA-Z0-9]{25,62}$/.test(addr))        return 'litecoin';
  if (/^addr1[a-z0-9]{50,}$/.test(addr))                  return 'cardano';
  return null;
}

// ─────────────────────────────────────────
// CHAIN METADATA
// ─────────────────────────────────────────
const CHAINS = {
  bitcoin:      { name: 'Bitcoin',   symbol: 'BTC',  color: '#4ade80' },
  ethereum:     { name: 'Ethereum',  symbol: 'ETH',  color: '#7c6cfa' },
  bnb:          { name: 'BNB',       symbol: 'BNB',  color: '#fbbf24' },
  polygon:      { name: 'Polygon',   symbol: 'MATIC', color: '#a78bfa' },
  'arbitrum-one':{ name: 'Arbitrum', symbol: 'ARB',  color: '#7c6cfa' },
  avalanche:    { name: 'Avalanche', symbol: 'AVAX', color: '#f87171' },
  solana:       { name: 'Solana',    symbol: 'SOL',  color: '#a78bfa' },
  'xrp-ledger': { name: 'XRP',       symbol: 'XRP',  color: '#7c6cfa' },
  tron:         { name: 'Tron',      symbol: 'TRX',  color: '#f87171' },
  dogecoin:     { name: 'Dogecoin',  symbol: 'DOGE', color: '#fbbf24' },
  litecoin:     { name: 'Litecoin',  symbol: 'LTC',  color: '#4ade80' },
  cardano:      { name: 'Cardano',   symbol: 'ADA',  color: '#7c6cfa' },
};

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
function calcETA(feeRate, fees) {
  if (!fees) return { t: '—', d: 'Unknown', c: 'var(--t3)' };
  const { fastestFee, halfHourFee, hourFee, economyFee } = fees;
  if (feeRate >= fastestFee)  return { t: '~10 min',   d: 'Next block',   c: 'var(--green)' };
  if (feeRate >= halfHourFee) return { t: '~30 min',   d: '1–3 blocks',   c: 'var(--green)' };
  if (feeRate >= hourFee)     return { t: '~1 hour',   d: '3–6 blocks',   c: 'var(--yellow)' };
  if (feeRate >= economyFee)  return { t: '2–4 hours', d: 'Low priority', c: 'var(--yellow)' };
  return                             { t: '> 4 hours', d: 'Very low fee', c: 'var(--red)' };
}

function fmtSats(n) {
  if (!n && n !== 0) return '—';
  if (n >= 1e8) return (n / 1e8).toFixed(4) + ' BTC';
  return Number(n).toLocaleString() + ' sats';
}

function trunc(s, n = 10) {
  return s ? s.slice(0, n) + '…' + s.slice(-6) : '—';
}

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

// ─────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────
export default function Home() {
  const [addr,    setAddr]    = useState('');
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState(null);
  const [stats,   setStats]   = useState(null);

  // Carica stats Bitcoin ogni 30s
  const loadStats = useCallback(async () => {
    try {
      const r = await fetch('/api/fees');
      if (r.ok) setStats(await r.json());
    } catch(e) {}
  }, []);

  useEffect(() => {
    loadStats();
    const t = setInterval(loadStats, 30000);
    return () => clearInterval(t);
  }, [loadStats]);

  // ── CHECK ──
  async function check() {
    const a = addr.trim();
    if (!a) return;
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      // 1. Detect chain localmente
      let chain = detectChainLocal(a);

      // 2. EVM → chiama 3xpl per trovare la chain esatta
      if (chain === 'evm') {
        const d = await fetch(`/api/detect?address=${encodeURIComponent(a)}`).then(r => r.json());
        chain = d?.data?.blockchains?.[0] || 'ethereum';
      }

      // 3. Non rilevato → chiama 3xpl detect
      if (!chain) {
        const d = await fetch(`/api/detect?address=${encodeURIComponent(a)}`).then(r => r.json());
        chain = d?.data?.blockchains?.[0] || null;
        if (!chain) throw new Error('Could not detect blockchain for this address');
      }

      // 4. Fetch dati indirizzo
      const addrRes = await fetch(`/api/address?address=${encodeURIComponent(a)}&blockchain=${chain}`);
      const addrData = await addrRes.json();
      if (addrData.error) throw new Error(addrData.error);

      // 5. Bitcoin → fetch anche confirmed txs
      let btcConfirmed = [];
      if (chain === 'bitcoin') {
        const btcRes = await fetch(`/api/btcaddress?address=${encodeURIComponent(a)}`);
        if (btcRes.ok) {
          const btcData = await btcRes.json();
          btcConfirmed = btcData.chainTxs || [];
        }
      }

      setResult({
        chain,
        addrData,
        fees:         stats?.fees || null,
        btcConfirmed,
      });

    } catch(e) {
      setError(e.message || 'Something went wrong');
    }

    setLoading(false);
  }

  const chainInfo = result
    ? (CHAINS[result.chain] || { name: result.chain, symbol: '?', color: 'var(--accent)' })
    : null;

  return (
    <>
      <Head>
        <title>ETA21 — When does your crypto arrive?</title>
        <meta name="description" content="Live crypto transaction tracker. Paste any wallet address across 48 blockchains and get a real-time estimated arrival time." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <style global jsx>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --bg: #0a0a0a; --bg1: #111111; --bg2: #161616; --bg3: #1c1c1c;
          --line: #242424; --line2: #2e2e2e;
          --accent: #7c6cfa; --accent2: #a78bfa;
          --green: #4ade80; --red: #f87171; --yellow: #fbbf24;
          --t1: #f0f0f0; --t2: #999999; --t3: #555555;
          --mono: 'JetBrains Mono', monospace;
          --sans: 'Inter', sans-serif;
          --r: 8px;
        }
        html { scroll-behavior: smooth; }
        body {
          background: var(--bg); color: var(--t1);
          font-family: var(--sans); font-size: 15px;
          line-height: 1.6; min-height: 100vh;
          -webkit-font-smoothing: antialiased;
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: var(--line2); border-radius: 2px; }
        a { color: var(--accent); text-decoration: none; }
        a:hover { text-decoration: underline; }
      `}</style>

      {/* ── HEADER ── */}
      <header style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        height:60, padding:'0 32px',
        borderBottom:'1px solid var(--line)',
        position:'sticky', top:0,
        background:'rgba(10,10,10,.96)',
        backdropFilter:'blur(20px)',
        zIndex:99,
      }}>
        <div style={{fontFamily:'var(--mono)',fontSize:17,fontWeight:500,letterSpacing:'-.5px'}}>
          eta<b style={{color:'var(--accent)'}}>21</b>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:6,border:'1px solid var(--line2)',borderRadius:5,padding:'6px 13px',fontFamily:'var(--mono)',fontSize:12,color:'var(--t2)'}}>
          <span style={{width:6,height:6,borderRadius:'50%',background:'var(--green)',boxShadow:'0 0 6px var(--green)',display:'inline-block',animation:'blink 2s ease-in-out infinite'}} />
          multichain · live
        </div>
        <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
      </header>

      {/* ── MAIN ── */}
      <main style={{maxWidth:780,margin:'0 auto',padding:'72px 32px 96px'}}>

        {/* HERO */}
        <div style={{marginBottom:52}}>
          <div style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--accent)',letterSpacing:'1.5px',textTransform:'uppercase',marginBottom:22}}>
            Transaction tracker
          </div>
          <h1 style={{fontSize:'clamp(30px,4.5vw,48px)',fontWeight:600,lineHeight:1.1,letterSpacing:-2,marginBottom:16}}>
            When does your<br />
            <span style={{color:'var(--t3)'}}>crypto arrive?</span>
          </h1>
          <p style={{fontSize:15,color:'var(--t2)',maxWidth:460,lineHeight:1.75,marginBottom:40}}>
            Paste any wallet address — Bitcoin, Ethereum, Solana and 45+ more chains. Get a live estimated arrival time based on real network congestion.
          </p>

          {/* SEARCH */}
          <div style={{display:'flex',border:'1px solid var(--line2)',borderRadius:'var(--r)',overflow:'hidden',background:'var(--bg1)',transition:'border-color .15s',outline:'none'}}
            onFocus={e=>e.currentTarget.style.borderColor='var(--accent)'}
            onBlur={e=>e.currentTarget.style.borderColor='var(--line2)'}
          >
            <input
              value={addr}
              onChange={e => setAddr(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && check()}
              placeholder="bc1q… or 0x… or any wallet address"
              autoComplete="off"
              spellCheck="false"
              style={{
                flex:1, background:'none', border:'none', outline:'none',
                color:'var(--t1)', fontFamily:'var(--mono)', fontSize:14,
                padding:'16px 20px', minWidth:0,
              }}
            />
            <button
              onClick={check}
              disabled={loading}
              style={{
                background: loading ? 'var(--bg3)' : 'var(--accent)',
                color: loading ? 'var(--t3)' : '#fff',
                border:'none', padding:'0 26px',
                fontFamily:'var(--sans)', fontSize:14, fontWeight:500,
                cursor: loading ? 'not-allowed' : 'pointer',
                whiteSpace:'nowrap', transition:'background .15s',
              }}
            >
              {loading ? 'Checking…' : 'Check ETA →'}
            </button>
          </div>
          <div style={{marginTop:10,fontFamily:'var(--mono)',fontSize:12,color:'var(--t3)'}}>
            Bitcoin · Ethereum · Solana · XRP · Tron · Dogecoin · Cardano · +40 more
          </div>
        </div>

        {/* STATS ROW */}
        <StatsRow stats={stats} />

        {/* RESULT */}
        <div style={{marginBottom:72}}>
          {loading && <Spinner addr={addr} />}
          {error   && <MsgBox icon="⚠" title={error} sub="Check the address format and try again." isError />}
          {result && !loading && (
            <ResultCard
              result={result}
              chainInfo={chainInfo}
              stats={stats}
            />
          )}
        </div>

        {/* FEATURES */}
        <div style={{fontSize:12,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'1.5px',marginBottom:18}}>
          Why eta21
        </div>
        <Features />

      </main>

      {/* FOOTER */}
      <footer style={{borderTop:'1px solid var(--line)',padding:'22px 32px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
        <div style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--t3)'}}>
          eta21 · data by <a href="https://mempool.space" target="_blank">mempool.space</a> &amp; <a href="https://3xpl.com" target="_blank">3xpl</a>
        </div>
        <div style={{fontSize:12,color:'var(--t3)'}}>For informational purposes only</div>
      </footer>
    </>
  );
}

// ─────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────

function StatsRow({ stats }) {
  const f = stats?.fees?.fastestFee;
  const feeColor = !f ? 'var(--t1)' : f<=5 ? 'var(--green)' : f<=30 ? 'var(--yellow)' : 'var(--red)';
  const cells = [
    { label: 'Fastest fee', value: f ? f+' sat/vB' : '—', color: feeColor },
    { label: '30 min fee',  value: stats?.fees ? stats.fees.halfHourFee+' sat/vB' : '—' },
    { label: '1 hour fee',  value: stats?.fees ? stats.fees.hourFee+' sat/vB' : '—' },
    { label: 'Mempool txs', value: stats?.mempool ? Number(stats.mempool.count).toLocaleString() : '—' },
    { label: 'BTC / USD',   value: stats?.price ? '$'+Number(stats.price.USD).toLocaleString() : '—' },
  ];
  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',border:'1px solid var(--line)',borderRadius:'var(--r)',overflow:'hidden',marginBottom:52}}>
      {cells.map((c,i) => (
        <div key={i} style={{padding:'18px 20px',borderRight: i<4 ? '1px solid var(--line)' : 'none'}}>
          <div style={{fontSize:12,color:'var(--t3)',marginBottom:6}}>{c.label}</div>
          <div style={{fontFamily:'var(--mono)',fontSize:14,fontWeight:500,color: c.color || 'var(--t1)'}}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

function Spinner({ addr }) {
  return (
    <div style={{padding:'56px 32px',textAlign:'center',color:'var(--t3)',fontSize:14}}>
      <div style={{width:28,height:28,borderRadius:'50%',border:'2px solid var(--line2)',borderTopColor:'var(--accent)',animation:'spin .7s linear infinite',margin:'0 auto 16px'}} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      Scanning {addr.slice(0,10)}… across 48 blockchains
    </div>
  );
}

function MsgBox({ icon, title, sub, isError }) {
  return (
    <div style={{border:'1px solid var(--line)',borderRadius:'var(--r)',padding:'56px 32px',textAlign:'center'}}>
      <div style={{fontSize:32,marginBottom:14}}>{icon}</div>
      <div style={{fontSize:16,fontWeight:500,marginBottom:8,color: isError ? 'var(--red)' : 'var(--t1)'}}>{title}</div>
      {sub && <div style={{fontSize:13,color:'var(--t3)'}}>{sub}</div>}
    </div>
  );
}

function ChainBadge({ chain, chainInfo }) {
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:6,border:'1px solid var(--line2)',borderRadius:4,padding:'4px 10px',fontFamily:'var(--mono)',fontSize:11,color:'var(--t2)'}}>
      <span style={{width:6,height:6,borderRadius:'50%',background: chainInfo?.color || 'var(--accent)',display:'inline-block'}} />
      {chainInfo?.name || chain}
    </span>
  );
}

function ResultCard({ result, chainInfo, stats }) {
  const { chain, addrData, fees, btcConfirmed } = result;
  const mempool  = addrData?.mempool || [];
  const isBTC    = chain === 'bitcoin';
  const pending  = mempool.length > 0;

  // ETA per Bitcoin
  let etaInfo = null;
  if (isBTC && pending) {
    const tx = mempool[0];
    const fr = tx.weight > 0 ? tx.fee / (tx.weight / 4) : 0;
    etaInfo  = { fr, eta: calcETA(fr, fees || stats?.fees), tx };
  }

  const dotColor = pending ? 'var(--yellow)' : 'var(--green)';
  const dotGlow  = pending ? '0 0 7px var(--yellow)' : '0 0 7px var(--green)';

  return (
    <div style={{border:'1px solid var(--line)',borderRadius:'var(--r)',overflow:'hidden',animation:'up .2s ease'}}>
      <style>{`@keyframes up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* CARD HEADER */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'22px 26px',borderBottom:'1px solid var(--line)',gap:16,flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span style={{width:9,height:9,borderRadius:'50%',background:dotColor,boxShadow:dotGlow,flexShrink:0,display:'inline-block'}} />
          <div>
            <div style={{fontSize:15,fontWeight:500}}>
              {pending
                ? `${mempool.length} pending transaction${mempool.length>1?'s':''}`
                : 'No pending transactions'}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8,marginTop:4}}>
              <ChainBadge chain={chain} chainInfo={chainInfo} />
            </div>
          </div>
        </div>

        {/* ETA */}
        {isBTC && etaInfo ? (
          <div style={{textAlign:'right'}}>
            <div style={{fontFamily:'var(--mono)',fontSize:22,fontWeight:500,letterSpacing:'-.5px',color:etaInfo.eta.c}}>{etaInfo.eta.t}</div>
            <div style={{fontSize:11,color:'var(--t3)',textTransform:'uppercase',letterSpacing:1,marginTop:3}}>estimated arrival</div>
          </div>
        ) : pending ? (
          <div style={{textAlign:'right'}}>
            <div style={{fontFamily:'var(--mono)',fontSize:22,fontWeight:500,color:'var(--yellow)'}}>Pending</div>
            <div style={{fontSize:11,color:'var(--t3)',textTransform:'uppercase',letterSpacing:1,marginTop:3}}>in mempool</div>
          </div>
        ) : (
          <div style={{textAlign:'right'}}>
            <div style={{fontFamily:'var(--mono)',fontSize:16,fontWeight:500,color:'var(--green)'}}>All confirmed ✓</div>
            <div style={{fontSize:11,color:'var(--t3)',textTransform:'uppercase',letterSpacing:1,marginTop:3}}>no pending</div>
          </div>
        )}
      </div>

      {/* GRID DETTAGLI — Bitcoin pending */}
      {isBTC && etaInfo && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',borderBottom:'1px solid var(--line)'}}>
          {[
            { l:'Fee rate',  v:`${etaInfo.fr.toFixed(1)} sat/vB` },
            { l:'Priority',  v:etaInfo.eta.d, c:etaInfo.eta.c },
            { l:'Fee',       v:fmtSats(etaInfo.tx.fee) },
            { l:'Size',      v:`${etaInfo.tx.size||'—'} bytes` },
          ].map((cell,i) => (
            <div key={i} style={{padding:'18px 26px',borderRight: i<3 ? '1px solid var(--line)' : 'none'}}>
              <div style={{fontSize:11,color:'var(--t3)',textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>{cell.l}</div>
              <div style={{fontFamily:'var(--mono)',fontSize:14,fontWeight:500,color:cell.c||'var(--t1)'}}>{cell.v}</div>
            </div>
          ))}
        </div>
      )}

      {/* TX PENDING LIST */}
      {pending && (
        <>
          <div style={{padding:'14px 26px 10px',fontSize:11,color:'var(--t3)',textTransform:'uppercase',letterSpacing:1,borderBottom:'1px solid var(--line)'}}>
            Pending transactions
          </div>
          {mempool.slice(0, 6).map((tx, i) => {
            const txid = tx.txid || tx.transaction_id || '';
            const explorerUrl = isBTC
              ? `https://mempool.space/tx/${txid}`
              : `https://3xpl.com/${chain}/transaction/${txid}`;
            const fr = isBTC && tx.weight > 0 ? (tx.fee/(tx.weight/4)).toFixed(1) : null;
            return (
              <TxRow
                key={i}
                icon="⏳" iconClass="pend"
                txid={txid} explorerUrl={explorerUrl}
                meta={fr ? `${fr} sat/vB · ${tx.size} bytes` : 'unconfirmed'}
                amount={isBTC ? fmtSats(tx.fee)+' fee' : 'pending'}
                status="unconfirmed"
                amtColor="var(--yellow)"
                isLast={i === Math.min(mempool.length,6)-1}
              />
            );
          })}
        </>
      )}

      {/* TX CONFIRMED LIST — solo Bitcoin */}
      {!pending && isBTC && btcConfirmed?.length > 0 && (
        <>
          <div style={{padding:'14px 26px 10px',fontSize:11,color:'var(--t3)',textTransform:'uppercase',letterSpacing:1,borderBottom:'1px solid var(--line)'}}>
            Recent transactions
          </div>
          {btcConfirmed.slice(0, 6).map((tx, i) => {
            const isIn = tx.vout?.some(v => v.scriptpubkey_address === addrData?.address?.address);
            const val  = tx.vout?.filter(v => v.scriptpubkey_address === addrData?.address?.address).reduce((s,v)=>s+(v.value||0),0) || 0;
            return (
              <TxRow
                key={i}
                icon={isIn ? '↓' : '↑'}
                iconClass={isIn ? 'in' : 'out'}
                txid={tx.txid}
                explorerUrl={`https://mempool.space/tx/${tx.txid}`}
                meta={`${fmtDate(tx.status?.block_time)} · block ${tx.status?.block_height||'—'}`}
                amount={(isIn?'+':'-') + fmtSats(val || tx.fee)}
                status="confirmed"
                amtColor={isIn ? 'var(--green)' : 'var(--accent)'}
                isLast={i === Math.min(btcConfirmed.length,6)-1}
              />
            );
          })}
        </>
      )}

      {/* ACCELERATE CTA — solo Bitcoin pending */}
      {isBTC && pending && (
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 26px',gap:16,flexWrap:'wrap',background:'var(--bg2)',borderTop:'1px solid var(--line)'}}>
          <div>
            <div style={{fontSize:14,fontWeight:500,marginBottom:3}}>Transaction taking too long?</div>
            <div style={{fontSize:12,color:'var(--t3)'}}>Accelerate via mining pools — priority confirmation</div>
          </div>
          <a
            href={`https://mempool.space/tx/${mempool[0]?.txid}#accelerate`}
            target="_blank" rel="noreferrer"
            style={{background:'var(--accent)',color:'#fff',borderRadius:6,padding:'10px 20px',fontSize:13,fontWeight:500,textDecoration:'none',whiteSpace:'nowrap'}}
          >
            Accelerate →
          </a>
        </div>
      )}

      {/* NO PENDING */}
      {!pending && (
        <div style={{padding:'20px 26px',color:'var(--t3)',fontSize:13,fontFamily:'var(--mono)',borderTop:'1px solid var(--line)'}}>
          No pending transactions on {chainInfo?.name || chain}.
          {!isBTC && ' Real-time mempool data available for Bitcoin only.'}
        </div>
      )}
    </div>
  );
}

function TxRow({ icon, iconClass, txid, explorerUrl, meta, amount, status, amtColor, isLast }) {
  const iconBg = {
    in:   'rgba(74,222,128,.1)',
    out:  'rgba(124,108,250,.1)',
    pend: 'rgba(251,191,36,.1)',
  };
  const iconFg = {
    in:   'var(--green)',
    out:  'var(--accent)',
    pend: 'var(--yellow)',
  };
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 26px',borderBottom: isLast ? 'none' : '1px solid var(--line)',gap:16}}>
      <div style={{display:'flex',alignItems:'center',gap:12,minWidth:0}}>
        <div style={{width:32,height:32,borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:600,flexShrink:0,background:iconBg[iconClass],color:iconFg[iconClass]}}>
          {icon}
        </div>
        <div>
          <div style={{fontFamily:'var(--mono)',fontSize:13,color:'var(--t2)'}}>
            <a href={explorerUrl} target="_blank" rel="noreferrer">
              {trunc(txid)}
            </a>
          </div>
          <div style={{fontSize:11,color:'var(--t3)',marginTop:3,fontFamily:'var(--mono)'}}>{meta}</div>
        </div>
      </div>
      <div style={{textAlign:'right',flexShrink:0}}>
        <div style={{fontFamily:'var(--mono)',fontSize:13,fontWeight:500,color:amtColor}}>{amount}</div>
        <div style={{fontSize:11,color:'var(--t3)',marginTop:3,fontFamily:'var(--mono)'}}>{status}</div>
      </div>
    </div>
  );
}

function Features() {
  const feats = [
    { icon:'⚡', name:'Live ETA',       desc:'Arrival time from real mempool congestion and fee rate. Updates every 30 seconds.' },
    { icon:'🌐', name:'48 blockchains', desc:'Bitcoin, Ethereum, Solana, XRP, Tron, Cardano and 42 more — one single input.' },
    { icon:'🚀', name:'Speed up',       desc:'Transaction stuck? Accelerate via mining pools for priority confirmation.' },
    { icon:'🔒', name:'Zero tracking',  desc:'No cookies, no analytics, no data stored. Your privacy is absolute.' },
  ];
  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',border:'1px solid var(--line)',borderRadius:'var(--r)',overflow:'hidden',marginBottom:72}}>
      {feats.map((f,i) => (
        <div key={i} style={{
          padding:'26px 28px',
          borderRight:  i%2===0 ? '1px solid var(--line)' : 'none',
          borderBottom: i<2     ? '1px solid var(--line)' : 'none',
        }}>
          <div style={{fontSize:20,marginBottom:12}}>{f.icon}</div>
          <div style={{fontSize:14,fontWeight:500,marginBottom:6}}>{f.name}</div>
          <div style={{fontSize:13,color:'var(--t3)',lineHeight:1.7}}>{f.desc}</div>
        </div>
      ))}
    </div>
  );
}
