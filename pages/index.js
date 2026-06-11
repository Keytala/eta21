import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body {
    background: #0f0f0f;
    color: #f0f0f0;
    font-family: 'Inter', sans-serif;
    font-size: 15px;
    line-height: 1.6;
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
  }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-thumb { background: #333333; border-radius: 2px; }
  a { color: #7c6cfa; text-decoration: none; }
  a:hover { text-decoration: underline; }
  @keyframes blink   { 0%,100%{ opacity:1; } 50%{ opacity:.3; } }
  @keyframes fadeUp  { from{ opacity:0; transform:translateY(12px); } to{ opacity:1; transform:translateY(0); } }
  @keyframes spin    { to{ transform:rotate(360deg); } }
`;

export default function Home() {
  const [addr,    setAddr]    = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function check() {
    const a = addr.trim();
    if (!a) return;
    setLoading(true);
    router.push(`/result/${encodeURIComponent(a)}`);
  }

  return (
    <>
      <Head>
        <title>CryptoScore — Is your crypto wallet safe?</title>
        <meta name="description" content="Check your crypto wallet address for privacy and security risks. Get a score from 0 to 100 and personalized recommendations." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </Head>

      {/* HEADER */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 56, padding: '0 32px',
        borderBottom: '1px solid #2a2a2a',
        position: 'sticky', top: 0,
        background: 'rgba(15,15,15,.96)',
        backdropFilter: 'blur(20px)',
        zIndex: 99,
      }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 500, letterSpacing: '-.5px', color: '#f0f0f0' }}>
          crypto<b style={{ color: '#7c6cfa' }}>score</b>
        </div>
        <div style={{ display: 'flex', gap: 24, fontSize: 13 }}>
          <a href="/about" style={{ color: '#888888' }}>About</a>
          <a href="/api-docs" style={{ color: '#888888' }}>API</a>
        </div>
      </header>

      {/* HERO */}
      <main style={{ maxWidth: 680, margin: '0 auto', padding: '80px 24px 60px', textAlign: 'center' }}>

        {/* BADGE */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          border: '1px solid #2a2a2a', borderRadius: 4,
          padding: '5px 12px',
          fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#888888',
          marginBottom: 32,
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%',
            background: '#4ade80', boxShadow: '0 0 5px #4ade80',
            display: 'inline-block', animation: 'blink 2s ease-in-out infinite',
          }} />
          Bitcoin · Ethereum · Solana · +45 chains
        </div>

        {/* TITLE */}
        <h1 style={{
          fontSize: 'clamp(28px,5vw,52px)', fontWeight: 600,
          lineHeight: 1.1, letterSpacing: -2,
          marginBottom: 20, color: '#f0f0f0',
        }}>
          Is your crypto<br />
          <span style={{ color: '#7c6cfa' }}>wallet safe?</span>
        </h1>

        <p style={{ fontSize: 16, color: '#888888', maxWidth: 460, margin: '0 auto 48px', lineHeight: 1.75 }}>
          Paste any public wallet address. We analyze transactions, exposure to risky addresses, exchange interactions and more — then give you a privacy &amp; security score.
        </p>

        {/* SEARCH */}
        <div style={{
          display: 'flex',
          border: '1px solid #333333', borderRadius: 8,
          overflow: 'hidden', background: '#161616',
          maxWidth: 560, margin: '0 auto 12px',
        }}>
          <input
            value={addr}
            onChange={e => setAddr(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && check()}
            placeholder="Paste any wallet address…"
            autoComplete="off"
            spellCheck="false"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: '#f0f0f0', fontFamily: 'JetBrains Mono, monospace',
              fontSize: 13, padding: '16px 20px', minWidth: 0,
            }}
          />
          <button
            onClick={check}
            disabled={loading || !addr.trim()}
            style={{
              background: addr.trim() ? '#7c6cfa' : '#1c1c1c',
              color:      addr.trim() ? '#ffffff' : '#444444',
              border: 'none', padding: '0 28px',
              fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500,
              cursor: addr.trim() ? 'pointer' : 'not-allowed',
              whiteSpace: 'nowrap', transition: 'background .15s',
            }}
          >
            {loading ? 'Loading…' : 'Check →'}
          </button>
        </div>

        <div style={{ fontSize: 12, color: '#444444', fontFamily: 'JetBrains Mono, monospace', marginBottom: 64 }}>
          Read-only · No sign-up · Your address is never stored
        </div>

        {/* STATS */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
          border: '1px solid #2a2a2a', borderRadius: 8,
          overflow: 'hidden', marginBottom: 80,
        }}>
          {[
            { n: '48+', l: 'Blockchains supported' },
            { n: '6',   l: 'Risk categories analyzed' },
            { n: '100', l: 'Point scoring system' },
          ].map((s, i) => (
            <div key={i} style={{
              padding: '24px 20px', background: '#161616',
              borderRight: i < 2 ? '1px solid #2a2a2a' : 'none',
              textAlign: 'center',
            }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 28, fontWeight: 500, color: '#7c6cfa', marginBottom: 6 }}>{s.n}</div>
              <div style={{ fontSize: 12, color: '#888888' }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* HOW IT WORKS */}
        <div style={{ textAlign: 'left', marginBottom: 80 }}>
          <div style={{ fontSize: 11, color: '#444444', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 20, textAlign: 'center' }}>
            How it works
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(2,1fr)',
            border: '1px solid #2a2a2a', borderRadius: 8, overflow: 'hidden',
          }}>
            {[
              { icon: '🔍', t: 'Blacklist check',   d: 'We cross-reference your address against OFAC sanctions, known scam databases and hacked wallets.' },
              { icon: '🏦', t: 'Exchange exposure',  d: 'We detect interactions with centralized exchanges that may have linked your identity to your wallet.' },
              { icon: '💰', t: 'Asset exposure',     d: 'Higher balances mean higher risk — we factor in your on-chain holdings to assess your exposure.' },
              { icon: '🔐', t: 'Custody analysis',   d: 'We check if your wallet shows signs of hardware wallet usage or if funds are at risk on hot wallets.' },
              { icon: '🌐', t: 'Public exposure',    d: 'We check if your address appears in public datasets, paste sites or is linked to a public identity.' },
              { icon: '📊', t: 'Activity patterns',  d: 'Recent high-value activity increases risk — we analyze timing and frequency of transactions.' },
            ].map((f, i) => (
              <div key={i} style={{
                padding: '22px 24px', background: '#161616',
                borderRight:  i % 2 === 0 ? '1px solid #2a2a2a' : 'none',
                borderBottom: i < 4       ? '1px solid #2a2a2a' : 'none',
              }}>
                <div style={{ fontSize: 18, marginBottom: 10 }}>{f.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 5, color: '#f0f0f0' }}>{f.t}</div>
                <div style={{ fontSize: 12, color: '#888888', lineHeight: 1.6 }}>{f.d}</div>
              </div>
            ))}
          </div>
        </div>

        {/* EXAMPLE SCORES */}
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 11, color: '#444444', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 20, textAlign: 'center' }}>
            Score examples
          </div>
          <div style={{ border: '1px solid #2a2a2a', borderRadius: 8, overflow: 'hidden' }}>
            {[
              { score: 12, label: 'Low Risk',      color: '#4ade80', desc: 'Self-custody, no exchange interactions, hardware wallet detected' },
              { score: 45, label: 'Medium Risk',   color: '#fbbf24', desc: 'Some exchange interactions, moderate balance, no hardware wallet' },
              { score: 78, label: 'High Risk',     color: '#fb923c', desc: 'Multiple exchange interactions, high balance, hot wallet only' },
              { score: 94, label: 'Critical Risk', color: '#f87171', desc: 'Blacklisted contact, large balance, no privacy measures detected' },
            ].map((e, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '16px 20px',
                borderBottom: i < 3 ? '1px solid #2a2a2a' : 'none',
                background: '#161616',
              }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 20, fontWeight: 600, color: e.color, minWidth: 40, textAlign: 'right' }}>
                  {e.score}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: e.color, marginBottom: 2 }}>{e.label}</div>
                  <div style={{ fontSize: 12, color: '#888888' }}>{e.desc}</div>
                </div>
                <ScoreBar score={e.score} color={e.color} />
              </div>
            ))}
          </div>
        </div>

      </main>

      {/* FOOTER */}
      <footer style={{
        borderTop: '1px solid #2a2a2a', padding: '20px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 10,
      }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#444444' }}>
          cryptoscore · data by{' '}
          <a href="https://mempool.space" target="_blank" rel="noreferrer">mempool.space</a>
          {' '}&amp;{' '}
          <a href="https://3xpl.com" target="_blank" rel="noreferrer">3xpl</a>
        </div>
        <div style={{ fontSize: 11, color: '#444444' }}>For informational purposes only · Not financial advice</div>
      </footer>
    </>
  );
}

// ─────────────────────────────────────────
// SCORE BAR
// ─────────────────────────────────────────
function ScoreBar({ score, color }) {
  return (
    <div style={{ width: 80, height: 4, background: '#2a2a2a', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 2, transition: 'width .3s' }} />
    </div>
  );
}
