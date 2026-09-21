const UPSTREAM = process.env.VITE_SHEETS_URL || '';
const STAGE_TTL_SEC = 60 * 60 * 24;

const memory = globalThis.__improvStageMemory || new Map();
globalThis.__improvStageMemory = memory;

function stageCode(req) {
  return String(req.query?.s || req.query?.stage || '').trim();
}

function execUrl(code) {
  const sep = UPSTREAM.includes('?') ? '&' : '?';
  return `${UPSTREAM}${sep}stage=${encodeURIComponent(code)}`;
}

function kvConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ''), token };
}

function emptyRecord(code) {
  return {
    code: String(code || ''),
    payload: {},
    ideas: {},
    ideasPending: {},
    ideaCats: [],
    ideasOpen: false,
    ideasUse: false,
    ideasHold: false,
    updatedAt: '',
  };
}

function ideaEntry(raw) {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    const text = raw.trim();
    return text ? { text } : null;
  }
  const text = String(raw.text || '').trim();
  if (!text) return null;
  return raw.flag === 'nsfw' ? { text, flag: 'nsfw' } : { text };
}

function ideaList(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  raw.forEach((item) => {
    const entry = ideaEntry(item);
    if (!entry) return;
    const id = entry.text.toLowerCase();
    if (seen.has(id)) return;
    seen.add(id);
    out.push(entry);
  });
  return out.slice(-200);
}

function normalizeIdeas(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  Object.entries(raw).forEach(([cat, rows]) => {
    const key = String(cat || '').trim();
    if (!key) return;
    out[key] = ideaList(rows);
  });
  return out;
}

function mergeIdeas(current, incoming) {
  const out = { ...normalizeIdeas(current) };
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return out;
  Object.entries(incoming).forEach(([cat, rows]) => {
    const key = String(cat || '').trim();
    if (!key) return;
    const prev = ideaList(out[key]);
    const seen = new Set(prev.map((row) => row.text.toLowerCase()));
    ideaList(rows).forEach((entry) => {
      const id = entry.text.toLowerCase();
      if (seen.has(id)) return;
      seen.add(id);
      prev.push(entry);
    });
    out[key] = prev.slice(-200);
  });
  return out;
}

function ideaCats(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  raw.forEach((id) => {
    const key = String(id || '').trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(key);
  });
  return out;
}

function normalizeRecord(code, raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyRecord(code);
  const payload = raw.payload && typeof raw.payload === 'object' && !Array.isArray(raw.payload)
    ? raw.payload
    : {};
  return {
    code: String(raw.code || code || ''),
    payload,
    ideas: normalizeIdeas(raw.ideas),
    ideasPending: normalizeIdeas(raw.ideasPending),
    ideaCats: ideaCats(raw.ideaCats),
    ideasOpen: raw.ideasOpen === true,
    ideasUse: raw.ideasUse === true,
    ideasHold: raw.ideasHold === true,
    updatedAt: String(raw.updatedAt || ''),
  };
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
    const result = await kvCommand(['GET', `stage:${code}`]);
    if (result == null || result === '') return null;
    const parsed = typeof result === 'string' ? JSON.parse(result) : result;
    return normalizeRecord(code, parsed);
  } catch {
    return null;
  }
}

async function kvSet(code, record) {
  try {
    await kvCommand(['SET', `stage:${code}`, JSON.stringify(record), 'EX', String(STAGE_TTL_SEC)]);
  } catch {
    /* optional store */
  }
}

function remember(code, record) {
  memory.set(code, record);
}

async function readLocal(code) {
  if (memory.has(code)) return memory.get(code);
  const fromKv = await kvGet(code);
  if (fromKv) {
    remember(code, fromKv);
    return fromKv;
  }
  return null;
}

function persistScript(method, url, body) {
  if (!UPSTREAM || UPSTREAM.includes('/api/catalog') || UPSTREAM.includes('/api/stage')) return;
  fetch(url, {
    method,
    redirect: 'follow',
    keepalive: true,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body,
  }).catch(() => {});
}

