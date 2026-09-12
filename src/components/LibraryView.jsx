import { useMemo, useState } from 'react';
import { Dices, BookMarked, ListFilter, Check, X, Star, ListPlus, CheckCircle, Folder } from 'lucide-react';
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

const BUILTIN_SETS = [
  { id: 'toPlay', label: 'To Play', Icon: ListPlus, onClass: 'text-blue-300 border-blue-400 bg-blue-600/20' },
  { id: 'played', label: 'Played', Icon: CheckCircle, onClass: 'text-green-300 border-green-400 bg-green-600/20' },
  { id: 'favorites', label: 'Favorites', Icon: Star, onClass: 'text-yellow-300 border-yellow-400 bg-yellow-600/20' },
];

function idsInSet(lists, setId) {
  if (setId === 'favorites' || setId === 'toPlay' || setId === 'played') {
    return lists[setId] || [];
  }
  return lists.customSets.find((set) => set.id === setId)?.games || [];
}

function cycleSetMode(current) {
  if (current === 'in') return 'out';
  if (current === 'out') return undefined;
  return 'in';
}

function modeLabel(mode) {
  if (mode === 'in') return 'in set';
  if (mode === 'out') return 'not in set';
  return 'all';
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1 px-3 py-2 rounded-full text-sm font-medium min-h-11 border ${
        active
          ? 'bg-blue-600 text-white border-blue-300 shadow-md'
          : 'bg-gray-800 text-gray-300 border-gray-700'
      }`}
    >
      {active ? <Check className="w-3.5 h-3.5" /> : null}
      {children}
    </button>
  );
}

function SetModeButton({ mode, onClick, label, Icon, onClass, filled }) {
  const inSet = mode === 'in';
  const out = mode === 'out';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${modeLabel(mode)}`}
      aria-pressed={Boolean(inSet || out)}
      className={`relative min-w-11 min-h-11 rounded-xl border inline-flex items-center justify-center ${
        inSet
          ? onClass
          : out
            ? 'text-rose-400 border-rose-500 bg-rose-950/40'
            : 'text-gray-500 border-gray-700 bg-gray-800'
      }`}
    >
      <Icon className="w-5 h-5" fill={inSet && filled ? 'currentColor' : 'none'} />
      {out ? (
        <span className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden>
          <span className="block w-6 h-0.5 rounded-full bg-rose-500 rotate-[-28deg]" />
        </span>
      ) : null}
    </button>
  );
}

