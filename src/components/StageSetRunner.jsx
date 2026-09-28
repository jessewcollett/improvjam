import { useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Square, Wand2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore.js';
import { catalogIdsFromState, resolveGameGeneratorLink } from '../lib/gameGenerator.js';
import { playGamesFromState } from '../lib/stagePlay.js';

export default function StageSetRunner() {
  const stagePlay = useAppStore((s) => s.stagePlay);
  const customSets = useAppStore((s) => s.lists.customSets);
  const catalogGames = useAppStore((s) => s.data.games);
  const generatorRows = useAppStore((s) => s.data.generator);
  const banks = useAppStore((s) => s.data.banks);
  const prompts = useAppStore((s) => s.data.prompts);
  const links = useAppStore((s) => s.gameGeneratorLinks);
  const cueStagePlayIndex = useAppStore((s) => s.cueStagePlayIndex);
  const generateFromGame = useAppStore((s) => s.generateFromGame);
  const clearStagePlay = useAppStore((s) => s.clearStagePlay);

  const resolved = useMemo(
    () => playGamesFromState({
      stagePlay,
      lists: { customSets },
      data: { games: catalogGames },
    }),
    [stagePlay, customSets, catalogGames],
  );

  useEffect(() => {
    if (stagePlay && !resolved.play) clearStagePlay();
  }, [stagePlay, resolved.play, clearStagePlay]);

  if (!resolved.play || !resolved.current) return null;

  const { set, games, current, play } = resolved;
  const catalog = catalogIdsFromState({ data: { generator: generatorRows, banks, prompts } });
  const hasLink = Boolean(resolveGameGeneratorLink(links?.[current.id], catalog));
  const at = play.index + 1;

  return (
    <div className="mb-3 rounded-xl border border-lime-800/40 bg-[#1A1A1A] p-2">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-black font-display text-white truncate">
          {set.name}
          <span className="ml-2 text-2xs font-bold text-gray-500 tabular-nums">{at} / {games.length}</span>
        </p>
        <button
          type="button"
          onClick={() => clearStagePlay()}
          className="min-h-11 px-2 rounded-lg text-xs font-bold text-gray-300 inline-flex items-center gap-1"
        >
          <Square className="w-3.5 h-3.5" />
          Exit
        </button>
      </div>
      <div className="flex gap-1 overflow-x-auto scrollbar-hide mb-2">
        {games.map((game, index) => {
          const on = index === play.index;
          return (
            <button
              key={game.id}
              type="button"
              onClick={() => cueStagePlayIndex(index)}
              className={`min-h-11 px-2.5 rounded-full text-xs font-bold shrink-0 border ${
                on ? 'bg-lime-700 text-white border-lime-500' : 'bg-[#121212] text-gray-200 border-gray-800'
              }`}
            >
              {game.name}
            </button>
          );
        })}
      </div>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => cueStagePlayIndex(play.index - 1)}
          disabled={play.index <= 0}
          className="min-h-11 min-w-11 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 disabled:text-gray-600 inline-flex items-center justify-center"
          aria-label="Previous game"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => generateFromGame(current.id, { stay: true })}
          disabled={!hasLink}
          className="flex-1 min-h-11 rounded-lg bg-lime-700 text-white font-bold text-sm inline-flex items-center justify-center gap-1.5 disabled:bg-gray-800 disabled:text-gray-500"
        >
          <Wand2 className="w-4 h-4" />
          Generate
        </button>
        <button
          type="button"
          onClick={() => cueStagePlayIndex(play.index + 1)}
          disabled={play.index >= games.length - 1}
          className="min-h-11 min-w-11 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 disabled:text-gray-600 inline-flex items-center justify-center"
          aria-label="Next game"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      {!hasLink ? (
        <p className="text-2xs text-gray-500 mt-1.5">Link a generator on this game first.</p>
      ) : null}
    </div>
  );
}
