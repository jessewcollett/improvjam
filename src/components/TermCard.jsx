import { useState } from 'react';
import {
  CheckCircle,
  CheckSquare,
  ChevronRight,
  Circle,
  ExternalLink,
  FolderPlus,
  Square,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { termClass } from '../lib/categoryStyles.js';
import { splitList } from '../lib/generator.js';
import { normalizeSetItems, termIsInSet, termIsLinkedToGame, termIsSetSlide } from '../lib/setItems.js';
import CatalogImage from './CatalogImage.jsx';
import { ItemSource } from './SourceCitation.jsx';
import { trustedSourceUrl } from '../lib/sheets.js';
import { useAppStore } from '../store/useAppStore.js';

function iconClass(active, on) {
  return `flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${
    active ? on : 'text-gray-500'
  }`;
}

export default function TermCard({ termData, onCategoryClick }) {
  const sources = useAppStore((s) => s.data.sources);
  const games = useAppStore((s) => s.data.games) || [];
  const lists = useAppStore((s) => s.lists);
  const toggleInList = useAppStore((s) => s.toggleInList);
  const toggleSetTerm = useAppStore((s) => s.toggleSetTerm);
  const toggleSetGameTerm = useAppStore((s) => s.toggleSetGameTerm);
  const [expanded, setExpanded] = useState(false);
  const [showSets, setShowSets] = useState(false);
  const categories = termData.categories?.length ? termData.categories : splitList(termData.category);
  const originalHref = trustedSourceUrl(termData, sources);
  const isLearned = (lists.learned || []).includes(termData.id);
  const inAnySet = (lists.customSets || []).some((set) => termIsInSet(set, termData.id));

  const customSetMenu = (
    <div className="absolute top-full right-0 mt-1 w-56 bg-[#121212] border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-20">
      <div className="bg-gray-800 text-2xs font-bold text-gray-400 uppercase tracking-wider px-3 py-2 border-b border-gray-700">
        Add to custom set
      </div>
      <div className="max-h-56 overflow-y-auto">
        {lists.customSets.length === 0 ? (
          <div className="px-3 py-4 text-xs text-gray-500 text-center italic">No custom sets yet. Create one in My Sets.</div>
        ) : (
          lists.customSets.map((set) => {
            const asSlide = termIsSetSlide(set, termData.id);
            const setGames = normalizeSetItems(set).filter((item) => item.type === 'game');
            return (
              <div key={set.id} className="border-b border-gray-800 last:border-b-0">
                <button
                  type="button"
                  onClick={() => toggleSetTerm(set.id, termData.id)}
                  className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 flex items-center min-h-11"
                >
                  {asSlide ? <CheckSquare className="w-4 h-4 mr-2 text-purple-400 shrink-0" /> : <Square className="w-4 h-4 mr-2 text-gray-500 shrink-0" />}
                  <span className="truncate">{set.name}</span>
                  <span className="ml-auto text-2xs font-bold uppercase tracking-wider text-gray-500 shrink-0 pl-2">
                    Slide
                  </span>
                </button>
                {setGames.map((item) => {
                  const game = games.find((entry) => entry.id === item.id);
                  const linked = termIsLinkedToGame(set, item.id, termData.id);
                  return (
                    <button
                      key={`${set.id}-${item.id}`}
                      type="button"
                      onClick={() => toggleSetGameTerm(set.id, item.id, termData.id)}
                      className="w-full text-left pl-8 pr-3 py-2 text-sm text-gray-400 hover:bg-gray-700 flex items-center min-h-11"
                    >
                      {linked ? <CheckSquare className="w-4 h-4 mr-2 text-indigo-400 shrink-0" /> : <Square className="w-4 h-4 mr-2 text-gray-600 shrink-0" />}
                      <span className="truncate">{game?.name || item.id}</span>
                    </button>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div className="bg-card border border-gray-800 rounded-xl overflow-visible relative h-full">
      <div className="flex items-start gap-1 px-2.5 py-1.5">
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="w-full min-w-0 text-left py-0.5"
            aria-expanded={expanded}
          >
            <div className="flex items-start gap-1">
              <h3 className="text-base font-bold font-display text-gray-100 leading-tight">{termData.term}</h3>
              <ChevronRight className={`w-4 h-4 text-gray-500 shrink-0 mt-0.5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </div>
          </button>
          <div className="flex flex-wrap items-center gap-1 mt-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => onCategoryClick?.(cat)}
                className={`text-2xs font-medium px-2 py-0.5 rounded-full border ${termClass(cat)}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center shrink-0">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSets((v) => !v)}
              className={iconClass(inAnySet || showSets, 'text-indigo-400')}
              aria-label="Add to custom set"
              aria-expanded={showSets}
            >
              <FolderPlus className="w-5 h-5" />
            </button>
            {showSets ? customSetMenu : null}
          </div>
          <button
            type="button"
            onClick={() => toggleInList('learned', termData.id)}
            className={iconClass(isLearned, 'text-green-400')}
            aria-label={isLearned ? 'Unmark learned' : 'Mark learned'}
            aria-pressed={isLearned}
          >
            {isLearned ? <CheckCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
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
            <div className="px-3 pb-3">
              <CatalogImage src={termData.imageSrc || termData.image} alt={termData.term} />
              <p className="text-sm text-gray-400 leading-relaxed mb-2">{termData.definition}</p>
              {termData.definitions ? (
                <p className="text-sm text-gray-400 leading-relaxed mb-2 whitespace-pre-wrap">{termData.definitions}</p>
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
              <ItemSource item={termData} sources={sources} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
