import { splitList } from './generator.js';

export const MUSIC_GENRE_PRESETS = [
  'Pop',
  'Rock',
  'Jazz',
  'Funk',
  'Soul',
  'Hip-Hop',
  'Electronic',
  'Disco',
  'Reggae',
  'Folk',
  'Country',
  'R&B',
  '80s',
  '90s',
  'Ballad',
  'Upbeat',
  'Slow',
  'Underscore',
  'Comedy',
  'World',
];

export const UNTAGGED_FILTER = '__untagged__';

const NAME_GENRE_HINTS = [
  [/80/, '80s'],
  [/90/, '90s'],
  [/alt\.?\s*pop|pop/i, 'Pop'],
  [/funk/i, 'Funk'],
  [/ballad/i, 'Ballad'],
  [/disco/i, 'Disco'],
  [/grunge|acid\s*rock|rock/i, 'Rock'],
  [/ho\s*down|cowboy|country/i, 'Country'],
  [/reggae/i, 'Reggae'],
  [/swing/i, 'Jazz'],
  [/r\s*&?\s*b|rnb/i, 'R&B'],
  [/rap|hip-?\s*hop|gangsta/i, 'Hip-Hop'],
  [/irish|world/i, 'World'],
  [/doo\s*wop/i, 'Pop'],
  [/folk/i, 'Folk'],
  [/dance|club|electronic/i, 'Electronic'],
  [/surf/i, 'Rock'],
  [/show\s*tune/i, 'Pop'],
];

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
  return uniqueTags([
    ...splitList(row?.tags),
    ...splitList(row?.genre),
    ...splitList(row?.genres),
  ]);
}

export function inferredTagsFromName(name) {
  const raw = String(name || '')
    .replace(/\.[a-z0-9]{2,4}$/i, '')
    .replace(/^\d+[-_\s]+/, '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2');
  if (!raw.trim()) return [];
  return uniqueTags(NAME_GENRE_HINTS.filter(([pattern]) => pattern.test(raw)).map(([, tag]) => tag));
}

export function tagsForTrack(track, musicTags = {}) {
  const local = track?.id ? musicTags?.[track.id] : null;
  if (Array.isArray(local)) return uniqueTags(local);
  const sheet = uniqueTags(track?.tags);
  if (sheet.length) return sheet;
  return inferredTagsFromName(track?.name);
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
