const UPSTREAM = process.env.VITE_SHEETS_URL || '';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (!UPSTREAM || UPSTREAM.includes('/api/catalog')) {
    res.status(500).json({ error: 'VITE_SHEETS_URL must be the Apps Script /exec URL.' });
    return;
  }

  try {
    const upstream = await fetch(UPSTREAM, { redirect: 'follow' });
    const text = await upstream.text();
    if (text.trim().startsWith('<')) {
      res.status(502).json({ error: 'Sheet URL asked for a Google login. Redeploy the web app as Anyone.' });
      return;
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(upstream.ok ? 200 : upstream.status).send(text);
  } catch (error) {
    res.status(502).json({ error: error.message || 'Catalog proxy failed.' });
  }
}
