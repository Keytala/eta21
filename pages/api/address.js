// pages/api/address.js
// Recupera dati indirizzo + transazioni pending
// Per Bitcoin usa mempool.space (più dettagliato)
// Per altre chain usa 3xpl sandbox

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { address, blockchain } = req.query;

  if (!address || !blockchain) {
    return res.status(400).json({ error: 'Missing address or blockchain param' });
  }

  // ── BITCOIN: usa mempool.space direttamente (più affidabile e dettagliato) ──
  if (blockchain === 'bitcoin') {
    try {
      const [infoRes, mempoolRes] = await Promise.all([
        fetch(`https://mempool.space/api/address/${address}`),
        fetch(`https://mempool.space/api/address/${address}/txs/mempool`)
      ]);

      if (!infoRes.ok) throw new Error('Bitcoin address not found');

      const info    = await infoRes.json();
      const mempool = mempoolRes.ok ? await mempoolRes.json() : [];

      res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
      return res.status(200).json({
        address:    info,
        mempool,
        blockchain: 'bitcoin',
        source:     'mempool.space'
      });
    } catch (e) {
      console.error('[address/bitcoin]', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  // ── ALTRE CHAIN: usa 3xpl ──
  const token = process.env.THREEXPL_API_KEY;
  const base  = token ? 'https://api.3xpl.com' : 'https://sandbox-api.3xpl.com';
  const auth  = token ? `?token=${token}` : '';

  try {
    const [addrRes, mempoolRes] = await Promise.allSettled([
      fetch(`${base}/${blockchain}/address/${encodeURIComponent(address)}${auth}`),
      fetch(`${base}/${blockchain}/address/${encodeURIComponent(address)}/mempool${auth}`)
    ]);

    // Risposta indirizzo
    if (addrRes.status !== 'fulfilled' || !addrRes.value.ok) {
      const errText = addrRes.status === 'fulfilled'
        ? await addrRes.value.text()
        : 'Network error';
      throw new Error(`3xpl error for ${blockchain}: ${errText.slice(0, 150)}`);
    }

    const addrJson = await addrRes.value.json();

    // Risposta mempool (opzionale)
    let mempoolData = [];
    if (mempoolRes.status === 'fulfilled' && mempoolRes.value.ok) {
      const mj = await mempoolRes.value.json();
      // 3xpl restituisce { data: [...] } oppure { data: { ... } }
      mempoolData = Array.isArray(mj.data) ? mj.data : [];
    }

    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
    return res.status(200).json({
      address:    addrJson.data || addrJson,
      mempool:    mempoolData,
      blockchain,
      source:     '3xpl'
    });

  } catch (e) {
    console.error('[address/3xpl]', e.message);
    return res.status(500).json({ error: e.message });
  }
}
