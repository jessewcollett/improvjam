import {
  gameIdsFromItems,
  itemsFromGames,
  normalizeSetItem,
  SET_ITEM_MAX,
} from './setItems.js';
import { stageMessageHtml, stageMessageText } from './stageMessage.js';

export const SHARE_TOKEN_MAX = 1800;
export const SHARE_CODE_LEN = 5;
export const SHARE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const SHARE_CODE_RE = new RegExp(`^[${SHARE_ALPHABET}]{${SHARE_CODE_LEN}}$`, 'i');
const SHARE_FETCH_TIMEOUT_MS = 8000;

function encodeJson(data) {
  const json = JSON.stringify(data);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  bytes.forEach((byte) => {
    bin += String.fromCharCode(byte);
  });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function serializeShareItem(item, includeMessage) {
  const next = normalizeSetItem(item);
  if (!next) return null;
  if (next.type === 'game') {
    const row = { t: 'g', id: next.id };
    if (next.terms?.length) row.k = next.terms;
    return row;
  }
  if (next.type === 'term') return { t: 't', id: next.id };
  if (next.type === 'message') {
    if (!includeMessage) return null;
    const text = stageMessageText(next.message);
    if (!text) return null;
    const html = stageMessageHtml(next.message);
    return html ? { t: 'm', x: text, h: html } : { t: 'm', x: text };
  }
  return null;
}

function deserializeShareItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const kind = String(raw.t || raw.type || '').trim();
  if (kind === 'g' || kind === 'game') {
    return normalizeSetItem({ type: 'game', id: raw.id, terms: raw.k || raw.terms });
  }
  if (kind === 't' || kind === 'term') {
    return normalizeSetItem({ type: 'term', id: raw.id });
  }
  if (kind === 'm' || kind === 'message') {
    return normalizeSetItem({
      type: 'message',
      id: raw.id,
      message: raw.message || (raw.h || raw.x ? { html: raw.h, text: raw.x } : raw.x),
    });
  }
  return null;
}

function shareNeedsV2(items) {
  return (items || []).some((item) => item.type !== 'game' || (item.terms && item.terms.length));
}

export function encodeSharedSet({ name, ids, items } = {}) {
  const n = String(name || '').trim().slice(0, 80);
  const normalized = Array.isArray(items) && items.length
    ? items.map(normalizeSetItem).filter(Boolean).slice(0, SET_ITEM_MAX)
    : itemsFromGames(ids).slice(0, SET_ITEM_MAX);
  if (shareNeedsV2(normalized)) {
    const withMessages = normalized.map((item) => serializeShareItem(item, true)).filter(Boolean);
    let token = encodeJson({ v: 2, n, i: withMessages });
    if (token.length <= SHARE_TOKEN_MAX) return token;
    const noMessages = normalized
      .filter((item) => item.type !== 'message')
      .map((item) => serializeShareItem(item, false))
      .filter(Boolean);
    token = encodeJson({ v: 2, n, i: noMessages });
    if (token.length <= SHARE_TOKEN_MAX) return token;
  }
  const g = (normalized.length ? gameIdsFromItems(normalized) : uniqueShareIds(ids)).slice(0, SET_ITEM_MAX);
  return encodeJson({ v: 1, n, g });
}

function uniqueShareIds(ids) {
  return (Array.isArray(ids) ? ids : []).map((id) => String(id || '').trim()).filter(Boolean);
}

function unwrapShareToken(raw) {
  const token = String(raw || '').trim();
  if (!token) return '';
  try {
    return decodeURIComponent(token).trim();
  } catch {
    return token;
  }
}

function compactShareChunk(raw) {
  return unwrapShareToken(raw).replace(/-\s+/g, '').replace(/\s+/g, '');
}

export function isShareCode(raw) {
  return SHARE_CODE_RE.test(String(raw || '').trim());
}

