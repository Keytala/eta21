// pages/api/fees.js
// Proxy server-side verso mempool.space
// Evita problemi CORS e nasconde l'origine delle chiamate

export default async function handler(req, res) {
  // Solo GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const [fees, mempool, price] = await Promise.all([
      fetch('https://mempool.space/api/v1/fees/recommended').then(r => {
        if (!r.ok) throw new Error('mempool.space fees error');
        return r.json();
      }),
      fetch('https://mempool.space/api/mempool').then(r => {
        if (!r.ok) throw new Error('mempool.space mempool error');
        return r.json();
      }),
      fetch('https://mempool.space/api/v1/prices').then(r => {
        if (!r.ok) throw new Error('mempool.space price error');
        return r.json();
      })
    ]);

    // Cache 30 secondi su Vercel Edge
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    res.status(200).json({ fees, mempool, price });

  } catch (e) {
    console.error('[fees]', e.message);
    res.status(500).json({ error: e.message });
  }
}
