const UPSTREAM = process.env.VITE_SHEETS_URL || '';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const memory = globalThis.__improvProfileMemory || new Map();
globalThis.__improvProfileMemory = memory;

function profileId(req, body) {
  return String(
    (body && (body.id || body.code))
    || req.query?.u
    || req.query?.id
    || req.query?.profile
    || req.query?.user
    || '',
  ).trim();
}

function execUrl(id) {
  const sep = UPSTREAM.includes('?') ? '&' : '?';
  return `${UPSTREAM}${sep}profile=${encodeURIComponent(id)}`;
}

function emptyRecord(id) {
  return { id: String(id || ''), payload: {}, updatedAt: '', miss: true };
}

function loginPage(text) {
  return Boolean(text && text.trim().startsWith('<'));
}

function profileHasLists(payload) {
  const lists = payload?.lists;
  if (!lists || typeof lists !== 'object') return false;
  if (lists.customSets?.length) return true;
  if (lists.favorites?.length) return true;
  if (lists.toPlay?.length) return true;
  if (lists.played?.length) return true;
  if (lists.learned?.length) return true;
  return false;
}

function incomingWouldWipe(existing, incoming) {
  if (!profileHasLists(existing)) return false;
  if (!profileHasLists(incoming)) return true;
  const aSets = existing?.lists?.customSets?.length || 0;
  const bSets = incoming?.lists?.customSets?.length || 0;
  return aSets > 0 && bSets === 0;
}

function normalizeRecord(id, raw) {
  const payload = raw && raw.payload && typeof raw.payload === 'object' && !Array.isArray(raw.payload)
    ? raw.payload
    : {};
  const updatedAt = String(raw?.updatedAt || '');
  const miss = !updatedAt && (!payload || Object.keys(payload).length === 0);
  return {
    id: String(id || raw?.id || ''),
    payload,
    updatedAt,
    miss,
    kept: raw?.kept === true,
    minted: raw?.minted === true,
  };
}

function mintLocalId() {
  let id = '';
  for (let i = 0; i < 6; i += 1) id += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return id;
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

function usableUpstream() {
  return Boolean(UPSTREAM && !UPSTREAM.includes('/api/catalog') && !UPSTREAM.includes('/api/profile'));
}

async function fetchUpstream(id) {
  if (!usableUpstream()) return null;
  const upstream = await fetch(execUrl(id), { redirect: 'follow', cache: 'no-store' });
  const text = await upstream.text();
  if (loginPage(text)) return null;
  try {
    return normalizeRecord(id, JSON.parse(text));
  } catch {
    return null;
  }
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
      const id = profileId(req);
      if (!id) {
        res.status(400).json({ error: 'Missing profile id.', ...emptyRecord('') });
        return;
      }
      const fromSheet = await fetchUpstream(id);
      if (fromSheet && !fromSheet.miss) {
        memory.set(id, fromSheet);
        res.status(200).json(fromSheet);
        return;
      }
      if (memory.has(id) && !incomingWouldWipe(memory.get(id).payload, fromSheet?.payload || {})) {
        res.status(200).json(memory.get(id));
        return;
      }
      res.status(200).json(fromSheet || memory.get(id) || emptyRecord(id));
      return;
    }

    if (req.method === 'POST') {
      let body = {};
      try {
        body = JSON.parse(await readBody(req));
      } catch {
        body = {};
      }

      if (body.mint === true) {
        if (usableUpstream()) {
          const upstream = await fetch(UPSTREAM, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind: 'profile', mint: true }),
          });
          const text = await upstream.text();
          if (!loginPage(text)) {
            try {
              const parsed = JSON.parse(text);
              const id = String(parsed?.id || '').trim();
              if (id && !parsed.error) {
                const record = normalizeRecord(id, parsed);
                memory.set(id, record);
                res.status(200).json(record);
                return;
              }
            } catch {
              /* fall through to local mint */
            }
          }
        }
        const id = mintLocalId();
        const record = { id, payload: {}, updatedAt: new Date().toISOString(), miss: false, minted: true };
        memory.set(id, record);
        res.status(200).json(record);
        return;
      }

      const id = profileId(req, body);
      if (!id) {
        res.status(400).json({ error: 'Missing id', ...emptyRecord('') });
        return;
      }
      const payload = body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)
        ? body.payload
        : {};
      const existing = memory.get(id) || await fetchUpstream(id);
      if (existing && incomingWouldWipe(existing.payload, payload)) {
        res.status(200).json({ ...existing, kept: true, miss: false });
        return;
      }
      const record = {
        id,
        payload,
        updatedAt: new Date().toISOString(),
        miss: false,
      };
      memory.set(id, record);
      if (!usableUpstream()) {
        res.status(200).json(record);
        return;
      }
      const upstream = await fetch(UPSTREAM, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'profile', id, payload }),
      });
      const text = await upstream.text();
      if (loginPage(text)) {
        res.status(502).json({ error: 'Sheet URL asked for a Google login. Redeploy the web app as Anyone.', ...record });
        return;
      }
      try {
        const parsed = JSON.parse(text);
        if (parsed?.kept) {
          const kept = normalizeRecord(id, parsed);
          memory.set(id, kept);
          res.status(200).json(kept);
          return;
        }
        if (parsed?.error) {
          res.status(502).json({ error: parsed.error, ...record });
          return;
        }
        if (parsed?.updatedAt) record.updatedAt = String(parsed.updatedAt);
      } catch {
        /* keep memory timestamp */
      }
      memory.set(id, record);
      res.status(200).json(record);
      return;
    }

    res.status(405).json({ error: 'GET or POST only' });
  } catch (error) {
    res.status(502).json({ error: error.message || 'Profile sync failed.' });
  }
}
