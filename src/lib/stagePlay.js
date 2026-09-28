import { resolvePlayableItems } from './setItems.js';

export function normalizeStagePlay(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const setId = String(raw.setId || '').trim();
  if (!setId) return null;
  const index = Math.max(0, Math.round(Number(raw.index) || 0));
  return { setId, index };
}

export function playItemsFromState(state) {
  const play = normalizeStagePlay(state?.stagePlay);
  if (!play) return { play: null, set: null, items: [], current: null };
  const set = (state?.lists?.customSets || []).find((item) => item.id === play.setId) || null;
  if (!set) return { play: null, set: null, items: [], current: null };
  const items = resolvePlayableItems(set, {
    games: state?.data?.games || [],
    terms: state?.data?.terms || [],
  });
  if (!items.length) return { play: null, set, items: [], current: null };
  const index = Math.min(play.index, items.length - 1);
  return {
    play: { setId: set.id, index },
    set,
    items,
    current: items[index] || null,
  };
}

export function playGamesFromState(state) {
  const resolved = playItemsFromState(state);
  const games = resolved.items.filter((item) => item.type === 'game').map((item) => item.game);
  const current = resolved.current?.type === 'game' ? resolved.current.game : null;
  return {
    play: resolved.play,
    set: resolved.set,
    games,
    current,
    items: resolved.items,
    currentItem: resolved.current,
  };
}
