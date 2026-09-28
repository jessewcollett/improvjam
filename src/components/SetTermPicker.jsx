import { useMemo, useState } from 'react';
import { BookOpen, Check, Plus, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore.js';
import { splitList } from '../lib/generator.js';
import { normalizeSetItems } from '../lib/setItems.js';
import SearchField from './SearchField.jsx';

const RESULT_CAP = 80;

function itemCategories(term) {
  return term.categories?.length ? term.categories : splitList(term.category);
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

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1 rounded-full border text-xs font-bold min-h-9 px-2.5 shrink-0 ${
        active
          ? 'bg-purple-700 text-white border-purple-400'
          : 'bg-[#1A1A1A] text-gray-300 border-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

export default function SetTermPicker({ setId, gameId = '' }) {
  const terms = useAppStore((s) => s.data.terms) || [];
  const customSets = useAppStore((s) => s.lists.customSets) || [];
  const toggleSetTerm = useAppStore((s) => s.toggleSetTerm);
  const toggleSetGameTerm = useAppStore((s) => s.toggleSetGameTerm);
  const activeSet = customSets.find((set) => set.id === setId);
  const items = normalizeSetItems(activeSet);
  const linking = Boolean(gameId);
  const selectedIds = useMemo(() => {
    if (linking) {
      return items.find((item) => item.type === 'game' && item.id === gameId)?.terms || [];
    }
    return items.filter((item) => item.type === 'term').map((item) => item.id);
  }, [items, linking, gameId]);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const [query, setQuery] = useState('');
  const [categoryFilters, setCategoryFilters] = useState([]);

  const categories = useMemo(
    () => [...new Set(terms.flatMap(itemCategories).filter(Boolean))].sort(byLabel),
    [terms],
  );

  const filterActive = Boolean(query.trim() || categoryFilters.length);

  const matches = useMemo(() => {
    if (!filterActive) return [];
    const q = query.trim().toLowerCase();
    const catSet = new Set(categoryFilters);
    return terms.filter((term) => {
      const cats = itemCategories(term);
      const hay = [term.term, term.definition, term.definitions, ...cats].join(' ').toLowerCase();
      if (q && !hay.includes(q)) return false;
      if (catSet.size && !cats.some((cat) => catSet.has(cat))) return false;
      return true;
    });
  }, [filterActive, terms, query, categoryFilters]);

  const visible = matches.slice(0, RESULT_CAP);
  const extra = matches.length - visible.length;

  const onToggle = (termId) => {
    if (linking) toggleSetGameTerm(setId, gameId, termId);
    else toggleSetTerm(setId, termId);
  };

  const linkedTerms = useMemo(
    () => (linking ? terms.filter((term) => selected.has(term.id)) : []),
    [linking, terms, selected],
  );

  return (
    <div className="space-y-2">
      <SearchField
        value={query}
        onChange={setQuery}
        placeholder={linking ? 'Search glossary to link…' : 'Search glossary to add slides…'}
        ringClass="focus:ring-purple-500"
        compact
      />

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

      {linkedTerms.length ? (
        <div>
          <p className="text-2xs uppercase tracking-wider text-gray-500 font-bold mb-1">Linked</p>
          <div className="flex flex-wrap gap-1">
            {linkedTerms.map((term) => (
              <button
                key={term.id}
                type="button"
                onClick={() => onToggle(term.id)}
                className="inline-flex items-center gap-1 rounded-full border text-xs font-bold min-h-9 px-2.5 bg-purple-700 text-white border-purple-400 max-w-full"
              >
                <Check className="w-3 h-3 shrink-0" />
                <span className="truncate">{term.term}</span>
              </button>
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
                  : `${matches.length} term${matches.length === 1 ? '' : 's'}`
                : 'No matching terms.'}
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setCategoryFilters([]);
              }}
              className="inline-flex items-center gap-1 min-h-9 px-2 rounded-full text-2xs font-bold text-gray-400 border border-gray-800"
            >
              <X className="w-3 h-3" />
              Clear filters
            </button>
          </div>
          {visible.length ? (
            <div className="flex flex-wrap gap-1">
              {visible.map((term) => {
                const on = selected.has(term.id);
                return (
                  <button
                    key={term.id}
                    type="button"
                    onClick={() => onToggle(term.id)}
                    aria-pressed={on}
                    className={`inline-flex items-center gap-1 rounded-full border text-xs font-bold min-h-9 px-2.5 max-w-full ${
                      on
                        ? 'bg-purple-700 text-white border-purple-400'
                        : 'bg-[#1A1A1A] text-gray-200 border-gray-700'
                    }`}
                  >
                    {on ? <Check className="w-3 h-3 shrink-0" /> : <Plus className="w-3 h-3 shrink-0 text-gray-500" />}
                    <span className="truncate">{term.term}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-xs text-gray-500">
          {linking
            ? 'Search or tap a category, then tap a term to link it to this game.'
            : 'Search or tap a category, then tap a term to add a glossary slide.'}
        </p>
      )}

      {!filterActive && !linkedTerms.length ? (
        <p className="text-2xs text-gray-600 inline-flex items-center gap-1">
          <BookOpen className="w-3 h-3" />
          {terms.length} glossary terms in the catalog.
        </p>
      ) : null}
    </div>
  );
}
