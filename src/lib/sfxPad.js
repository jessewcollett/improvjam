import { BELL_STYLES } from './audio.js';
import { playbackUrl } from './mediaUrl.js';

const BUNDLED_META = {
  counter: {
    icon: 'bell',
    credit: 'Alva Majo (5ro4), CC0',
    creditUrl: 'https://freesound.org/people/5ro4/sounds/611113/',
  },
  ringing: {
    icon: 'bell-ring',
    credit: 'designerschoice / Nicholas Judy, CC BY',
    creditUrl: 'https://freesound.org/people/designerschoice/sounds/804750/',
  },
  bell: { icon: 'bell', credit: 'Built-in synth' },
  chime: { icon: 'sparkles', credit: 'Built-in synth' },
  buzz: { icon: 'zap', credit: 'Built-in synth' },
  ding: { icon: 'bell', credit: 'Built-in synth' },
  gong: { icon: 'disc-3', credit: 'Built-in synth' },
  clave: { icon: 'drum', credit: 'Built-in synth' },
  whoosh: { icon: 'wind', credit: 'Built-in synth' },
  wrong: { icon: 'megaphone', credit: 'Built-in synth' },
  right: { icon: 'circle-dot', credit: 'Built-in synth' },
  triangle: { icon: 'triangle', credit: 'Built-in synth' },
};

export function bundledSfxPads() {
  return BELL_STYLES.map((style) => {
    const meta = BUNDLED_META[style.id] || { icon: 'bell', credit: 'Built-in synth' };
    return {
      id: style.id,
      name: style.label,
      kind: 'sfx',
      hint: style.hint,
      icon: meta.icon,
      credit: meta.credit,
      creditUrl: meta.creditUrl || '',
      notes: style.hint,
      url: '',
      playUrl: '',
      bundled: true,
      styleId: style.id,
      enabled: true,
    };
  });
}

export function mergeSfxPads(sheetAudio = []) {
  const pads = new Map(bundledSfxPads().map((pad) => [pad.id, pad]));
  sheetAudio
    .filter((row) => row && String(row.kind || '').toLowerCase() !== 'track')
    .forEach((row) => {
      if (row.enabled === false) {
        pads.delete(row.id);
        return;
      }
      const existing = pads.get(row.id);
      const playUrl = row.playUrl || playbackUrl(row.url);
      if (existing) {
        pads.set(row.id, {
          ...existing,
          name: row.name || existing.name,
          icon: row.icon || existing.icon,
          credit: row.credit || existing.credit,
          creditUrl: row.creditUrl || existing.creditUrl,
          notes: row.notes || existing.notes,
          url: row.url || existing.url,
          playUrl: playUrl || existing.playUrl,
        });
        return;
      }
      if (!playUrl) return;
      pads.set(row.id, {
        id: row.id,
        name: row.name,
        kind: 'sfx',
        hint: row.notes,
        icon: row.icon || 'bell',
        credit: row.credit,
        creditUrl: row.creditUrl,
        notes: row.notes,
        url: row.url,
        playUrl,
        bundled: false,
        styleId: null,
        enabled: true,
      });
    });
  return [...pads.values()];
}

export function sheetTracks(sheetAudio = []) {
  return sheetAudio.filter((row) => {
    if (!row || row.enabled === false) return false;
    const kind = String(row.kind || '').toLowerCase();
    return kind === 'track' && (row.playUrl || row.url);
  });
}

export const SFX_SLOT_MIN = 4;
export const SFX_SLOT_MAX = 16;
export const SFX_SLOT_COUNT = 8;
export const defaultSfxSlots = ['counter', 'ringing', 'bell', 'ding', null, null, null, null];

export const PAD_COLOR_IDS = ['slate', 'yellow', 'red', 'orange', 'green', 'teal', 'blue', 'purple', 'pink'];

export const PAD_COLORS = {
  slate: {
    fill: 'bg-[#1A1A1A] text-gray-100 border-gray-700',
    empty: 'border-gray-600 text-gray-500',
    swatch: 'bg-gray-600',
  },
  yellow: {
    fill: 'bg-yellow-600 text-black border-yellow-400',
    empty: 'border-yellow-500 text-yellow-300',
    swatch: 'bg-yellow-500',
  },
  red: {
    fill: 'bg-red-700 text-white border-red-400',
    empty: 'border-red-500 text-red-300',
    swatch: 'bg-red-500',
  },
  orange: {
    fill: 'bg-orange-600 text-black border-orange-400',
    empty: 'border-orange-500 text-orange-300',
    swatch: 'bg-orange-500',
  },
  green: {
    fill: 'bg-green-700 text-white border-green-400',
    empty: 'border-green-500 text-green-300',
    swatch: 'bg-green-500',
  },
  teal: {
    fill: 'bg-teal-700 text-white border-teal-300',
    empty: 'border-teal-500 text-teal-300',
    swatch: 'bg-teal-500',
  },
  blue: {
    fill: 'bg-blue-700 text-white border-blue-400',
    empty: 'border-blue-500 text-blue-300',
    swatch: 'bg-blue-500',
  },
  purple: {
    fill: 'bg-purple-700 text-white border-purple-300',
    empty: 'border-purple-500 text-purple-300',
    swatch: 'bg-purple-500',
  },
  pink: {
    fill: 'bg-pink-600 text-black border-pink-300',
    empty: 'border-pink-400 text-pink-300',
    swatch: 'bg-pink-500',
  },
};

export function clampPadColor(value) {
  return PAD_COLOR_IDS.includes(value) ? value : 'slate';
}

export function normalizeSfxSlotColors(raw, slotCount) {
  const count = clampSfxSlotCount(slotCount);
  return Array.from({ length: count }, (_, i) => clampPadColor(Array.isArray(raw) ? raw[i] : ''));
}

export function padGridShape(count) {
  const n = clampSfxSlotCount(count);
  if (n <= 4) return { cols: 2, rows: 2 };
  if (n <= 6) return { cols: 3, rows: 2 };
  if (n <= 8) return { cols: 4, rows: 2 };
  if (n <= 12) return { cols: 4, rows: 3 };
  return { cols: 4, rows: 4 };
}

export function clampSfxSlotCount(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return SFX_SLOT_COUNT;
  return Math.min(SFX_SLOT_MAX, Math.max(SFX_SLOT_MIN, n));
}

export function normalizeSfxSlots(raw, fallbackOrder = [], hidden = []) {
  if (Array.isArray(raw) && raw.length) {
    const count = clampSfxSlotCount(raw.length);
    const slots = raw.slice(0, count).map((id) => (id ? String(id) : null));
    while (slots.length < count) slots.push(null);
    return slots;
  }
  const hiddenSet = new Set(hidden || []);
  const fromOrder = (fallbackOrder || []).filter((id) => id && !hiddenSet.has(id)).slice(0, SFX_SLOT_COUNT);
  if (fromOrder.length) {
    while (fromOrder.length < SFX_SLOT_COUNT) fromOrder.push(null);
    return fromOrder;
  }
  return [...defaultSfxSlots];
}

export function resolveDefaultPad(pads, defaultSfxId, bellStyle) {
  const byId = new Map(pads.map((pad) => [pad.id, pad]));
  return byId.get(defaultSfxId) || byId.get(bellStyle) || pads[0] || null;
}
