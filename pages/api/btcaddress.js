// pages/api/btcaddress.js
// Recupera le transazioni CONFERMATE di un indirizzo Bitcoin
// Usato per mostrare lo storico quando non ci sono tx pending

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { address } = req.query;
  if (!address) return res.status(400).json({ error: 'Missing address' });

  try {
    const [infoRes, chainRes] = await Promise.all([
      fetch(`https://mempool.space/api/address/${address}`),
      fetch(`https://mempool.space/api/address/${address}/txs/chain`)
    ]);

    if (!infoRes.ok) throw new Error('Address not found on Bitcoin network');

    const info      = await infoRes.json();
    const chainTxs  = chainRes.ok ? await chainRes.json() : [];

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    res.status(200).json({ info, chainTxs });

  } catch (e) {
    console.error('[btcaddress]', e.message);
    res.status(500).json({ error: e.message });
  }
}
