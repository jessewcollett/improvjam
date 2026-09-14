import { useEffect, useMemo, useState } from 'react';
import { Shuffle } from 'lucide-react';
import { gamesFromCatalog } from '../lib/stage.js';
import { useAppStore } from '../store/useAppStore.js';
import GameCard from './GameCard.jsx';
import StagePin, { GamePartToggles } from './StagePin.jsx';

const FORMS = [
  { id: 'warmup', label: 'Warm-up', match: ['Warm-Up'] },
  { id: 'short', label: 'Short form', match: ['Short Form', 'Line Games', 'Endowment'] },
  { id: 'long', label: 'Long form', match: ['Long Form'] },
  { id: 'exercise', label: 'Exercise', match: ['Exercise'] },
  { id: 'ideas', label: 'Idea generators', match: ['Idea Generators'] },
  { id: 'any', label: 'Surprise', match: null },
];

const SET_LIST = [
  { form: 'warmup', n: 2 },
  { form: 'short', n: 4 },
  { form: 'long', n: 1 },
];

function pick(arr) {
  return arr?.length ? arr[Math.floor(Math.random() * arr.length)] : undefined;
}

function inForm(game, match) {
  if (!match) return true;
  const cats = game.categories?.length ? game.categories : [game.category];
  return cats.some((cat) => match.includes(cat));
}

export default function RandomGameDraw() {
  const games = useAppStore((s) => s.data.games) || [];
  const stagePins = useAppStore((s) => s.stagePins);
  const setStageSlot = useAppStore((s) => s.setStageSlot);
  const toggleStagePin = useAppStore((s) => s.toggleStagePin);
  const gamesPinned = stagePins.includes('games');
  const stageSlots = useAppStore((s) => s.stageSlots);
  const toggleStageGamePart = useAppStore((s) => s.toggleStageGamePart);
  const [formId, setFormId] = useState('warmup');
  const [drawn, setDrawn] = useState([]);

  useEffect(() => {
    if (!drawn.length || !useAppStore.getState().stagePins.includes('games')) return;
    const previous = useAppStore.getState().stageSlots.games;
    setStageSlot('games', gamesFromCatalog(drawn, previous));
  }, [drawn, setStageSlot]);

  const poolFor = useMemo(() => {
    const map = {};
    FORMS.forEach((form) => {
      map[form.id] = games.filter((game) => inForm(game, form.match));
    });
    return map;
  }, [games]);

  const drawOne = (id, avoid) => {
    const all = poolFor[id] || [];
    if (!all.length) return undefined;
    const fresh = all.filter((game) => !avoid.has(game.id));
    return pick(fresh.length ? fresh : all);
  };

  const onDraw = () => {
    if (formId === 'setlist') {
      const used = new Set();
      const next = [];
      SET_LIST.forEach(({ form, n }) => {
        for (let i = 0; i < n; i += 1) {
          const game = drawOne(form, used);
          if (!game) continue;
          used.add(game.id);
          next.push(game);
        }
      });
      setDrawn(next);
      return;
    }
    const game = drawOne(formId, new Set());
    setDrawn(game ? [game] : []);
  };

  return (
    <div className="flex-1 h-full flex flex-col min-h-0">
      <div className="flex-none px-4 md:px-6 pt-3 pb-3 border-b border-gray-800">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {FORMS.map((form) => (
            <button
              key={form.id}
              type="button"
              onClick={() => setFormId(form.id)}
              aria-pressed={formId === form.id}
              className={`min-h-11 px-3 rounded-full text-xs font-bold border ${
                formId === form.id
                  ? 'bg-lime-600 text-black border-lime-400'
                  : 'bg-transparent text-gray-300 border-gray-700'
              }`}
            >
              {form.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setFormId('setlist')}
            aria-pressed={formId === 'setlist'}
            className={`min-h-11 px-3 rounded-full text-xs font-bold border ${
              formId === 'setlist'
                ? 'bg-lime-600 text-black border-lime-400'
                : 'bg-transparent text-gray-300 border-gray-700'
            }`}
          >
            Set list
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDraw}
            disabled={!games.length}
            className="flex-1 min-h-11 rounded-xl bg-lime-700 disabled:bg-gray-800 disabled:text-gray-500 text-black font-black text-sm inline-flex items-center justify-center gap-2"
          >
            <Shuffle className="w-4 h-4" />
            {formId === 'setlist' ? 'Draw a set list' : 'Draw a game'}
          </button>
          <StagePin
            pressed={gamesPinned}
            label={gamesPinned ? 'Unpin games from Stage' : 'Pin games to Stage'}
            onClick={() => {
              if (!gamesPinned) {
                const previous = useAppStore.getState().stageSlots.games;
                setStageSlot('games', gamesFromCatalog(drawn, previous));
              }
              toggleStagePin('games');
            }}
          />
        </div>
        {gamesPinned && drawn.length ? (
          <div className="mt-2 space-y-1.5">
            {drawn.map((game) => {
              const pinned = (stageSlots.games || []).find(
                (item) => String(item?.name || '').trim() === String(game.name || '').trim(),
              );
              if (!pinned) return null;
              return (
                <div key={game.id || game.name}>
                  {drawn.length > 1 ? (
                    <p className="text-2xs uppercase tracking-wider text-gray-500 font-bold mb-1 truncate">
                      {game.name}
                    </p>
                  ) : null}
                  <GamePartToggles
                    game={pinned}
                    onToggle={(partId) => toggleStageGamePart(game.name, partId)}
                  />
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-4 md:px-6 pt-3 pb-nav">
        {drawn.length ? (
          <div className="space-y-1.5">
            {drawn.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Pick a form, then Draw a game.</p>
        )}
      </div>
    </div>
  );
}
