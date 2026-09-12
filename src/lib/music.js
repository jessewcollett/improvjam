import { splitList } from './generator.js';

export const UNTAGGED_FILTER = '__untagged__';

export function uniqueTags(values) {
  const seen = new Set();
  const out = [];
  (values || []).forEach((raw) => {
    const tag = String(raw || '').trim();
    if (!tag) return;
    const key = tag.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(tag);
  });
  return out;
}

export function sheetAudioTags(row) {
  const raw = row?.tags ?? row?.Tags ?? row?.tag ?? row?.Tag ?? '';
  return uniqueTags(splitList(raw));
}

/** Sheet tags, or an on-device edit overlay. Filename inference is disabled so Filter chips stay real. */
export function tagsForTrack(track, musicTags = {}) {
  const local = track?.id ? musicTags?.[track.id] : null;
  if (Array.isArray(local)) return uniqueTags(local);
  return uniqueTags(track?.tags);
}

export function toggleTagList(current, tag) {
  const next = String(tag || '').trim();
  if (!next) return uniqueTags(current);
  const key = next.toLowerCase();
  const list = uniqueTags(current);
  if (list.some((item) => item.toLowerCase() === key)) {
    return list.filter((item) => item.toLowerCase() !== key);
  }
  return [...list, next];
}

export function normalizeMusicTags(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const next = {};
  Object.entries(raw).forEach(([id, tags]) => {
    if (!id) return;
    next[id] = uniqueTags(tags);
  });
  return next;
}
