export const STAGE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const STAGE_SLOT_IDS = ['suggestions', 'games', 'timer', 'hat', 'coin', 'whosup', 'set'];
export const STAGE_CODE_RE = new RegExp(`^[${STAGE_ALPHABET}]{4,5}$`);

const SLOT_SET = new Set(STAGE_SLOT_IDS);

export function isStageSlotId(id) {
  return SLOT_SET.has(id);
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

export function normalizeStageCode(raw) {
  const code = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
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
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return Boolean(value.trim());
  return true;
}

export const STAGE_BOARD_STYLES = ['cards', 'compact'];

export function normalizeStageBoardStyle(raw) {
  return String(raw || '').trim().toLowerCase() === 'compact' ? 'compact' : 'cards';
}

export function buildStagePayload(pins, slots, sizes, layout, boardStyle) {
  const payload = {};
  const order = [];
  const sizeMap = {};
  normalizeStagePins(pins).forEach((id) => {
    const value = slots?.[id];
    if (!slotHasContent(id, value)) return;
    payload[id] = value;
    order.push(id);
    sizeMap[id] = clampStageSize(sizes?.[id]);
  });
  payload.order = order;
  payload.sizes = sizeMap;
  const layoutId = normalizeStageLayout(layout);
  if (layoutId) payload.layout = layoutId;
  payload.boardStyle = normalizeStageBoardStyle(boardStyle);
  return payload;
}

export function payloadHasSlots(payload) {
  if (!payload || typeof payload !== 'object') return false;
  return STAGE_SLOT_IDS.some((id) => slotHasContent(id, payload[id]));
}

export const STAGE_DISPLAY_ORDER = ['timer', 'suggestions', 'games', 'set', 'whosup', 'hat', 'coin'];

export const STAGE_SLOT_LABELS = {
  timer: 'Timer',
  suggestions: 'Suggestions',
  games: 'Games',
  set: 'Set',
  whosup: "Who's up",
  hat: 'Hat',
  coin: 'Coin',
};

export const STAGE_SIZE_MIN = 1;
export const STAGE_SIZE_MAX = 3;
export const STAGE_SIZE_LABELS = { 1: 'S', 2: 'M', 3: 'L' };

export function clampStageSize(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 1;
  return Math.min(STAGE_SIZE_MAX, Math.max(STAGE_SIZE_MIN, n));
}

export function normalizeStageSizes(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  STAGE_SLOT_IDS.forEach((id) => {
    if (raw[id] != null) out[id] = clampStageSize(raw[id]);
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
  return ids.map((id) => ({
    id,
    value: payload[id],
    size: clampStageSize(payload.sizes?.[id]),
  }));
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
  const emphasized = items.some((slot) => slot.size > 1);
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
/** How often the TV GETs /api/stage. Start/pause latency only — not the digit refresh. */
export const STAGE_BOARD_POLL_MS = 1500;
/** Debounce for non-timer publishes (pins, suggestions, layout). Timer POSTs immediately. */
export const STAGE_PUBLISH_DEBOUNCE_MS = 300;

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
  const msg = String(error?.message || error || '').toLowerCase();
  if (!msg) return false;
  return /google login|redeploy|unauthorized|unauthorised|sign in|sign-in|forbidden|\b401\b|\b403\b|anyone|login page|asked for a google/.test(msg);
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

export async function fetchStage(code) {
  const normalized = normalizeStageCode(code);
  if (!normalized) throw new Error('Missing stage code.');
  const res = await fetch(`/api/stage?s=${encodeURIComponent(normalized)}`, { cache: 'no-store' });
  const data = await readJson(res);
  if (!res.ok) {
    throw new Error(data.error || `Couldn’t load the board (${res.status}).`);
  }
  return {
    code: data.code || normalized,
    payload: data.payload && typeof data.payload === 'object' && !Array.isArray(data.payload) ? data.payload : {},
    updatedAt: data.updatedAt || '',
  };
}

export async function postStage(code, payload) {
  const normalized = normalizeStageCode(code);
  if (!normalized) throw new Error('Missing stage code.');
  const res = await fetch('/api/stage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: normalized, payload: payload || {} }),
  });
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
