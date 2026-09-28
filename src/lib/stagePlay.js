export function normalizeStagePlay(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const setId = String(raw.setId || '').trim();
  if (!setId) return null;
  const index = Math.max(0, Math.round(Number(raw.index) || 0));
  return { setId, index };
}

export function playGamesFromState(state) {
  const play = normalizeStagePlay(state?.stagePlay);
  if (!play) return { play: null, set: null, games: [], current: null };
  const set = (state?.lists?.customSets || []).find((item) => item.id === play.setId) || null;
  if (!set) return { play: null, set: null, games: [], current: null };
  const catalog = state?.data?.games || [];
  const games = (set.games || [])
    .map((id) => catalog.find((game) => game.id === id))
    .filter(Boolean);
  if (!games.length) return { play: null, set, games: [], current: null };
  const index = Math.min(play.index, games.length - 1);
  return {
    play: { setId: set.id, index },
    set,
    games,
    current: games[index] || null,
  };
}
