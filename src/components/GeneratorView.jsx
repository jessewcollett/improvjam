import { useMemo, useState } from 'react';
import {
  Wand2,
  Shuffle,
  Lock,
  Unlock,
  Star,
  ChevronDown,
  Tag,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/useAppStore.js';
import { askForCategoriesFromRows, rowCategories, rowExtra, skillItemsFromRows } from '../lib/generator.js';
import ActionDock from './ActionDock.jsx';
import CatalogIcon from './CatalogIcon.jsx';
import SearchField from './SearchField.jsx';
import SyncButton from './SyncButton.jsx';

const pick = (arr) => (arr?.length ? arr[Math.floor(Math.random() * arr.length)] : undefined);
const CATALOGUE_CAP = 50;

function displayText(row) {
  if (!row) return '';
  if (typeof row === 'string') return row;
  return row.text || '';
}

function ExtraCaption({ extra, className = '' }) {
  if (!extra) return null;
  return <span className={`block text-xs text-gray-500 leading-snug mt-0.5 ${className}`}>{extra}</span>;
}

function asSuggestion(value) {
  if (!value) return null;
  if (typeof value === 'string') return { text: value, extra: '' };
  return value;
}

function styleLabel(content) {
  if (!content) return '';
  if (typeof content === 'string') return content;
  return content.name || '';
}

function styleDescription(content) {
  if (!content || typeof content === 'string') return '';
  return content.description || '';
}

function CheckRow({ checked, icon, label, count, onToggle }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={`min-h-11 px-2 py-1.5 rounded-lg border flex items-center gap-1.5 min-w-0 flex-1 ${
        checked ? 'bg-lime-600/15 text-white border-lime-600/50' : 'bg-[#1A1A1A] text-gray-200 border-gray-800'
      }`}
    >
      <CatalogIcon name={icon} className={`w-3.5 h-3.5 shrink-0 ${checked ? 'text-lime-400' : 'text-gray-500'}`} fallback={Tag} />
      <span className="flex-1 text-xs font-bold leading-tight text-left">{label}</span>
      <span className={`text-2xs tabular-nums shrink-0 ${checked ? 'text-lime-300/80' : 'text-gray-500'}`}>{count}</span>
    </button>
  );
}

