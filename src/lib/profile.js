import { BACKUP_KEYS, buildDeviceBackup } from './appStorage.js';
import { mergeLists } from './setItems.js';
import { STAGE_ALPHABET } from './stage.js';

export const USER_ID_LEN = 6;
export const PROFILE_NAME_MIN = 3;
export const PROFILE_NAME_MAX = 20;
export const GUEST_ID_RE = new RegExp(`^[${STAGE_ALPHABET}]{${USER_ID_LEN}}$`);
export const PROFILE_NAME_RE = /^[A-Z][A-Z0-9-]{2,19}$/;
export const PROFILE_PUSH_MS = 1600;

const SKIP_SETTINGS = new Set(['lastRoute', 'lastTool', 'stageOn', 'userId', 'profileNamed']);
const SKIP_KEYS = new Set(['generatorSessionBanks']);

export function mintUserId() {
  const bytes = new Uint8Array(USER_ID_LEN);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < USER_ID_LEN; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  let id = '';
  for (let i = 0; i < USER_ID_LEN; i += 1) id += STAGE_ALPHABET[bytes[i] % STAGE_ALPHABET.length];
  return id;
}

export function sanitizeUserIdInput(raw) {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .replace(/^-+/, '')
    .slice(0, PROFILE_NAME_MAX);
}

export function normalizeUserId(raw) {
  const id = sanitizeUserIdInput(raw);
  if (GUEST_ID_RE.test(id) || PROFILE_NAME_RE.test(id)) return id;
  return '';
}

export function profileUrl(id, origin = typeof window !== 'undefined' ? window.location.origin : '') {
  const code = normalizeUserId(id);
  if (!code || !origin) return '';
  return `${origin}/?u=${encodeURIComponent(code)}`;
}

export function buildProfilePayload(appState) {
  const backup = buildDeviceBackup(appState);
  const state = { ...(backup.state || {}) };
  SKIP_KEYS.forEach((key) => {
    delete state[key];
  });
  if (state.settings && typeof state.settings === 'object') {
    const settings = { ...state.settings };
    SKIP_SETTINGS.forEach((key) => {
      delete settings[key];
    });
    state.settings = settings;
  }
  BACKUP_KEYS.forEach((key) => {
    if (SKIP_KEYS.has(key)) delete state[key];
  });
  return state;
}

export function profileSignature(appState) {
  try {
    return JSON.stringify(buildProfilePayload(appState));
  } catch {
    return '';
  }
}

export function profileHasData(payload) {
  if (!payload || typeof payload !== 'object') return false;
  const lists = payload.lists;
  if (lists && typeof lists === 'object') {
    if ((lists.favorites || []).length) return true;
    if ((lists.toPlay || []).length) return true;
    if ((lists.played || []).length) return true;
    if ((lists.learned || []).length) return true;
    if ((lists.customSets || []).length) return true;
  }
  if (Array.isArray(payload.generatorBankFavorites) && payload.generatorBankFavorites.length) return true;
  if (payload.gameGeneratorLinks && Object.keys(payload.gameGeneratorLinks).length) return true;
  if (Array.isArray(payload.stagePins) && payload.stagePins.length) return true;
  if (Array.isArray(payload.sfxHidden) && payload.sfxHidden.length) return true;
  if (payload.musicTags && Object.keys(payload.musicTags).length) return true;
  return false;
}

function listCounts(payload) {
  const lists = payload?.lists && typeof payload.lists === 'object' ? payload.lists : {};
  const customSets = Array.isArray(lists.customSets) ? lists.customSets : [];
  return {
    sets: customSets.length,
    flags: (lists.favorites || []).length
      + (lists.toPlay || []).length
      + (lists.played || []).length
      + (lists.learned || []).length,
  };
}

export function incomingWouldWipe(existing, incoming) {
  if (!profileHasData(existing)) return false;
  if (!profileHasData(incoming)) return true;
  const a = listCounts(existing);
  const b = listCounts(incoming);
  return a.sets > 0 && b.sets === 0;
}

function isEmptyField(value) {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  if (typeof value === 'string') return !value.trim();
  return false;
}

export function mergeProfilePayload(local, remote) {
  const a = local && typeof local === 'object' ? local : {};
  const b = remote && typeof remote === 'object' ? remote : {};
  const keys = new Set([...BACKUP_KEYS, ...Object.keys(a), ...Object.keys(b)]);
  const out = {};
  keys.forEach((key) => {
    if (SKIP_KEYS.has(key) || key === 'lists' || key === 'settings') return;
    const left = a[key];
    const right = b[key];
    if (isEmptyField(right) && !isEmptyField(left)) out[key] = left;
    else if (isEmptyField(left) && !isEmptyField(right)) out[key] = right;
    else if (right !== undefined) out[key] = right;
    else out[key] = left;
  });
  out.lists = mergeLists(a.lists, b.lists);
  const leftSettings = a.settings && typeof a.settings === 'object' ? a.settings : {};
  const rightSettings = b.settings && typeof b.settings === 'object' ? b.settings : {};
  const settings = { ...leftSettings, ...rightSettings };
  SKIP_SETTINGS.forEach((key) => {
    delete settings[key];
  });
  out.settings = settings;
  return out;
}

export async function mintProfileId() {
  try {
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'profile', mint: true }),
    });
    const data = await res.json().catch(() => null);
    const id = normalizeUserId(data?.id);
    if (id) return id;
  } catch {
    /* offline — mint locally */
  }
  return mintUserId();
}

export async function fetchProfile(id) {
  const code = normalizeUserId(id);
  if (!code) return { id: '', payload: {}, updatedAt: '', miss: true };
  const res = await fetch(`/api/profile?u=${encodeURIComponent(code)}`, { cache: 'no-store' });
  const data = await res.json().catch(() => null);
  if (!res.ok && !data) throw new Error('Profile lookup failed.');
  return {
    id: code,
    payload: data?.payload && typeof data.payload === 'object' ? data.payload : {},
    updatedAt: String(data?.updatedAt || ''),
    miss: data?.miss === true || (!data?.updatedAt && !profileHasData(data?.payload)),
    kept: data?.kept === true,
    error: data?.error ? String(data.error) : '',
  };
}

export async function postProfile(id, payload) {
  const code = normalizeUserId(id);
  if (!code) throw new Error('Missing user id.');
  const res = await fetch('/api/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'profile', id: code, payload }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || 'Profile save failed.');
  return {
    id: code,
    payload: data?.payload && typeof data.payload === 'object' ? data.payload : payload,
    updatedAt: String(data?.updatedAt || new Date().toISOString()),
    kept: data?.kept === true,
  };
}
