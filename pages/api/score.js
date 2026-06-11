// pages/api/score.js
// Risk Score 0-100 per Bitcoin + Ethereum
// v2 — fix BigInt, fix txCount, fix Etherscan fallback, aggiunto debug

// ─────────────────────────────────────────
// EXCHANGE ADDRESSES
// ─────────────────────────────────────────
const BTC_EXCHANGE = new Set([
  '34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo',
  '3M219KR5vEneNb47ewrPfWyb5jQ2DjxRP6',
  'bc1qm34lsc65zpw79lxes69zkqmk6ee3ewf0j77s3h',
  '3Cbq7aT1tY8kMxWLbitaG7yT6bPbKChq64',
  '3QJmV3qfvL9SuYo34YihAf3sRCW3qSinyC',
  '3AfP6N5bMQZJxFQFHaFBpGxGVhkRJDrPNT',
  'bc1ql49ydapnjafl5t2cp9zqpjwe6pdgmxy98859v2',
  '3D2oetdNuZUqQHPJmcMDDHYoqkyNVsFk9r',
]);

const ETH_EXCHANGE = new Set([
  '0x28c6c06298d514db089934071355e5743bf21d60', // Binance 1
  '0x21a31ee1afc51d94c2efccaa2092ad1028285549', // Binance 2
  '0xdfd5293d8e347dfe59e90efd55b2956a1343963d', // Binance 3
  '0x71660c4005ba85c37ccec55d0c4493e66fe775d3', // Coinbase 1
  '0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43', // Coinbase 2
  '0x2910543af39aba0cd09dbb2d50200b3e800a63d2', // Kraken 1
  '0x0a869d79a7052c7f1b55a8ebabbea3420f0d1e13', // Kraken 2
  '0x6cc5f688a315f3dc28a7781717a9a798a59fda7b', // OKX
  '0xf89d7b9c864f589bbf53a82105107622b35eaa40', // Bybit
  '0x1151314c646ce4e0efd76d1af4760ae66a9fe30f', // Bitfinex
  '0xd24400ae8bfebb18ca49be86258a3c749cf46853', // Gemini
]);

// ─────────────────────────────────────────
// BLACKLIST STATICA
// ─────────────────────────────────────────
const BTC_BLACKLIST = new Set([
  '12qtd5bfwrsdnsazy76uve1xycgntojih9h',
  '1ldRcdxfbsnmcyyn3deypunztiyzVfbeqec',
  '1feexv6baHb8ybzjqqmjjrccrhgw9sb6uf',
  'bc1qazcm763858nkj2dj986etajv6wquslv8uxwczt',
]);

const ETH_BLACKLIST = new Set([
  '0x7f367cc41522ce07553e823bf3be79a889debe1b',
  '0xd882cfc20f52f2599d84b8e8d58c7fb62cfe344b',
  '0x901bb9583b24d97e995513c6778dc6888ab6870e',
  '0xa7e5d5a720f06526557c513402f2e6b5fa20b008',
  '0x8576acc5c05d6ce88f4e49bf65bdf0c62f91353c',
  '0x722122df12d4e14e13ac3b6895a86e84145b6967', // Tornado Cash
  '0xdd4c48c0b24039969fc16d1cdf626eab821d3384',
  '0xd90e2f925da726b50c4ed8d0fb90ad053324f31b',
  '0x098b716b8aaf21512996dc57eb0615e2383e2f96', // Lazarus
  '0xa0e1c89ef1a489c9c7de96311ed5ce5d32c20e4b',
  '0x59abf3837fa962d6853b4cc0a19513aa031fd32b', // FTX hacker
]);