function peelShareValue(value) {
  const v = unwrapShareToken(value).replace(/^=+/, '');
  if (!v) return '';
  if (/^eyJ/.test(v)) {
    const bare = v.match(/eyJ[A-Za-z0-9_-]+/);
    return bare ? bare[0] : v;
  }
  const code = v.slice(0, SHARE_CODE_LEN);
  if (isShareCode(code)) return code.toUpperCase();
  return v;
}

export function sharedSetTokenFromInput(raw) {
  let text = String(raw || '').trim().replace(/^["']+|["']+$/g, '');
  if (!text) return '';
  text = text.replace(/improv jam set:\s*.*$/gim, '').trim();
  text = text.replace(/-\s*\n\s*/g, '');
  const compact = compactShareChunk(text).replace(/improvjamset:.*$/i, '');
  const fromQuery = compact.match(/[?&]set=([^&#"'<>]+)/i) || compact.match(/(?:^|\/)set=([^&#"'<>]+)/i);
  if (fromQuery) return peelShareValue(fromQuery[1]);
  const token = peelShareValue(compact);
  if (token) return token;
  const bare = compact.replace(/^=+/, '').match(/eyJ[A-Za-z0-9_-]+/);
  return bare ? bare[0] : compact.replace(/^=+/, '');
}

function abortAfter(ms) {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    clear: () => globalThis.clearTimeout(timer),
  };
}

function shareOrigin(origin) {
  return String(origin || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/, '');
}

export function decodeSharedSet(raw) {
  const token = sharedSetTokenFromInput(raw);
  if (!token || isShareCode(token)) return null;
  try {
    const padded = token.replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
    const bin = atob(padded + pad);
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const data = JSON.parse(json);
    if (!data || typeof data !== 'object') return null;
    const name = String(data.n || 'Shared set').trim() || 'Shared set';
    if (Number(data.v) === 2 || Array.isArray(data.i)) {
      const items = (Array.isArray(data.i) ? data.i : []).map(deserializeShareItem).filter(Boolean).slice(0, SET_ITEM_MAX);
      if (!items.length) return null;
      return { name, items, ids: gameIdsFromItems(items) };
    }
    const ids = uniqueShareIds(data.g).slice(0, SET_ITEM_MAX);
    if (!ids.length) return null;
    return { name, ids, items: itemsFromGames(ids) };
  } catch {
    return null;
  }
}

export function sharedSetUrl(payload, origin) {
  const token = encodeSharedSet(payload);
  if (!token) return '';
  return `${shareOrigin(origin)}/?set=${encodeURIComponent(token)}`;
}

export function sharedSetCodeUrl(code, origin) {
  const key = String(code || '').trim().toUpperCase();
  if (!isShareCode(key)) return '';
  return `${shareOrigin(origin)}/?set=${encodeURIComponent(key)}`;
}

async function postShareToken(token) {
  const abort = abortAfter(SHARE_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch('/api/share', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      signal: abort.signal,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.code) return '';
    return String(data.code);
  } catch {
    return '';
  } finally {
    abort.clear();
  }
}

async function fetchShareToken(code) {
  const abort = abortAfter(SHARE_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`/api/share?c=${encodeURIComponent(code)}`, {
      cache: 'no-store',
      signal: abort.signal,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.token) return '';
    return String(data.token);
  } catch {
    return '';
  } finally {
    abort.clear();
  }
}

export async function createSharedSetLink(payload, origin) {
  const token = encodeSharedSet(payload);
  if (!token) return '';
  const code = await postShareToken(token);
  if (code) return sharedSetCodeUrl(code, origin);
  return `${shareOrigin(origin)}/?set=${encodeURIComponent(token)}`;
}

export async function resolveSharedSet(raw) {
  const token = sharedSetTokenFromInput(raw);
  if (!token) return null;
  if (isShareCode(token)) {
    const remote = await fetchShareToken(token);
    return remote ? decodeSharedSet(remote) : null;
  }
  return decodeSharedSet(token);
}
