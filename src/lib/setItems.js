import { normalizeStageMessage, stageMessageText } from './stageMessage.js';

export const SET_ITEM_MAX = 200;

export function newSetItemId(prefix = 'si') {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export function setItemKey(item) {
  if (!item || typeof item !== 'object') return '';
  if (item.type === 'message') return `message:${item.id}`;
  if (item.type === 'term') return `term:${item.id}`;
  if (item.type === 'game') return `game:${item.id}`;
  return '';
}

function uniqueIds(raw) {
  const seen = new Set();
  const out = [];
  (Array.isArray(raw) ? raw : []).forEach((value) => {
    const id = String(value || '').trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(id);
  });
  return out;
}

export function itemsFromGames(ids) {
  return uniqueIds(ids).map((id) => ({ type: 'game', id }));
}

export function gameIdsFromItems(items) {
  return uniqueIds((Array.isArray(items) ? items : []).filter((item) => item?.type === 'game').map((item) => item.id));
}

export function messageItemLabel(message, max = 48) {
  const text = stageMessageText(message);
  const line = text.split('\n').map((part) => part.trim()).find(Boolean) || 'Message';
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

export function normalizeSetItem(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const type = String(raw.type || '').trim();
  if (type === 'game') {
    const id = String(raw.id || '').trim();
    if (!id) return null;
    const terms = uniqueIds(raw.terms);
    return terms.length ? { type: 'game', id, terms } : { type: 'game', id };
  }
  if (type === 'term') {
    const id = String(raw.id || '').trim();
    if (!id) return null;
    return { type: 'term', id };
  }
  if (type === 'message') {
    const message = normalizeStageMessage(raw.message);
    if (!stageMessageText(message)) return null;
    const id = String(raw.id || '').trim() || newSetItemId('msg');
    return { type: 'message', id, message };
  }
  return null;
}

export function normalizeSetItems(set) {
  if (Array.isArray(set?.items)) {
    return set.items.map(normalizeSetItem).filter(Boolean).slice(0, SET_ITEM_MAX);
  }
  return itemsFromGames(set?.games).slice(0, SET_ITEM_MAX);
}

export function withSetItems(set, items) {
  const nextItems = (Array.isArray(items) ? items : []).map(normalizeSetItem).filter(Boolean).slice(0, SET_ITEM_MAX);
  return {
    ...set,
    items: nextItems,
    games: gameIdsFromItems(nextItems),
  };
}

export function normalizeCustomSet(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = String(raw.id || '').trim();
  const name = String(raw.name || '').trim();
  if (!id || !name) return null;
  return withSetItems({ id, name }, normalizeSetItems(raw));
}

export function normalizeCustomSets(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeCustomSet).filter(Boolean);
}

function idList(raw) {
  return uniqueIds(Array.isArray(raw) ? raw : []);
}

export function normalizeLists(raw) {
  const lists = raw && typeof raw === 'object' ? raw : {};
  return {
    favorites: idList(lists.favorites),
    toPlay: idList(lists.toPlay),
    played: idList(lists.played),
    learned: idList(lists.learned),
    customSets: normalizeCustomSets(lists.customSets),
  };
}

function richerMessageItem(prev, next) {
  const prevText = stageMessageText(prev.message);
  const nextText = stageMessageText(next.message);
  if (nextText.length > prevText.length) return next;
  if (prevText.length > nextText.length) return prev;
  const prevHtml = prev.message && typeof prev.message === 'object' ? String(prev.message.html || '') : '';
  const nextHtml = next.message && typeof next.message === 'object' ? String(next.message.html || '') : '';
  return nextHtml.length > prevHtml.length ? next : prev;
}

function mergeSetItem(prev, next) {
  if (!prev) return next;
  if (!next) return prev;
  if (prev.type === 'message' && next.type === 'message') return richerMessageItem(prev, next);
  if (prev.type === 'game' && next.type === 'game') {
    const terms = uniqueIds([...(prev.terms || []), ...(next.terms || [])]);
    return terms.length ? { type: 'game', id: prev.id, terms } : { type: 'game', id: prev.id };
  }
  return prev;
}

export function mergeSetItems(a, b) {
  const left = (Array.isArray(a) ? a : []).map(normalizeSetItem).filter(Boolean);
  const right = (Array.isArray(b) ? b : []).map(normalizeSetItem).filter(Boolean);
  const byKey = new Map();
  const order = [];
  const put = (item) => {
    const key = setItemKey(item);
    if (!key) return;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, item);
      order.push(key);
      return;
    }
    byKey.set(key, mergeSetItem(prev, item));
  };
  left.forEach(put);
  right.forEach(put);
  return order.map((key) => byKey.get(key)).filter(Boolean).slice(0, SET_ITEM_MAX);
}

function mergeCustomSet(left, right) {
  const a = normalizeCustomSet(left);
  const b = normalizeCustomSet(right);
  if (!a) return b;
  if (!b) return a;
  return withSetItems({ id: a.id, name: a.name || b.name }, mergeSetItems(a.items, b.items));
}

