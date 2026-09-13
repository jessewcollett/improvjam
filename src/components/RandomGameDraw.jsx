import { useMemo, useState } from 'react';
import { Shuffle } from 'lucide-react';
import { useAppStore } from '../store/useAppStore.js';
import GameCard from './GameCard.jsx';

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
  const [formId, setFormId] = useState('warmup');
  const [drawn, setDrawn] = useState([]);

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
    <section className="mb-3 rounded-2xl border border-gray-800 bg-[#1A1A1A] p-2">
      <p className="text-2xs font-bold uppercase tracking-wider text-gray-500 px-1 mb-1.5">Random game</p>
      <div className="flex flex-wrap gap-1 mb-2">
        {FORMS.map((form) => (
          <button
            key={form.id}
            type="button"
            onClick={() => setFormId(form.id)}
            className={`min-h-10 px-2.5 rounded-full text-2xs font-bold border ${
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
          className={`min-h-10 px-2.5 rounded-full text-2xs font-bold border ${
            formId === 'setlist'
              ? 'bg-lime-600 text-black border-lime-400'
              : 'bg-transparent text-gray-300 border-gray-700'
          }`}
        >
          Set list
        </button>
      </div>
      <button
        type="button"
        onClick={onDraw}
        disabled={!games.length}
        className="w-full min-h-11 rounded-xl bg-lime-700 disabled:bg-gray-800 disabled:text-gray-500 text-black font-black text-sm inline-flex items-center justify-center gap-2"
      >
        <Shuffle className="w-4 h-4" />
        {formId === 'setlist' ? 'Draw a set list' : 'Draw a game'}
      </button>
      {drawn.length ? (
        <div className="mt-2 space-y-1.5">
          {drawn.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
