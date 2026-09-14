import { Pin } from 'lucide-react';
import { availableGameParts, normalizeGameParts } from '../lib/stage.js';
import { useAppStore } from '../store/useAppStore.js';

export function GamePartToggles({ game, onToggle, className = '' }) {
  const catalogGames = useAppStore((s) => s.data.games);
  const name = String(game?.name || '').trim();
  const catalog = (catalogGames || []).find((item) => String(item.name || '').trim() === name) || game;
  const parts = availableGameParts(catalog);
  if (!parts.length) return null;
  const selected = new Set(normalizeGameParts(game?.parts, catalog));
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {parts.map((part) => {
        const on = selected.has(part.id);
        return (
          <button
            key={part.id}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(part.id)}
            className={`min-h-8 px-2 rounded-lg text-2xs font-bold border ${
              on ? 'bg-lime-700 text-white border-lime-500' : 'bg-[#1A1A1A] text-gray-300 border-gray-800'
            }`}
          >
            {part.label}
          </button>
        );
      })}
    </div>
  );
}

export default function StagePin({ pressed, onClick, label, className = '' }) {
  const on = Boolean(pressed);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={label || (on ? 'Unpin from Stage' : 'Pin to Stage')}
      className={`inline-flex items-center justify-center min-w-11 min-h-11 rounded-lg shrink-0 ${
        on ? 'text-lime-300 bg-lime-900/40' : 'text-gray-500 bg-gray-800/70'
      } ${className}`}
    >
      <Pin className="w-4 h-4" fill={on ? 'currentColor' : 'none'} />
    </button>
  );
}
