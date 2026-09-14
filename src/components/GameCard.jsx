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
  ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/useAppStore.js';
import { categoryClass } from '../lib/categoryStyles.js';
import { splitList } from '../lib/generator.js';
import CatalogImage from './CatalogImage.jsx';
import { ItemSource } from './SourceCitation.jsx';
import { trustedSourceUrl } from '../lib/sheets.js';
import { findStageGameIndex, gameIsOnStage, gamesFromCatalog } from '../lib/stage.js';
import StagePin, { GamePartToggles } from './StagePin.jsx';

function iconClass(active, on) {
  return `flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${
    active ? on : 'text-gray-500'
  }`;
}

export default function GameCard({ game, onCategoryClick }) {
  const lists = useAppStore((s) => s.lists);
  const sources = useAppStore((s) => s.data.sources);
  const toggleInList = useAppStore((s) => s.toggleInList);
  const toggleInCustomSet = useAppStore((s) => s.toggleInCustomSet);
  const stagePins = useAppStore((s) => s.stagePins);
  const stageSlots = useAppStore((s) => s.stageSlots);
  const setStageSlot = useAppStore((s) => s.setStageSlot);
  const toggleStagePin = useAppStore((s) => s.toggleStagePin);
  const removeStageSlotItem = useAppStore((s) => s.removeStageSlotItem);
  const toggleStageGamePart = useAppStore((s) => s.toggleStageGamePart);
  const gameIndex = findStageGameIndex(stageSlots.games, game);
  const gamePinned = stagePins.includes('games') && gameIndex >= 0;
  const isFavorite = lists.favorites.includes(game.id);
  const isToPlay = lists.toPlay.includes(game.id);
  const isPlayed = lists.played.includes(game.id);
  const inAnySet = lists.customSets.some((set) => set.games.includes(game.id));
  const [expanded, setExpanded] = useState(false);
  const [showSets, setShowSets] = useState(false);
  const categories = game.categories?.length ? game.categories : splitList(game.category);
  const tags = splitList(game.tags);
  const lifeSkills = splitList(game.lifeSkills);
  const visibleTags = tags.slice(0, expanded ? tags.length : 2);
  const originalHref = trustedSourceUrl(game, sources);

  const customSetMenu = (
    <div className="absolute top-full right-0 mt-1 w-52 bg-[#121212] border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-20">
      <div className="bg-gray-800 text-2xs font-bold text-gray-400 uppercase tracking-wider px-3 py-2 border-b border-gray-700">
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
      className="bg-card border border-gray-800 rounded-xl shadow-lg overflow-visible relative h-full"
    >
      <div className="flex items-center gap-1 px-2.5 py-1.5">
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="w-full min-w-0 text-left py-0.5"
            aria-expanded={expanded}
          >
            <div className="flex items-start gap-1">
              <h3 className="text-base font-bold font-display text-gray-100 leading-tight">{game.name}</h3>
              <ChevronRight className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </div>
          </button>
          <div className="flex flex-wrap gap-1 mt-1">
            {categories.map((cat) => (
              <button
                key={`cat-${cat}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCategoryClick?.(cat);
                }}
                className={`text-2xs font-semibold px-1.5 py-0.5 rounded-full border ${categoryClass(cat)}`}
              >
                {cat}
              </button>
            ))}
            {visibleTags.map((tag) => (
              <span
                key={`tag-${tag}`}
                className="text-2xs font-semibold px-1.5 py-0.5 rounded-full border text-gray-400 bg-gray-800 border-gray-700"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
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
              <div className="mb-2">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold text-gray-400">Show on Stage</span>
                  <StagePin
                    pressed={gamePinned}
                    label={gamePinned ? 'Unpin game from Stage' : 'Pin game to Stage'}
                    onClick={() => {
                      if (gamePinned) {
                        if (gameIndex >= 0) removeStageSlotItem('games', gameIndex);
                        return;
                      }
                      if (gameIsOnStage(stageSlots.games, game)) {
                        if (!stagePins.includes('games')) toggleStagePin('games');
                        return;
                      }
                      const current = Array.isArray(stageSlots.games) ? stageSlots.games : [];
                      setStageSlot('games', [...current, ...gamesFromCatalog([game], current)]);
                      if (!stagePins.includes('games')) toggleStagePin('games');
                    }}
                  />
                </div>
                {gamePinned ? (
                  <GamePartToggles
                    game={stageSlots.games[gameIndex] || game}
                    onToggle={(partId) => toggleStageGamePart(game.name, partId)}
                  />
                ) : null}
              </div>
              <CatalogImage src={game.imageSrc || game.image} alt={game.name} />
              {lifeSkills.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1 items-center">
                  <span className="text-2xs font-bold text-emerald-500 uppercase tracking-wider mr-1">Life Skills</span>
                  {lifeSkills.map((skill) => (
                    <span key={skill} className="text-2xs text-emerald-300/80 bg-emerald-900/20 border border-emerald-800/30 px-1.5 py-0.5 rounded-full">
                      {skill}
                    </span>
                  ))}
                </div>
              )}

              <p className="text-sm text-gray-300 leading-relaxed mb-2">{game.description}</p>
              {[
                ['Setup', game.setup],
                ['How to play', game.howToPlay],
                ['Gimmicks', game.gimmicks],
              ].map(([label, text]) => (
                text ? (
                  <div key={label} className="mb-2">
                    <p className="text-2xs font-bold uppercase tracking-wider text-gray-500 mb-0.5">{label}</p>
                    <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{text}</p>
                  </div>
                ) : null
              ))}
              {game.synonyms?.length ? (
                <p className="text-sm text-gray-400 mb-2">
                  <span className="text-2xs font-bold uppercase tracking-wider text-gray-500 mr-1">Also called</span>
                  {game.synonyms.join(', ')}
                </p>
              ) : null}
              {game.variations?.length ? (
                <p className="text-sm text-gray-400 mb-2">
                  <span className="text-2xs font-bold uppercase tracking-wider text-gray-500 mr-1">Variations</span>
                  {game.variations.join(', ')}
                </p>
              ) : null}
              {originalHref ? (
                <a
                  href={originalHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-2xs text-blue-400 mb-2 min-h-9"
                >
                  Open original
                  <ExternalLink className="w-3 h-3 ml-1 opacity-70" />
                </a>
              ) : null}
              <ItemSource item={game} sources={sources} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
