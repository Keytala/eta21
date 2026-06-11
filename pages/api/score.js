// pages/api/score.js
// Calcola il Risk Score da 0 a 100 per un indirizzo crypto
// Analizza: blacklist, exchange, balance, custodia, attività

// ── EXCHANGE ADDRESSES (Bitcoin — campione) ──
// Lista parziale di indirizzi noti di exchange
const EXCHANGE_ADDRESSES = new Set([
  // Binance
  '34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo',
  '3M219KR5vEneNb47ewrPfWyb5jQ2DjxRP6',
  'bc1qm34lsc65zpw79lxes69zkqmk6ee3ewf0j77s3h',
  // Coinbase
  '3Cbq7aT1tY8kMxWLbitaG7yT6bPbKChq64',
  '3QJmV3qfvL9SuYo34YihAf3sRCW3qSinyC',
  // Kraken
  '3AfP6N5bMQZJxFQFHaFBpGxGVhkRJDrPNT',
  // Robinhood
  'bc1ql49ydapnjafl5t2cp9zqpjwe6pdgmxy98859v2',
  // Bitfinex
  '3D2oetdNuZUqQHPJmcMDDHYoqkyNVsFk9r',
]);

// ── KNOWN RISKY / BLACKLISTED (campione statico) ──
// In produzione: usa https://github.com/vile/ofac-sdn-list
const BLACKLISTED = new Set([
  '12QtD5BFwRsdNsAZY76UVE1xyCGNTojH9h', // OFAC sanctioned
  '1LdRcdxfbSnmCYYNdeYpUnztiYzVfBEQeC', // OFAC sanctioned
  '1FeexV6bAHb8ybZjqQMjJrcCrHGW9sb6uF', // Mt. Gox hacker
  'bc1qazcm763858nkj2dj986etajv6wquslv8uxwczt', // FBI wallet
]);

// ── MIXER / PRIVACY SERVICES ──
const MIXER_ADDRESSES = new Set([
  'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', // Tornado Cash BTC bridge
]);

// ── HELPERS ──
function fmtSats(n) {
  if (!n && n !== 0) return '—';
  if (n >= 1e8) return (n / 1e8).toFixed(4) + ' BTC';
  return Number(n).toLocaleString() + ' sats';
}

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

function detectChain(addr) {
  if (/^(bc1|1|3)[a-zA-HJ-NP-Z0-9]{25,62}$/.test(addr)) return 'bitcoin';
  if (/^0x[a-fA-F0-9]{40}$/.test(addr))                  return 'ethereum';
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr))        return 'solana';
  if (/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(addr))       return 'xrp-ledger';
  if (/^T[a-zA-Z0-9]{33}$/.test(addr))                   return 'tron';
  if (/^D[5-9A-HJ-NP-Za-km-z]{33}$/.test(addr))          return 'dogecoin';
  return 'unknown';
}

// ── FETCH OFAC LIST (aggiornata settimanalmente da GitHub) ──
let ofacCache = null;
let ofacCacheTime = 0;

async function getOFACList() {
  const now = Date.now();
  // Cache in memoria per 1 ora
  if (ofacCache && (now - ofacCacheTime) < 3600000) return ofacCache;

  try {
    const r = await fetch(
      'https://raw.githubusercontent.com/vile/ofac-sdn-list/main/data/bitcoin.json',
      { signal: AbortSignal.timeout(5000) }
    );
    if (r.ok) {
      const data = await r.json();
      ofacCache = new Set(Array.isArray(data) ? data : []);
      ofacCacheTime = now;
      return ofacCache;
    }
  } catch(e) {
    console.warn('[ofac] fetch failed, using static list');
  }
  return BLACKLISTED;
}

