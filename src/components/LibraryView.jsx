import { useMemo, useState } from 'react';
import { Dices, BookMarked, ListFilter, Check } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/useAppStore.js';
import { splitList } from '../lib/generator.js';
import GameCard from './GameCard.jsx';
import TermCard from './TermCard.jsx';
import { LibraryFooter } from './SourceCitation.jsx';
import SearchField from './SearchField.jsx';
import SyncButton from './SyncButton.jsx';

export default function LibraryView() {
  const data = useAppStore((s) => s.data);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [termFilter, setTermFilter] = useState('All');
  const [viewType, setViewType] = useState('games');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(data.games.flatMap((g) => (g.categories?.length ? g.categories : splitList(g.category)))))],
    [data.games],
  );
  const termCategories = useMemo(
    () => ['All', ...Array.from(new Set(data.terms.flatMap((t) => (t.categories?.length ? t.categories : splitList(t.category))).filter(Boolean)))],
    [data.terms],
  );

  const tip = useMemo(() => {
    if (!data.terms.length) return null;
    const day = new Date().getDate();
    return data.terms[day % data.terms.length];
  }, [data.terms]);

  const filteredGames = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return data.games.filter((game) => {
      const cats = game.categories?.length ? game.categories : splitList(game.category);
      const tags = splitList(game.tags);
      const skills = splitList(game.lifeSkills);
      const hay = [game.name, game.description, ...tags, ...skills, ...cats].join(' ').toLowerCase();
      const matchesSearch = !q || hay.includes(q);
      const matchesFilter = activeFilter === 'All' || cats.includes(activeFilter);
      return matchesSearch && matchesFilter;
    });
  }, [data.games, searchTerm, activeFilter]);

  const filteredTerms = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return data.terms
      .filter((t) => {
        const cats = t.categories?.length ? t.categories : splitList(t.category);
        const matchesSearch = !q || `${t.term} ${t.definition} ${cats.join(' ')}`.toLowerCase().includes(q);
        const matchesFilter = termFilter === 'All' || cats.includes(termFilter);
        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => a.term.localeCompare(b.term));
  }, [data.terms, searchTerm, termFilter]);

  const filterValue = viewType === 'games' ? activeFilter : termFilter;
  const filterOptions = viewType === 'games' ? categories : termCategories;
  const setFilter = viewType === 'games' ? setActiveFilter : setTermFilter;
  const filterActive = filterValue !== 'All';

  return (
    <div className="h-full flex flex-col pt-4 px-4">
      <div className="flex-none mb-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h1 className="text-2xl font-black font-display text-white tracking-tight">The Library</h1>
          <SyncButton compact />
        </div>

        {viewType === 'terms' && tip && (
          <div className="mb-4 rounded-xl border border-purple-800/50 bg-purple-900/20 p-3">
            <p className="text-[10px] uppercase tracking-wider text-purple-400 font-bold mb-1">Tip of the day</p>
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
            className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center min-h-11 ${
              viewType === 'games' ? 'bg-gray-700 text-white' : 'text-gray-400'
            }`}
            onClick={() => setViewType('games')}
          >
            <Dices className="w-4 h-4 mr-2" />
            Games ({data.games.length})
          </button>
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center min-h-11 ${
              viewType === 'terms' ? 'bg-gray-700 text-white' : 'text-gray-400'
            }`}
            onClick={() => setViewType('terms')}
          >
            <BookMarked className="w-4 h-4 mr-2" />
            Glossary ({data.terms.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-bold min-h-10 border ${
              filterActive
                ? 'bg-blue-600/20 text-blue-200 border-blue-400'
                : 'bg-gray-800 text-gray-300 border-gray-700'
            }`}
            aria-expanded={filtersOpen}
          >
            <ListFilter className="w-4 h-4" />
            Filter
            {filterActive ? (
              <span className="inline-flex items-center justify-center min-w-5 h-5 rounded-full bg-blue-600 text-white text-[10px]">
                <Check className="w-3 h-3" />
              </span>
            ) : null}
          </button>
          {filterActive && !filtersOpen ? (
            <span className="text-xs font-semibold text-blue-300 truncate">{filterValue}</span>
          ) : null}
        </div>

        {filtersOpen && (
          <div className="flex flex-wrap gap-2 mt-3">
            {filterOptions.map((cat) => {
              const active = filterValue === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFilter(cat)}
                  className={`inline-flex items-center gap-1 whitespace-nowrap px-3 py-2 rounded-full text-sm font-medium min-h-10 border ${
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
              filteredGames.map((game) => (
                <GameCard key={game.id} game={game} onCategoryClick={(cat) => setActiveFilter(cat)} />
              ))
            ) : (
              <div className="text-center text-gray-500 mt-10">No games found matching “{searchTerm}”</div>
            )
          ) : filteredTerms.length > 0 ? (
            filteredTerms.map((term) => (
              <TermCard key={term.id || term.term} termData={term} onCategoryClick={(cat) => setTermFilter(cat)} />
            ))
          ) : (
            <div className="text-center text-gray-500 mt-10">No terms found matching “{searchTerm}”</div>
          )}
        </AnimatePresence>
        <LibraryFooter sources={data.sources} />
      </div>
    </div>
  );
}