function loginPage(text) {
  return Boolean(text && text.trim().startsWith('<'));
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
      const code = stageCode(req);
      if (!code) {
        res.status(400).json({ error: 'Missing stage code (s or stage).' });
        return;
      }
      const local = await readLocal(code);
      if (local) {
        res.status(200).json(local);
        return;
      }
      if (UPSTREAM && !UPSTREAM.includes('/api/catalog') && !UPSTREAM.includes('/api/stage')) {
        const upstream = await fetch(execUrl(code), { redirect: 'follow', cache: 'no-store' });
        const text = await upstream.text();
        if (loginPage(text)) {
          res.status(200).json(emptyRecord(code));
          return;
        }
        let parsed = emptyRecord(code);
        try {
          parsed = normalizeRecord(code, JSON.parse(text));
        } catch {
          res.status(200).json(emptyRecord(code));
          return;
        }
        const payload = parsed.payload || {};
        if (Array.isArray(payload.order) || Object.keys(payload).length > 0) {
          remember(code, parsed);
        }
        res.status(upstream.ok ? 200 : upstream.status).json(parsed);
        return;
      }
      res.status(200).json(emptyRecord(code));
      return;
    }

    if (req.method === 'POST') {
      const raw = await readBody(req);
      let body = {};
      try {
        body = JSON.parse(raw || '{}');
      } catch {
        body = {};
      }
      const code = String(body.code || '').trim();
      if (!code) {
        res.status(400).json({ error: 'Missing code', code: '', payload: {}, ideas: {}, ideasPending: {}, ideaCats: [], ideasOpen: false, ideasUse: false, ideasHold: false, updatedAt: '' });
        return;
      }
      const prev = normalizeRecord(code, (await readLocal(code)) || emptyRecord(code));
      const record = {
        ...prev,
        code,
        updatedAt: new Date().toISOString(),
      };
      if (Object.prototype.hasOwnProperty.call(body, 'payload')) {
        record.payload = body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)
          ? body.payload
          : {};
      }
      if (Object.prototype.hasOwnProperty.call(body, 'ideasOpen')) {
        record.ideasOpen = body.ideasOpen === true;
      }
      if (Object.prototype.hasOwnProperty.call(body, 'ideasUse')) {
        record.ideasUse = body.ideasUse === true;
      }
      if (Object.prototype.hasOwnProperty.call(body, 'ideasHold')) {
        record.ideasHold = body.ideasHold === true;
      }
      if (Array.isArray(body.ideaCats)) {
        record.ideaCats = ideaCats(body.ideaCats);
      }
      const hostWrite = Object.prototype.hasOwnProperty.call(body, 'payload');
      if (hostWrite) {
        if (Object.prototype.hasOwnProperty.call(body, 'ideas') && body.ideas && typeof body.ideas === 'object' && !Array.isArray(body.ideas)) {
          record.ideas = normalizeIdeas(body.ideas);
        }
        if (Object.prototype.hasOwnProperty.call(body, 'ideasPending') && body.ideasPending && typeof body.ideasPending === 'object' && !Array.isArray(body.ideasPending)) {
          record.ideasPending = normalizeIdeas(body.ideasPending);
        }
      } else if (body.ideas && typeof body.ideas === 'object' && !Array.isArray(body.ideas)) {
        if (record.ideasOpen || body.ideasOpen === true) {
          const target = record.ideasHold ? 'ideasPending' : 'ideas';
          record[target] = mergeIdeas(prev[target], body.ideas);
        }
      }
      remember(code, record);
      await kvSet(code, record);
      res.status(200).json(record);
      persistScript('POST', UPSTREAM, JSON.stringify({ code, payload: record.payload }));
      return;
    }

    res.status(405).json({ error: 'GET or POST only' });
  } catch (error) {
    res.status(502).json({ error: error.message || 'Stage proxy failed.' });
  }
}
