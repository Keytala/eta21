// pages/api/score.js
// Calcola il Risk Score da 0 a 100 per un indirizzo crypto
// Supporta: Bitcoin (mempool.space) + Ethereum (Etherscan)
// Analizza: blacklist, exchange, balance, custodia, attività

// ─────────────────────────────────────────
// EXCHANGE ADDRESSES — Bitcoin
// ─────────────────────────────────────────
const BTC_EXCHANGE_ADDRESSES = new Set([
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

// ─────────────────────────────────────────
// EXCHANGE ADDRESSES — Ethereum
// ─────────────────────────────────────────
const ETH_EXCHANGE_ADDRESSES = new Set([
  // Binance
  '0x28c6c06298d514db089934071355e5743bf21d60',
  '0x21a31ee1afc51d94c2efccaa2092ad1028285549',
  '0xdfd5293d8e347dfe59e90efd55b2956a1343963d',
  // Coinbase
  '0x71660c4005ba85c37ccec55d0c4493e66fe775d3',
  '0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43',
  // Kraken
  '0x2910543af39aba0cd09dbb2d50200b3e800a63d2',
  '0x0a869d79a7052c7f1b55a8ebabbea3420f0d1e13',
  // OKX
  '0x6cc5f688a315f3dc28a7781717a9a798a59fda7b',
  // Bybit
  '0xf89d7b9c864f589bbf53a82105107622b35eaa40',
  // Bitfinex
  '0x1151314c646ce4e0efd76d1af4760ae66a9fe30f',
  // Gemini
  '0xd24400ae8bfebb18ca49be86258a3c749cf46853',
]);

// ─────────────────────────────────────────
// BLACKLIST STATICA — Bitcoin
// ─────────────────────────────────────────
const BTC_BLACKLISTED = new Set([
  '12QtD5BFwRsdNsAZY76UVE1xyCGNTojH9h',
  '1LdRcdxfbSnmCYYNdeYpUnztiYzVfBEQeC',
  '1FeexV6bAHb8ybZjqQMjJrcCrHGW9sb6uF',
  'bc1qazcm763858nkj2dj986etajv6wquslv8uxwczt',
]);

// ─────────────────────────────────────────
// BLACKLIST STATICA — Ethereum (OFAC + noti)
// ─────────────────────────────────────────
const ETH_BLACKLISTED = new Set([
  // Tornado Cash contracts (OFAC sanctioned)
  '0x7f367cc41522ce07553e823bf3be79a889debe1b',
  '0xd882cfc20f52f2599d84b8e8d58c7fb62cfe344b',
  '0x901bb9583b24d97e995513c6778dc6888ab6870e',
  '0xa7e5d5a720f06526557c513402f2e6b5fa20b008',
  '0x8576acc5c05d6ce88f4e49bf65bdf0c62f91353c',
  // Tornado Cash router
  '0x722122df12d4e14e13ac3b6895a86e84145b6967',
  '0xdd4c48c0b24039969fc16d1cdf626eab821d3384',
  '0xd90e2f925da726b50c4ed8d0fb90ad053324f31b',
  '0xd96f2b1c14db8458374d9aca76e26c3950113464',
  '0x4736dcf1b7a3d580672cce6e7c65cd5cc9cfba9d',
  // Lazarus Group (North Korea)
  '0x098b716b8aaf21512996dc57eb0615e2383e2f96',
  '0xa0e1c89ef1a489c9c7de96311ed5ce5d32c20e4b',
  '0x3cffd56b47278a68b5c9f9b0a5e3e2f2d8b8e9a1',
  // FTX hacker
  '0x59abf3837fa962d6853b4cc0a19513aa031fd32b',
]);

// ─────────────────────────────────────────
// MIXER / PRIVACY — Ethereum
// ─────────────────────────────────────────
const ETH_MIXER_ADDRESSES = new Set([
  '0x722122df12d4e14e13ac3b6895a86e84145b6967', // Tornado Cash
  '0x47ce0c6ed5b0ce3d3a51fdb1c52dc66a7c3c2936',
]);

// BTC Mixer
const BTC_MIXER_ADDRESSES = new Set([
  'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
]);

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
function fmtSats(n) {
  if (!n && n !== 0) return '—';
  if (n >= 1e8) return (n / 1e8).toFixed(4) + ' BTC';
  return Number(n).toLocaleString() + ' sats';
}

function fmtEth(wei) {
  if (!wei && wei !== 0) return '—';
  const eth = Number(wei) / 1e18;
  if (eth >= 1) return eth.toFixed(4) + ' ETH';
  return (eth * 1000).toFixed(4) + ' mETH';
}

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleDateString('en-GB', {
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

// ─────────────────────────────────────────
// OFAC LIST — Bitcoin (cache 1h)
// ─────────────────────────────────────────
let ofacBtcCache     = null;
let ofacBtcCacheTime = 0;

async function getOFACBitcoin() {
  const now = Date.now();
  if (ofacBtcCache && (now - ofacBtcCacheTime) < 3600000) return ofacBtcCache;
  try {
    const r = await fetch(
      'https://raw.githubusercontent.com/vile/ofac-sdn-list/main/data/bitcoin.json',
      { signal: AbortSignal.timeout(5000) }
    );
    if (r.ok) {
      const data = await r.json();
      ofacBtcCache     = new Set(Array.isArray(data) ? data.map(a => a.toLowerCase()) : []);
      ofacBtcCacheTime = now;
      return ofacBtcCache;
    }
  } catch(e) { console.warn('[ofac/btc]', e.message); }
  return BTC_BLACKLISTED;
}

// OFAC LIST — Ethereum (cache 1h)
let ofacEthCache     = null;
let ofacEthCacheTime = 0;

async function getOFACEthereum() {
  const now = Date.now();
  if (ofacEthCache && (now - ofacEthCacheTime) < 3600000) return ofacEthCache;
  try {
    const r = await fetch(
      'https://raw.githubusercontent.com/vile/ofac-sdn-list/main/data/ethereum.json',
      { signal: AbortSignal.timeout(5000) }
    );
    if (r.ok) {
      const data = await r.json();
      ofacEthCache     = new Set(Array.isArray(data) ? data.map(a => a.toLowerCase()) : []);
      ofacEthCacheTime = now;
      return ofacEthCache;
    }
  } catch(e) { console.warn('[ofac/eth]', e.message); }
  return ETH_BLACKLISTED;
}

// ─────────────────────────────────────────
// SCORE ENGINE — BITCOIN
// ─────────────────────────────────────────
async function scoreBitcoin(addr) {
  const [infoRes, mempoolRes, txsRes, ofacList] = await Promise.all([
    fetch(`https://mempool.space/api/address/${addr}`, { signal: AbortSignal.timeout(8000) }),
    fetch(`https://mempool.space/api/address/${addr}/txs/mempool`, { signal: AbortSignal.timeout(8000) }),
    fetch(`https://mempool.space/api/address/${addr}/txs/chain`, { signal: AbortSignal.timeout(8000) }),
    getOFACBitcoin(),
  ]);

  if (!infoRes.ok) throw new Error('Bitcoin address not found');

  const info     = await infoRes.json();
  const mempool  = mempoolRes.ok ? await mempoolRes.json() : [];
  const chainTxs = txsRes.ok     ? await txsRes.json()    : [];

  const stats      = info.chain_stats || {};
  const balance    = (stats.funded_txo_sum || 0) - (stats.spent_txo_sum || 0);
  const txCount    = stats.tx_count || 0;

  // Prezzo BTC live
  let btcPrice = 95000;
  try {
    const pr = await fetch('https://mempool.space/api/v1/prices', { signal: AbortSignal.timeout(3000) });
    if (pr.ok) { const p = await pr.json(); btcPrice = p.USD || 95000; }
  } catch(e) {}
  const balanceUSD = (balance / 1e8) * btcPrice;

  // Indirizzi interagiti (ultime 50 tx)
  const interacted = new Set();
  for (const tx of chainTxs.slice(0, 50)) {
    tx.vin?.forEach(v => {
      if (v.prevout?.scriptpubkey_address && v.prevout.scriptpubkey_address !== addr)
        interacted.add(v.prevout.scriptpubkey_address);
    });
    tx.vout?.forEach(v => {
      if (v.scriptpubkey_address && v.scriptpubkey_address !== addr)
        interacted.add(v.scriptpubkey_address);
    });
  }

  let totalScore = 0;
  const breakdown = [];

  // 1. BLACKLIST (max 30)
  const isBlacklisted       = ofacList.has(addr) || BTC_BLACKLISTED.has(addr);
  const blacklistedContacts = [...interacted].filter(a => ofacList.has(a) || BTC_BLACKLISTED.has(a));
  const mixerContacts       = [...interacted].filter(a => BTC_MIXER_ADDRESSES.has(a));
  let bPts = 0, bDetail = 'No blacklisted address interactions detected';
  if (isBlacklisted)               { bPts = 30; bDetail = '🚨 This address is on the OFAC sanctions list'; }
  else if (blacklistedContacts.length > 0) { bPts = 20; bDetail = `Interacted with ${blacklistedContacts.length} sanctioned address${blacklistedContacts.length>1?'es':''}`; }
  else if (mixerContacts.length > 0)       { bPts = 10; bDetail = `Interacted with ${mixerContacts.length} known mixing service${mixerContacts.length>1?'s':''}`; }
  totalScore += bPts;
  breakdown.push({ icon: bPts===0?'✅':'🚨', label:'Blacklist & Sanctions', detail:bDetail, points:bPts, max:30 });

  // 2. EXCHANGE EXPOSURE (max 25)
  const exchContacts  = [...interacted].filter(a => BTC_EXCHANGE_ADDRESSES.has(a));
  const isExchangeAddr = BTC_EXCHANGE_ADDRESSES.has(addr);
  let ePts = 0, eDetail = 'No known exchange interactions detected';
  if (isExchangeAddr)           { ePts = 25; eDetail = 'This address belongs to a centralized exchange'; }
  else if (exchContacts.length >= 3) { ePts = 20; eDetail = `${exchContacts.length} interactions with known exchange addresses`; }
  else if (exchContacts.length > 0)  { ePts = 12; eDetail = `${exchContacts.length} interaction${exchContacts.length>1?'s':''} with known exchange address${exchContacts.length>1?'es':''}`; }
  totalScore += ePts;
  breakdown.push({ icon: ePts===0?'✅':ePts>=20?'🏦':'⚠️', label:'Exchange Exposure', detail:eDetail, points:ePts, max:25 });

  // 3. ASSET EXPOSURE (max 15)
  let aPts = 0, aDetail = `Balance: ${fmtSats(balance)}`;
  if (balanceUSD >= 100000)      { aPts = 15; aDetail = `High balance: ~$${Math.round(balanceUSD/1000)}k — significant exposure`; }
  else if (balanceUSD >= 10000)  { aPts = 10; aDetail = `Moderate balance: ~$${Math.round(balanceUSD/1000)}k`; }
  else if (balanceUSD >= 1000)   { aPts = 5;  aDetail = `Balance: ~$${Math.round(balanceUSD)} — low exposure`; }
  totalScore += aPts;
  breakdown.push({ icon: aPts===0?'✅':aPts>=10?'💰':'⚠️', label:'Asset Exposure', detail:aDetail, points:aPts, max:15 });

  // 4. CUSTODY (max 15)
  const isSegwit = addr.startsWith('bc1');
  const isLegacy = addr.startsWith('1');
  let cPts = 0, cDetail = 'Self-custody patterns detected';
  if (isExchangeAddr)                    { cPts = 15; cDetail = 'Funds held on centralized exchange — not self-custodied'; }
  else if (isLegacy && txCount > 100)    { cPts = 10; cDetail = 'Legacy address with high activity — consider hardware wallet'; }
  else if (isLegacy)                     { cPts = 8;  cDetail = 'Legacy P2PKH address — no hardware wallet patterns detected'; }
  else if (!isSegwit)                    { cPts = 5;  cDetail = 'No hardware wallet signature patterns detected'; }
  else                                   { cDetail = 'Native SegWit — good practices detected'; }
  totalScore += cPts;
  breakdown.push({ icon: cPts===0?'✅':cPts>=10?'🔓':'⚠️', label:'Custody & Hardware Wallet', detail:cDetail, points:cPts, max:15 });

  // 5. PUBLIC EXPOSURE (max 10)
  let pPts = 0, pDetail = 'No unusual public exposure detected';
  if (txCount > 200)      { pPts = 10; pDetail = `Address used in ${txCount} transactions — highly traceable`; }
  else if (txCount > 50)  { pPts = 6;  pDetail = `Address reused in ${txCount} transactions — consider rotating`; }
  else if (txCount > 10)  { pPts = 3;  pDetail = `${txCount} transactions — moderate address reuse`; }
  totalScore += pPts;
  breakdown.push({ icon: pPts===0?'✅':'🌐', label:'Public Exposure & Address Reuse', detail:pDetail, points:pPts, max:10 });

  // 6. RECENT ACTIVITY (max 5)
  const lastTs        = chainTxs[0]?.status?.block_time;
  const daysSinceLast = lastTs ? (Date.now()/1000 - lastTs) / 86400 : 999;
  let rPts = 0, rDetail = 'No recent high-risk activity';
  if (daysSinceLast < 7  && balanceUSD > 5000) { rPts = 5; rDetail = 'Recent activity with significant balance'; }
  else if (daysSinceLast < 30 && balanceUSD > 1000) { rPts = 3; rDetail = 'Active in last 30 days with notable balance'; }
  totalScore += rPts;
  breakdown.push({ icon: rPts===0?'✅':'📊', label:'Recent Activity', detail:rDetail, points:rPts, max:5 });

  const firstTx = chainTxs[chainTxs.length - 1];
  const meta = {
    chain:      'Bitcoin',
    balance:    fmtSats(balance),
    balanceUSD: balanceUSD > 0 ? `~$${Math.round(balanceUSD).toLocaleString()}` : '$0',
    txCount,
    firstSeen:  fmtDate(firstTx?.status?.block_time),
    lastActive: fmtDate(lastTs),
  };

  return { totalScore: Math.min(100, Math.max(0, totalScore)), breakdown, meta, balanceUSD, ePts, cPts, pPts, bPts, aPts };
}

// ─────────────────────────────────────────
// SCORE ENGINE — ETHEREUM
// ─────────────────────────────────────────
async function scoreEthereum(addr) {
  const addrLower  = addr.toLowerCase();
  const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY || '';
  const base = 'https://api.etherscan.io/api';
  const auth = ETHERSCAN_KEY ? `&apikey=${ETHERSCAN_KEY}` : '';

  // Fetch parallelo: balance + tx list + token tx
  const [balRes, txRes, tokenRes, ofacList] = await Promise.allSettled([
    fetch(`${base}?module=account&action=balance&address=${addr}&tag=latest${auth}`, { signal: AbortSignal.timeout(8000) }),
    fetch(`${base}?module=account&action=txlist&address=${addr}&startblock=0&endblock=99999999&sort=desc&offset=50&page=1${auth}`, { signal: AbortSignal.timeout(8000) }),
    fetch(`${base}?module=account&action=tokentx&address=${addr}&startblock=0&endblock=99999999&sort=desc&offset=20&page=1${auth}`, { signal: AbortSignal.timeout(8000) }),
    getOFACEthereum(),
  ]);

  // Balance
  let balanceWei = 0;
  if (balRes.status === 'fulfilled' && balRes.value.ok) {
    const bj = await balRes.value.json();
    balanceWei = bj.status === '1' ? BigInt(bj.result || '0') : BigInt(0);
  }

  // Transactions
  let txList = [];
  if (txRes.status === 'fulfilled' && txRes.value.ok) {
    const tj = await txRes.value.json();
    txList = tj.status === '1' && Array.isArray(tj.result) ? tj.result : [];
  }

  // Token transfers
  let tokenTxs = [];
  if (tokenRes.status === 'fulfilled' && tokenRes.value.ok) {
    const ttj = await tokenRes.value.json();
    tokenTxs = ttj.status === '1' && Array.isArray(ttj.result) ? ttj.result : [];
  }

  const ofacList2 = ofacList.status === 'fulfilled' ? ofacList.value : ETH_BLACKLISTED;

  // Prezzo ETH live
  let ethPrice = 3000;
  try {
    const pr = await fetch(
      `${base}?module=stats&action=ethprice${auth}`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (pr.ok) {
      const pj = await pr.json();
      if (pj.status === '1') ethPrice = parseFloat(pj.result?.ethusd) || 3000;
    }
  } catch(e) {}

  const balanceETH = Number(balanceWei) / 1e18;
  const balanceUSD = balanceETH * ethPrice;
  const txCount    = txList.length;

  // Indirizzi interagiti
  const interacted = new Set();
  for (const tx of txList) {
    if (tx.from && tx.from.toLowerCase() !== addrLower) interacted.add(tx.from.toLowerCase());
    if (tx.to   && tx.to.toLowerCase()   !== addrLower) interacted.add(tx.to.toLowerCase());
  }
  for (const tx of tokenTxs) {
    if (tx.from && tx.from.toLowerCase() !== addrLower) interacted.add(tx.from.toLowerCase());
    if (tx.to   && tx.to.toLowerCase()   !== addrLower) interacted.add(tx.to.toLowerCase());
  }

  // Contratti interagiti (tx con input data)
  const contractInteractions = txList.filter(tx => tx.input && tx.input !== '0x').length;

  // Failed tx (possibile segno di attività rischiosa)
  const failedTxs = txList.filter(tx => tx.isError === '1').length;

  let totalScore = 0;
  const breakdown = [];

  // 1. BLACKLIST (max 30)
  const isBlacklisted       = ofacList2.has(addrLower) || ETH_BLACKLISTED.has(addrLower);
  const blacklistedContacts = [...interacted].filter(a => ofacList2.has(a) || ETH_BLACKLISTED.has(a));
  const mixerContacts       = [...interacted].filter(a => ETH_MIXER_ADDRESSES.has(a));
  let bPts = 0, bDetail = 'No blacklisted address interactions detected';
  if (isBlacklisted)                       { bPts = 30; bDetail = '🚨 This address is on the OFAC sanctions list'; }
  else if (blacklistedContacts.length > 0) { bPts = 25; bDetail = `Interacted with ${blacklistedContacts.length} OFAC sanctioned address${blacklistedContacts.length>1?'es':''}`; }
  else if (mixerContacts.length > 0)       { bPts = 15; bDetail = `Interacted with Tornado Cash or other mixer (${mixerContacts.length} interaction${mixerContacts.length>1?'s':''})`; }
  totalScore += bPts;
  breakdown.push({ icon: bPts===0?'✅':'🚨', label:'Blacklist & Sanctions', detail:bDetail, points:bPts, max:30 });

  // 2. EXCHANGE EXPOSURE (max 25)
  const exchContacts   = [...interacted].filter(a => ETH_EXCHANGE_ADDRESSES.has(a));
  const isExchangeAddr = ETH_EXCHANGE_ADDRESSES.has(addrLower);
  let ePts = 0, eDetail = 'No known exchange interactions detected';
  if (isExchangeAddr)             { ePts = 25; eDetail = 'This address belongs to a centralized exchange'; }
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
  // Su Ethereum: se ha interagito con exchange e non con DeFi → probabilmente hot wallet
  const defiInteractions = contractInteractions;
  let cPts = 0, cDetail = 'Self-custody patterns detected';
  if (isExchangeAddr)               { cPts = 15; cDetail = 'Funds held on centralized exchange — not self-custodied'; }
  else if (ePts >= 20 && defiInteractions === 0) { cPts = 12; cDetail = 'High exchange exposure with no DeFi activity — likely hot wallet'; }
  else if (ePts >= 12)              { cPts = 8;  cDetail = 'Exchange interactions detected — consider hardware wallet for self-custody'; }
  else if (defiInteractions > 10)   { cPts = 5;  cDetail = 'High DeFi activity — smart contract risk exposure'; }
  else                              { cDetail = 'Self-custody patterns detected — good practices'; }
  totalScore += cPts;
  breakdown.push({ icon: cPts===0?'✅':cPts>=10?'🔓':'⚠️', label:'Custody & Hardware Wallet', detail:cDetail, points:cPts, max:15 });

  // 5. PUBLIC EXPOSURE (max 10)
  const totalTxCount = parseInt(txList[0]?.nonce || '0') + 1;
  let pPts = 0, pDetail = 'No unusual public exposure detected';
  if (totalTxCount > 500)      { pPts = 10; pDetail = `High on-chain activity: ${totalTxCount}+ transactions — highly traceable`; }
  else if (totalTxCount > 100) { pPts = 6;  pDetail = `${totalTxCount} transactions — moderate exposure`; }
  else if (totalTxCount > 20)  { pPts = 3;  pDetail = `${totalTxCount} transactions — low exposure`; }
  totalScore += pPts;
  breakdown.push({ icon: pPts===0?'✅':'🌐', label:'Public Exposure & On-chain Activity', detail:pDetail, points:pPts, max:10 });

  // 6. RECENT ACTIVITY (max 5)
  const lastTx        = txList[0];
  const lastTs        = lastTx ? parseInt(lastTx.timeStamp) : null;
  const daysSinceLast = lastTs ? (Date.now()/1000 - lastTs) / 86400 : 999;
  let rPts = 0, rDetail = 'No recent high-risk activity';
  if (daysSinceLast < 7  && balanceUSD > 5000)  { rPts = 5; rDetail = 'Recent activity with significant balance'; }
  else if (daysSinceLast < 30 && balanceUSD > 1000) { rPts = 3; rDetail = 'Active in last 30 days with notable balance'; }
  totalScore += rPts;
  breakdown.push({ icon: rPts===0?'✅':'📊', label:'Recent Activity', detail:rDetail, points:rPts, max:5 });

  const firstTx = txList[txList.length - 1];
  const meta = {
    chain:      'Ethereum',
    balance:    `${balanceETH.toFixed(4)} ETH`,
    balanceUSD: balanceUSD > 0 ? `~$${Math.round(balanceUSD).toLocaleString()}` : '$0',
    txCount:    totalTxCount,
    firstSeen:  fmtDate(firstTx ? parseInt(firstTx.timeStamp) : null),
    lastActive: fmtDate(lastTs),
  };

  return { totalScore: Math.min(100, Math.max(0, totalScore)), breakdown, meta, balanceUSD, ePts, cPts, pPts, bPts, aPts };
}

// ─────────────────────────────────────────
// BUILD RECOMMENDATIONS
// ─────────────────────────────────────────
function buildRecommendations({ bPts, ePts, cPts, pPts, aPts, chain }) {
  const recs = [];

  if (cPts >= 8) {
    recs.push({
      icon:     '🔐',
      title:    'Get a Hardware Wallet',
      desc:     `A hardware wallet keeps your private keys offline and protected from hacks, malware and exchange failures. It's the single most effective security upgrade for any ${chain} holder.`,
      cta:      'Shop Hardware Wallets',
      ctaUrl:   'https://www.ledger.com/?r=YOUR_AFFILIATE_ID',
      priority: 'HIGH',
    });
  }

  if (ePts >= 12) {
    recs.push({
      icon:     '🏦',
      title:    'Move funds off exchanges',
      desc:     'Centralized exchanges are a single point of failure. "Not your keys, not your coins." Withdraw to a self-custody wallet — ideally hardware-backed.',
      cta:      'Learn self-custody',
      ctaUrl:   'https://bitcoin.org/en/secure-your-wallet',
      priority: 'HIGH',
    });
  }

  if (pPts >= 6) {
    recs.push({
      icon:     '🔄',
      title:    chain === 'Ethereum' ? 'Consider using multiple addresses' : 'Rotate your addresses',
      desc:     chain === 'Ethereum'
        ? 'Using a single Ethereum address for all activity makes your entire financial history traceable. Consider separating DeFi, NFT and exchange activity across different addresses.'
        : 'Using a single address for all transactions makes your financial history fully traceable. Use a new address for each transaction — modern wallets do this automatically.',
      priority: 'MEDIUM',
    });
  }

  if (bPts >= 10) {
    recs.push({
      icon:     '⚠️',
      title:    'Review your transaction history',
      desc:     'Your address has interacted with flagged or sanctioned addresses. Review your transaction history and consider consulting a compliance professional if needed.',
      priority: 'HIGH',
    });
  }

  if (aPts >= 10) {
    recs.push({
      icon:     '🛡️',
      title:    'Consider a multi-signature setup',
      desc:     `For balances over $10,000, a multi-signature wallet adds an extra layer of security — funds can only move with approval from multiple keys.`,
      priority: 'MEDIUM',
    });
  }

  if (recs.length === 0) {
    recs.push({
      icon:     '✅',
      title:    'Good security posture',
      desc:     'Your wallet shows good privacy and security practices. Keep using a hardware wallet, rotate addresses regularly, and stay informed about new threats.',
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

  const { address } = req.query;
  if (!address) return res.status(400).json({ error: 'Missing address' });

  const addr  = address.trim();
  const chain = detectChain(addr);

  if (chain === 'unknown') {
    return res.status(400).json({ error: 'Unsupported or invalid address format' });
  }

  // Chain non ancora supportate
  if (!['bitcoin', 'ethereum'].includes(chain)) {
    return res.status(200).json({
      score: 0,
      breakdown: [],
      recommendations: [{
        icon:     '🔧',
        title:    'Full analysis coming soon',
        desc:     `Deep analysis for ${chain} is coming soon. Currently full scoring is available for Bitcoin and Ethereum addresses.`,
        priority: 'INFO',
      }],
      meta: { chain, txCount: '—', balance: '—', firstSeen: '—', lastActive: '—' },
      partial: true,
    });
  }

  try {
    let scoreData;

    if (chain === 'bitcoin') {
      scoreData = await scoreBitcoin(addr);
    } else {
      scoreData = await scoreEthereum(addr);
    }

    const { totalScore, breakdown, meta, balanceUSD, ePts, cPts, pPts, bPts, aPts } = scoreData;
    const recommendations = buildRecommendations({ bPts, ePts, cPts, pPts, aPts, chain: meta.chain });

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json({
      score: totalScore,
      breakdown,
      recommendations,
      meta,
    });

  } catch(e) {
    console.error('[score]', e.message);
    return res.status(500).json({ error: e.message });
  }
}
