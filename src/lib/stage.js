export const STAGE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const STAGE_SLOT_IDS = ['suggestions', 'games', 'timer', 'hat', 'coin', 'whosup', 'set', 'display', 'message'];
export const STAGE_CODE_RE = new RegExp(`^[${STAGE_ALPHABET}]{4,5}$`);

const SLOT_SET = new Set(STAGE_SLOT_IDS);

export function isStageSlotId(id) {
  return SLOT_SET.has(id);
}

export function normalizeStageSpotlight(raw, ids) {
  const key = String(raw || '').trim();
  if (!key || !isStageSlotId(key)) return '';
  if (Array.isArray(ids) && ids.length && !ids.includes(key)) return '';
  return key;
}

export function mintStageCode(length = 5) {
  const n = length === 4 ? 4 : 5;
  const bytes = new Uint8Array(n);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < n; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  let code = '';
  for (let i = 0; i < n; i += 1) {
    code += STAGE_ALPHABET[bytes[i] % STAGE_ALPHABET.length];
  }
  return code;
}

export function sanitizeStageCodeInput(raw) {
  return String(raw || '')
    .toUpperCase()
    .replace(new RegExp(`[^${STAGE_ALPHABET}]`, 'g'), '')
    .slice(0, 5);
}

export function normalizeStageCode(raw) {
  const code = sanitizeStageCodeInput(raw);
  return STAGE_CODE_RE.test(code) ? code : '';
}

export function normalizeStagePins(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  raw.forEach((id) => {
    if (!isStageSlotId(id) || seen.has(id)) return;
    seen.add(id);
    out.push(id);
  });
  return out;
}

export function normalizeStageSlots(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  STAGE_SLOT_IDS.forEach((id) => {
    if (raw[id] != null) out[id] = raw[id];
  });
  return out;
}

function slotHasContent(id, value) {
  if (value == null) return false;
  if (id === 'timer') return typeof value === 'object' && !Array.isArray(value);
  if (id === 'coin') return Boolean(String(value).trim());
  if (id === 'hat') {
    return Boolean(value.location || value.occupation || value.relationship || value.object);
  }
  if (id === 'set') {
    return Boolean(String(value.name || '').trim() || (Array.isArray(value.games) && value.games.length));
  }
  if (id === 'display') {
    return Boolean(String(value?.url || value?.code || '').trim());
  }
  if (id === 'message') {
    return Boolean(String(typeof value === 'string' ? value : value?.text || '').trim());
  }
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return Boolean(value.trim());
  return true;
}

export const STAGE_BOARD_STYLES = ['cards', 'compact'];

export function normalizeStageBoardStyle(raw) {
  return String(raw || '').trim().toLowerCase() === 'compact' ? 'compact' : 'cards';
}

export function buildStagePayload(pins, slots, sizes, layout, boardStyle, zooms, frames) {
  const payload = {};
  const order = [];
  const sizeMap = {};
  const zoomMap = {};
  normalizeStagePins(pins).forEach((id) => {
    const value = slots?.[id];
    if (!slotHasContent(id, value)) return;
    payload[id] = value;
    order.push(id);
    const resolved = resolveStageZoom();
    zoomMap[id] = resolved.zoom;
    sizeMap[id] = resolved.size;
  });
  payload.order = order;
  payload.sizes = sizeMap;
  payload.zooms = zoomMap;
  const layoutId = normalizeStageLayout(layout);
  if (layoutId) payload.layout = layoutId;
  payload.boardStyle = normalizeStageBoardStyle(boardStyle);
  const frameMap = normalizeStageFrames(frames);
  const covered = framesCoverSlots(frameMap, order);
  if (covered) payload.frames = Object.fromEntries(order.map((id) => [id, frameMap[id]]));
  return payload;
}

export function payloadHasSlots(payload) {
  if (!payload || typeof payload !== 'object') return false;
  return STAGE_SLOT_IDS.some((id) => slotHasContent(id, payload[id]));
}

/** Keep last known Receive state when a poll is an empty miss or Apps Script payload-only row. */
export function coalesceStageSession(prev, next) {
  const incoming = next && typeof next === 'object' ? next : {};
  const previous = prev && typeof prev === 'object' ? prev : null;
  if (previous?.ideaFlags && !incoming.ideaFlags) {
    return {
      ...incoming,
      ideasOpen: previous.ideasOpen,
      ideasUse: previous.ideasUse,
      ideasHold: previous.ideasHold,
      ideaCats: Array.isArray(incoming.ideaCats) && incoming.ideaCats.length
        ? incoming.ideaCats
        : previous.ideaCats,
      ideaFlags: true,
      updatedAt: incoming.updatedAt || previous.updatedAt,
    };
  }
  if (!incoming.updatedAt && previous?.updatedAt) return previous;
  return incoming;
}

/** Keep the last live board when a poll returns a cold/empty miss. Host clears always send `order: []`. */
export function coalesceStagePayload(prev, next) {
  const incoming = next && typeof next === 'object' && !Array.isArray(next) ? next : {};
  const previous = prev && typeof prev === 'object' && !Array.isArray(prev) ? prev : {};
  if (payloadHasSlots(incoming)) return incoming;
  if (!payloadHasSlots(previous)) return incoming;
  if (Array.isArray(incoming.order)) return incoming;
  return previous;
}

export function stageTileFitValue(id, value) {
  if (id === 'timer' && value && typeof value === 'object' && !Array.isArray(value)) {
    return { running: Boolean(value.running), endsAt: value.endsAt || '', endMs: value.endMs || null };
  }
  return value;
}

/** Ignore timer remaining and object-key churn so Stage polls do not remount tiles. */
export function stagePayloadSyncKey(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return '';
  const slots = {};
  STAGE_SLOT_IDS.forEach((id) => {
    if (payload[id] == null) return;
    slots[id] = stageTileFitValue(id, payload[id]);
  });
  return JSON.stringify({
    order: Array.isArray(payload.order) ? payload.order : [],
    slots,
    layout: payload.layout || '',
    boardStyle: payload.boardStyle || '',
    frames: payload.frames || null,
    floats: payload.floats || null,
    aligns: payload.aligns || null,
    captions: payload.captions || null,
    hideCode: payload.hideCode === true,
    theme: payload.theme || '',
    spotlight: payload.spotlight || '',
  });
}