export function mergeLists(a, b) {
  const left = normalizeLists(a);
  const right = normalizeLists(b);
  const byId = new Map();
  left.customSets.forEach((set) => byId.set(set.id, set));
  right.customSets.forEach((set) => {
    const prev = byId.get(set.id);
    byId.set(set.id, prev ? mergeCustomSet(prev, set) : set);
  });
  const seen = new Set();
  const customSets = [];
  [...left.customSets, ...right.customSets].forEach((set) => {
    if (seen.has(set.id)) return;
    seen.add(set.id);
    customSets.push(byId.get(set.id));
  });
  return {
    favorites: idList([...left.favorites, ...right.favorites]),
    toPlay: idList([...left.toPlay, ...right.toPlay]),
    played: idList([...left.played, ...right.played]),
    learned: idList([...left.learned, ...right.learned]),
    customSets,
  };
}

export function termIsSetSlide(set, termId) {
  const key = String(termId || '').trim();
  if (!key) return false;
  return normalizeSetItems(set).some((item) => item.type === 'term' && item.id === key);
}

export function termIsLinkedToGame(set, gameId, termId) {
  const gameKey = String(gameId || '').trim();
  const termKey = String(termId || '').trim();
  if (!gameKey || !termKey) return false;
  const item = normalizeSetItems(set).find((entry) => entry.type === 'game' && entry.id === gameKey);
  return Boolean(item?.terms?.includes(termKey));
}

export function termIsInSet(set, termId) {
  const key = String(termId || '').trim();
  if (!key) return false;
  return normalizeSetItems(set).some((item) => {
    if (item.type === 'term' && item.id === key) return true;
    if (item.type === 'game' && (item.terms || []).includes(key)) return true;
    return false;
  });
}

export function setItemCounts(set) {
  const items = normalizeSetItems(set);
  return {
    total: items.length,
    games: items.filter((item) => item.type === 'game').length,
    terms: items.filter((item) => item.type === 'term').length,
    messages: items.filter((item) => item.type === 'message').length,
  };
}

export function setCountLabel(set) {
  const counts = setItemCounts(set);
  if (!counts.total) return 'Empty';
  const parts = [];
  if (counts.games) parts.push(`${counts.games} game${counts.games === 1 ? '' : 's'}`);
  if (counts.terms) parts.push(`${counts.terms} term${counts.terms === 1 ? '' : 's'}`);
  if (counts.messages) parts.push(`${counts.messages} message${counts.messages === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

export function reorderSetItems(items, keys) {
  const list = Array.isArray(items) ? items : [];
  const byKey = new Map();
  list.forEach((item) => {
    const key = setItemKey(item);
    if (key && !byKey.has(key)) byKey.set(key, item);
  });
  const ordered = (Array.isArray(keys) ? keys : []).map((key) => byKey.get(key)).filter(Boolean);
  const leftover = list.filter((item) => !ordered.includes(item));
  return [...ordered, ...leftover];
}

export function labelForSetItem(item, { games = [], terms = [] } = {}) {
  if (item?.type === 'game') {
    return games.find((game) => game.id === item.id)?.name || item.id;
  }
  if (item?.type === 'term') {
    return terms.find((term) => term.id === item.id)?.term || item.id;
  }
  if (item?.type === 'message') return messageItemLabel(item.message);
  return '';
}

function escapeHtml(raw) {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function paragraphsToHtml(raw) {
  return String(raw || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('');
}

export function termBoardMessage(term) {
  const name = String(term?.term || '').trim();
  const def = String(term?.definition || term?.definitions || '').trim();
  if (!name && !def) return '';
  const html = [
    name ? `<p><strong>${escapeHtml(name)}</strong></p>` : '',
    paragraphsToHtml(def),
  ].filter(Boolean).join('');
  return normalizeStageMessage({
    html,
    text: [name, def].filter(Boolean).join('\n\n'),
  });
}

export function resolvePlayableItems(set, { games = [], terms = [] } = {}) {
  const gameById = new Map((games || []).map((game) => [game.id, game]));
  const termById = new Map((terms || []).map((term) => [term.id, term]));
  return normalizeSetItems(set)
    .map((item) => {
      if (item.type === 'game') {
        const game = gameById.get(item.id);
        if (!game) return null;
        const linkedTerms = (item.terms || []).map((id) => termById.get(id)).filter(Boolean);
        return {
          ...item,
          game,
          term: null,
          linkedTerms,
          label: game.name,
        };
      }
      if (item.type === 'term') {
        const term = termById.get(item.id);
        if (!term) return null;
        return {
          ...item,
          game: null,
          term,
          linkedTerms: [],
          label: term.term,
        };
      }
      if (item.type === 'message') {
        if (!stageMessageText(item.message)) return null;
        return {
          ...item,
          game: null,
          term: null,
          linkedTerms: [],
          label: messageItemLabel(item.message),
        };
      }
      return null;
    })
    .filter(Boolean);
}