const ETH_MIXERS = new Set([
  '0x722122df12d4e14e13ac3b6895a86e84145b6967',
  '0x47ce0c6ed5b0ce3d3a51fdb1c52dc66a7c3c2936',
  '0xdd4c48c0b24039969fc16d1cdf626eab821d3384',
]);

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
function fmtBTC(n) {
  if (!n && n !== 0) return '—';
  if (n >= 1e8) return (n / 1e8).toFixed(4) + ' BTC';
  return Number(n).toLocaleString() + ' sats';
}

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(Number(ts) * 1000).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
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

// Safe fetch con timeout e fallback
async function safeFetch(url, fallback = null, timeout = 8000) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(timeout) });
    if (!r.ok) {
      console.warn(`[fetch] ${r.status} for ${url.slice(0, 80)}`);
      return fallback;
    }
    return await r.json();
  } catch(e) {
    console.warn(`[fetch] error for ${url.slice(0, 80)}: ${e.message}`);
    return fallback;
  }
}

// ─────────────────────────────────────────
// OFAC LISTS — cache 1h
// ─────────────────────────────────────────
const ofacCache = { btc: null, eth: null, ts: { btc: 0, eth: 0 } };

async function getOFAC(chain) {
  const now = Date.now();
  const key = chain === 'bitcoin' ? 'btc' : 'eth';
  if (ofacCache[key] && (now - ofacCache.ts[key]) < 3600000) return ofacCache[key];

  const url = chain === 'bitcoin'
    ? 'https://raw.githubusercontent.com/vile/ofac-sdn-list/main/data/bitcoin.json'
    : 'https://raw.githubusercontent.com/vile/ofac-sdn-list/main/data/ethereum.json';

  const data = await safeFetch(url, [], 5000);
  const set  = new Set(Array.isArray(data) ? data.map(a => a.toLowerCase()) : []);
  ofacCache[key]    = set;
  ofacCache.ts[key] = now;
  return set;
}

