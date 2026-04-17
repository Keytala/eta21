// pages/api/detect.js
// Chiama 3xpl per rilevare su quale blockchain esiste un indirizzo
// La API key rimane nascosta lato server

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { address } = req.query;
  if (!address || address.trim().length < 10) {
    return res.status(400).json({ error: 'Missing or invalid address' });
  }

  const token = process.env.THREEXPL_API_KEY;

  // Se non c'è token usa il sandbox gratuito (rate limited)
  const base = token
    ? 'https://api.3xpl.com'
    : 'https://sandbox-api.3xpl.com';

  const url = token
    ? `${base}/search?q=${encodeURIComponent(address.trim())}&token=${token}`
    : `${base}/search?q=${encodeURIComponent(address.trim())}`;

  try {
    const r = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`3xpl error ${r.status}: ${txt.slice(0, 100)}`);
    }

    const data = await r.json();

    // Cache 60 secondi — la blockchain di un indirizzo non cambia
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    res.status(200).json(data);

  } catch (e) {
    console.error('[detect]', e.message);
    res.status(500).json({ error: e.message });
  }
}