function BankRow({ cat, checked, favorited, onToggle, onFavorite }) {
  return (
    <div className="flex items-center gap-0.5 min-w-0">
      <CheckRow
        checked={checked}
        icon={cat.icon}
        label={cat.label}
        count={cat.count}
        onToggle={onToggle}
      />
      <button
        type="button"
        onClick={onFavorite}
        className={`flex items-center justify-center min-w-11 min-h-11 rounded-lg shrink-0 ${
          favorited ? 'text-yellow-400' : 'text-gray-600'
        }`}
        aria-label={favorited ? `Unfavorite ${cat.label}` : `Favorite ${cat.label}`}
        aria-pressed={favorited}
      >
        <Star className="w-4 h-4" fill={favorited ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
}

export default function GeneratorView() {
  const prompts = useAppStore((s) => s.data.prompts);
  const generator = useAppStore((s) => s.data.generator) || [];
  const banks = useAppStore((s) => s.data.banks) || [];
  const selectedIds = useAppStore((s) => s.generatorBanks) || [];
  const selectedSkills = useAppStore((s) => s.generatorSkills) || [];
  const favoriteIds = useAppStore((s) => s.generatorBankFavorites) || [];
  const toggleGeneratorBank = useAppStore((s) => s.toggleGeneratorBank);
  const toggleGeneratorBankFavorite = useAppStore((s) => s.toggleGeneratorBankFavorite);
  const toggleGeneratorSkill = useAppStore((s) => s.toggleGeneratorSkill);
  const [locks, setLocks] = useState({ c: false, o: false, r: false, e: false });
  const [kit, setKit] = useState(null);
  const [skillResults, setSkillResults] = useState([]);
  const [bankQuery, setBankQuery] = useState('');
  const [banksOpen, setBanksOpen] = useState(false);
  const [catalogueOpen, setCatalogueOpen] = useState(false);

  const askForCategories = useMemo(
    () => askForCategoriesFromRows(generator, banks),
    [generator, banks],
  );

  const skillItems = useMemo(
    () => skillItemsFromRows(generator, prompts, banks),
    [generator, prompts, banks],
  );

  const selectedCats = useMemo(
    () => askForCategories.filter((cat) => selectedIds.includes(cat.id)),
    [askForCategories, selectedIds],
  );

  const favoriteCats = useMemo(
    () => askForCategories.filter((cat) => favoriteIds.includes(cat.id)),
    [askForCategories, favoriteIds],
  );

  const remainingCats = useMemo(
    () => askForCategories.filter((cat) => !favoriteIds.includes(cat.id)),
    [askForCategories, favoriteIds],
  );

  const selectedSkillItems = useMemo(
    () => skillItems.filter((item) => selectedSkills.includes(item.id)),
    [skillItems, selectedSkills],
  );

  const selectedRows = useMemo(() => {
    if (!selectedIds.length) return [];
    const wanted = new Set(selectedIds);
    return generator.filter((row) => row.text && rowCategories(row).some((cat) => wanted.has(cat)));
  }, [generator, selectedIds]);

  const filteredCatalogue = useMemo(() => {
    const q = bankQuery.trim().toLowerCase();
    if (!q) return selectedRows;
    return selectedRows.filter((row) => {
      const hay = `${row.text} ${rowExtra(row)} ${rowCategories(row).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [selectedRows, bankQuery]);

  const visibleCatalogue = filteredCatalogue.slice(0, CATALOGUE_CAP);

  const drawFrom = (rows, current) => {
    if (!rows.length) return undefined;
    const nextPool = rows.filter((row) => row.id !== current?.id);
    return pick(nextPool.length ? nextPool : rows);
  };

  const buildCORE = (prev) => {
    const { characters, objectives, relationships, environments } = prompts.core || {};
    return {
      type: 'core',
      title: 'C.O.R.E. Setup',
      content: {
        c: locks.c && prev?.type === 'core' ? prev.content.c : pick(characters),
        o: locks.o && prev?.type === 'core' ? prev.content.o : pick(objectives),
        r: locks.r && prev?.type === 'core' ? prev.content.r : pick(relationships),
        e: locks.e && prev?.type === 'core' ? prev.content.e : pick(environments),
      },
    };
  };

  const pickSkillRow = (cat, fallbackList) => {
    const rows = generator.filter((row) => rowCategories(row).includes(cat) && row.text);
    return asSuggestion(pick(rows.length ? rows : fallbackList));
  };

  const buildSkill = (skill, prev) => {
    const id = typeof skill === 'string' ? skill : skill?.id;
    if (!id) return null;
    const category = (typeof skill === 'object' && skill.category)
      || (String(id).startsWith('cat:') ? id.slice(4) : id);
    const title = (typeof skill === 'object' && skill.label) || category;
    if (id === 'core') return { ...buildCORE(prev), id };
    if (id === 'fut') {
      const item = pick(prompts.fut);
      return item ? { id, type: 'fut', title: 'F.U.T. Starter', content: item } : null;
    }
    if (id === 'line') {
      const line = pickSkillRow('Lines', prompts.lines);
      return line ? { id, type: 'line', title: 'Opening Line', content: line } : null;
    }
    if (id === 'two') {
      const scene = pickSkillRow('Scenes', prompts.twoPerson);
      return scene ? { id, type: 'two', title: 'Two-Person Scene', content: scene } : null;
    }
    if (id === 'style') {
      const style = pick(prompts.playStyles);
      return style ? { id, type: 'style', title: 'Play Style', content: style } : null;
    }
    if (id === 'instruction') {
      const instruction = pickSkillRow('Instructions', prompts.instructions);
      return instruction ? { id, type: 'instruction', title: 'Secret Instruction', content: instruction } : null;
    }
    const row = pickSkillRow(category, []);
    return row ? { id, type: 'bank', title, content: row } : null;
  };

  const generate = () => {
    setBanksOpen(false);
    if (selectedCats.length) {
      setKit(
        selectedCats.map((cat) => {
          const rows = generator.filter((row) => rowCategories(row).includes(cat.id) && row.text);
          const current = kit?.find((item) => item.id === cat.id)?.row;
          return { id: cat.id, label: cat.label, icon: cat.icon, row: drawFrom(rows, current) || null };
        }),
      );
    } else {
      setKit(null);
    }

    setSkillResults((prev) => selectedSkillItems.map((skill) => (
      buildSkill(skill, prev.find((item) => item?.id === skill.id || item?.type === skill.id))
    )).filter(Boolean));
  };

  const applyCatalogueRow = (row) => {
    const cats = rowCategories(row);
    const match = selectedCats.find((cat) => cats.includes(cat.id));
    if (!match) return;
    setKit((prev) => {
      const next = prev?.length
        ? prev.map((item) => ({ ...item }))
        : selectedCats.map((cat) => ({ id: cat.id, label: cat.label, icon: cat.icon, row: null }));
      return next.map((item) => (item.id === match.id ? { ...item, row } : item));
    });
  };

  const canGenerate = selectedCats.length > 0 || selectedSkillItems.length > 0;
  const hasOutput = Boolean(kit?.length || skillResults.length);
  const selectedSummary = [
    ...selectedCats.map((cat) => cat.label),
    ...selectedSkillItems.map((item) => item.label),
  ].join(', ') || 'Nothing selected';

  const generateButton = (className) => (
    <button
      type="button"
      onClick={generate}
      disabled={!canGenerate}
      className={`w-full bg-lime-600 disabled:bg-gray-800 disabled:text-gray-500 text-black font-black py-3 rounded-xl min-h-12 flex items-center justify-center gap-2 ${className}`}
    >
      <Shuffle className="w-4 h-4" />
      Generate
    </button>
  );

  return (
    <div className="h-full flex flex-col pt-safe relative overflow-hidden">
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-green-500/5 blur-3xl pointer-events-none" />
      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 md:px-6 pb-6 md:pb-nav">
        <div className="flex items-start justify-between gap-3 mb-4">
          <h1 className="text-2xl font-black font-display text-white tracking-tight flex items-center">
            <Wand2 className="text-green-400 mr-2 w-7 h-7" />
            Generator
          </h1>
          <SyncButton compact />
        </div>

        <section className="mb-3">
          <button
            type="button"
            onClick={() => setBanksOpen((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl border border-gray-800 bg-[#1A1A1A] min-h-11"
          >
            <div className="text-left min-w-0">
              <h2 className="text-base font-black font-display text-white leading-tight">Ask for…</h2>
              <p className="text-xs text-gray-500 leading-snug">
                {selectedCats.length + selectedSkillItems.length} selected
                {favoriteCats.length ? ` · ${favoriteCats.length} favorite${favoriteCats.length === 1 ? '' : 's'}` : ''}
                {' · '}{selectedSummary}
              </p>
            </div>
            <ChevronDown className={`w-5 h-5 text-gray-500 shrink-0 transition-transform ${banksOpen ? 'rotate-180' : ''}`} />
          </button>

          {banksOpen && (
            <div className="mt-2">
              {favoriteCats.length > 0 && (
                <>
                  <p className="text-2xs uppercase tracking-wider text-yellow-500/80 font-bold px-0.5 mb-1">Favorites</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
                    {favoriteCats.map((cat) => (
                      <BankRow
                        key={cat.id}
                        cat={cat}
                        checked={selectedIds.includes(cat.id)}
                        favorited
                        onToggle={() => toggleGeneratorBank(cat.id)}
                        onFavorite={() => toggleGeneratorBankFavorite(cat.id)}
                      />
                    ))}
                  </div>
                </>
              )}
              {remainingCats.length > 0 && (
                <>
                  <p className={`text-2xs uppercase tracking-wider text-gray-500 font-bold px-0.5 mb-1 ${favoriteCats.length ? 'mt-2.5' : ''}`}>
                    {favoriteCats.length ? 'All banks' : 'Ask for'}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
                    {remainingCats.map((cat) => (
                      <BankRow
                        key={cat.id}
                        cat={cat}
                        checked={selectedIds.includes(cat.id)}
                        favorited={false}
                        onToggle={() => toggleGeneratorBank(cat.id)}
                        onFavorite={() => toggleGeneratorBankFavorite(cat.id)}
                      />
                    ))}
                  </div>
                </>
              )}
              {skillItems.length > 0 && (
                <>
                  <p className="text-2xs uppercase tracking-wider text-gray-500 font-bold px-0.5 mt-2.5 mb-1">Skill Building</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
                    {skillItems.map((skill) => (
                      <CheckRow
                        key={skill.id}
                        checked={selectedSkills.includes(skill.id)}
                        icon={skill.icon}
                        label={skill.label}
                        count={skill.count}
                        onToggle={() => toggleGeneratorSkill(skill.id)}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </section>

        <AnimatePresence>
          {hasOutput && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-3 space-y-2"
            >
              {kit?.length ? (
                <section className="bg-[#1A1A1A] border border-lime-800/50 rounded-2xl p-3">
                  <p className="text-2xs uppercase tracking-wider text-lime-400 font-bold mb-2">Scene kit</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                    {kit.map((item) => {
                      return (
                        <div key={item.id} className="flex items-start gap-2 rounded-xl border border-gray-800 bg-card px-2.5 py-2">
                          <CatalogIcon name={item.icon} className="w-3.5 h-3.5 text-lime-400 mt-0.5 shrink-0" fallback={Tag} />
                          <div className="min-w-0">
                            <p className="text-2xs uppercase tracking-wider text-gray-500 font-bold">{item.label}</p>
                            <p className="text-sm font-bold text-gray-100 leading-snug">
                              {item.row ? displayText(item.row) : `No ${item.label.toLowerCase()} yet.`}
                            </p>
                            <ExtraCaption extra={item.row ? rowExtra(item.row) : ''} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {skillResults.map((generated) => (
                <section
                  key={generated.id || `${generated.type}-${JSON.stringify(generated.content)}`}
                  className="bg-[#1A1A1A] border border-gray-700 rounded-2xl p-3"
                >
                  <p className="text-2xs uppercase tracking-wider text-gray-400 font-bold mb-2">{generated.title}</p>

                  {generated.type === 'core' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                      {[
                        ['c', 'Character', 'bg-blue-900/10 border-blue-900/30 text-blue-400', generated.content.c],
                        ['o', 'Objective', 'bg-rose-900/10 border-rose-900/30 text-rose-400', generated.content.o],
                        ['r', 'Relationship', 'bg-emerald-900/10 border-emerald-900/30 text-emerald-400', generated.content.r],
                        ['e', 'Environment', 'bg-amber-900/10 border-amber-900/30 text-amber-400', generated.content.e],
                      ].map(([key, label, tone, value]) => (
                        <div key={key} className={`${tone.split(' ').slice(0, 2).join(' ')} px-2.5 py-2 rounded-xl border flex justify-between gap-2 items-center`}>
                          <div className="min-w-0">
                            <span className={`${tone.split(' ').pop()} text-2xs font-bold block uppercase tracking-wider`}>{label}</span>
                            <span className="font-semibold text-gray-100 text-sm">{value}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setLocks((prev) => ({ ...prev, [key]: !prev[key] }))}
                            className={`p-2 rounded-lg min-w-9 min-h-9 ${locks[key] ? 'text-yellow-300 bg-yellow-900/30' : 'text-gray-500 bg-gray-800'}`}
                            aria-label={`Lock ${label}`}
                          >
                            {locks[key] ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {generated.type === 'fut' && generated.content && (
                    <div className="space-y-2">
                      <div>
                        <span className="text-2xs text-gray-500 block uppercase tracking-wider mb-1">Base Reality</span>
                        <p className="text-sm font-medium text-gray-300 bg-gray-900/50 p-2.5 rounded-xl border border-gray-800">
                          {generated.content.reality}
                        </p>
                      </div>
                      <div>
                        <span className="text-2xs text-pink-500 font-bold uppercase tracking-wider mb-1 flex items-center">
                          <Star className="w-3 h-3 mr-1" /> First Unusual Thing
                        </span>
                        <p className="text-base font-bold text-pink-200 leading-snug">{generated.content.weirdThing}</p>
                      </div>
                    </div>
                  )}

                  {generated.type === 'line' && (
                    <div className="text-center py-2">
                      <p className="text-lg font-black text-emerald-300 italic leading-tight">“{displayText(generated.content)}”</p>
                      <ExtraCaption extra={rowExtra(generated.content)} />
                    </div>
                  )}

                  {generated.type === 'two' && (
                    <div>
                      <p className="text-base font-bold text-amber-200 leading-snug">{displayText(generated.content)}</p>
                      <ExtraCaption extra={rowExtra(generated.content)} />
                    </div>
                  )}

                  {generated.type === 'style' && (
                    <div>
                      <p className="text-xl font-black text-lime-300 mb-0.5">{styleLabel(generated.content)}</p>
                      {styleDescription(generated.content) ? (
                        <p className="text-sm text-gray-300">{styleDescription(generated.content)}</p>
                      ) : null}
                    </div>
                  )}

                  {generated.type === 'instruction' && (
                    <div>
                      <p className="text-base font-bold text-fuchsia-200 leading-snug">{displayText(generated.content)}</p>
                      <ExtraCaption extra={rowExtra(generated.content)} />
                    </div>
                  )}

                  {generated.type === 'bank' && (
                    <div>
                      <p className="text-base font-bold text-lime-200 leading-snug">{displayText(generated.content)}</p>
                      <ExtraCaption extra={rowExtra(generated.content)} />
                    </div>
                  )}
                </section>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {generateButton('hidden md:flex mb-4')}

        <section className="mb-4">
          <button
            type="button"
            onClick={() => setCatalogueOpen((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-800 bg-card text-sm font-bold text-gray-200 min-h-11"
          >
            <span className="truncate">
              Search selected banks
              {selectedRows.length ? ` (${selectedRows.length})` : ''}
            </span>
            <ChevronDown className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${catalogueOpen ? 'rotate-180' : ''}`} />
          </button>

          {catalogueOpen && (
            <div className="mt-2">
              <div className="mb-2">
                <SearchField
                  value={bankQuery}
                  onChange={setBankQuery}
                  placeholder={selectedCats.length ? `Filter ${selectedCats.map((c) => c.label).join(', ').toLowerCase()}…` : 'Check a bank first…'}
                  ringClass="focus:ring-lime-600"
                />
              </div>
              {!selectedCats.length ? (
                <p className="text-sm text-gray-500">Check one or more banks above, then search their catalogue.</p>
              ) : selectedRows.length === 0 ? (
                <p className="text-sm text-gray-500">No rows yet. Add some in the Generator tab.</p>
              ) : (
                <>
                  <p className="text-xs text-gray-500 mb-2">
                    {filteredCatalogue.length} match{filteredCatalogue.length === 1 ? '' : 'es'}
                    {filteredCatalogue.length > CATALOGUE_CAP ? ` · showing ${CATALOGUE_CAP}` : ''}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                    {visibleCatalogue.map((row) => (
                      <button
                        key={row.id || row.text}
                        type="button"
                        onClick={() => applyCatalogueRow(row)}
                        className={`w-full text-left bg-card border rounded-xl px-3 py-2.5 text-sm min-h-11 ${
                          kit?.some((item) => item.row?.id === row.id) ? 'border-lime-600 text-white' : 'border-gray-800 text-gray-300'
                        }`}
                      >
                        <span className="flex flex-wrap gap-1 mb-1">
                          {rowCategories(row).map((cat) => (
                            <span key={cat} className="text-2xs uppercase tracking-wider text-gray-400 font-bold px-1.5 py-0.5 rounded-full border border-gray-700 bg-gray-800">
                              {cat}
                            </span>
                          ))}
                        </span>
                        <span className="block">{displayText(row)}</span>
                        <ExtraCaption extra={rowExtra(row)} />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      </div>
      <ActionDock>
        {generateButton('')}
      </ActionDock>
    </div>
  );
}
