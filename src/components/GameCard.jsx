import { useState } from 'react';
import {
  Star,
  ListPlus,
  FolderPlus,
  CheckCircle,
  Circle,
  ChevronRight,
  CheckSquare,
  Square,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/useAppStore.js';
import { categoryClass } from '../lib/categoryStyles.js';
import { ItemSource } from './SourceCitation.jsx';

function iconClass(active, on) {
  return `flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${
    active ? on : 'text-gray-500'
  }`;
}

export default function GameCard({ game }) {
  const lists = useAppStore((s) => s.lists);
  const sources = useAppStore((s) => s.data.sources);
  const toggleInList = useAppStore((s) => s.toggleInList);
  const toggleInCustomSet = useAppStore((s) => s.toggleInCustomSet);
  const isFavorite = lists.favorites.includes(game.id);
  const isToPlay = lists.toPlay.includes(game.id);
  const isPlayed = lists.played.includes(game.id);
  const inAnySet = lists.customSets.some((set) => set.games.includes(game.id));
  const [expanded, setExpanded] = useState(false);
  const [showSets, setShowSets] = useState(false);
  const pills = [game.category, ...(game.tags || []).slice(0, expanded ? 8 : 2)].filter(Boolean);

  const customSetMenu = (
    <div className="absolute top-full right-0 mt-1 w-52 bg-[#121212] border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-20">
      <div className="bg-gray-800 text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 py-2 border-b border-gray-700">
        Add to custom set
      </div>
      <div className="max-h-40 overflow-y-auto">
        {lists.customSets.length === 0 ? (
          <div className="px-3 py-4 text-xs text-gray-500 text-center italic">No custom sets yet. Create one in My Sets.</div>
        ) : (
          lists.customSets.map((set) => {
            const inSet = set.games.includes(game.id);
            return (
              <button
                key={set.id}
                type="button"
                onClick={() => {
                  toggleInCustomSet(set.id, game.id);
                  setShowSets(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 flex items-center"
              >
                {inSet ? <CheckSquare className="w-4 h-4 mr-2 text-blue-400" /> : <Square className="w-4 h-4 mr-2 text-gray-500" />}
                <span className="truncate">{set.name}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="bg-card border border-gray-800 rounded-xl mb-2 shadow-lg overflow-visible relative"
    >
      <div className="flex items-center gap-1 px-2.5 py-1.5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 min-w-0 text-left py-0.5"
          aria-expanded={expanded}
        >
          <div className="flex items-center gap-1">
            <h3 className="text-[15px] font-bold font-display text-gray-100 truncate">{game.name}</h3>
            <ChevronRight className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {pills.map((tag) => (
              <span
                key={tag}
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                  tag === game.category ? categoryClass(game.category) : 'text-gray-400 bg-gray-800 border-gray-700'
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
        </button>
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => toggleInList('favorites', game.id)}
            className={iconClass(isFavorite, 'text-yellow-400')}
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-pressed={isFavorite}
          >
            <Star className="w-5 h-5" fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            onClick={() => toggleInList('toPlay', game.id)}
            className={iconClass(isToPlay, 'text-blue-400')}
            aria-label={isToPlay ? 'Remove from To Play' : 'Add to To Play'}
            aria-pressed={isToPlay}
          >
            <ListPlus className="w-5 h-5" />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSets((v) => !v)}
              className={iconClass(inAnySet || showSets, 'text-blue-400')}
              aria-label="Add to custom set"
              aria-expanded={showSets}
            >
              <FolderPlus className="w-5 h-5" />
            </button>
            {showSets && customSetMenu}
          </div>
          <button
            type="button"
            onClick={() => toggleInList('played', game.id)}
            className={iconClass(isPlayed, 'text-green-400')}
            aria-label={isPlayed ? 'Unmark played' : 'Mark played'}
            aria-pressed={isPlayed}
          >
            {isPlayed ? <CheckCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-0">
              {game.lifeSkills?.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1 items-center">
                  <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mr-1">Life Skills</span>
                  {game.lifeSkills.map((skill) => (
                    <span key={skill} className="text-[10px] text-emerald-300/80 bg-emerald-900/20 border border-emerald-800/30 px-1.5 py-0.5 rounded">
                      {skill}
                    </span>
                  ))}
                </div>
              )}

              <p className="text-sm text-gray-300 leading-relaxed mb-3">{game.description}</p>

              <div className="flex justify-between items-center pt-2 border-t border-gray-700/50">
                <ItemSource item={game} sources={sources} className="max-w-[38%]" />
                <div className="flex gap-2 relative">
                  <button
                    type="button"
                    onClick={() => toggleInList('toPlay', game.id)}
                    className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium min-h-11 ${
                      isToPlay ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30' : 'bg-gray-800 text-gray-400 border border-gray-700'
                    }`}
                  >
                    <ListPlus className="w-4 h-4" />
                    <span className="hidden sm:inline">{isToPlay ? 'In set' : 'To Play'}</span>
                  </button>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowSets((v) => !v)}
                      className="flex items-center justify-center p-2 rounded-lg text-gray-400 bg-gray-800 border border-gray-700 min-w-11 min-h-11"
                      aria-label="Add to custom set"
                    >
                      <FolderPlus className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleInList('played', game.id)}
                    className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium min-h-11 ${
                      isPlayed ? 'bg-green-600/20 text-green-400 border border-green-600/30' : 'bg-gray-800 text-gray-400 border border-gray-700'
                    }`}
                    aria-label="Mark played"
                  >
                    {isPlayed ? <CheckCircle className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
