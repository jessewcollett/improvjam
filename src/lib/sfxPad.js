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
    .filter((row) => row && row.kind !== 'track')
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
  return sheetAudio.filter((row) => row && row.enabled !== false && row.kind === 'track' && (row.playUrl || row.url));
}

export const SFX_SLOT_COUNT = 8;
export const defaultSfxSlots = ['counter', 'ringing', 'bell', 'ding', null, null, null, null];

export function normalizeSfxSlots(raw, fallbackOrder = [], hidden = []) {
  if (Array.isArray(raw) && raw.some((id) => id)) {
    const slots = raw.slice(0, SFX_SLOT_COUNT).map((id) => (id ? String(id) : null));
    while (slots.length < SFX_SLOT_COUNT) slots.push(null);
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
