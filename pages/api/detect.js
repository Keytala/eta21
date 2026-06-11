// pages/api/detect.js
// Chiama 3xpl per rilevare su quale blockchain esiste un indirizzo
// Normalizza tutti i formati di risposta possibili del sandbox

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { address } = req.query;
  if (!address || address.trim().length < 10) {
    return res.status(400).json({ error: 'Missing or invalid address' });
  }

  const token = process.env.THREEXPL_API_KEY;
  const base  = token ? 'https://api.3xpl.com' : 'https://sandbox-api.3xpl.com';
  const url   = token
    ? `${base}/search?q=${encodeURIComponent(address.trim())}&token=${token}`
    : `${base}/search?q=${encodeURIComponent(address.trim())}`;

  try {
    const r = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal:  AbortSignal.timeout(8000)
    });

    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`3xpl ${r.status}: ${txt.slice(0, 150)}`);
    }

    const raw = await r.json();

    // Normalizza la risposta — 3xpl sandbox può rispondere in formati diversi
    let blockchains = [];

    if (raw?.data?.blockchains && Array.isArray(raw.data.blockchains)) {
      // Formato standard: { data: { blockchains: ['bitcoin', ...] } }
      blockchains = raw.data.blockchains;
    } else if (raw?.data?.results && Array.isArray(raw.data.results)) {
      // Formato alternativo: { data: { results: [...] } }
      blockchains = raw.data.results
        .filter(r => r.type === 'address')
        .map(r => r.blockchain)
        .filter(Boolean);
    } else if (Array.isArray(raw?.data)) {
      // Array diretto: { data: [...] }
      blockchains = raw.data
        .filter(item => typeof item === 'string')
        .slice(0, 5);
    }

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json({
      data: {
        blockchains,
        type: raw?.data?.type || 'address',
      }
    });

  } catch (e) {
    console.error('[detect]', e.message);
    return res.status(500).json({
      error: e.message,
      hint: 'sandbox-api.3xpl.com may be rate limited. Try again in a few seconds.'
    });
  }
}