export const STAGE_DISPLAY_ORDER = ['timer', 'suggestions', 'message', 'display', 'games', 'set', 'whosup', 'hat', 'coin'];

export const STAGE_SLOT_LABELS = {
  timer: 'Timer',
  suggestions: 'Suggestions',
  games: 'Games',
  set: 'Set',
  whosup: "Who's up",
  hat: 'Hat',
  coin: 'Coin',
  display: 'Ideas link',
  message: 'Message',
};

export const DEFAULT_STAGE_MESSAGES = ['Welcome', 'Thank you', 'Intermission', 'Next game'];
export const SESSION_BANK_PREFIX = 'session:';

export const STAGE_SIZE_MIN = 1;
export const STAGE_SIZE_MAX = 3;
export const STAGE_SIZE_LABELS = { 1: 'S', 2: 'M', 3: 'L' };

export const STAGE_ZOOM_MIN = 50;
export const STAGE_ZOOM_MAX = 200;
export const STAGE_ZOOM_STEP = 10;
export const STAGE_ZOOM_DEFAULT = 100;
export const STAGE_ZOOM_AUTO = 'auto';
export const STAGE_FRAME_MIN = 12;

export function isAutoZoom(value) {
  return value == null || value === '' || value === STAGE_ZOOM_AUTO;
}

export function clampStageSize(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 1;
  return Math.min(STAGE_SIZE_MAX, Math.max(STAGE_SIZE_MIN, n));
}

export function clampStageZoom(value) {
  if (isAutoZoom(value)) return STAGE_ZOOM_AUTO;
  const n = Math.round(Number(value) / STAGE_ZOOM_STEP) * STAGE_ZOOM_STEP;
  if (!Number.isFinite(n)) return STAGE_ZOOM_AUTO;
  return Math.min(STAGE_ZOOM_MAX, Math.max(STAGE_ZOOM_MIN, n));
}

export function stageFontFactor(zoom) {
  if (isAutoZoom(zoom)) return 1;
  const n = clampStageZoom(zoom);
  return n === STAGE_ZOOM_AUTO ? 1 : n / 100;
}

export function zoomFromLegacySize(size) {
  const s = clampStageSize(size);
  if (s >= 3) return 150;
  if (s >= 2) return 120;
  return STAGE_ZOOM_DEFAULT;
}

/** Auto packer span weight. Named layouts ignore this. Auto zoom is even cells. */
export function packerSizeFromZoom(zoom) {
  if (isAutoZoom(zoom)) return 1;
  const z = clampStageZoom(zoom);
  if (z === STAGE_ZOOM_AUTO) return 1;
  if (z <= 90) return 1;
  if (z >= 140) return 3;
  return 2;
}

export function resolveStageZoom() {
  return { zoom: STAGE_ZOOM_AUTO, size: 1 };
}

export function nudgeStageZoom(current, delta) {
  const step = Number(delta) || 0;
  if (isAutoZoom(current)) return clampStageZoom(STAGE_ZOOM_DEFAULT + step);
  return clampStageZoom(Number(current) + step);
}

export function normalizeStageSizes(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  STAGE_SLOT_IDS.forEach((id) => {
    if (raw[id] != null) out[id] = clampStageSize(raw[id]);
  });
  return out;
}

export function normalizeStageZooms(raw, fallbackSizes) {
  const out = {};
  const sizes = fallbackSizes && typeof fallbackSizes === 'object' && !Array.isArray(fallbackSizes)
    ? fallbackSizes
    : {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    STAGE_SLOT_IDS.forEach((id) => {
      if (raw[id] != null) out[id] = clampStageZoom(raw[id]);
    });
  }
  STAGE_SLOT_IDS.forEach((id) => {
    if (out[id] == null && sizes[id] != null) out[id] = zoomFromLegacySize(sizes[id]);
  });
  return out;
}

export function clampStageFrame(frame) {
  const x = Math.max(0, Math.min(100, Number(frame?.x) || 0));
  const y = Math.max(0, Math.min(100, Number(frame?.y) || 0));
  const w = Math.max(STAGE_FRAME_MIN, Math.min(100 - x, Number(frame?.w) || STAGE_FRAME_MIN));
  const h = Math.max(STAGE_FRAME_MIN, Math.min(100 - y, Number(frame?.h) || STAGE_FRAME_MIN));
  return { x, y, w, h };
}

export function normalizeStageFrames(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  STAGE_SLOT_IDS.forEach((id) => {
    if (raw[id]) out[id] = clampStageFrame(raw[id]);
  });
  return out;
}

export function framesFromPacked(packed) {
  if (!packed) return {};
  if (packed.mode === 'pip') {
    const base = (packed.placements || []).find((item) => !item.overlay);
    const pip = (packed.placements || []).find((item) => item.overlay);
    const out = {};
    if (base?.id) out[base.id] = { x: 0, y: 0, w: 100, h: 100 };
    if (pip?.id) out[pip.id] = { x: 65.5, y: 65.5, w: 32, h: 32 };
    return out;
  }
  const cols = Math.max(1, packed.cols || 1);
  const rows = Math.max(1, packed.rows || 1);
  const out = {};
  (packed.placements || []).forEach((item) => {
    if (!item?.id || item.overlay) return;
    out[item.id] = {
      x: ((item.col - 1) / cols) * 100,
      y: ((item.row - 1) / rows) * 100,
      w: (item.colSpan / cols) * 100,
      h: (item.rowSpan / rows) * 100,
    };
  });
  return out;
}

export function floatsFromPacked(packed) {
  if (packed?.mode !== 'pip') return [];
  const pip = (packed.placements || []).find((item) => item.overlay);
  return pip?.id ? [pip.id] : [];
}

export function framesCoverSlots(frames, ids) {
  const list = ids || [];
  if (!list.length) return false;
  return list.every((id) => frames?.[id]);
}

const FRAME_EDGE = 1.25;

function near(a, b) {
  return Math.abs(Number(a) - Number(b)) < FRAME_EDGE;
}

