// pages/api/detect.js
// Chiama 3xpl per rilevare su quale blockchain esiste un indirizzo
// Gestisce correttamente la struttura della risposta del sandbox

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
      // Timeout di 8 secondi
      signal: AbortSignal.timeout(8000)
    });

    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`3xpl ${r.status}: ${txt.slice(0, 150)}`);
    }

    const raw = await r.json();

    // ── Normalizza la risposta ──
    // 3xpl sandbox può rispondere in formati diversi:
    // { data: { blockchains: ['bitcoin', ...], type: 'address' } }
    // oppure { data: { results: [...] } }
    // oppure { data: [...] }

    let blockchains = [];

    if (raw?.data?.blockchains && Array.isArray(raw.data.blockchains)) {
      // Formato standard
      blockchains = raw.data.blockchains;
    } else if (raw?.data?.results && Array.isArray(raw.data.results)) {
      // Formato alternativo
      blockchains = raw.data.results
        .filter(r => r.type === 'address')
        .map(r => r.blockchain)
        .filter(Boolean);
    } else if (Array.isArray(raw?.data)) {
      // Array diretto
      blockchains = raw.data
        .filter(item => typeof item === 'string')
        .slice(0, 5);
    }

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json({
      data: {
        blockchains,
        type: raw?.data?.type || 'address',
        raw: raw?.data  // incluso per debug
      }
    });

  } catch (e) {
    console.error('[detect]', e.message);

    // Se 3xpl fallisce, restituisci errore chiaro
    return res.status(500).json({
      error: e.message,
      hint: 'If using sandbox-api.3xpl.com, it may be rate limited. Try again in a few seconds.'
    });
  }
}
