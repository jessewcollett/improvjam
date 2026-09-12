import { useMemo, useState } from 'react';
import { Dices, BookMarked, ListFilter, Check, X } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { localDateString, useAppStore } from '../store/useAppStore.js';
import { splitList } from '../lib/generator.js';
import GameCard from './GameCard.jsx';
import TermCard from './TermCard.jsx';
import { LibraryFooter } from './SourceCitation.jsx';
import SearchField from './SearchField.jsx';
import SyncButton from './SyncButton.jsx';

function itemCategories(item) {
  return item.categories?.length ? item.categories : splitList(item.category);
}

function toggleValue(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function addValue(list, value) {
  return list.includes(value) ? list : [...list, value];
}

export default function LibraryView() {
  const data = useAppStore((s) => s.data);
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const dismissedTipDate = useAppStore((s) => s.dismissedTipDate);
  const dismissTipOfTheDay = useAppStore((s) => s.dismissTipOfTheDay);
  const [searchTerm, setSearchTerm] = useState('');
  const [gameFilters, setGameFilters] = useState([]);
  const [termFilters, setTermFilters] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const viewType = settings.libraryView === 'terms' ? 'terms' : 'games';

  const setViewType = (next) => updateSettings({ libraryView: next });

  const categories = useMemo(
    () => Array.from(new Set(data.games.flatMap(itemCategories).filter(Boolean))),
    [data.games],
  );
  const termCategories = useMemo(
    () => Array.from(new Set(data.terms.flatMap(itemCategories).filter(Boolean))),
    [data.terms],
  );

  const tip = useMemo(() => {
    if (!data.terms.length) return null;
    const day = new Date().getDate();
    return data.terms[day % data.terms.length];
  }, [data.terms]);

  const selectedFilters = viewType === 'games' ? gameFilters : termFilters;
  const setSelectedFilters = viewType === 'games' ? setGameFilters : setTermFilters;
  const filterOptions = viewType === 'games' ? categories : termCategories;
  const filterActive = selectedFilters.length > 0;

  const filteredGames = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return data.games.filter((game) => {
      const cats = itemCategories(game);
      const tags = splitList(game.tags);
      const skills = splitList(game.lifeSkills);
      const hay = [game.name, game.description, ...tags, ...skills, ...cats].join(' ').toLowerCase();
      const matchesSearch = !q || hay.includes(q);
      const matchesFilter = !gameFilters.length || gameFilters.some((cat) => cats.includes(cat));
      return matchesSearch && matchesFilter;
    });
  }, [data.games, searchTerm, gameFilters]);

  const filteredTerms = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return data.terms
      .filter((t) => {
        const cats = itemCategories(t);
        const matchesSearch = !q || `${t.term} ${t.definition} ${cats.join(' ')}`.toLowerCase().includes(q);
        const matchesFilter = !termFilters.length || termFilters.some((cat) => cats.includes(cat));
        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => a.term.localeCompare(b.term));
  }, [data.terms, searchTerm, termFilters]);

  return (
    <div className="h-full flex flex-col pt-safe px-4 md:px-6">
      <div className="flex-none mb-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h1 className="text-2xl font-black font-display text-white tracking-tight min-w-0">The Library</h1>
          <SyncButton compact />
        </div>

        {viewType === 'terms' && tip && dismissedTipDate !== localDateString() && (
          <div className="relative mb-4 rounded-xl border border-purple-800/50 bg-purple-900/20 p-3 pr-12">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                dismissTipOfTheDay();
              }}
              className="absolute top-0 right-0 flex items-center justify-center min-w-11 min-h-11 text-gray-400"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
            <p className="text-xs uppercase tracking-wider text-purple-400 font-bold mb-1">Tip of the day</p>
            <p className="text-sm text-gray-100 font-semibold">{tip.term}</p>
            <p className="text-xs text-gray-400 mt-1">{tip.definition}</p>
          </div>
        )}

        <div className="mb-4">
          <SearchField
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search games, skills, or terms..."
          />
        </div>

        <div className="flex bg-[#1A1A1A] p-1 rounded-xl mb-3 border border-gray-800">
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center min-h-11 px-2 ${
              viewType === 'games' ? 'bg-gray-700 text-white' : 'text-gray-400'
            }`}
            onClick={() => setViewType('games')}
          >
            <Dices className="w-4 h-4 mr-2 shrink-0" />
            <span className="text-center leading-tight">Games ({data.games.length})</span>
          </button>
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center min-h-11 px-2 ${
              viewType === 'terms' ? 'bg-gray-700 text-white' : 'text-gray-400'
            }`}
            onClick={() => setViewType('terms')}
          >
            <BookMarked className="w-4 h-4 mr-2 shrink-0" />
            <span className="text-center leading-tight">Glossary ({data.terms.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-bold min-h-11 border ${
              filterActive
                ? 'bg-blue-600/20 text-blue-200 border-blue-400'
                : 'bg-gray-800 text-gray-300 border-gray-700'
            }`}
            aria-expanded={filtersOpen}
          >
            <ListFilter className="w-4 h-4" />
            Filter
            {filterActive ? (
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-blue-600 text-white text-xs">
                {selectedFilters.length}
              </span>
            ) : null}
          </button>
          {filterActive ? (
            <button
              type="button"
              onClick={() => setSelectedFilters([])}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-bold min-h-11 border border-gray-700 bg-gray-800 text-gray-200"
            >
              <X className="w-4 h-4" />
              Clear filters
            </button>
          ) : null}
          {filterActive && !filtersOpen ? (
            <span className="text-xs font-semibold text-blue-300 min-w-0">
              {selectedFilters.join(' · ')}
            </span>
          ) : null}
        </div>

        {filtersOpen && (
          <div className="flex flex-wrap gap-2 mt-3">
            {filterOptions.map((cat) => {
              const active = selectedFilters.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedFilters((prev) => toggleValue(prev, cat))}
                  className={`inline-flex items-center gap-1 px-3 py-2 rounded-full text-sm font-medium min-h-11 border ${
                    active ? 'bg-blue-600 text-white border-blue-300 shadow-md' : 'bg-gray-800 text-gray-300 border-gray-700'
                  }`}
                >
                  {active ? <Check className="w-3.5 h-3.5" /> : null}
                  {cat}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide pb-nav">
        <AnimatePresence mode="popLayout">
          {viewType === 'games' ? (
            filteredGames.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 lg:gap-3">
                {filteredGames.map((game) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    onCategoryClick={(cat) => setGameFilters((prev) => addValue(prev, cat))}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 mt-10">No games found matching “{searchTerm}”</div>
            )
          ) : filteredTerms.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 lg:gap-3">
              {filteredTerms.map((term) => (
                <TermCard
                  key={term.id || term.term}
                  termData={term}
                  onCategoryClick={(cat) => setTermFilters((prev) => addValue(prev, cat))}
                />
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 mt-10">No terms found matching “{searchTerm}”</div>
          )}
        </AnimatePresence>
        <LibraryFooter sources={data.sources} />
      </div>
    </div>
  );
}