// ─────────────────────────────────────────
// SCORE ENGINE — BITCOIN
// ─────────────────────────────────────────
async function scoreBitcoin(addr) {
  console.log('[bitcoin] scoring', addr.slice(0, 12));

  const [info, mempool, chainTxs, ofac] = await Promise.all([
    safeFetch(`https://mempool.space/api/address/${addr}`, null),
    safeFetch(`https://mempool.space/api/address/${addr}/txs/mempool`, []),
    safeFetch(`https://mempool.space/api/address/${addr}/txs/chain`, []),
    getOFAC('bitcoin'),
  ]);

  if (!info) throw new Error('Bitcoin address not found or network error');

  const stats      = info.chain_stats || {};
  // ✅ FIX: usa Number() per evitare problemi con valori grandi
  const balance    = Number(stats.funded_txo_sum || 0) - Number(stats.spent_txo_sum || 0);
  const txCount    = Number(stats.tx_count || 0);

  // Prezzo BTC
  const priceData  = await safeFetch('https://mempool.space/api/v1/prices', { USD: 95000 }, 3000);
  const btcPrice   = Number(priceData?.USD || 95000);
  const balanceUSD = (balance / 1e8) * btcPrice;

  console.log('[bitcoin] balance:', balance, 'txCount:', txCount, 'USD:', Math.round(balanceUSD));

  // Indirizzi interagiti
  const interacted = new Set();
  for (const tx of (chainTxs || []).slice(0, 50)) {
    tx.vin?.forEach(v => {
      const a = v.prevout?.scriptpubkey_address;
      if (a && a !== addr) interacted.add(a);
    });
    tx.vout?.forEach(v => {
      const a = v.scriptpubkey_address;
      if (a && a !== addr) interacted.add(a);
    });
  }

  console.log('[bitcoin] interacted addresses:', interacted.size);

  let totalScore = 0;
  const breakdown = [];

  // 1. BLACKLIST (max 30)
  const addrLower           = addr.toLowerCase();
  const isBlacklisted       = ofac.has(addrLower) || BTC_BLACKLIST.has(addrLower);
  const blacklistedContacts = [...interacted].filter(a => ofac.has(a.toLowerCase()) || BTC_BLACKLIST.has(a.toLowerCase()));
  let bPts = 0, bDetail = 'No blacklisted address interactions detected';
  if (isBlacklisted)                       { bPts = 30; bDetail = '🚨 This address is on the OFAC sanctions list'; }
  else if (blacklistedContacts.length > 0) { bPts = 20; bDetail = `Interacted with ${blacklistedContacts.length} sanctioned address${blacklistedContacts.length>1?'es':''}`; }
  totalScore += bPts;
  breakdown.push({ icon: bPts===0?'✅':'🚨', label:'Blacklist & Sanctions', detail:bDetail, points:bPts, max:30 });

  // 2. EXCHANGE EXPOSURE (max 25)
  const exchContacts   = [...interacted].filter(a => BTC_EXCHANGE.has(a));
  const isExchangeAddr = BTC_EXCHANGE.has(addr);
  let ePts = 0, eDetail = 'No known exchange interactions detected';
  if (isExchangeAddr)                { ePts = 25; eDetail = 'This address belongs to a centralized exchange'; }
  else if (exchContacts.length >= 3) { ePts = 20; eDetail = `${exchContacts.length} interactions with known exchange addresses`; }
  else if (exchContacts.length > 0)  { ePts = 12; eDetail = `${exchContacts.length} interaction${exchContacts.length>1?'s':''} with known exchange address${exchContacts.length>1?'es':''}`; }
  totalScore += ePts;
  breakdown.push({ icon: ePts===0?'✅':ePts>=20?'🏦':'⚠️', label:'Exchange Exposure', detail:eDetail, points:ePts, max:25 });

  // 3. ASSET EXPOSURE (max 15)
  let aPts = 0, aDetail = `Balance: ${fmtBTC(balance)}`;
  if (balanceUSD >= 100000)     { aPts = 15; aDetail = `High balance: ~$${Math.round(balanceUSD/1000)}k — significant exposure`; }
  else if (balanceUSD >= 10000) { aPts = 10; aDetail = `Moderate balance: ~$${Math.round(balanceUSD/1000)}k`; }
  else if (balanceUSD >= 1000)  { aPts = 5;  aDetail = `Balance: ~$${Math.round(balanceUSD)} — low exposure`; }
  totalScore += aPts;
  breakdown.push({ icon: aPts===0?'✅':aPts>=10?'💰':'⚠️', label:'Asset Exposure', detail:aDetail, points:aPts, max:15 });

  // 4. CUSTODY (max 15)
  const isSegwit = addr.startsWith('bc1');
  const isLegacy = addr.startsWith('1');
  let cPts = 0, cDetail = 'Self-custody patterns detected';
  if (isExchangeAddr)               { cPts = 15; cDetail = 'Funds held on centralized exchange — not self-custodied'; }
  else if (isLegacy && txCount > 100) { cPts = 10; cDetail = 'Legacy address with high activity — consider hardware wallet'; }
  else if (isLegacy)                  { cPts = 8;  cDetail = 'Legacy P2PKH address — no hardware wallet patterns detected'; }
  else if (!isSegwit)                 { cPts = 5;  cDetail = 'No hardware wallet signature patterns detected'; }
  else                                { cDetail = 'Native SegWit — good practices detected'; }
  totalScore += cPts;
  breakdown.push({ icon: cPts===0?'✅':cPts>=10?'🔓':'⚠️', label:'Custody & Hardware Wallet', detail:cDetail, points:cPts, max:15 });

  // 5. PUBLIC EXPOSURE (max 10)
  let pPts = 0, pDetail = 'No unusual public exposure detected';
  if (txCount > 200)     { pPts = 10; pDetail = `Address used in ${txCount} transactions — highly traceable`; }
  else if (txCount > 50) { pPts = 6;  pDetail = `Address reused in ${txCount} transactions — consider rotating`; }
  else if (txCount > 10) { pPts = 3;  pDetail = `${txCount} transactions — moderate address reuse`; }
  totalScore += pPts;
  breakdown.push({ icon: pPts===0?'✅':'🌐', label:'Public Exposure & Address Reuse', detail:pDetail, points:pPts, max:10 });

  // 6. RECENT ACTIVITY (max 5)
  const lastTs        = (chainTxs || [])[0]?.status?.block_time;
  const daysSinceLast = lastTs ? (Date.now()/1000 - lastTs) / 86400 : 999;
  let rPts = 0, rDetail = 'No recent high-risk activity';
  if (daysSinceLast < 7  && balanceUSD > 5000)  { rPts = 5; rDetail = 'Recent activity with significant balance'; }
  else if (daysSinceLast < 30 && balanceUSD > 1000) { rPts = 3; rDetail = 'Active in last 30 days with notable balance'; }
  totalScore += rPts;
  breakdown.push({ icon: rPts===0?'✅':'📊', label:'Recent Activity', detail:rDetail, points:rPts, max:5 });

  const firstTx = (chainTxs || [])[chainTxs.length - 1];
  const meta = {
    chain:      'Bitcoin',
    balance:    fmtBTC(balance),
    balanceUSD: balanceUSD > 0 ? `~$${Math.round(balanceUSD).toLocaleString()}` : '$0',
    txCount,
    firstSeen:  fmtDate(firstTx?.status?.block_time),
    lastActive: fmtDate(lastTs),
  };

  console.log('[bitcoin] score:', Math.min(100, totalScore));
  return { totalScore: Math.min(100, Math.max(0, totalScore)), breakdown, meta, bPts, ePts, cPts, pPts, aPts };
}

