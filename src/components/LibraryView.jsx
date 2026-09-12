import { useMemo, useState } from 'react';
import { Search, Dices, BookMarked } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/useAppStore.js';
import GameCard from './GameCard.jsx';
import TermCard from './TermCard.jsx';
import { LibraryFooter } from './SourceCitation.jsx';

export default function LibraryView() {
  const data = useAppStore((s) => s.data);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [termFilter, setTermFilter] = useState('All');
  const [viewType, setViewType] = useState('games');

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(data.games.map((g) => g.category)))],
    [data.games],
  );
  const termCategories = useMemo(
    () => ['All', ...Array.from(new Set(data.terms.map((t) => t.category).filter(Boolean)))],
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
      const hay = [game.name, game.description, ...(game.tags || []), ...(game.lifeSkills || [])]
        .join(' ')
        .toLowerCase();
      const matchesSearch = !q || hay.includes(q);
      const matchesFilter = activeFilter === 'All' || game.category === activeFilter;
      return matchesSearch && matchesFilter;
    });
  }, [data.games, searchTerm, activeFilter]);

  const filteredTerms = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return data.terms
      .filter((t) => {
        const matchesSearch = !q || `${t.term} ${t.definition} ${t.category}`.toLowerCase().includes(q);
        const matchesFilter = termFilter === 'All' || t.category === termFilter;
        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => a.term.localeCompare(b.term));
  }, [data.terms, searchTerm, termFilter]);

  return (
    <div className="h-full flex flex-col pt-4 px-4">
      <div className="flex-none mb-4">
        <h1 className="text-2xl font-black font-display text-white mb-4 tracking-tight">The Library</h1>

        {viewType === 'terms' && tip && (
          <div className="mb-4 rounded-xl border border-purple-800/50 bg-purple-900/20 p-3">
            <p className="text-[10px] uppercase tracking-wider text-purple-400 font-bold mb-1">Tip of the day</p>
            <p className="text-sm text-gray-100 font-semibold">{tip.term}</p>
            <p className="text-xs text-gray-400 mt-1">{tip.definition}</p>
          </div>
        )}

        <div className="relative mb-4">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-500" />
          </div>
          <input
            type="search"
            className="block w-full pl-10 pr-3 py-3 border border-gray-700 rounded-xl bg-[#1A1A1A] text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Search games, skills, or terms..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex bg-[#1A1A1A] p-1 rounded-xl mb-4 border border-gray-800">
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

        <div className="flex overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide space-x-2">
          {(viewType === 'games' ? categories : termCategories).map((cat) => {
            const active = viewType === 'games' ? activeFilter === cat : termFilter === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => (viewType === 'games' ? setActiveFilter(cat) : setTermFilter(cat))}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium min-h-10 ${
                  active ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-800 text-gray-300 border border-gray-700'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide pb-nav">
        <AnimatePresence mode="popLayout">
          {viewType === 'games' ? (
            filteredGames.length > 0 ? (
              filteredGames.map((game) => <GameCard key={game.id} game={game} />)
            ) : (
              <div className="text-center text-gray-500 mt-10">No games found matching “{searchTerm}”</div>
            )
          ) : filteredTerms.length > 0 ? (
            filteredTerms.map((term) => <TermCard key={term.id || term.term} termData={term} />)
          ) : (
            <div className="text-center text-gray-500 mt-10">No terms found matching “{searchTerm}”</div>
          )}
        </AnimatePresence>
        <LibraryFooter sources={data.sources} />
      </div>
    </div>
  );
}
