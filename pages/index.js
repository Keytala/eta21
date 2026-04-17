import { useState, useEffect } from 'react';
import Head from 'next/head';

// ── CHAIN DETECTION (locale, senza API) ──
function detectChain(addr) {
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

// ── CHAIN METADATA ──
const CHAINS = {
  bitcoin:    { name: 'Bitcoin',  symbol: 'BTC', color: '#4ade80' },
  ethereum:   { name: 'Ethereum', symbol: 'ETH', color: '#7c6cfa' },
  bnb:        { name: 'BNB',      symbol: 'BNB', color: '#fbbf24' },
  polygon:    { name: 'Polygon',  symbol: 'MATIC',color:'#a78bfa' },
  solana:     { name: 'Solana',   symbol: 'SOL', color: '#a78bfa' },
  'xrp-ledger':{ name: 'XRP',    symbol: 'XRP', color: '#7c6cfa' },
  tron:       { name: 'Tron',     symbol: 'TRX', color: '#f87171' },
  dogecoin:   { name: 'Dogecoin', symbol: 'DOGE',color: '#fbbf24' },
  litecoin:   { name: 'Litecoin', symbol: 'LTC', color: '#4ade80' },
  cardano:    { name: 'Cardano',  symbol: 'ADA', color: '#7c6cfa' },
};

// ── ETA CALCULATOR (Bitcoin only) ──
function calcETA(feeRate, fees) {
  if (!fees) return { t: '—', d: 'Unknown', c: 'var(--t3)' };
  const { fastestFee, halfHourFee, hourFee, economyFee } = fees;
  if (feeRate >= fastestFee)  return { t: '~10 min',   d: 'Next block',   c: 'var(--green)' };
  if (feeRate >= halfHourFee) return { t: '~30 min',   d: '1–3 blocks',   c: 'var(--green)' };
  if (feeRate >= hourFee)     return { t: '~1 hour',   d: '3–6 blocks',   c: 'var(--yellow)' };
  if (feeRate >= economyFee)  return { t: '2–4 hours', d: 'Low priority', c: 'var(--yellow)' };
  return                             { t: '> 4 hours', d: 'Very low fee', c: 'var(--red)' };
}

function sats(n) {
  if (!n) return '0';
  if (n >= 1e8) return (n / 1e8).toFixed(4) + ' BTC';
  return Number(n).toLocaleString() + ' sats';
}

function trunc(s, n = 10) {
  return s ? s.slice(0, n) + '…' + s.slice(-6) : '—';
}

// ── COMPONENT ──
export default function Home() {
  const [addr,    setAddr]    = useState('');
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState(null);
  const [stats,   setStats]   = useState(null);

  // Load Bitcoin network stats
  useEffect(() => {
    async function load() {
      try {
        const r = await fetch('/api/fees');
        const d = await r.json();
        setStats(d);
      } catch(e) {}
    }
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  async function check() {
    if (!addr.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      // 1. Detect chain locally
      let chain = detectChain(addr.trim());

      // 2. If EVM, call 3xpl detect to find exact chain
      if (chain === 'evm') {
        const d = await fetch(`/api/detect?address=${addr.trim()}`).then(r => r.json());
        chain = d?.data?.blockchains?.[0] || 'ethereum';
      }

      // 3. If still null, call 3xpl detect
      if (!chain) {
        const d = await fetch(`/api/detect?address=${addr.trim()}`).then(r => r.json());
        chain = d?.data?.blockchains?.[0] || null;
      }

      if (!chain) throw new Error('Could not detect blockchain for this address');

      // 4. Fetch address data
      const addrData = await fetch(`/api/address?address=${addr.trim()}&blockchain=${chain}`).then(r => r.json());
      if (addrData.error) throw new Error(addrData.error);

      // 5. For Bitcoin, also get fees
      let fees = stats?.fees || null;
      if (chain === 'bitcoin' && !fees) {
        const f = await fetch('/api/fees').then(r => r.json());
        fees = f.fees;
      }

      setResult({ chain, addrData, fees });
    } catch(e) {
      setError(e.message);
    }

    setLoading(false);
  }

  const chainInfo = result ? (CHAINS[result.chain] || { name: result.chain, symbol: '?', color: 'var(--accent)' }) : null;

  return (
    <>
      <Head>
        <title>ETA21 — When does your crypto arrive?</title>
        <meta name="description" content="Live crypto transaction tracker. Paste any wallet address and get an estimated arrival time." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --bg: #0a0a0a; --bg1: #111; --bg2: #161616; --line: #242424; --line2: #2e2e2e;
          --accent: #7c6cfa; --accent2: #a78bfa;
          --green: #4ade80; --red: #f87171; --yellow: #fbbf24;
          --t1: #f0f0f0; --t2: #999; --t3: #555;
          --mono: 'JetBrains Mono', monospace; --sans: 'Inter', sans-serif; --r: 8px;
        }
        html { scroll-behavior: smooth; }
        body { background: var(--bg); color: var(--t1); font-family: var(--sans); font-size: 15px; line-height: 1.6; min-height: 100vh; -webkit-font-smoothing: antialiased; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: var(--line2); border-radius: 2px; }

        header { display: flex; align-items: center; justify-content: space-between; height: 60px; padding: 0 32px; border-bottom: 1px solid var(--line); position: sticky; top: 0; background: rgba(10,10,10,.96); backdrop-filter: blur(20px); z-index: 99; }
        .logo { font-family: var(--mono); font-size: 17px; font-weight: 500; letter-spacing: -.5px; }
        .logo b { color: var(--accent); }
        .pill { display: flex; align-items: center; gap: 6px; border: 1px solid var(--line2); border-radius: 5px; padding: 6px 13px; font-family: var(--mono); font-size: 12px; color: var(--t2); }
        .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--green); box-shadow: 0 0 6px var(--green); animation: blink 2s ease-in-out infinite; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }

        main { max-width: 780px; margin: 0 auto; padding: 72px 32px 96px; }

        .eyebrow { font-family: var(--mono); font-size: 12px; color: var(--accent); letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 22px; }
        h1 { font-size: clamp(30px,4.5vw,48px); font-weight: 600; line-height: 1.1; letter-spacing: -2px; margin-bottom: 16px; }
        h1 .dim { color: var(--t3); }
        .desc { font-size: 15px; color: var(--t2); max-width: 460px; line-height: 1.75; margin-bottom: 40px; }

        .search { display: flex; border: 1px solid var(--line2); border-radius: var(--r); overflow: hidden; background: var(--bg1); transition: border-color .15s; margin-bottom: 10px; }
        .search:focus-within { border-color: var(--accent); }
        .search input { flex: 1; background: none; border: none; outline: none; color: var(--t1); font-family: var(--mono); font-size: 14px; padding: 16px 20px; min-width: 0; }
        .search input::placeholder { color: var(--t3); }
        .search button { background: var(--accent); color: #fff; border: none; padding: 0 26px; font-family: var(--sans); font-size: 14px; font-weight: 500; cursor: pointer; transition: background .15s; white-space: nowrap; }
        .search button:hover { background: var(--accent2); }
        .search button:disabled { background: var(--bg2); color: var(--t3); cursor: not-allowed; }
        .search-meta { font-family: var(--mono); font-size: 12px; color: var(--t3); margin-bottom: 52px; }

        .stats { display: grid; grid-template-columns: repeat(5,1fr); border: 1px solid var(--line); border-radius: var(--r); overflow: hidden; margin-bottom: 52px; }
        .sc { padding: 18px 20px; border-right: 1px solid var(--line); }
        .sc:last-child { border-right: none; }
        .sl { font-size: 12px; color: var(--t3); margin-bottom: 6px; }
        .sv { font-family: var(--mono); font-size: 14px; font-weight: 500; }
        .sv.ok { color: var(--green); } .sv.warn { color: var(--yellow); } .sv.bad { color: var(--red); }

        .card { border: 1px solid var(--line); border-radius: var(--r); overflow: hidden; animation: up .2s ease; margin-bottom: 72px; }
        @keyframes up { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }

        .ch { display: flex; align-items: center; justify-content: space-between; padding: 22px 26px; border-bottom: 1px solid var(--line); gap: 16px; flex-wrap: wrap; }
        .ch-left { display: flex; align-items: center; gap: 12px; }
        .sdot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
        .cht { font-size: 15px; font-weight: 500; }
        .chs { font-size: 12px; color: var(--t3); font-family: var(--mono); margin-top: 2px; }
        .eta-box { text-align: right; }
        .eta-v { font-family: var(--mono); font-size: 22px; font-weight: 500; letter-spacing: -.5px; }
        .eta-l { font-size: 11px; color: var(--t3); text-transform: uppercase; letter-spacing: 1px; margin-top: 3px; }

        .cgrid { display: grid; grid-template-columns: repeat(4,1fr); border-bottom: 1px solid var(--line); }
        .gc { padding: 18px 26px; border-right: 1px solid var(--line); }
        .gc:last-child { border-right: none; }
        .gl { font-size: 11px; color: var(--t3); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
        .gv { font-family: var(--mono); font-size: 14px; font-weight: 500; }

        .tsec { padding: 14px 26px 10px; font-size: 11px; color: var(--t3); text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid var(--line); }
        .trow { display: flex; align-items: center; justify-content: space-between; padding: 16px 26px; border-bottom: 1px solid var(--line); gap: 16px; }
        .trow:last-child { border-bottom: none; }
        .tleft { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .tico { width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; flex-shrink: 0; }
        .tico.in  { background: rgba(74,222,128,.1); color: var(--green); }
        .tico.out { background: rgba(124,108,250,.1); color: var(--accent); }
        .tico.pend{ background: rgba(251,191,36,.1);  color: var(--yellow); }
        .tid { font-family: var(--mono); font-size: 13px; color: var(--t2); }
        .tid a { color: var(--accent); text-decoration: none; }
        .tid a:hover { text-decoration: underline; }
        .tmeta { font-size: 11px; color: var(--t3); margin-top: 3px; font-family: var(--mono); }
        .tright { text-align: right; flex-shrink: 0; }
        .tamt { font-family: var(--mono); font-size: 13px; font-weight: 500; }
        .tamt.in  { color: var(--green); } .tamt.out { color: var(--accent); } .tamt.pend { color: var(--yellow); }
        .tstat { font-size: 11px; color: var(--t3); margin-top: 3px; font-family: var(--mono); }

        .accel { display: flex; align-items: center; justify-content: space-between; padding: 18px 26px; gap: 16px; flex-wrap: wrap; background: var(--bg2); border-top: 1px solid var(--line); }
        .at { font-size: 14px; font-weight: 500; margin-bottom: 3px; }
        .as { font-size: 12px; color: var(--t3); }
        .btn-a { background: var(--accent); color: #fff; border: none; border-radius: 6px; padding: 10px 20px; font-size: 13px; font-weight: 500; cursor: pointer; text-decoration: none; display: inline-block; transition: background .15s; }
        .btn-a:hover { background: var(--accent2); }

        .chain-badge { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--line2); border-radius: 4px; padding: 4px 10px; font-family: var(--mono); font-size: 11px; color: var(--t2); }
        .chain-dot { width: 6px; height: 6px; border-radius: 50%; }

        .msg { border: 1px solid var(--line); border-radius: var(--r); padding: 56px 32px; text-align: center; margin-bottom: 72px; }
        .mi { font-size: 32px; margin-bottom: 14px; }
        .mt { font-size: 16px; font-weight: 500; margin-bottom: 8px; }
        .ms { font-size: 13px; color: var(--t3); }

        .spin-wrap { padding: 56px 32px; text-align: center; color: var(--t3); font-size: 14px; margin-bottom: 72px; }
        .spin { width: 28px; height: 28px; border-radius: 50%; border: 2px solid var(--line2); border-top-color: var(--accent); animation: spin .7s linear infinite; margin: 0 auto 16px; }
        @keyframes spin { to{transform:rotate(360deg)} }

        .feat-grid { display: grid; grid-template-columns: repeat(2,1fr); border: 1px solid var(--line); border-radius: var(--r); overflow: hidden; margin-bottom: 72px; }
        .feat { padding: 26px 28px; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); }
        .feat:nth-child(2n) { border-right: none; }
        .feat:nth-child(3), .feat:nth-child(4) { border-bottom: none; }
        .fi { font-size: 20px; margin-bottom: 12px; }
        .fn { font-size: 14px; font-weight: 500; margin-bottom: 6px; }
        .fd { font-size: 13px; color: var(--t3); line-height: 1.7; }

        .sec-title { font-size: 12px; color: var(--t3); text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 18px; }

        footer { border-top: 1px solid var(--line); padding: 22px 32px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
        .fl { font-family: var(--mono); font-size: 12px; color: var(--t3); }
        .fl a { color: var(--accent); text-decoration: none; }
        .fl a:hover { text-decoration: underline; }
        .fr { font-size: 12px; color: var(--t3); }

        @media(max-width:640px){
          main { padding: 48px 20px 72px; }
          header { padding: 0 20px; }
          .stats { grid-template-columns: repeat(3,1fr); }
          .sc:nth-child(4), .sc:nth-child(5) { display: none; }
          .cgrid { grid-template-columns: 1fr 1fr; }
          .ch { flex-direction: column; align-items: flex-start; }
          .feat-grid { grid-template-columns: 1fr; }
          .feat { border-right: none; }
          .feat:nth-child(3) { border-bottom: 1px solid var(--line); }
          footer { padding: 18px 20px; }
        }
      `}</style>

      {/* HEADER */}
      <header>
        <div className="logo">eta<b>21</b></div>
        <div style={{display:'flex',gap:10}}>
          <div className="pill">
            <span className="dot" />
            <span>multichain · live</span>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main>

        {/* HERO */}
        <div style={{marginBottom:52}}>
          <div className="eyebrow">Transaction tracker</div>
          <h1>When does your<br /><span className="dim">crypto arrive?</span></h1>
          <p className="desc">Paste any wallet address — Bitcoin, Ethereum, Solana and 45+ more chains. Get a live estimated arrival time based on real network congestion.</p>

          <div className="search">
            <input
              value={addr}
              onChange={e => setAddr(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && check()}
              placeholder="bc1q… or 0x… or any wallet address"
              autoComplete="off"
              spellCheck="false"
            />
            <button onClick={check} disabled={loading}>
              {loading ? 'Checking…' : 'Check ETA →'}
            </button>
          </div>
          <div className="search-meta">Bitcoin · Ethereum · Solana · XRP · Tron · Dogecoin · Cardano · +40 more</div>
        </div>

        {/* STATS ROW */}
        <div className="stats">
          <div className="sc">
            <div className="sl">Fastest fee</div>
            <div className={`sv ${stats?.fees ? (stats.fees.fastestFee<=5?'ok':stats.fees.fastestFee<=30?'warn':'bad') : ''}`}>
              {stats?.fees ? stats.fees.fastestFee+' sat/vB' : '—'}
            </div>
          </div>
          <div className="sc">
            <div className="sl">30 min fee</div>
            <div className="sv">{stats?.fees ? stats.fees.halfHourFee+' sat/vB' : '—'}</div>
          </div>
          <div className="sc">
            <div className="sl">1 hour fee</div>
            <div className="sv">{stats?.fees ? stats.fees.hourFee+' sat/vB' : '—'}</div>
          </div>
          <div className="sc">
            <div className="sl">Mempool txs</div>
            <div className="sv">{stats?.mempool ? Number(stats.mempool.count).toLocaleString() : '—'}</div>
          </div>
          <div className="sc">
            <div className="sl">BTC / USD</div>
            <div className="sv">{stats?.price ? '$'+Number(stats.price.USD).toLocaleString() : '—'}</div>
          </div>
        </div>

        {/* RESULT */}
        {loading && (
          <div className="spin-wrap">
            <div className="spin" />
            Scanning {addr.slice(0,8)}… across 48 blockchains
          </div>
        )}

        {error && (
          <div className="msg">
            <div className="mi">⚠</div>
            <div className="mt" style={{color:'var(--red)'}}>{error}</div>
            <div className="ms">Check the address format and try again.</div>
          </div>
        )}

        {result && !loading && <ResultCard result={result} chainInfo={chainInfo} />}

        {/* FEATURES */}
        <div className="sec-title">Why eta21</div>
        <div className="feat-grid">
          <div className="feat"><div className="fi">⚡</div><div className="fn">Live ETA</div><div className="fd">Arrival time from real mempool congestion and fee rate. Updates every 30 seconds.</div></div>
          <div className="feat"><div className="fi">🌐</div><div className="fn">48 blockchains</div><div className="fd">Bitcoin, Ethereum, Solana, XRP, Tron, Cardano and 42 more — one single input.</div></div>
          <div className="feat"><div className="fi">🚀</div><div className="fn">Speed up</div><div className="fd">Transaction stuck? Accelerate via mining pools for priority confirmation.</div></div>
          <div className="feat"><div className="fi">🔒</div><div className="fn">Zero tracking</div><div className="fd">No cookies, no analytics, no data stored. Your privacy is absolute.</div></div>
        </div>

      </main>

      {/* FOOTER */}
      <footer>
        <div className="fl">eta21 · data by <a href="https://mempool.space" target="_blank">mempool.space</a> &amp; <a href="https://3xpl.com" target="_blank">3xpl</a></div>
        <div className="fr">For informational purposes only</div>
      </footer>
    </>
  );
}

// ── RESULT CARD ──
function ResultCard({ result, chainInfo }) {
  const { chain, addrData, fees } = result;
  const mempool   = addrData?.mempool  || [];
  const address   = addrData?.address  || {};
  const blockchain = addrData?.blockchain || chain;

  const isBitcoin = chain === 'bitcoin';
  const hasPending = mempool.length > 0;

  // Bitcoin-specific ETA
  let etaData = null;
  if (isBitcoin && hasPending && fees) {
    const tx = mempool[0];
    const fr = tx.weight > 0 ? tx.fee / (tx.weight / 4) : 0;
    etaData = { fr, eta: calcETA(fr, fees), tx };
  }

  const dotColor = hasPending ? 'var(--yellow)' : 'var(--green)';

  return (
    <div className="card">
      {/* HEADER */}
      <div className="ch">
        <div className="ch-left">
          <span className="sdot" style={{background: dotColor, boxShadow:`0 0 7px ${dotColor}`}} />
          <div>
            <div className="cht">
              {hasPending ? `${mempool.length} pending transaction${mempool.length>1?'s':''}` : 'No pending transactions'}
            </div>
            <div className="chs" style={{display:'flex',alignItems:'center',gap:8,marginTop:4}}>
              <span className="chain-badge">
                <span className="chain-dot" style={{background: chainInfo?.color || 'var(--accent)'}} />
                {chainInfo?.name || chain}
              </span>
              {address.balance !== undefined && (
                <span>Balance: {address.balance}</span>
              )}
            </div>
          </div>
        </div>

        {/* ETA Box */}
        {isBitcoin && etaData ? (
          <div className="eta-box">
            <div className="eta-v" style={{color: etaData.eta.c}}>{etaData.eta.t}</div>
            <div className="eta-l">estimated arrival</div>
          </div>
        ) : hasPending ? (
          <div className="eta-box">
            <div className="eta-v" style={{color:'var(--yellow)'}}>Pending</div>
            <div className="eta-l">in mempool</div>
          </div>
        ) : (
          <div className="eta-box">
            <div className="eta-v" style={{color:'var(--green)',fontSize:16}}>Confirmed</div>
            <div className="eta-l">all transactions</div>
          </div>
        )}
      </div>

      {/* GRID — Bitcoin specific */}
      {isBitcoin && etaData && (
        <div className="cgrid">
          <div className="gc"><div className="gl">Fee rate</div><div className="gv">{etaData.fr.toFixed(1)} sat/vB</div></div>
          <div className="gc"><div className="gl">Priority</div><div className="gv" style={{color:etaData.eta.c}}>{etaData.eta.d}</div></div>
          <div className="gc"><div className="gl">Amount</div><div className="gv">{sats(etaData.tx.fee)}</div></div>
          <div className="gc"><div className="gl">Size</div><div className="gv">{etaData.tx.size||'—'} bytes</div></div>
        </div>
      )}

      {/* TX LIST */}
      {mempool.length > 0 && (
        <>
          <div className="tsec">Pending transactions</div>
          {mempool.slice(0, 6).map((tx, i) => {
            const explorerUrl = isBitcoin
              ? `https://mempool.space/tx/${tx.txid}`
              : `https://3xpl.com/${chain}/transaction/${tx.transaction_id || tx.txid}`;
            return (
              <div className="trow" key={i}>
                <div className="tleft">
                  <div className="tico pend">⏳</div>
                  <div>
                    <div className="tid">
                      <a href={explorerUrl} target="_blank" rel="noreferrer">
                        {trunc(tx.txid || tx.transaction_id)}
                      </a>
                    </div>
                    <div className="tmeta">
                      {isBitcoin && tx.weight > 0
                        ? `${(tx.fee/(tx.weight/4)).toFixed(1)} sat/vB · ${tx.size} bytes`
                        : 'unconfirmed'}
                    </div>
                  </div>
                </div>
                <div className="tright">
                  <div className="tamt pend">{isBitcoin ? sats(tx.fee)+' fee' : 'pending'}</div>
                  <div className="tstat">unconfirmed</div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* ACCELERATE CTA — Bitcoin only */}
      {isBitcoin && hasPending && (
        <div className="accel">
          <div>
            <div className="at">Transaction taking too long?</div>
            <div className="as">Accelerate via mining pools — priority confirmation</div>
          </div>
          <a className="btn-a"
            href={`https://mempool.space/tx/${mempool[0]?.txid}#accelerate`}
            target="_blank" rel="noreferrer">
            Accelerate →
          </a>
        </div>
      )}

      {/* NO PENDING */}
      {!hasPending && (
        <div style={{padding:'24px 26px',borderTop:'1px solid var(--line)',color:'var(--t3)',fontSize:13,fontFamily:'var(--mono)'}}>
          No pending transactions found for this address on {chainInfo?.name || chain}.
        </div>
      )}
    </div>
  );
}