// ─────────────────────────────────────────
// SCORE ENGINE — ETHEREUM
// ─────────────────────────────────────────
async function scoreEthereum(addr) {
  const addrLower = addr.toLowerCase();
  console.log('[ethereum] scoring', addrLower.slice(0, 12));

  const KEY  = process.env.ETHERSCAN_API_KEY || '';
  const auth = KEY ? `&apikey=${KEY}` : '';
  const base = 'https://api.etherscan.io/api';

  const [balData, txData, internalData, ofac] = await Promise.all([
    safeFetch(`${base}?module=account&action=balance&address=${addr}&tag=latest${auth}`, null),
    safeFetch(`${base}?module=account&action=txlist&address=${addr}&startblock=0&endblock=99999999&sort=desc&offset=100&page=1${auth}`, null),
    safeFetch(`${base}?module=account&action=txlistinternal&address=${addr}&startblock=0&endblock=99999999&sort=desc&offset=20&page=1${auth}`, null),
    getOFAC('ethereum'),
  ]);

  console.log('[ethereum] balData status:', balData?.status, 'result:', balData?.result?.slice?.(0,10));
  console.log('[ethereum] txData status:', txData?.status, 'count:', Array.isArray(txData?.result) ? txData.result.length : 'N/A');

  // ✅ FIX: usa parseFloat invece di BigInt per evitare errori
  const balanceWei = balData?.status === '1' ? parseFloat(balData.result || '0') : 0;
  const balanceETH = balanceWei / 1e18;

  // ✅ FIX: gestisci sia status '1' che '0' con messaggio NOTX
  const txList = (txData?.status === '1' && Array.isArray(txData.result))
    ? txData.result
    : [];

  console.log('[ethereum] balanceETH:', balanceETH.toFixed(4), 'txList length:', txList.length);

  // ✅ FIX: txCount reale dal nonce dell'ultimo tx inviato
  // Il nonce dell'ultima tx outgoing = numero totale di tx inviate
  const outgoingTxs = txList.filter(tx => tx.from?.toLowerCase() === addrLower);
  const lastNonce   = outgoingTxs.length > 0 ? parseInt(outgoingTxs[0].nonce || '0') + 1 : 0;
  // Stima totale tx = nonce + tx ricevute
  const incomingTxs = txList.filter(tx => tx.to?.toLowerCase() === addrLower);
  const txCount     = lastNonce + incomingTxs.length;

  console.log('[ethereum] outgoing:', outgoingTxs.length, 'incoming:', incomingTxs.length, 'estimated total:', txCount);

  // Prezzo ETH
  const priceData = await safeFetch(`${base}?module=stats&action=ethprice${auth}`, null, 3000);
  const ethPrice  = priceData?.status === '1' ? parseFloat(priceData.result?.ethusd || '3000') : 3000;
  const balanceUSD = balanceETH * ethPrice;

  console.log('[ethereum] ethPrice:', ethPrice, 'balanceUSD:', Math.round(balanceUSD));

  // Indirizzi interagiti
  const interacted = new Set();
  for (const tx of txList) {
    if (tx.from && tx.from.toLowerCase() !== addrLower) interacted.add(tx.from.toLowerCase());
    if (tx.to   && tx.to.toLowerCase()   !== addrLower) interacted.add(tx.to.toLowerCase());
  }

  // Contract interactions (tx con input data non vuoto)
  const contractInteractions = txList.filter(tx =>
    tx.input && tx.input !== '0x' && tx.from?.toLowerCase() === addrLower
  ).length;

  // Failed transactions
  const failedTxs = txList.filter(tx => tx.isError === '1').length;

  console.log('[ethereum] interacted:', interacted.size, 'contracts:', contractInteractions, 'failed:', failedTxs);

  let totalScore = 0;
  const breakdown = [];

  // 1. BLACKLIST (max 30)
  const isBlacklisted       = ofac.has(addrLower) || ETH_BLACKLIST.has(addrLower);
  const blacklistedContacts = [...interacted].filter(a => ofac.has(a) || ETH_BLACKLIST.has(a));
  const mixerContacts       = [...interacted].filter(a => ETH_MIXERS.has(a));
  let bPts = 0, bDetail = 'No blacklisted address interactions detected';
  if (isBlacklisted)                       { bPts = 30; bDetail = '🚨 This address is on the OFAC sanctions list'; }
  else if (blacklistedContacts.length > 0) { bPts = 25; bDetail = `Interacted with ${blacklistedContacts.length} OFAC sanctioned address${blacklistedContacts.length>1?'es':''}`; }
  else if (mixerContacts.length > 0)       { bPts = 15; bDetail = `Tornado Cash or mixer interaction detected (${mixerContacts.length})`; }
  totalScore += bPts;
  breakdown.push({ icon: bPts===0?'✅':'🚨', label:'Blacklist & Sanctions', detail:bDetail, points:bPts, max:30 });

  // 2. EXCHANGE EXPOSURE (max 25)
  const exchContacts   = [...interacted].filter(a => ETH_EXCHANGE.has(a));
  const isExchangeAddr = ETH_EXCHANGE.has(addrLower);
  let ePts = 0, eDetail = 'No known exchange interactions detected';
  if (isExchangeAddr)                { ePts = 25; eDetail = 'This address belongs to a centralized exchange'; }
  else if (exchContacts.length >= 3) { ePts = 20; eDetail = `${exchContacts.length} interactions with known exchange addresses`; }
  else if (exchContacts.length > 0)  { ePts = 12; eDetail = `${exchContacts.length} interaction${exchContacts.length>1?'s':''} with known exchange address${exchContacts.length>1?'es':''}`; }
  totalScore += ePts;
  breakdown.push({ icon: ePts===0?'✅':ePts>=20?'🏦':'⚠️', label:'Exchange Exposure', detail:eDetail, points:ePts, max:25 });

  // 3. ASSET EXPOSURE (max 15)
  let aPts = 0, aDetail = `Balance: ${balanceETH.toFixed(4)} ETH`;
  if (balanceUSD >= 100000)     { aPts = 15; aDetail = `High balance: ~$${Math.round(balanceUSD/1000)}k — significant exposure`; }
  else if (balanceUSD >= 10000) { aPts = 10; aDetail = `Moderate balance: ~$${Math.round(balanceUSD/1000)}k`; }
  else if (balanceUSD >= 1000)  { aPts = 5;  aDetail = `Balance: ~$${Math.round(balanceUSD)} — low exposure`; }
  totalScore += aPts;
  breakdown.push({ icon: aPts===0?'✅':aPts>=10?'💰':'⚠️', label:'Asset Exposure', detail:aDetail, points:aPts, max:15 });

  // 4. CUSTODY (max 15)
  let cPts = 0, cDetail = 'Self-custody patterns detected';
  if (isExchangeAddr)                            { cPts = 15; cDetail = 'Funds held on centralized exchange — not self-custodied'; }
  else if (ePts >= 20 && contractInteractions === 0) { cPts = 12; cDetail = 'High exchange exposure, no DeFi activity — likely hot wallet'; }
  else if (ePts >= 12)                           { cPts = 8;  cDetail = 'Exchange interactions — consider hardware wallet'; }
  else if (contractInteractions > 20)            { cPts = 5;  cDetail = `High DeFi activity (${contractInteractions} contract calls) — smart contract risk`; }
  else                                           { cDetail = 'Self-custody patterns detected'; }
  totalScore += cPts;
  breakdown.push({ icon: cPts===0?'✅':cPts>=10?'🔓':'⚠️', label:'Custody & Hardware Wallet', detail:cDetail, points:cPts, max:15 });

  // 5. PUBLIC EXPOSURE (max 10)
  let pPts = 0, pDetail = 'No unusual public exposure detected';
  if (txCount > 500)      { pPts = 10; pDetail = `High on-chain activity: ${txCount}+ transactions — highly traceable`; }
  else if (txCount > 100) { pPts = 6;  pDetail = `${txCount} transactions — moderate exposure`; }
  else if (txCount > 20)  { pPts = 3;  pDetail = `${txCount} transactions — low exposure`; }
  totalScore += pPts;
  breakdown.push({ icon: pPts===0?'✅':'🌐', label:'Public Exposure & On-chain Activity', detail:pDetail, points:pPts, max:10 });

  // 6. RECENT ACTIVITY (max 5)
  const lastTs        = txList[0] ? parseInt(txList[0].timeStamp) : null;
  const daysSinceLast = lastTs ? (Date.now()/1000 - lastTs) / 86400 : 999;
  let rPts = 0, rDetail = 'No recent high-risk activity';
  if (daysSinceLast < 7  && balanceUSD > 5000)      { rPts = 5; rDetail = 'Recent activity with significant balance'; }
  else if (daysSinceLast < 30 && balanceUSD > 1000) { rPts = 3; rDetail = 'Active in last 30 days with notable balance'; }
  totalScore += rPts;
  breakdown.push({ icon: rPts===0?'✅':'📊', label:'Recent Activity', detail:rDetail, points:rPts, max:5 });

  const firstTx = txList[txList.length - 1];
  const meta = {
    chain:      'Ethereum',
    balance:    `${balanceETH.toFixed(4)} ETH`,
    balanceUSD: balanceUSD > 0 ? `~$${Math.round(balanceUSD).toLocaleString()}` : '$0',
    txCount,
    firstSeen:  fmtDate(firstTx?.timeStamp),
    lastActive: fmtDate(lastTs),
  };

  console.log('[ethereum] final score:', Math.min(100, totalScore));
  return { totalScore: Math.min(100, Math.max(0, totalScore)), breakdown, meta, bPts, ePts, cPts, pPts, aPts };
}