export default function LibraryView() {
  const data = useAppStore((s) => s.data);
  const lists = useAppStore((s) => s.lists);
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const dismissedTipDate = useAppStore((s) => s.dismissedTipDate);
  const dismissTipOfTheDay = useAppStore((s) => s.dismissTipOfTheDay);
  const [searchTerm, setSearchTerm] = useState('');
  const [gameFilters, setGameFilters] = useState([]);
  const [termFilters, setTermFilters] = useState([]);
  const [setModes, setSetModes] = useState({});
  const [customMenuOpen, setCustomMenuOpen] = useState(false);
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
  const setLabel = (setId) => {
    const builtin = BUILTIN_SETS.find((set) => set.id === setId);
    if (builtin) return builtin.label;
    return lists.customSets.find((set) => set.id === setId)?.name || setId;
  };
  const activeSetModes = Object.entries(setModes).filter(([, mode]) => mode === 'in' || mode === 'out');
  const setFilterCount = viewType === 'games' ? activeSetModes.length : 0;
  const filterCount = selectedFilters.length + setFilterCount;
  const filterActive = filterCount > 0;
  const filterSummary = [
    ...selectedFilters,
    ...(viewType === 'games'
      ? activeSetModes.map(([id, mode]) => (mode === 'out' ? `Not ${setLabel(id)}` : setLabel(id)))
      : []),
  ];
  const customModes = lists.customSets.map((set) => setModes[set.id]).filter(Boolean);
  const customFolderMode = customModes.includes('in') ? 'in' : customModes.includes('out') ? 'out' : undefined;

  const cycleMode = (setId) => {
    setSetModes((current) => {
      const nextMode = cycleSetMode(current[setId]);
      if (!nextMode) {
        const next = { ...current };
        delete next[setId];
        return next;
      }
      return { ...current, [setId]: nextMode };
    });
  };

  const clearFilters = () => {
    setSelectedFilters([]);
    if (viewType === 'games') {
      setSetModes({});
      setCustomMenuOpen(false);
    }
  };

  const filteredGames = useMemo(() => {
    const q = searchTerm.toLowerCase();
    const inIds = activeSetModes.filter(([, mode]) => mode === 'in').map(([id]) => id);
    const outIds = activeSetModes.filter(([, mode]) => mode === 'out').map(([id]) => id);
    return data.games.filter((game) => {
      const cats = itemCategories(game);
      const tags = splitList(game.tags);
      const skills = splitList(game.lifeSkills);
      const hay = [game.name, game.description, ...tags, ...skills, ...cats].join(' ').toLowerCase();
      const matchesSearch = !q || hay.includes(q);
      const matchesFilter = !gameFilters.length || gameFilters.some((cat) => cats.includes(cat));
      const matchesInSet = inIds.every((setId) => idsInSet(lists, setId).includes(game.id));
      const matchesNotInSet = outIds.every((setId) => !idsInSet(lists, setId).includes(game.id));
      return matchesSearch && matchesFilter && matchesInSet && matchesNotInSet;
    });
  }, [data.games, searchTerm, gameFilters, setModes, lists]);

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
            onClick={() => {
              setFiltersOpen((v) => !v);
              setCustomMenuOpen(false);
            }}
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
                {filterCount}
              </span>
            ) : null}
          </button>
          {filterActive ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-bold min-h-11 border border-gray-700 bg-gray-800 text-gray-200"
            >
              <X className="w-4 h-4" />
              Clear filters
            </button>
          ) : null}
          {filterActive && !filtersOpen ? (
            <span className="text-xs font-semibold text-blue-300 min-w-0">
              {filterSummary.join(' · ')}
            </span>
          ) : null}
        </div>

        {filtersOpen && (
          <div className="mt-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Categories</p>
            <div className="flex flex-wrap gap-2">
              {filterOptions.map((cat) => (
                <Chip
                  key={cat}
                  active={selectedFilters.includes(cat)}
                  onClick={() => setSelectedFilters((prev) => toggleValue(prev, cat))}
                >
                  {cat}
                </Chip>
              ))}
            </div>
            {viewType === 'games' ? (
              <>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 mt-3">Sets</p>
                <p className="text-2xs text-gray-500 mb-2">Highlight = in set · red slash = not in · gray = all</p>
                <div className="flex items-center gap-2">
                  {BUILTIN_SETS.map((set) => (
                    <SetModeButton
                      key={set.id}
                      mode={setModes[set.id]}
                      onClick={() => cycleMode(set.id)}
                      label={set.label}
                      Icon={set.Icon}
                      onClass={set.onClass}
                      filled={set.id === 'favorites'}
                    />
                  ))}
                  <div className="relative">
                    <SetModeButton
                      mode={customFolderMode}
                      onClick={() => setCustomMenuOpen((v) => !v)}
                      label="Custom sets"
                      Icon={Folder}
                      onClass="text-indigo-300 border-indigo-400 bg-indigo-600/20"
                    />
                    {customMenuOpen ? (
                      <div className="absolute top-full right-0 mt-1 w-56 bg-[#121212] border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-20">
                        <div className="bg-gray-800 text-2xs font-bold text-gray-400 uppercase tracking-wider px-3 py-2 border-b border-gray-700">
                          Custom sets
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {lists.customSets.length === 0 ? (
                            <p className="px-3 py-4 text-xs text-gray-500 text-center italic">
                              No custom sets yet. Create one in My Sets.
                            </p>
                          ) : (
                            lists.customSets.map((set) => (
                              <button
                                key={set.id}
                                type="button"
                                onClick={() => cycleMode(set.id)}
                                className="w-full text-left px-3 py-2 min-h-11 text-sm text-gray-300 hover:bg-gray-700 flex items-center justify-between gap-2"
                              >
                                <span className="truncate">{set.name}</span>
                                <span
                                  className={`text-2xs font-bold uppercase tracking-wider shrink-0 ${
                                    setModes[set.id] === 'in'
                                      ? 'text-indigo-300'
                                      : setModes[set.id] === 'out'
                                        ? 'text-rose-400'
                                        : 'text-gray-500'
                                  }`}
                                >
                                  {setModes[set.id] === 'in' ? 'In' : setModes[set.id] === 'out' ? 'Not in' : 'All'}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}
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
              <div className="text-center text-gray-500 mt-10">
                {searchTerm || filterActive ? 'No games match these filters.' : 'No games in the catalog.'}
              </div>
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