export function layoutSplitters(frames) {
  const entries = Object.entries(frames || {});
  const vertical = [];
  const horizontal = [];
  const seenV = new Set();
  const seenH = new Set();
  entries.forEach(([, frame]) => {
    const right = frame.x + frame.w;
    const bottom = frame.y + frame.h;
    if (right < 99.5) {
      const key = Math.round(right);
      if (!seenV.has(key)) {
        const leftIds = entries.filter(([, other]) => near(other.x + other.w, right)).map(([id]) => id);
        const rightIds = entries.filter(([, other]) => near(other.x, right)).map(([id]) => id);
        if (leftIds.length && rightIds.length) {
          seenV.add(key);
          vertical.push({ axis: 'x', at: right, left: leftIds, right: rightIds });
        }
      }
    }
    if (bottom < 99.5) {
      const key = Math.round(bottom);
      if (!seenH.has(key)) {
        const topIds = entries.filter(([, other]) => near(other.y + other.h, bottom)).map(([id]) => id);
        const bottomIds = entries.filter(([, other]) => near(other.y, bottom)).map(([id]) => id);
        if (topIds.length && bottomIds.length) {
          seenH.add(key);
          horizontal.push({ axis: 'y', at: bottom, top: topIds, bottom: bottomIds });
        }
      }
    }
  });
  return { vertical, horizontal };
}

export function applySplitterDrag(frames, splitter, nextAt) {
  const next = { ...frames };
  if (!splitter) return next;
  if (splitter.axis === 'x') {
    let at = nextAt;
    (splitter.left || []).forEach((id) => {
      const frame = next[id];
      if (!frame) return;
      at = Math.max(at, frame.x + STAGE_FRAME_MIN);
    });
    (splitter.right || []).forEach((id) => {
      const frame = next[id];
      if (!frame) return;
      at = Math.min(at, frame.x + frame.w - STAGE_FRAME_MIN);
    });
    (splitter.left || []).forEach((id) => {
      const frame = next[id];
      if (!frame) return;
      next[id] = clampStageFrame({ ...frame, w: at - frame.x });
    });
    (splitter.right || []).forEach((id) => {
      const frame = next[id];
      if (!frame) return;
      const end = frame.x + frame.w;
      next[id] = clampStageFrame({ ...frame, x: at, w: end - at });
    });
  } else {
    let at = nextAt;
    (splitter.top || []).forEach((id) => {
      const frame = next[id];
      if (!frame) return;
      at = Math.max(at, frame.y + STAGE_FRAME_MIN);
    });
    (splitter.bottom || []).forEach((id) => {
      const frame = next[id];
      if (!frame) return;
      at = Math.min(at, frame.y + frame.h - STAGE_FRAME_MIN);
    });
    (splitter.top || []).forEach((id) => {
      const frame = next[id];
      if (!frame) return;
      next[id] = clampStageFrame({ ...frame, h: at - frame.y });
    });
    (splitter.bottom || []).forEach((id) => {
      const frame = next[id];
      if (!frame) return;
      const end = frame.y + frame.h;
      next[id] = clampStageFrame({ ...frame, y: at, h: end - at });
    });
  }
  return next;
}

export function normalizeStageFloats(raw, ids) {
  const allowed = new Set((ids || STAGE_SLOT_IDS).filter(Boolean));
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set();
  const out = [];
  list.forEach((id) => {
    const key = String(id || '').trim();
    if (!key || seen.has(key) || !allowed.has(key)) return;
    seen.add(key);
    out.push(key);
  });
  return out;
}

function rangesOverlap(a0, a1, b0, b1) {
  return a0 < b1 - 0.5 && b0 < a1 - 0.5;
}

export function yOverlapFrames(a, b) {
  return a && b && rangesOverlap(a.y, a.y + a.h, b.y, b.y + b.h);
}

export function xOverlapFrames(a, b) {
  return a && b && rangesOverlap(a.x, a.x + a.w, b.x, b.x + b.w);
}

export function applyNeighborPush(frames, id, edge, nextAt, dockedIds) {
  const next = { ...frames };
  const a = next[id];
  if (!a) return next;
  const others = (dockedIds || []).filter((other) => other !== id && next[other]);
  if (edge === 'right') {
    const neighbors = others.filter((other) => near(next[other].x, a.x + a.w) && yOverlapFrames(a, next[other]));
    if (!neighbors.length) return next;
    let at = nextAt;
    at = Math.max(at, a.x + STAGE_FRAME_MIN);
    neighbors.forEach((other) => {
      at = Math.min(at, next[other].x + next[other].w - STAGE_FRAME_MIN);
    });
    next[id] = clampStageFrame({ ...a, w: at - a.x });
    neighbors.forEach((other) => {
      const b = next[other];
      const end = b.x + b.w;
      next[other] = clampStageFrame({ ...b, x: at, w: end - at });
    });
    return next;
  }
  if (edge === 'left') {
    const neighbors = others.filter((other) => near(next[other].x + next[other].w, a.x) && yOverlapFrames(a, next[other]));
    if (!neighbors.length) return next;
    let at = nextAt;
    at = Math.min(at, a.x + a.w - STAGE_FRAME_MIN);
    neighbors.forEach((other) => {
      at = Math.max(at, next[other].x + STAGE_FRAME_MIN);
    });
    const end = a.x + a.w;
    next[id] = clampStageFrame({ ...a, x: at, w: end - at });
    neighbors.forEach((other) => {
      const b = next[other];
      next[other] = clampStageFrame({ ...b, w: at - b.x });
    });
    return next;
  }
  if (edge === 'bottom') {
    const neighbors = others.filter((other) => near(next[other].y, a.y + a.h) && xOverlapFrames(a, next[other]));
    if (!neighbors.length) return next;
    let at = nextAt;
    at = Math.max(at, a.y + STAGE_FRAME_MIN);
    neighbors.forEach((other) => {
      at = Math.min(at, next[other].y + next[other].h - STAGE_FRAME_MIN);
    });
    next[id] = clampStageFrame({ ...a, h: at - a.y });
    neighbors.forEach((other) => {
      const b = next[other];
      const end = b.y + b.h;
      next[other] = clampStageFrame({ ...b, y: at, h: end - at });
    });
    return next;
  }
  if (edge === 'top') {
    const neighbors = others.filter((other) => near(next[other].y + next[other].h, a.y) && xOverlapFrames(a, next[other]));
    if (!neighbors.length) return next;
    let at = nextAt;
    at = Math.min(at, a.y + a.h - STAGE_FRAME_MIN);
    neighbors.forEach((other) => {
      at = Math.max(at, next[other].y + STAGE_FRAME_MIN);
    });
    const end = a.y + a.h;
    next[id] = clampStageFrame({ ...a, y: at, h: end - at });
    neighbors.forEach((other) => {
      const b = next[other];
      next[other] = clampStageFrame({ ...b, h: at - b.y });
    });
    return next;
  }
  return next;
}

