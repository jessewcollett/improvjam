const MAX_BYTES = 25 * 1024 * 1024;

const ALLOWED_HOSTS = [
  /(^|\.)google\.com$/i,
  /(^|\.)googleapis\.com$/i,
  /(^|\.)googleusercontent\.com$/i,
  /(^|\.)gstatic\.com$/i,
  /(^|\.)freesound\.org$/i,
];

function hostAllowed(hostname) {
  const host = String(hostname || '').toLowerCase();
  return ALLOWED_HOSTS.some((re) => re.test(host));
}

function driveId(value) {
  const raw = String(value || '').trim();
  if (/^[a-zA-Z0-9_-]{20,}$/.test(raw)) return raw;
  const match = raw.match(/\/d\/([a-zA-Z0-9_-]{10,})/) || raw.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  return match ? match[1] : '';
}

const EXT_TYPES = {
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
  aac: 'audio/aac',
};

function typeFromName(name) {
  const match = String(name || '').toLowerCase().match(/\.([a-z0-9]+)(?:["'\s;?#]|$)/);
  return (match && EXT_TYPES[match[1]]) || '';
}

function guessType(buffer, names = []) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png';
  }
  if (buffer.length >= 6 && buffer.slice(0, 6).toString() === 'GIF87a') return 'image/gif';
  if (buffer.length >= 6 && buffer.slice(0, 6).toString() === 'GIF89a') return 'image/gif';
  if (buffer.length >= 12 && buffer.slice(8, 12).toString() === 'WEBP') return 'image/webp';
  if (
    buffer.length >= 12
    && buffer.slice(0, 4).toString() === 'RIFF'
    && buffer.slice(8, 12).toString() === 'WAVE'
  ) {
    return 'audio/wav';
  }
  if (buffer.length >= 3 && buffer.slice(0, 3).toString() === 'ID3') return 'audio/mpeg';
  if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return 'audio/mpeg';
  for (const name of names) {
    const fromExt = typeFromName(name);
    if (fromExt) return fromExt;
  }
  return 'application/octet-stream';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET only' });
    return;
  }

  const queryId = String(req.query?.id || '');
  const queryUrl = String(req.query?.url || '');
  const fileId = driveId(queryId) || driveId(queryUrl);
  let target = '';

  if (fileId) {
    target = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}&confirm=t`;
  } else if (queryUrl) {
    let parsed;
    try {
      parsed = new URL(queryUrl);
    } catch {
      res.status(400).json({ error: 'Bad url' });
      return;
    }
    if (!/^https?:$/.test(parsed.protocol) || !hostAllowed(parsed.hostname)) {
      res.status(400).json({ error: 'Host not allowed' });
      return;
    }
    target = parsed.toString();
  } else {
    res.status(400).json({ error: 'Missing id or url' });
    return;
  }

  try {
    const upstream = await fetch(target, {
      redirect: 'follow',
      headers: { 'User-Agent': 'ImprovJam/1.0' },
    });
    const type = upstream.headers.get('content-type') || '';
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: `Upstream ${upstream.status}` });
      return;
    }
    if (type.includes('text/html')) {
      res.status(502).json({ error: 'Drive returned a login or virus-scan page. Set the file to Anyone with the link.' });
      return;
    }
    const length = Number(upstream.headers.get('content-length') || 0);
    if (length > MAX_BYTES) {
      res.status(413).json({ error: 'File too large' });
      return;
    }
    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.length > MAX_BYTES) {
      res.status(413).json({ error: 'File too large' });
      return;
    }
    const disposition = upstream.headers.get('content-disposition') || '';
    const guessed = guessType(buffer, [queryUrl, target, disposition]);
    res.setHeader('Content-Type', type && !type.includes('octet-stream') ? type : guessed);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).send(buffer);
  } catch (error) {
    res.status(502).json({ error: error.message || 'Media proxy failed' });
  }
}