// ─────────────────────────────────────────
// RECOMMENDATIONS
// ─────────────────────────────────────────
function buildRecommendations({ bPts, ePts, cPts, pPts, aPts, chain }) {
  const recs = [];

  if (cPts >= 8) {
    recs.push({
      icon: '🔐', title: 'Get a Hardware Wallet',
      desc: `A hardware wallet keeps your private keys offline and protected from hacks, malware and exchange failures — the single most effective security upgrade for any ${chain} holder.`,
      cta: 'Shop Hardware Wallets', ctaUrl: 'https://www.ledger.com/?r=YOUR_AFFILIATE_ID',
      priority: 'HIGH',
    });
  }

  if (ePts >= 12) {
    recs.push({
      icon: '🏦', title: 'Move funds off exchanges',
      desc: 'Centralized exchanges are a single point of failure. "Not your keys, not your coins." Withdraw to a self-custody wallet — ideally hardware-backed.',
      cta: 'Learn self-custody', ctaUrl: 'https://bitcoin.org/en/secure-your-wallet',
      priority: 'HIGH',
    });
  }

  if (pPts >= 6) {
    recs.push({
      icon: '🔄',
      title: chain === 'Ethereum' ? 'Use multiple addresses' : 'Rotate your addresses',
      desc: chain === 'Ethereum'
        ? 'Using a single Ethereum address for all activity makes your entire financial history traceable. Separate DeFi, NFT and exchange activity across different addresses.'
        : 'Using a single address for all transactions makes your financial history fully traceable. Use a new address for each transaction.',
      priority: 'MEDIUM',
    });
  }

  if (bPts >= 10) {
    recs.push({
      icon: '⚠️', title: 'Review your transaction history',
      desc: 'Your address has interacted with flagged or sanctioned addresses. Review your history and consider consulting a compliance professional.',
      priority: 'HIGH',
    });
  }

  if (aPts >= 10) {
    recs.push({
      icon: '🛡️', title: 'Consider a multi-signature setup',
      desc: 'For balances over $10,000, a multi-signature wallet adds an extra layer of security — funds can only move with approval from multiple keys.',
      priority: 'MEDIUM',
    });
  }

  if (recs.length === 0) {
    recs.push({
      icon: '✅', title: 'Good security posture',
      desc: 'Your wallet shows good privacy and security practices. Keep using a hardware wallet, rotate addresses regularly, and stay informed.',
      priority: 'INFO',
    });
  }

  return recs;
}