export function resizeFloatFrame(frame, edge, nextAt) {
  const a = clampStageFrame(frame);
  if (edge === 'right') {
    const at = Math.max(a.x + STAGE_FRAME_MIN, Math.min(100, nextAt));
    return clampStageFrame({ ...a, w: at - a.x });
  }
  if (edge === 'left') {
    const end = a.x + a.w;
    const at = Math.max(0, Math.min(end - STAGE_FRAME_MIN, nextAt));
    return clampStageFrame({ ...a, x: at, w: end - at });
  }
  if (edge === 'bottom') {
    const at = Math.max(a.y + STAGE_FRAME_MIN, Math.min(100, nextAt));
    return clampStageFrame({ ...a, h: at - a.y });
  }
  if (edge === 'top') {
    const end = a.y + a.h;
    const at = Math.max(0, Math.min(end - STAGE_FRAME_MIN, nextAt));
    return clampStageFrame({ ...a, y: at, h: end - at });
  }
  return a;
}

export function resizeFloatCorner(frame, corner, xPct, yPct) {
  const a = clampStageFrame(frame);
  const x = Number(xPct);
  const y = Number(yPct);
  let next = { ...a };
  if (corner === 'nw' || corner === 'sw') {
    const end = a.x + a.w;
    const at = Math.max(0, Math.min(end - STAGE_FRAME_MIN, x));
    next = { ...next, x: at, w: end - at };
  }
  if (corner === 'ne' || corner === 'se') {
    const at = Math.max(next.x + STAGE_FRAME_MIN, Math.min(100, x));
    next = { ...next, w: at - next.x };
  }
  if (corner === 'nw' || corner === 'ne') {
    const end = a.y + a.h;
    const at = Math.max(0, Math.min(end - STAGE_FRAME_MIN, y));
    next = { ...next, y: at, h: end - at };
  }
  if (corner === 'sw' || corner === 'se') {
    const at = Math.max(next.y + STAGE_FRAME_MIN, Math.min(100, y));
    next = { ...next, h: at - next.y };
  }
  return clampStageFrame(next);
}

export function moveFloatFrame(frame, dx, dy) {
  const a = clampStageFrame(frame);
  const x = Math.max(0, Math.min(100 - a.w, a.x + dx));
  const y = Math.max(0, Math.min(100 - a.h, a.y + dy));
  return clampStageFrame({ ...a, x, y });
}

export function swapStageFrames(frames, a, b) {
  const next = { ...frames };
  const fa = next[a];
  const fb = next[b];
  if (!fa || !fb) return next;
  next[a] = fb;
  next[b] = fa;
  return next;
}

export function popOutStageTile(frames, floats, id, slotIds) {
  const key = String(id || '').trim();
  const ids = (slotIds || []).filter(Boolean);
  if (!key || !ids.includes(key)) return { frames: normalizeStageFrames(frames), floats: normalizeStageFloats(floats, ids) };
  const floatsNext = normalizeStageFloats([...floats, key], ids);
  const remaining = ids.filter((item) => !floatsNext.includes(item));
  const packed = packStageGrid(remaining.map((item) => ({ id: item, size: 1 })), true, '');
  const floatFrame = clampStageFrame({ x: 65.5, y: 65.5, w: 32, h: 32 });
  const kept = {};
  floatsNext.forEach((fid) => {
    if (fid === key) return;
    if (frames?.[fid]) kept[fid] = frames[fid];
  });
  return {
    frames: { ...framesFromPacked(packed), ...kept, [key]: floatFrame },
    floats: floatsNext,
  };
}

export function dockStageTile(frames, floats, id, slotIds) {
  const key = String(id || '').trim();
  const ids = (slotIds || []).filter(Boolean);
  const floatsNext = normalizeStageFloats(floats, ids).filter((item) => item !== key);
  const remaining = ids.filter((item) => !floatsNext.includes(item));
  const packed = packStageGrid(remaining.map((item) => ({ id: item, size: 1 })), true, '');
  const kept = {};
  floatsNext.forEach((fid) => {
    if (frames?.[fid]) kept[fid] = frames[fid];
  });
  return {
    frames: { ...kept, ...framesFromPacked(packed) },
    floats: floatsNext,
  };
}

export function frameAtPoint(frames, ids, xPct, yPct) {
  const list = [...(ids || [])].reverse();
  return list.find((id) => {
    const frame = frames?.[id];
    if (!frame) return false;
    return xPct >= frame.x && xPct <= frame.x + frame.w && yPct >= frame.y && yPct <= frame.y + frame.h;
  }) || '';
}

