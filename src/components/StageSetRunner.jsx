import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Square, Tv, Wand2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore.js';
import { catalogIdsFromState, resolveGameGeneratorLink } from '../lib/gameGenerator.js';
import { playItemsFromState } from '../lib/stagePlay.js';
import { stageMessageText } from '../lib/stageMessage.js';

function chipClass(on, type) {
  if (on) {
    if (type === 'term') return 'bg-purple-700 text-white border-purple-400';
    if (type === 'message') return 'bg-amber-700 text-white border-amber-400';
    return 'bg-lime-700 text-white border-lime-500';
  }
  return 'bg-[#121212] text-gray-200 border-gray-800';
}

export default function StageSetRunner() {
  const stagePlay = useAppStore((s) => s.stagePlay);
  const customSets = useAppStore((s) => s.lists.customSets);
  const catalogGames = useAppStore((s) => s.data.games);
  const catalogTerms = useAppStore((s) => s.data.terms);
  const generatorRows = useAppStore((s) => s.data.generator);
  const banks = useAppStore((s) => s.data.banks);
  const prompts = useAppStore((s) => s.data.prompts);
  const links = useAppStore((s) => s.gameGeneratorLinks);
  const cueStagePlayIndex = useAppStore((s) => s.cueStagePlayIndex);
  const generateFromGame = useAppStore((s) => s.generateFromGame);
  const clearStagePlay = useAppStore((s) => s.clearStagePlay);
  const showTermOnBoard = useAppStore((s) => s.showTermOnBoard);
  const [openTermId, setOpenTermId] = useState('');

  const resolved = useMemo(
    () => playItemsFromState({
      stagePlay,
      lists: { customSets },
      data: { games: catalogGames, terms: catalogTerms },
    }),
    [stagePlay, customSets, catalogGames, catalogTerms],
  );

  useEffect(() => {
    if (stagePlay && !resolved.play) clearStagePlay();
  }, [stagePlay, resolved.play, clearStagePlay]);

  useEffect(() => {
    setOpenTermId('');
  }, [resolved.play?.index, resolved.current?.type, resolved.current?.id]);

  if (!resolved.play || !resolved.current) return null;

  const { set, items, current, play } = resolved;
  const catalog = catalogIdsFromState({ data: { generator: generatorRows, banks, prompts } });
  const currentGame = current.type === 'game' ? current.game : null;
  const hasLink = Boolean(currentGame && resolveGameGeneratorLink(links?.[currentGame.id], catalog));
  const at = play.index + 1;
  const noteTerm = current.type === 'term'
    ? current.term
    : current.linkedTerms.find((term) => term.id === openTermId) || null;

  return (
    <div className="mb-3 rounded-xl border border-lime-800/40 bg-[#1A1A1A] p-2">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-black font-display text-white truncate">
          {set.name}
          <span className="ml-2 text-2xs font-bold text-gray-500 tabular-nums">{at} / {items.length}</span>
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
        {items.map((item, index) => {
          const on = index === play.index;
          return (
            <button
              key={`${item.type}-${item.id}-${index}`}
              type="button"
              onClick={() => cueStagePlayIndex(index)}
              className={`min-h-11 px-2.5 rounded-full text-xs font-bold shrink-0 border ${chipClass(on, item.type)}`}
            >
              {item.label}
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
          aria-label="Previous"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {currentGame ? (
          <button
            type="button"
            onClick={() => generateFromGame(currentGame.id, { stay: true })}
            disabled={!hasLink}
            className="flex-1 min-h-11 rounded-lg bg-lime-700 text-white font-bold text-sm inline-flex items-center justify-center gap-1.5 disabled:bg-gray-800 disabled:text-gray-500"
          >
            <Wand2 className="w-4 h-4" />
            Generate
          </button>
        ) : current.type === 'term' && current.term ? (
          <button
            type="button"
            onClick={() => showTermOnBoard(current.term)}
            className="flex-1 min-h-11 rounded-lg bg-purple-700 text-white font-bold text-sm inline-flex items-center justify-center gap-1.5"
          >
            <Tv className="w-4 h-4" />
            Show on board
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="flex-1 min-h-11 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-xs font-bold inline-flex items-center justify-center px-2 text-center"
          >
            On the board
          </button>
        )}
        <button
          type="button"
          onClick={() => cueStagePlayIndex(play.index + 1)}
          disabled={play.index >= items.length - 1}
          className="min-h-11 min-w-11 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 disabled:text-gray-600 inline-flex items-center justify-center"
          aria-label="Next"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      {currentGame && !hasLink ? (
        <p className="text-2xs text-gray-500 mt-1.5">Link a generator on this game first.</p>
      ) : null}
      {currentGame && current.linkedTerms.length ? (
        <div className="flex flex-wrap gap-1 mt-2">
          {current.linkedTerms.map((term) => {
            const on = openTermId === term.id;
            return (
              <button
                key={term.id}
                type="button"
                onClick={() => setOpenTermId(on ? '' : term.id)}
                className={`min-h-9 px-2.5 rounded-full text-2xs font-bold border ${
                  on ? 'bg-purple-700 text-white border-purple-400' : 'bg-[#121212] text-purple-200 border-purple-900'
                }`}
              >
                {term.term}
              </button>
            );
          })}
        </div>
      ) : null}
      {current.type === 'term' && current.term ? (
        <TermNotes term={current.term} />
      ) : noteTerm ? (
        <div className="mt-2">
          <TermNotes term={noteTerm} />
          <button
            type="button"
            onClick={() => showTermOnBoard(noteTerm)}
            className="mt-2 w-full min-h-11 rounded-lg bg-purple-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
          >
            <Tv className="w-3.5 h-3.5" />
            Show on board
          </button>
        </div>
      ) : current.type === 'message' ? (
        <p className="text-xs text-gray-400 mt-2 whitespace-pre-wrap line-clamp-6">
          {stageMessageText(current.message)}
        </p>
      ) : null}
    </div>
  );
}

function TermNotes({ term }) {
  const def = String(term.definition || term.definitions || '').trim();
  return (
    <div className="mt-2 rounded-lg border border-purple-900/50 bg-[#121212] px-2.5 py-2">
      <p className="text-sm font-black font-display text-white leading-tight">{term.term}</p>
      {def ? <p className="text-xs text-gray-400 mt-1 leading-relaxed">{def}</p> : null}
    </div>
  );
}
