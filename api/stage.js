const UPSTREAM = process.env.VITE_SHEETS_URL || '';

function stageCode(req) {
  return String(req.query?.s || req.query?.stage || '').trim();
}

function execUrl(code) {
  const sep = UPSTREAM.includes('?') ? '&' : '?';
  return `${UPSTREAM}${sep}stage=${encodeURIComponent(code)}`;
}

async function readBody(req) {
  if (req.body != null) {
    return typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  }
  if (typeof req.on !== 'function') return '{}';
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks.map((c) => (Buffer.isBuffer(c) ? c : Buffer.from(c)))).toString('utf8');
  return text || '{}';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (!UPSTREAM || UPSTREAM.includes('/api/catalog') || UPSTREAM.includes('/api/stage')) {
    res.status(500).json({ error: 'VITE_SHEETS_URL must be the Apps Script /exec URL.' });
    return;
  }

  try {
    let upstream;
    if (req.method === 'GET') {
      const code = stageCode(req);
      if (!code) {
        res.status(400).json({ error: 'Missing stage code (s or stage).' });
        return;
      }
      upstream = await fetch(execUrl(code), { redirect: 'follow' });
    } else if (req.method === 'POST') {
      const body = await readBody(req);
      upstream = await fetch(UPSTREAM, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
    } else {
      res.status(405).json({ error: 'GET or POST only' });
      return;
    }

    const text = await upstream.text();
    if (text.trim().startsWith('<')) {
      res.status(502).json({ error: 'Sheet URL asked for a Google login. Redeploy the web app as Anyone.' });
      return;
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(upstream.ok ? 200 : upstream.status).send(text);
  } catch (error) {
    res.status(502).json({ error: error.message || 'Stage proxy failed.' });
  }
}