export function normalizeIdeaCats(raw) {
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

export function sessionBankId(catId) {
  const key = String(catId || '').trim();
  return key ? `${SESSION_BANK_PREFIX}${key}` : '';
}

export function parseSessionBankId(id) {
  const raw = String(id || '');
  if (!raw.startsWith(SESSION_BANK_PREFIX)) return '';
  return raw.slice(SESSION_BANK_PREFIX.length).trim();
}

export function stageMessageText(value) {
  if (typeof value === 'string') return value.trim();
  return String(value?.text || '').trim();
}

export function normalizeStageMessages(raw, fallback = DEFAULT_STAGE_MESSAGES) {
  const source = Array.isArray(raw) ? raw : fallback;
  const seen = new Set();
  const out = [];
  source.forEach((item) => {
    const text = String(item || '').trim().slice(0, 80);
    if (!text) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(text);
  });
  return out.slice(0, 24);
}

export function compactStageUrl(url) {
  return String(url || '').replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

export function stageIdeasJoinUrl(origin = typeof window !== 'undefined' ? window.location.origin : '') {
  return origin ? `${origin}/ideas` : '/ideas';
}

export function ideaEntry(raw) {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    const text = raw.trim();
    return text ? { text } : null;
  }
  const text = String(raw.text || '').trim();
  if (!text) return null;
  return raw.flag === 'nsfw' ? { text, flag: 'nsfw' } : { text };
}

export function ideaText(raw) {
  return ideaEntry(raw)?.text || '';
}

export function normalizeIdeaBucket(raw) {
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
  return out.slice(0, 200);
}

export function mergeStageIdeas(current, incoming) {
  const out = { ...(current && typeof current === 'object' && !Array.isArray(current) ? current : {}) };
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return out;
  Object.entries(incoming).forEach(([cat, rows]) => {
    const key = String(cat || '').trim();
    if (!key) return;
    const prev = normalizeIdeaBucket(out[key]);
    const seen = new Set(prev.map((row) => ideaText(row).toLowerCase()));
    normalizeIdeaBucket(rows).forEach((entry) => {
      const id = entry.text.toLowerCase();
      if (seen.has(id)) return;
      seen.add(id);
      prev.push(entry);
    });
    out[key] = prev.slice(-200);
  });
  return out;
}

export const STAGE_LAYOUTS = [
  { id: 'pbp', name: 'Side-by-Side (PBP)', short: 'Side-by-Side', count: 2 },
  { id: 'stack', name: 'Top-and-Bottom', short: 'Top-and-Bottom', count: 2 },
  { id: 'pip', name: 'Picture-in-Picture (PiP)', short: 'PiP', count: 2 },
  { id: 'large-2', name: '1 Large + 2 Small', short: '1 + 2', count: 3 },
  { id: 'triple', name: 'Triple Column', short: 'Triple', count: 3 },
  { id: 'quad', name: 'Quad View (2×2)', short: 'Quad', count: 4 },
  { id: 'l-shape', name: '1 Large + 3 Small (L-Shape)', short: 'L-Shape', count: 4 },
  { id: 'large-5', name: '1 Large + 5 Small', short: '1 + 5', count: 6 },
  { id: 'grid-3x3', name: '3×3 Grid', short: '3×3', count: 9 },
  { id: 'grid-4x4', name: '4×4 Grid', short: '4×4', count: 16 },
];

const STAGE_LAYOUT_BY_ID = Object.fromEntries(STAGE_LAYOUTS.map((layout) => [layout.id, layout]));

export function normalizeStageLayout(raw) {
  const id = String(raw || '').trim();
  return STAGE_LAYOUT_BY_ID[id] ? id : '';
}

export function normalizeStageAlign(raw) {
  return String(raw || '').trim().toLowerCase() === 'left' ? 'left' : 'center';
}

export function normalizeStageAligns(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  STAGE_SLOT_IDS.forEach((id) => {
    if (raw[id] == null) return;
    const align = normalizeStageAlign(raw[id]);
    if (align === 'left') out[id] = 'left';
  });
  return out;
}

export function normalizeStageCaptions(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  STAGE_SLOT_IDS.forEach((id) => {
    if (raw[id] === false) out[id] = false;
  });
  return out;
}

export function slotHasSuggestionCaptions(value) {
  return (Array.isArray(value) ? value : []).some((item) => (
    (item?.texts || []).some((entry) => Boolean(suggestionLine(entry).extra))
  ));
}

export function layoutsForCount(count) {
  const n = Math.round(Number(count));
  if (!Number.isFinite(n)) return [];
  return STAGE_LAYOUTS.filter((layout) => layout.count === n);
}

function placeSlot(item, col, row, colSpan = 1, rowSpan = 1) {
  return { ...item, col, row, colSpan, rowSpan };
}

export function packNamedLayout(slots, layoutId) {
  const items = (slots || []).map((slot) => ({ ...slot, size: clampStageSize(slot.size) }));
  const layout = STAGE_LAYOUT_BY_ID[normalizeStageLayout(layoutId)];
  if (!layout || items.length !== layout.count) return null;
  switch (layout.id) {
    case 'pbp':
      return { cols: 2, rows: 1, placements: items.map((item, i) => placeSlot(item, i + 1, 1)) };
    case 'stack':
      return { cols: 1, rows: 2, placements: items.map((item, i) => placeSlot(item, 1, i + 1)) };
    case 'pip':
      return {
        mode: 'pip',
        cols: 1,
        rows: 1,
        placements: [
          placeSlot(items[0], 1, 1),
          { ...items[1], overlay: 'br' },
        ],
      };
    case 'large-2':
      return {
        cols: 3,
        rows: 2,
        placements: [
          placeSlot(items[0], 1, 1, 2, 2),
          placeSlot(items[1], 3, 1),
          placeSlot(items[2], 3, 2),
        ],
      };
    case 'triple':
      return { cols: 3, rows: 1, placements: items.map((item, i) => placeSlot(item, i + 1, 1)) };
    case 'quad':
      return {
        cols: 2,
        rows: 2,
        placements: items.map((item, i) => placeSlot(item, (i % 2) + 1, Math.floor(i / 2) + 1)),
      };
    case 'l-shape':
      return {
        cols: 3,
        rows: 3,
        placements: [
          placeSlot(items[0], 1, 1, 2, 3),
          placeSlot(items[1], 3, 1),
          placeSlot(items[2], 3, 2),
          placeSlot(items[3], 3, 3),
        ],
      };
    case 'large-5':
      return {
        cols: 3,
        rows: 3,
        placements: [
          placeSlot(items[0], 1, 1, 2, 2),
          placeSlot(items[1], 3, 1),
          placeSlot(items[2], 3, 2),
          placeSlot(items[3], 1, 3),
          placeSlot(items[4], 2, 3),
          placeSlot(items[5], 3, 3),
        ],
      };
    case 'grid-3x3':
      return {
        cols: 3,
        rows: 3,
        placements: items.map((item, i) => placeSlot(item, (i % 3) + 1, Math.floor(i / 3) + 1)),
      };
    case 'grid-4x4':
      return {
        cols: 4,
        rows: 4,
        placements: items.map((item, i) => placeSlot(item, (i % 4) + 1, Math.floor(i / 4) + 1)),
      };
    default:
      return null;
  }
}

export function listedStageSlots(payload) {
  if (!payload || typeof payload !== 'object') return [];
  const preferred = Array.isArray(payload.order) ? payload.order : STAGE_DISPLAY_ORDER;
  const seen = new Set();
  const ids = [];
  preferred.forEach((id) => {
    if (!isStageSlotId(id) || seen.has(id) || !slotHasContent(id, payload[id])) return;
    seen.add(id);
    ids.push(id);
  });
  STAGE_DISPLAY_ORDER.forEach((id) => {
    if (seen.has(id) || !slotHasContent(id, payload[id])) return;
    seen.add(id);
    ids.push(id);
  });
  const frames = normalizeStageFrames(payload?.frames);
  const aligns = normalizeStageAligns(payload?.aligns);
  const captions = payload?.captions && typeof payload.captions === 'object' && !Array.isArray(payload.captions)
    ? payload.captions
    : {};
  return ids.map((id) => {
    const resolved = resolveStageZoom();
    return {
      id,
      value: payload[id],
      zoom: resolved.zoom,
      size: resolved.size,
      frame: frames[id],
      align: aligns[id] || 'center',
      captions: captions[id] !== false,
    };
  });
}

export function seedStageFrames(slots, landscape, layout) {
  return seedStageLayout(slots, landscape, layout).frames;
}

export function seedStageLayout(slots, landscape, layout) {
  const packed = packStageGrid(slots, landscape, layout);
  return {
    frames: framesFromPacked(packed),
    floats: floatsFromPacked(packed),
  };
}

export function packStageGrid(slots, landscape, layout) {
  const named = packNamedLayout(slots, layout);
  if (named) return named;
  const items = (slots || []).map((slot) => ({ ...slot, size: clampStageSize(slot.size) }));
  const n = items.length;
  if (!n) return { cols: 1, rows: 1, placements: [] };
  if (n === 1) {
    return {
      cols: 1,
      rows: 1,
      placements: [{ ...items[0], col: 1, row: 1, colSpan: 1, rowSpan: 1 }],
    };
  }
  const emphasized = items.some((slot) => slot.size !== items[0].size);
  if (!emphasized) {
    const { cols, rows } = stageGridTemplate(n, landscape);
    return {
      cols,
      rows,
      placements: items.map((item, index) => ({
        ...item,
        col: (index % cols) + 1,
        row: Math.floor(index / cols) + 1,
        colSpan: 1,
        rowSpan: 1,
      })),
    };
  }
  const cols = landscape ? 6 : 2;
  const spanFor = (size) => {
    if (!landscape) {
      return size >= 2
        ? { colSpan: 2, rowSpan: size >= 3 ? 2 : 1 }
        : { colSpan: 1, rowSpan: 1 };
    }
    if (size >= 3) return { colSpan: 6, rowSpan: 2 };
    if (size === 2) return { colSpan: 4, rowSpan: 1 };
    return { colSpan: 2, rowSpan: 1 };
  };
  const placements = [];
  let row = 1;
  let col = 1;
  let rowHeight = 1;
  let maxRow = 1;
  items.forEach((item) => {
    const span = spanFor(item.size);
    const colSpan = Math.min(cols, span.colSpan);
    const rowSpan = span.rowSpan;
    if (col - 1 + colSpan > cols) {
      row += rowHeight;
      col = 1;
      rowHeight = 1;
    }
    placements.push({ ...item, col, row, colSpan, rowSpan });
    maxRow = Math.max(maxRow, row + rowSpan - 1);
    rowHeight = Math.max(rowHeight, rowSpan);
    col += colSpan;
    if (col > cols) {
      row += rowHeight;
      col = 1;
      rowHeight = 1;
    }
  });
  return { cols, rows: maxRow, placements };
}

export function stageGridTemplate(count, landscape) {
  const n = Math.max(0, count);
  if (n <= 1) return { cols: 1, rows: 1 };
  if (n === 2) return landscape ? { cols: 2, rows: 1 } : { cols: 1, rows: 2 };
  if (n === 3) return landscape ? { cols: 3, rows: 1 } : { cols: 1, rows: 3 };
  if (n === 4) return { cols: 2, rows: 2 };
  if (n <= 6) return landscape ? { cols: 3, rows: 2 } : { cols: 2, rows: 3 };
  return { cols: 3, rows: 3 };
}

/** Local countdown paint rate on the board. Digits interpolate from endsAt, not from polls. */
export const STAGE_TIMER_TICK_MS = 50;
/** How often the TV GETs /api/stage. Pin/start latency only — not the digit refresh. */
export const STAGE_BOARD_POLL_MS = 250;
export const STAGE_IDEAS_POLL_MS = 1000;
/** Debounce for bursty UI (zoom, layout). Pins, slots, and timer POST immediately. */
export const STAGE_PUBLISH_DEBOUNCE_MS = 80;
export const STAGE_FETCH_TIMEOUT_MS = 8000;

export function stageTypeScale(count) {
  if (count <= 1) {
    return {
      kicker: 'stage-type-kicker stage-type-kicker-1',
      title: 'stage-type-title stage-type-title-1',
      body: 'stage-type-body stage-type-body-1',
      caption: 'stage-type-caption stage-type-caption-1',
    };
  }
  if (count === 2) {
    return {
      kicker: 'stage-type-kicker stage-type-kicker-2',
      title: 'stage-type-title stage-type-title-2',
      body: 'stage-type-body stage-type-body-2',
      caption: 'stage-type-caption stage-type-caption-2',
    };
  }
  if (count <= 4) {
    return {
      kicker: 'stage-type-kicker stage-type-kicker-4',
      title: 'stage-type-title stage-type-title-4',
      body: 'stage-type-body stage-type-body-4',
      caption: 'stage-type-caption stage-type-caption-4',
    };
  }
  return {
    kicker: 'stage-type-kicker stage-type-kicker-n',
    title: 'stage-type-title stage-type-title-n',
    body: 'stage-type-body stage-type-body-n',
    caption: 'stage-type-caption stage-type-caption-n',
  };
}

export function isTransientStageError(error) {
  const name = String(error?.name || '');
  if (name === 'AbortError' || name === 'TimeoutError') return true;
  const msg = String(error?.message || error || '').toLowerCase();
  if (!msg) return false;
  return /google login|redeploy|unauthorized|unauthorised|sign in|sign-in|forbidden|\b401\b|\b403\b|anyone|login page|asked for a google|abort|timed out|timeout|failed to fetch|network/.test(msg);
}

export function slotSummary(id, value) {
  if (id === 'timer') return formatStageTime(remainingFromTimer(value));
  if (id === 'coin') return String(value || '');
  if (id === 'hat') {
    return ['location', 'occupation', 'relationship', 'object']
      .map((key) => value?.[key])
      .filter(Boolean)
      .join(' · ');
  }
  if (id === 'set') {
    const games = Array.isArray(value?.games) ? value.games.filter(Boolean) : [];
    return [value?.name, games.length ? `${games.length} games` : '']
      .filter(Boolean)
      .join(' · ');
  }
  if (id === 'whosup') return (value || []).filter(Boolean).join(', ');
  if (id === 'games') return (value || []).map((game) => game?.name).filter(Boolean).join(', ');
  if (id === 'suggestions') {
    return (value || [])
      .map((item) => item?.label)
      .filter(Boolean)
      .join(', ');
  }
  if (id === 'display') return String(value?.code || value?.url || 'Ideas link');
  if (id === 'message') return stageMessageText(value);
  return '';
}

export function stageBoardPath(code) {
  const normalized = normalizeStageCode(code);
  return normalized ? `/stage?s=${encodeURIComponent(normalized)}` : '/stage';
}

export function stageBoardUrl(code, origin = typeof window !== 'undefined' ? window.location.origin : '') {
  const path = stageBoardPath(code);
  return origin ? `${origin}${path}` : path;
}

export function stageIdeasPath(code) {
  const normalized = normalizeStageCode(code);
  return normalized ? `/ideas?s=${encodeURIComponent(normalized)}` : '/ideas';
}

export function stageIdeasUrl(code, origin = typeof window !== 'undefined' ? window.location.origin : '') {
  const path = stageIdeasPath(code);
  return origin ? `${origin}${path}` : path;
}

export function normalizeStageIdeasMap(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  Object.entries(raw).forEach(([cat, rows]) => {
    const key = String(cat || '').trim();
    if (!key) return;
    out[key] = normalizeIdeaBucket(rows);
  });
  return out;
}

export async function copyText(text) {
  const value = String(text || '');
  if (!value) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const field = document.createElement('textarea');
    field.value = value;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.left = '-9999px';
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(field);
    return ok;
  } catch {
    return false;
  }
}

