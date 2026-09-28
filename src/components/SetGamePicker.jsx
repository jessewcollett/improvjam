import { useMemo, useState } from 'react';
import { Check, CheckCircle, Folder, ListPlus, Plus, Star, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore.js';
import { splitList } from '../lib/generator.js';
import SearchField from './SearchField.jsx';

const RESULT_CAP = 80;

const LIST_SOURCES = [
  { id: 'toPlay', label: 'To Play', Icon: ListPlus },
  { id: 'played', label: 'Played', Icon: CheckCircle },
  { id: 'favorites', label: 'Faves', Icon: Star },
];

function itemCategories(game) {
  return game.categories?.length ? game.categories : splitList(game.category);
}

function byLabel(a, b) {
  const labelA = String(a || '');
  const labelB = String(b || '');
  const keyA = labelA.replace(/^[^0-9A-Za-z]+/, '');
  const keyB = labelB.replace(/^[^0-9A-Za-z]+/, '');
  return keyA.localeCompare(keyB, undefined, { sensitivity: 'base' })
    || labelA.localeCompare(labelB, undefined, { sensitivity: 'base' });
}

function toggleValue(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function idsInList(lists, listId) {
  if (listId === 'toPlay' || listId === 'played' || listId === 'favorites') {
    return lists[listId] || [];
  }
  return lists.customSets.find((set) => set.id === listId)?.games || [];
}

function FilterChip({ active, onClick, children, icon: Icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1 rounded-full border text-xs font-bold min-h-9 px-2.5 shrink-0 ${
        active
          ? 'bg-indigo-600 text-white border-indigo-400'
          : 'bg-[#1A1A1A] text-gray-300 border-gray-700'
      }`}
    >
      {Icon ? <Icon className="w-3.5 h-3.5" fill={active && Icon === Star ? 'currentColor' : 'none'} /> : null}
      {children}
    </button>
  );
}

export default function SetGamePicker({ setId }) {
  const games = useAppStore((s) => s.data.games) || [];
  const lists = useAppStore((s) => s.lists);
  const toggleInCustomSet = useAppStore((s) => s.toggleInCustomSet);
  const customSets = lists.customSets || [];
  const activeSet = customSets.find((set) => set.id === setId);
  const inSetIds = activeSet?.games || [];
  const inSet = useMemo(() => new Set(inSetIds), [inSetIds]);

  const [query, setQuery] = useState('');
  const [listFilters, setListFilters] = useState([]);
  const [categoryFilters, setCategoryFilters] = useState([]);
  const [tagFilters, setTagFilters] = useState([]);

  const categories = useMemo(
    () => [...new Set(games.flatMap(itemCategories).filter(Boolean))].sort(byLabel),
    [games],
  );
  const tags = useMemo(
    () => [...new Set(games.flatMap((game) => splitList(game.tags)).filter(Boolean))].sort(byLabel),
    [games],
  );
  const otherSets = customSets.filter((set) => set.id !== setId);

  const filterActive = Boolean(
    query.trim() || listFilters.length || categoryFilters.length || tagFilters.length,
  );

  const matches = useMemo(() => {
    if (!filterActive) return [];
    const q = query.trim().toLowerCase();
    const listIdSet = new Set(listFilters);
    const catSet = new Set(categoryFilters);
    const tagSet = new Set(tagFilters);
    return games.filter((game) => {
      const cats = itemCategories(game);
      const gameTags = splitList(game.tags);
      const skills = splitList(game.lifeSkills);
      const hay = [game.name, game.description, ...gameTags, ...skills, ...cats].join(' ').toLowerCase();
      if (q && !hay.includes(q)) return false;
      if (listIdSet.size && ![...listIdSet].some((id) => idsInList(lists, id).includes(game.id))) return false;
      if (catSet.size && !cats.some((cat) => catSet.has(cat))) return false;
      if (tagSet.size && !gameTags.some((tag) => tagSet.has(tag))) return false;
      return true;
    });
  }, [filterActive, games, query, listFilters, categoryFilters, tagFilters, lists]);

  const visible = matches.slice(0, RESULT_CAP);
  const extra = matches.length - visible.length;

  const clearFilters = () => {
    setQuery('');
    setListFilters([]);
    setCategoryFilters([]);
    setTagFilters([]);
  };

  return (
    <div className="space-y-2">
      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Search Library to add games…"
        ringClass="focus:ring-indigo-500"
        compact
      />

      <div>
        <p className="text-2xs uppercase tracking-wider text-gray-500 font-bold mb-1">From lists</p>
        <div className="flex flex-wrap gap-1">
          {LIST_SOURCES.map((source) => (
            <FilterChip
              key={source.id}
              icon={source.Icon}
              active={listFilters.includes(source.id)}
              onClick={() => setListFilters((prev) => toggleValue(prev, source.id))}
            >
              {source.label}
            </FilterChip>
          ))}
          {otherSets.map((set) => (
            <FilterChip
              key={set.id}
              icon={Folder}
              active={listFilters.includes(set.id)}
              onClick={() => setListFilters((prev) => toggleValue(prev, set.id))}
            >
              {set.name}
            </FilterChip>
          ))}
        </div>
      </div>

      {categories.length ? (
        <div>
          <p className="text-2xs uppercase tracking-wider text-gray-500 font-bold mb-1">Categories</p>
          <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto scrollbar-hide">
            {categories.map((cat) => (
              <FilterChip
                key={cat}
                active={categoryFilters.includes(cat)}
                onClick={() => setCategoryFilters((prev) => toggleValue(prev, cat))}
              >
                {cat}
              </FilterChip>
            ))}
          </div>
        </div>
      ) : null}

      {tags.length ? (
        <div>
          <p className="text-2xs uppercase tracking-wider text-gray-500 font-bold mb-1">Tags</p>
          <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto scrollbar-hide">
            {tags.map((tag) => (
              <FilterChip
                key={tag}
                active={tagFilters.includes(tag)}
                onClick={() => setTagFilters((prev) => toggleValue(prev, tag))}
              >
                {tag}
              </FilterChip>
            ))}
          </div>
        </div>
      ) : null}

      {filterActive ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-2xs text-gray-500">
              {matches.length
                ? extra > 0
                  ? `Showing ${visible.length} of ${matches.length}`
                  : `${matches.length} game${matches.length === 1 ? '' : 's'}`
                : 'No matching games.'}
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 min-h-9 px-2 rounded-full text-2xs font-bold text-gray-400 border border-gray-800"
            >
              <X className="w-3 h-3" />
              Clear filters
            </button>
          </div>
          {visible.length ? (
            <div className="flex flex-wrap gap-1">
              {visible.map((game) => {
                const selected = inSet.has(game.id);
                return (
                  <button
                    key={game.id}
                    type="button"
                    onClick={() => toggleInCustomSet(setId, game.id)}
                    aria-pressed={selected}
                    className={`inline-flex items-center gap-1 rounded-full border text-xs font-bold min-h-9 px-2.5 max-w-full ${
                      selected
                        ? 'bg-indigo-600 text-white border-indigo-400'
                        : 'bg-[#1A1A1A] text-gray-200 border-gray-700'
                    }`}
                  >
                    {selected ? <Check className="w-3 h-3 shrink-0" /> : <Plus className="w-3 h-3 shrink-0 text-gray-500" />}
                    <span className="truncate">{game.name}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-xs text-gray-500">
          Search, or tap a list, category, or tag. Tap a game chip to add or remove.
        </p>
      )}
    </div>
  );
}