// ── MAIN HANDLER ──
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { address } = req.query;
  if (!address) return res.status(400).json({ error: 'Missing address' });

  const addr  = address.trim();
  const chain = detectChain(addr);

  if (chain === 'unknown') {
    return res.status(400).json({ error: 'Unsupported or invalid address format' });
  }

  // Per ora supportiamo Bitcoin completamente, altre chain con dati parziali
  if (chain !== 'bitcoin') {
    return res.status(200).json({
      score: 0,
      breakdown: [],
      recommendations: [{
        icon: '🔧',
        title: 'Full analysis coming soon',
        desc: `Deep analysis for ${chain} is coming soon. Currently full scoring is available for Bitcoin addresses.`,
        priority: 'info',
      }],
      meta: { chain, txCount: '—', balance: '—', firstSeen: '—', lastActive: '—' },
      partial: true,
    });
  }

  try {
    // ── FETCH DATI PARALLELI ──
    const [infoRes, mempoolRes, txsRes, ofacList] = await Promise.all([
      fetch(`https://mempool.space/api/address/${addr}`),
      fetch(`https://mempool.space/api/address/${addr}/txs/mempool`),
      fetch(`https://mempool.space/api/address/${addr}/txs/chain`),
      getOFACList(),
    ]);

    if (!infoRes.ok) throw new Error('Address not found on Bitcoin network');

    const info      = await infoRes.json();
    const mempool   = mempoolRes.ok ? await mempoolRes.json() : [];
    const chainTxs  = txsRes.ok     ? await txsRes.json()    : [];
    const allTxs    = [...mempool, ...chainTxs];

    const stats = info.chain_stats || {};
    const balance = (stats.funded_txo_sum || 0) - (stats.spent_txo_sum || 0);
    const txCount = stats.tx_count || 0;

    // Stima valore in USD (approssimativo — usa prezzo live se disponibile)
    let btcPrice = 70000;
    try {
      const pr = await fetch('https://mempool.space/api/v1/prices', { signal: AbortSignal.timeout(3000) });
      if (pr.ok) { const p = await pr.json(); btcPrice = p.USD || 70000; }
    } catch(e) {}

    const balanceUSD = (balance / 1e8) * btcPrice;

    // ── RACCOLTA INDIRIZZI INTERAGITI ──
    const interactedAddresses = new Set();
    for (const tx of chainTxs.slice(0, 50)) {
      tx.vin?.forEach(v => {
        if (v.prevout?.scriptpubkey_address && v.prevout.scriptpubkey_address !== addr) {
          interactedAddresses.add(v.prevout.scriptpubkey_address);
        }
      });
      tx.vout?.forEach(v => {
        if (v.scriptpubkey_address && v.scriptpubkey_address !== addr) {
          interactedAddresses.add(v.scriptpubkey_address);
        }
      });
    }

    // ── CALCOLO SCORE ──
    let totalScore = 0;
    const breakdown = [];

    // ── 1. BLACKLIST CHECK (max 30 pts) ──
    const isBlacklisted = ofacList.has(addr) || BLACKLISTED.has(addr);
    const blacklistedContacts = [...interactedAddresses].filter(a => ofacList.has(a) || BLACKLISTED.has(a));
    const mixerContacts = [...interactedAddresses].filter(a => MIXER_ADDRESSES.has(a));

    let blacklistPts = 0;
    let blacklistDetail = 'No blacklisted address interactions detected';

    if (isBlacklisted) {
      blacklistPts = 30;
      blacklistDetail = '🚨 This address is on the OFAC sanctions list';
    } else if (blacklistedContacts.length > 0) {
      blacklistPts = 20;
      blacklistDetail = `Interacted with ${blacklistedContacts.length} sanctioned/blacklisted address${blacklistedContacts.length>1?'es':''}`;
    } else if (mixerContacts.length > 0) {
      blacklistPts = 10;
      blacklistDetail = `Interacted with ${mixerContacts.length} known mixing service${mixerContacts.length>1?'s':''}`;
    }

    totalScore += blacklistPts;
    breakdown.push({
      icon:   blacklistPts === 0 ? '✅' : '🚨',
      label:  'Blacklist & Sanctions',
      detail: blacklistDetail,
      points: blacklistPts,
      max:    30,
    });

    // ── 2. EXCHANGE EXPOSURE (max 25 pts) ──
    const exchangeContacts = [...interactedAddresses].filter(a => EXCHANGE_ADDRESSES.has(a));
    const isExchangeAddr   = EXCHANGE_ADDRESSES.has(addr);

    let exchangePts = 0;
    let exchangeDetail = 'No known exchange interactions detected';

    if (isExchangeAddr) {
      exchangePts = 25;
      exchangeDetail = 'This address belongs to a centralized exchange';
    } else if (exchangeContacts.length >= 3) {
      exchangePts = 20;
      exchangeDetail = `${exchangeContacts.length} interactions with known exchange addresses`;
    } else if (exchangeContacts.length > 0) {
      exchangePts = 12;
      exchangeDetail = `${exchangeContacts.length} interaction${exchangeContacts.length>1?'s':''} with known exchange address${exchangeContacts.length>1?'es':''}`;
    }

    totalScore += exchangePts;
    breakdown.push({
      icon:   exchangePts === 0 ? '✅' : exchangePts >= 20 ? '🏦' : '⚠️',
      label:  'Exchange Exposure',
      detail: exchangeDetail,
      points: exchangePts,
      max:    25,
    });

    // ── 3. ASSET EXPOSURE (max 15 pts) ──
    let assetPts = 0;
    let assetDetail = `Balance: ${fmtSats(balance)}`;

    if (balanceUSD >= 100000) {
      assetPts = 15;
      assetDetail = `High balance: ~$${Math.round(balanceUSD/1000)}k — significant exposure`;
    } else if (balanceUSD >= 10000) {
      assetPts = 10;
      assetDetail = `Moderate balance: ~$${Math.round(balanceUSD/1000)}k`;
    } else if (balanceUSD >= 1000) {
      assetPts = 5;
      assetDetail = `Balance: ~$${Math.round(balanceUSD)} — low exposure`;
    } else {
      assetDetail = `Balance: ${fmtSats(balance)} — minimal exposure`;
    }

    totalScore += assetPts;
    breakdown.push({
      icon:   assetPts === 0 ? '✅' : assetPts >= 10 ? '💰' : '⚠️',
      label:  'Asset Exposure',
      detail: assetDetail,
      points: assetPts,
      max:    15,
    });

    // ── 4. CUSTODY ANALYSIS (max 15 pts) ──
    // Heuristica: se l'indirizzo riusa sempre lo stesso tipo di script
    // e ha molte tx in entrata da exchange → probabilmente hot wallet
    const isSegwit   = addr.startsWith('bc1');
    const isLegacy   = addr.startsWith('1');
    const hasHighTxCount = txCount > 100;

    let custodyPts = 0;
    let custodyDetail = 'Self-custody patterns detected';

    if (isExchangeAddr) {
      custodyPts = 15;
      custodyDetail = 'Funds held on centralized exchange — not self-custodied';
    } else if (!isSegwit && isLegacy && hasHighTxCount) {
      custodyPts = 10;
      custodyDetail = 'Legacy address with high activity — consider upgrading to SegWit and hardware wallet';
    } else if (isLegacy) {
      custodyPts = 8;
      custodyDetail = 'Legacy P2PKH address — no hardware wallet signature patterns detected';
    } else if (!isSegwit) {
      custodyPts = 5;
      custodyDetail = 'No hardware wallet signature patterns detected';
    } else {
      custodyDetail = 'Native SegWit address — good practices detected';
    }

    totalScore += custodyPts;
    breakdown.push({
      icon:   custodyPts === 0 ? '✅' : custodyPts >= 10 ? '🔓' : '⚠️',
      label:  'Custody & Hardware Wallet',
      detail: custodyDetail,
      points: custodyPts,
      max:    15,
    });

    // ── 5. PUBLIC EXPOSURE (max 10 pts) ──
    const addressReuse = txCount > 50;
    let publicPts = 0;
    let publicDetail = 'No unusual public exposure detected';

    if (txCount > 200) {
      publicPts = 10;
      publicDetail = `Address used in ${txCount} transactions — highly traceable on-chain`;
    } else if (txCount > 50) {
      publicPts = 6;
      publicDetail = `Address reused in ${txCount} transactions — consider rotating addresses`;
    } else if (txCount > 10) {
      publicPts = 3;
      publicDetail = `${txCount} transactions — moderate address reuse`;
    }

    totalScore += publicPts;
    breakdown.push({
      icon:   publicPts === 0 ? '✅' : '🌐',
      label:  'Public Exposure & Address Reuse',
      detail: publicDetail,
      points: publicPts,
      max:    10,
    });

    // ── 6. RECENT ACTIVITY (max 5 pts) ──
    const lastTx = chainTxs[0];
    const lastTs = lastTx?.status?.block_time;
    const daysSinceLast = lastTs ? (Date.now()/1000 - lastTs) / 86400 : 999;

    let activityPts = 0;
    let activityDetail = 'No recent high-risk activity';

    if (daysSinceLast < 7 && balanceUSD > 5000) {
      activityPts = 5;
      activityDetail = 'Recent activity with significant balance — increased exposure window';
    } else if (daysSinceLast < 30 && balanceUSD > 1000) {
      activityPts = 3;
      activityDetail = 'Active in last 30 days with notable balance';
    }

    totalScore += activityPts;
    breakdown.push({
      icon:   activityPts === 0 ? '✅' : '📊',
      label:  'Recent Activity',
      detail: activityDetail,
      points: activityPts,
      max:    5,
    });

    // ── CAP A 100 ──
    totalScore = Math.min(100, Math.max(0, totalScore));

    // ── RECOMMENDATIONS ──
    const recommendations = [];

    if (custodyPts >= 8) {
      recommendations.push({
        icon:     '🔐',
        title:    'Get a Hardware Wallet',
        desc:     'A hardware wallet keeps your private keys offline and protected from hacks, malware and exchange failures. It\'s the single most effective security upgrade for any crypto holder.',
        cta:      'Shop Hardware Wallets',
        ctaUrl:   'https://www.ledger.com/?r=YOUR_AFFILIATE_ID',
        priority: 'HIGH',
      });
    }

    if (exchangePts >= 12) {
      recommendations.push({
        icon:     '🏦',
        title:    'Move funds off exchanges',
        desc:     'Centralized exchanges are a single point of failure. "Not your keys, not your coins." Withdraw to a self-custody wallet — ideally hardware-backed.',
        cta:      'Learn self-custody',
        ctaUrl:   'https://bitcoin.org/en/secure-your-wallet',
        priority: 'HIGH',
      });
    }

    if (publicPts >= 6) {
      recommendations.push({
        icon:     '🔄',
        title:    'Rotate your addresses',
        desc:     'Using a single address for all transactions makes your financial history fully traceable. Use a new address for each transaction — modern wallets do this automatically.',
        priority: 'MEDIUM',
      });
    }

    if (blacklistPts >= 10) {
      recommendations.push({
        icon:     '⚠️',
        title:    'Review your transaction history',
        desc:     'Your address has interacted with flagged addresses. Review your transaction history and consider consulting a compliance professional if needed.',
        priority: 'HIGH',
      });
    }

    if (assetPts >= 10) {
      recommendations.push({
        icon:     '🛡️',
        title:    'Consider a multi-signature setup',
        desc:     'For balances over $10,000, a multi-signature wallet adds an extra layer of security — funds can only move with approval from multiple keys.',
        priority: 'MEDIUM',
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        icon:     '✅',
        title:    'Good security posture',
        desc:     'Your wallet shows good privacy and security practices. Keep using a hardware wallet, rotate addresses regularly, and stay informed about new threats.',
        priority: 'INFO',
      });
    }

    // ── META ──
    const firstTx = chainTxs[chainTxs.length - 1];
    const meta = {
      chain:      'Bitcoin',
      balance:    fmtSats(balance),
      balanceUSD: balanceUSD > 0 ? `~$${Math.round(balanceUSD).toLocaleString()}` : '$0',
      txCount,
      firstSeen:  fmtDate(firstTx?.status?.block_time),
      lastActive: fmtDate(lastTs),
    };

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json({
      score:    totalScore,
      breakdown,
      recommendations,
      meta,
    });

  } catch(e) {
    console.error('[score]', e.message);
    return res.status(500).json({ error: e.message });
  }
}