async function readJson(res) {
  const text = await res.text();
  if (text.trim().startsWith('<')) {
    throw new Error('Stage URL asked for a Google login. Redeploy the web app as Anyone.');
  }
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Stage returned something that was not JSON.');
  }
}

function abortAfter(ms) {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    clear: () => globalThis.clearTimeout(timer),
  };
}

export async function fetchStage(code) {
  const normalized = normalizeStageCode(code);
  if (!normalized) throw new Error('Missing stage code.');
  const abort = abortAfter(STAGE_FETCH_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`/api/stage?s=${encodeURIComponent(normalized)}`, {
      cache: 'no-store',
      signal: abort.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Stage request timed out.');
    throw error;
  } finally {
    abort.clear();
  }
  const data = await readJson(res);
  if (!res.ok) {
    throw new Error(data.error || `Couldn’t load the board (${res.status}).`);
  }
  return {
    code: data.code || normalized,
    payload: data.payload && typeof data.payload === 'object' && !Array.isArray(data.payload) ? data.payload : {},
    ideas: normalizeStageIdeasMap(data.ideas),
    ideasPending: normalizeStageIdeasMap(data.ideasPending),
    ideaCats: normalizeIdeaCats(data.ideaCats),
    ideasOpen: data.ideasOpen === true,
    ideasUse: data.ideasUse === true,
    ideasHold: data.ideasHold === true,
    ideaFlags: data.ideaFlags === true,
    updatedAt: data.updatedAt || '',
  };
}

export async function postStage(code, payload, extra = {}) {
  const normalized = normalizeStageCode(code);
  if (!normalized) throw new Error('Missing stage code.');
  const abort = abortAfter(STAGE_FETCH_TIMEOUT_MS);
  const body = { code: normalized, ...extra };
  if (payload !== undefined) body.payload = payload || {};
  let res;
  try {
    res = await fetch('/api/stage', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: abort.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Stage request timed out.');
    throw error;
  } finally {
    abort.clear();
  }
  const data = await readJson(res);
  if (!res.ok) {
    throw new Error(data.error || `Couldn’t publish to Stage (${res.status}).`);
  }
  return data;
}

function displayText(row) {
  if (!row) return '';
  if (typeof row === 'string') return row;
  return String(row.text || '').trim();
}

function extraOf(row) {
  if (!row || typeof row === 'string') return '';
  return String(row.extra || '').trim();
}

/** Read a published suggestion line. Old sessions sent a plain string (sometimes `text — extra`). */
export function suggestionLine(entry) {
  if (entry == null) return { text: '', extra: '' };
  if (typeof entry === 'string') return { text: entry.trim(), extra: '' };
  if (typeof entry === 'object') {
    return {
      text: String(entry.text || '').trim(),
      extra: String(entry.extra || '').trim(),
    };
  }
  return { text: String(entry).trim(), extra: '' };
}

export function isLineSuggestion(item) {
  const type = String(item?.type || '').trim().toLowerCase();
  if (type === 'line' || type === 'lines') return true;
  const label = String(item?.label || '').trim().toLowerCase();
  return label === 'line' || label === 'lines';
}

export function quotedStageLine(text) {
  const value = String(text || '').trim();
  if (!value) return '';
  if ((value.startsWith('“') && value.endsWith('”')) || (value.startsWith('"') && value.endsWith('"'))) {
    return value;
  }
  return `“${value}”`;
}

function suggestionEntry(text, extra) {
  const line = String(text || '').trim();
  if (!line) return null;
  const caption = String(extra || '').trim();
  return caption ? { text: line, extra: caption } : { text: line };
}

function kitSuggestionType(item) {
  const id = String(item?.id || '').trim().toLowerCase();
  const label = String(item?.label || '').trim().toLowerCase();
  if (id === 'lines' || id === 'line' || label === 'lines' || label === 'line') return 'line';
  return id || label || '';
}

function skillResultTexts(generated) {
  const content = generated?.content;
  if (generated?.type === 'core' && content) {
    return [
      content.c && suggestionEntry(`Character: ${content.c}`),
      content.o && suggestionEntry(`Objective: ${content.o}`),
      content.r && suggestionEntry(`Relationship: ${content.r}`),
      content.e && suggestionEntry(`Environment: ${content.e}`),
    ].filter(Boolean);
  }
  if (generated?.type === 'fut' && content) {
    return [
      content.reality && suggestionEntry(`Base: ${content.reality}`),
      content.weirdThing && suggestionEntry(`Unusual: ${content.weirdThing}`),
    ].filter(Boolean);
  }
  if (generated?.type === 'style') {
    const name = typeof content === 'string' ? content : content?.name || '';
    const desc = typeof content === 'object' ? content?.description || '' : '';
    const entry = suggestionEntry(name, desc);
    return entry ? [entry] : [];
  }
  const entry = suggestionEntry(displayText(content), extraOf(content));
  return entry ? [entry] : [];
}

export function suggestionsFromGenerator(kit, skillResults) {
  const items = [];
  (kit || []).forEach((item) => {
    const texts = (item.rows || [])
      .map((row) => suggestionEntry(displayText(row), extraOf(row)))
      .filter(Boolean);
    if (!texts.length) return;
    items.push({
      label: item.label || 'Ask for',
      type: kitSuggestionType(item),
      texts,
    });
  });
  (skillResults || []).forEach((generated) => {
    items.push({
      label: generated.title || 'Suggestion',
      type: generated.type || '',
      texts: skillResultTexts(generated),
    });
  });
  return items;
}

export const STAGE_GAME_PARTS = [
  { id: 'howToPlay', label: 'Directions' },
  { id: 'setup', label: 'Setup' },
  { id: 'gimmicks', label: 'Tips' },
  { id: 'variations', label: 'Variations' },
  { id: 'description', label: 'Overview' },
];

const STAGE_GAME_PART_IDS = new Set(STAGE_GAME_PARTS.map((part) => part.id));

export function isStageGamePartId(id) {
  return STAGE_GAME_PART_IDS.has(id);
}

export function gamePartText(game, partId) {
  if (!game || !STAGE_GAME_PART_IDS.has(partId)) return '';
  const raw = game[partId];
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item || '').trim()).filter(Boolean).join(', ');
  }
  return String(raw || '').trim();
}

