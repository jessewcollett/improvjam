import {
  gameIdsFromItems,
  itemsFromGames,
  normalizeSetItem,
  SET_ITEM_MAX,
} from './setItems.js';
import { stageMessageHtml, stageMessageText } from './stageMessage.js';

const SHARE_TOKEN_MAX = 1800;

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

export function sharedSetTokenFromInput(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  try {
    const url = new URL(text, 'https://improv-jam.vercel.app');
    const fromQuery = url.searchParams.get('set');
    if (fromQuery) return String(fromQuery).trim();
  } catch {
    /* not a URL */
  }
  const match = text.match(/[?&]set=([^&\s#]+)/i);
  if (match) {
    try {
      return decodeURIComponent(match[1]).trim();
    } catch {
      return match[1].trim();
    }
  }
  return text;
}

export function decodeSharedSet(raw) {
  const token = sharedSetTokenFromInput(raw);
  if (!token) return null;
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

export function sharedSetUrl(payload, origin = typeof window !== 'undefined' ? window.location.origin : '') {
  const token = encodeSharedSet(payload);
  if (!token) return '';
  const base = String(origin || '').replace(/\/+$/, '');
  return `${base}/?set=${encodeURIComponent(token)}`;
}
