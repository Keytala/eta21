// pages/api/address.js
// Recupera dati indirizzo + transazioni pending da 3xpl
// Supporta qualsiasi blockchain tra le 48 supportate

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { address, blockchain } = req.query;

  if (!address || !blockchain) {
    return res.status(400).json({ error: 'Missing address or blockchain param' });
  }

  const token = process.env.THREEXPL_API_KEY;
  const base  = token ? 'https://api.3xpl.com' : 'https://sandbox-api.3xpl.com';
  const auth  = token ? `token=${token}` : '';

  const sep = (path) => path.includes('?') ? '&' : '?';

  try {
    // Chiamate parallele: dati indirizzo + transazioni mempool
    const [addrRes, mempoolRes] = await Promise.allSettled([
      fetch(`${base}/${blockchain}/address/${encodeURIComponent(address)}${auth ? '?'+auth : ''}`),
      fetch(`${base}/${blockchain}/address/${encodeURIComponent(address)}/mempool${auth ? '?'+auth : ''}`)
    ]);

    // Gestione risposta indirizzo
    let addrData = null;
    if (addrRes.status === 'fulfilled' && addrRes.value.ok) {
      addrData = await addrRes.value.json();
    } else {
      throw new Error(`Could not fetch address data for ${blockchain}`);
    }

    // Gestione risposta mempool (opzionale — non tutte le chain la supportano)
    let mempoolData = { data: [] };
    if (mempoolRes.status === 'fulfilled' && mempoolRes.value.ok) {
      mempoolData = await mempoolRes.value.json();
    }

    // Per Bitcoin: recupera anche le tx confermate recenti da mempool.space
    // (più dettagliate di 3xpl per il calcolo ETA)
    let btcTxs = [];
    if (blockchain === 'bitcoin') {
      try {
        const btcRes = await fetch(
          `https://mempool.space/api/address/${address}/txs/mempool`
        );
        if (btcRes.ok) btcTxs = await btcRes.json();
      } catch(e) {}
    }

    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
    res.status(200).json({
      address:    addrData.data   || addrData,
      mempool:    btcTxs.length > 0 ? btcTxs : (mempoolData.data || []),
      blockchain,
      source:     btcTxs.length > 0 ? 'mempool.space' : '3xpl'
    });

  } catch (e) {
    console.error('[address]', e.message);
    res.status(500).json({ error: e.message });
  }
}