export function availableGameParts(game) {
  return STAGE_GAME_PARTS.filter((part) => gamePartText(game, part.id));
}

export function normalizeGameParts(raw, game) {
  const allowed = new Set(availableGameParts(game).map((part) => part.id));
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  raw.forEach((id) => {
    if (!allowed.has(id) || seen.has(id)) return;
    seen.add(id);
    out.push(id);
  });
  return out;
}

export function publishStageGame(game, parts) {
  const name = String(game?.name || '').trim();
  if (!name) return null;
  const selected = normalizeGameParts(parts, game);
  const item = {
    name,
    category: String(game?.category || game?.categories?.[0] || '').trim(),
  };
  if (selected.length) item.parts = selected;
  selected.forEach((id) => {
    const text = gamePartText(game, id);
    if (text) item[id] = text;
  });
  return item;
}

export function gamesFromCatalog(games, previous) {
  const prevByName = new Map();
  (previous || []).forEach((item) => {
    const name = String(item?.name || '').trim();
    if (name) prevByName.set(name, item);
  });
  return (games || [])
    .map((game) => {
      const name = String(game?.name || '').trim();
      if (!name) return null;
      const prev = prevByName.get(name);
      return publishStageGame(game, game.parts ?? prev?.parts);
    })
    .filter(Boolean);
}