// ─────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { address, debug } = req.query;
  if (!address) return res.status(400).json({ error: 'Missing address' });

  const addr  = address.trim();
  const chain = detectChain(addr);

  console.log('[score] address:', addr.slice(0, 12), 'chain:', chain);

  if (chain === 'unknown') {
    return res.status(400).json({ error: 'Unsupported or invalid address format' });
  }

  if (!['bitcoin', 'ethereum'].includes(chain)) {
    return res.status(200).json({
      score: 0, breakdown: [],
      recommendations: [{
        icon: '🔧', title: 'Full analysis coming soon',
        desc: `Deep analysis for ${chain} is coming soon. Currently full scoring is available for Bitcoin and Ethereum.`,
        priority: 'INFO',
      }],
      meta: { chain, txCount: '—', balance: '—', firstSeen: '—', lastActive: '—' },
      partial: true,
    });
  }

  try {
    const scoreData = chain === 'bitcoin'
      ? await scoreBitcoin(addr)
      : await scoreEthereum(addr);

    const { totalScore, breakdown, meta, bPts, ePts, cPts, pPts, aPts } = scoreData;
    const recommendations = buildRecommendations({ bPts, ePts, cPts, pPts, aPts, chain: meta.chain });

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json({
      score: totalScore,
      breakdown,
      recommendations,
      meta,
      // debug mode: ?debug=1 nell'URL per vedere i dettagli
      ...(debug === '1' ? { _debug: { bPts, ePts, cPts, pPts, aPts } } : {}),
    });

  } catch(e) {
    console.error('[score] error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
