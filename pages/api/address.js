// pages/api/address.js
// Bitcoin → mempool.space (più affidabile e dettagliato)
// Altre chain → 3xpl sandbox/api

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { address, blockchain } = req.query;

  if (!address || !blockchain) {
    return res.status(400).json({ error: 'Missing address or blockchain param' });
  }

  // ── BITCOIN: usa mempool.space direttamente ──
  if (blockchain === 'bitcoin') {
    try {
      const [infoRes, mempoolRes] = await Promise.all([
        fetch(`https://mempool.space/api/address/${address}`, {
          signal: AbortSignal.timeout(8000)
        }),
        fetch(`https://mempool.space/api/address/${address}/txs/mempool`, {
          signal: AbortSignal.timeout(8000)
        })
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
      fetch(`${base}/${blockchain}/address/${encodeURIComponent(address)}${auth}`, {
        signal: AbortSignal.timeout(8000)
      }),
      fetch(`${base}/${blockchain}/address/${encodeURIComponent(address)}/mempool${auth}`, {
        signal: AbortSignal.timeout(8000)
      })
    ]);

    if (addrRes.status !== 'fulfilled' || !addrRes.value.ok) {
      const errText = addrRes.status === 'fulfilled'
        ? await addrRes.value.text()
        : 'Network error';
      throw new Error(`3xpl error for ${blockchain}: ${errText.slice(0, 150)}`);
    }

    const addrJson = await addrRes.value.json();

    let mempoolData = [];
    if (mempoolRes.status === 'fulfilled' && mempoolRes.value.ok) {
      const mj = await mempoolRes.value.json();
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