export function findStageGameIndex(slot, game) {
  const name = String(game?.name || game || '').trim();
  if (!name || !Array.isArray(slot)) return -1;
  return slot.findIndex((item) => String(item?.name || '').trim() === name);
}

export function timerEndsAt(running, remaining, now = Date.now()) {
  const seconds = Math.max(0, Math.round(Number(remaining) || 0));
  if (!running || seconds <= 0) return null;
  return new Date(now + seconds * 1000).toISOString();
}

export function snapshotTimer(running, remaining, now = Date.now()) {
  const seconds = Math.max(0, Math.round(Number(remaining) || 0));
  const endsAt = timerEndsAt(running, seconds, now);
  const endMs = endsAt ? new Date(endsAt).getTime() : null;
  return {
    running: Boolean(running),
    remaining: seconds,
    endsAt,
    endMs: Number.isFinite(endMs) ? endMs : null,
  };
}

export function parseTimerEndMs(timer) {
  if (!timer) return null;
  const fromMs = Number(timer.endMs);
  if (Number.isFinite(fromMs) && fromMs > 0) return fromMs;
  if (timer.endsAt == null || timer.endsAt === '') return null;
  if (typeof timer.endsAt === 'number' && Number.isFinite(timer.endsAt)) return timer.endsAt;
  const end = new Date(timer.endsAt).getTime();
  return Number.isFinite(end) ? end : null;
}

export function remainingFromTimer(timer, now = Date.now()) {
  if (!timer) return 0;
  if (timer.running) {
    const end = parseTimerEndMs(timer);
    if (end != null) return Math.max(0, Math.ceil((end - now) / 1000));
  }
  return Math.max(0, Math.round(Number(timer.remaining) || 0));
}

export function formatStageTime(total) {
  const n = Math.max(0, Math.round(Number(total) || 0));
  const m = Math.floor(n / 60);
  const s = n % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function gameIsOnStage(slot, game) {
  const name = String(game?.name || '').trim();
  if (!name || !Array.isArray(slot)) return false;
  return slot.some((item) => String(item?.name || '').trim() === name);
}
