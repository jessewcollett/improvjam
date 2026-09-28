const SHARE_TTL_SEC = 60 * 60 * 24 * 30;
const SHARE_CODE_LEN = 5;
const SHARE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SHARE_TOKEN_MAX = 1800;
const SHARE_CODE_RE = new RegExp(`^[${SHARE_ALPHABET}]{${SHARE_CODE_LEN}}$`);
const TOKEN_RE = /^eyJ[A-Za-z0-9_-]+$/;

const memory = globalThis.__improvShareMemory || new Map();
globalThis.__improvShareMemory = memory;

function kvConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ''), token };
}

function shareCode(req) {
  return String(req.query?.c || req.query?.code || req.query?.set || '')
    .trim()
    .toUpperCase();
}

async function kvCommand(args) {
  const kv = kvConfig();
  if (!kv) return null;
  const res = await fetch(kv.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${kv.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data && Object.prototype.hasOwnProperty.call(data, 'result') ? data.result : data;
}

async function kvGet(code) {
  try {
    const result = await kvCommand(['GET', `setshare:${code}`]);
    if (result == null || result === '') return null;
    return typeof result === 'string' ? result : String(result);
  } catch {
    return null;
  }
}

async function kvSet(code, token) {
  try {
    await kvCommand(['SET', `setshare:${code}`, token, 'EX', String(SHARE_TTL_SEC)]);
  } catch {
    /* optional store */
  }
}

async function readToken(code) {
  if (memory.has(code)) return memory.get(code);
  const fromKv = await kvGet(code);
  if (fromKv) {
    memory.set(code, fromKv);
    return fromKv;
  }
  return '';
}

function mintCode() {
  const bytes = new Uint8Array(SHARE_CODE_LEN);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < SHARE_CODE_LEN; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  let code = '';
  for (let i = 0; i < SHARE_CODE_LEN; i += 1) code += SHARE_ALPHABET[bytes[i] % SHARE_ALPHABET.length];
  return code;
}

function normalizeToken(raw) {
  const token = String(raw || '').trim();
  if (!TOKEN_RE.test(token) || token.length > SHARE_TOKEN_MAX) return '';
  return token;
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

  try {
    if (req.method === 'GET') {
      const code = shareCode(req);
      if (!SHARE_CODE_RE.test(code)) {
        res.status(400).json({ error: 'Missing share code.' });
        return;
      }
      const token = await readToken(code);
      if (!token) {
        res.status(404).json({ error: 'Unknown share code.' });
        return;
      }
      res.status(200).json({ code, token });
      return;
    }

    if (req.method === 'POST') {
      let body = {};
      try {
        body = JSON.parse(await readBody(req));
      } catch {
        body = {};
      }
      const token = normalizeToken(body.token);
      if (!token) {
        res.status(400).json({ error: 'Missing share token.' });
        return;
      }
      for (let i = 0; i < 8; i += 1) {
        const code = mintCode();
        if (await readToken(code)) continue;
        memory.set(code, token);
        await kvSet(code, token);
        res.status(200).json({ code, token });
        return;
      }
      res.status(500).json({ error: 'Couldn’t mint a share code.' });
      return;
    }

    res.status(405).json({ error: 'GET or POST only' });
  } catch (error) {
    res.status(502).json({ error: error.message || 'Share lookup failed.' });
  }
}
