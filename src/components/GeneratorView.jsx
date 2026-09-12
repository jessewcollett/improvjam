import { useMemo, useState } from 'react';
import {
  Wand2,
  Shuffle,
  Lock,
  Unlock,
  Star,
  Search,
  ChevronDown,
  Footprints,
  Pencil,
  PawPrint,
  UserRound,
  Building2,
  Heart,
  Crown,
  Clapperboard,
  ScrollText,
  Briefcase,
  MapPin,
  Tag,
  Package,
  HeartHandshake,
  Drama,
  Shapes,
  Music,
  BookOpen,
  Play,
  Quote,
  Layers,
  Users,
  Sparkles,
  MessageSquare,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/useAppStore.js';
import { ASK_FOR_CATEGORIES, rowCategories } from '../lib/generator.js';
import ActionDock from './ActionDock.jsx';

const pick = (arr) => (arr?.length ? arr[Math.floor(Math.random() * arr.length)] : undefined);
const CATALOGUE_CAP = 50;

const BANK_ICONS = {
  Activities: Footprints,
  Adjectives: Pencil,
  Animals: PawPrint,
  Characters: UserRound,
  Companies: Building2,
  Emotions: Heart,
  Famous: Crown,
  Genres: Clapperboard,
  Instructions: ScrollText,
  Jobs: Briefcase,
  Locations: MapPin,
  Nouns: Tag,
  Objects: Package,
  Relationships: HeartHandshake,
  Scenes: Drama,
  Shapes: Shapes,
  Songs: Music,
  'Story Titles': BookOpen,
  Verbs: Play,
  Words: Quote,
};

function displayRow(row) {
  if (!row) return '';
  if (rowCategories(row).includes('FUT')) return `${row.text} → ${row.extra}`;
  if (rowCategories(row).includes('PlayStyle')) return row.extra ? `${row.text} — ${row.extra}` : row.text;
  return row.text;
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

function CheckRow({ checked, Icon, label, count, onToggle }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={`h-8 px-2 rounded-lg border flex items-center gap-1.5 min-w-0 ${
        checked ? 'bg-lime-600/15 text-white border-lime-600/50' : 'bg-[#1A1A1A] text-gray-200 border-gray-800'
      }`}
    >
      <Icon className={`w-3.5 h-3.5 shrink-0 ${checked ? 'text-lime-400' : 'text-gray-500'}`} />
      <span className="flex-1 text-xs font-bold truncate text-left">{label}</span>
      <span className={`text-[10px] tabular-nums shrink-0 ${checked ? 'text-lime-300/80' : 'text-gray-500'}`}>{count}</span>
    </button>
  );
}

export default function GeneratorView() {
  const prompts = useAppStore((s) => s.data.prompts);
  const generator = useAppStore((s) => s.data.generator) || [];
  const selectedIds = useAppStore((s) => s.generatorBanks) || [];
  const selectedSkills = useAppStore((s) => s.generatorSkills) || [];
  const toggleGeneratorBank = useAppStore((s) => s.toggleGeneratorBank);
  const toggleGeneratorSkill = useAppStore((s) => s.toggleGeneratorSkill);
  const [locks, setLocks] = useState({ c: false, o: false, r: false, e: false });
  const [kit, setKit] = useState(null);
  const [skillResults, setSkillResults] = useState([]);
  const [bankQuery, setBankQuery] = useState('');
  const [banksOpen, setBanksOpen] = useState(true);
  const [catalogueOpen, setCatalogueOpen] = useState(false);

  const askForCategories = useMemo(() => {
    const counts = new Map();
    generator.forEach((row) => {
      rowCategories(row).forEach((cat) => counts.set(cat, (counts.get(cat) || 0) + 1));
    });
    return ASK_FOR_CATEGORIES.filter((cat) => {
      if (cat.id === 'Instructions') return (counts.get(cat.id) || 0) > 0;
      return true;
    }).map((cat) => ({ ...cat, count: counts.get(cat.id) || 0, Icon: BANK_ICONS[cat.id] || Tag }));
  }, [generator]);

  const skillItems = useMemo(() => {
    const instructionCount = prompts.instructions?.length
      || generator.filter((row) => rowCategories(row).includes('Instructions') && row.text).length;
    return [
      { id: 'core', label: 'C.O.R.E.', count: prompts.core?.characters?.length || 0, Icon: Layers },
      { id: 'fut', label: 'F.U.T.', count: prompts.fut?.length || 0, Icon: Sparkles },
      { id: 'line', label: 'Line in a Pocket', count: prompts.lines?.length || 0, Icon: MessageSquare },
      { id: 'two', label: 'Two-Person Scene', count: prompts.twoPerson?.length || 0, Icon: Users },
      { id: 'style', label: 'Play Style', count: prompts.playStyles?.length || 0, Icon: Clapperboard },
      { id: 'instruction', label: 'Secret Instruction', count: instructionCount, Icon: ScrollText },
    ];
  }, [prompts, generator]);

  const selectedCats = useMemo(
    () => askForCategories.filter((cat) => selectedIds.includes(cat.id)),
    [askForCategories, selectedIds],
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
      const hay = `${row.text} ${row.extra || ''} ${rowCategories(row).join(' ')}`.toLowerCase();
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

  const buildSkill = (id, prev) => {
    if (id === 'core') return buildCORE(prev);
    if (id === 'fut') {
      const item = pick(prompts.fut);
      return item ? { type: 'fut', title: 'F.U.T. Starter', content: item } : null;
    }
    if (id === 'line') {
      const line = pick(prompts.lines);
      return line ? { type: 'line', title: 'Opening Line', content: line } : null;
    }
    if (id === 'two') {
      const scene = pick(prompts.twoPerson);
      return scene ? { type: 'two', title: 'Two-Person Scene', content: scene } : null;
    }
    if (id === 'style') {
      const style = pick(prompts.playStyles);
      return style ? { type: 'style', title: 'Play Style', content: style } : null;
    }
    const pool = prompts.instructions?.length
      ? prompts.instructions
      : generator.filter((row) => rowCategories(row).includes('Instructions')).map((row) => row.text);
    const instruction = pick(pool);
    return instruction ? { type: 'instruction', title: 'Secret Instruction', content: instruction } : null;
  };

  const generate = () => {
    if (selectedCats.length) {
      setKit(
        selectedCats.map((cat) => {
          const rows = generator.filter((row) => rowCategories(row).includes(cat.id) && row.text);
          const current = kit?.find((item) => item.id === cat.id)?.row;
          return { id: cat.id, label: cat.label, Icon: cat.Icon, row: drawFrom(rows, current) || null };
        }),
      );
    } else {
      setKit(null);
    }

    setSkillResults((prev) => selectedSkillItems.map((skill) => (
      buildSkill(skill.id, prev.find((item) => item?.type === skill.id))
    )).filter(Boolean));
  };

  const applyCatalogueRow = (row) => {
    const cats = rowCategories(row);
    const match = selectedCats.find((cat) => cats.includes(cat.id));
    if (!match) return;
    setKit((prev) => {
      const next = prev?.length
        ? prev.map((item) => ({ ...item }))
        : selectedCats.map((cat) => ({ id: cat.id, label: cat.label, Icon: cat.Icon, row: null }));
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
    <div className="h-full flex flex-col pt-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-green-500/5 blur-3xl pointer-events-none" />
      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-6 md:pb-nav">
        <h1 className="text-2xl font-black font-display text-white mb-1 tracking-tight flex items-center">
          <Wand2 className="text-green-400 mr-2 w-7 h-7" />
          Generator
        </h1>
        <p className="text-xs text-gray-500 mb-4">
          Check banks, then generate. Categories in the sheet can be comma or pipe separated — <span className="text-gray-300">Locations, Scenes</span>.
        </p>

        <section className="mb-3">
          <button
            type="button"
            onClick={() => setBanksOpen((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl border border-gray-800 bg-[#1A1A1A] min-h-11"
          >
            <div className="text-left min-w-0">
              <h2 className="text-base font-black font-display text-white leading-tight">Ask for…</h2>
              <p className="text-[11px] text-gray-500 truncate">
                {selectedCats.length + selectedSkillItems.length} selected · {selectedSummary}
              </p>
            </div>
            <ChevronDown className={`w-5 h-5 text-gray-500 shrink-0 transition-transform ${banksOpen ? 'rotate-180' : ''}`} />
          </button>

          {banksOpen && (
            <div className="mt-2">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold px-0.5 mb-1">Ask for</p>
              <div className="grid grid-cols-2 gap-1">
                {askForCategories.map((cat) => (
                  <CheckRow
                    key={cat.id}
                    checked={selectedIds.includes(cat.id)}
                    Icon={cat.Icon}
                    label={cat.label}
                    count={cat.count}
                    onToggle={() => toggleGeneratorBank(cat.id)}
                  />
                ))}
              </div>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold px-0.5 mt-2.5 mb-1">Skill Building</p>
              <div className="grid grid-cols-2 gap-1">
                {skillItems.map((skill) => (
                  <CheckRow
                    key={skill.id}
                    checked={selectedSkills.includes(skill.id)}
                    Icon={skill.Icon}
                    label={skill.label}
                    count={skill.count}
                    onToggle={() => toggleGeneratorSkill(skill.id)}
                  />
                ))}
              </div>
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
                  <p className="text-[10px] uppercase tracking-wider text-lime-400 font-bold mb-2">Scene kit</p>
                  <div className="space-y-1.5">
                    {kit.map((item) => {
                      const Icon = item.Icon || Tag;
                      return (
                        <div key={item.id} className="flex items-start gap-2 rounded-xl border border-gray-800 bg-card px-2.5 py-2">
                          <Icon className="w-3.5 h-3.5 text-lime-400 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">{item.label}</p>
                            <p className="text-sm font-bold text-gray-100 leading-snug">
                              {item.row ? displayRow(item.row) : `No ${item.label.toLowerCase()} yet.`}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {skillResults.map((generated) => (
                <section
                  key={`${generated.type}-${JSON.stringify(generated.content)}`}
                  className="bg-[#1A1A1A] border border-gray-700 rounded-2xl p-3"
                >
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-2">{generated.title}</p>

                  {generated.type === 'core' && (
                    <div className="space-y-1.5">
                      {[
                        ['c', 'Character', 'bg-blue-900/10 border-blue-900/30 text-blue-400', generated.content.c],
                        ['o', 'Objective', 'bg-rose-900/10 border-rose-900/30 text-rose-400', generated.content.o],
                        ['r', 'Relationship', 'bg-emerald-900/10 border-emerald-900/30 text-emerald-400', generated.content.r],
                        ['e', 'Environment', 'bg-amber-900/10 border-amber-900/30 text-amber-400', generated.content.e],
                      ].map(([key, label, tone, value]) => (
                        <div key={key} className={`${tone.split(' ').slice(0, 2).join(' ')} px-2.5 py-2 rounded-xl border flex justify-between gap-2 items-center`}>
                          <div className="min-w-0">
                            <span className={`${tone.split(' ').pop()} text-[10px] font-bold block uppercase tracking-wider`}>{label}</span>
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
                        <span className="text-[10px] text-gray-500 block uppercase tracking-wider mb-1">Base Reality</span>
                        <p className="text-sm font-medium text-gray-300 bg-gray-900/50 p-2.5 rounded-xl border border-gray-800">
                          {generated.content.reality}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-pink-500 font-bold uppercase tracking-wider mb-1 flex items-center">
                          <Star className="w-3 h-3 mr-1" /> First Unusual Thing
                        </span>
                        <p className="text-base font-bold text-pink-200 leading-snug">{generated.content.weirdThing}</p>
                      </div>
                    </div>
                  )}

                  {generated.type === 'line' && (
                    <p className="text-lg font-black text-emerald-300 italic leading-tight text-center py-2">“{generated.content}”</p>
                  )}

                  {generated.type === 'two' && (
                    <p className="text-base font-bold text-amber-200 leading-snug">{generated.content}</p>
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
                    <p className="text-base font-bold text-fuchsia-200 leading-snug">{generated.content}</p>
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
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <input
                  type="search"
                  value={bankQuery}
                  onChange={(e) => setBankQuery(e.target.value)}
                  placeholder={selectedCats.length ? `Filter ${selectedCats.map((c) => c.label).join(', ').toLowerCase()}…` : 'Check a bank first…'}
                  className="w-full pl-10 pr-3 py-3 border border-gray-700 rounded-xl bg-[#1A1A1A] text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-lime-600"
                />
              </div>
              {!selectedCats.length ? (
                <p className="text-sm text-gray-500">Check one or more banks above, then search their catalogue.</p>
              ) : selectedRows.length === 0 ? (
                <p className="text-sm text-gray-500">No rows yet. Add some in the Generator tab.</p>
              ) : (
                <>
                  <p className="text-[11px] text-gray-500 mb-2">
                    {filteredCatalogue.length} match{filteredCatalogue.length === 1 ? '' : 'es'}
                    {filteredCatalogue.length > CATALOGUE_CAP ? ` · showing ${CATALOGUE_CAP}` : ''}
                  </p>
                  <div className="space-y-1.5">
                    {visibleCatalogue.map((row) => (
                      <button
                        key={row.id || row.text}
                        type="button"
                        onClick={() => applyCatalogueRow(row)}
                        className={`w-full text-left bg-card border rounded-xl px-3 py-2.5 text-sm min-h-11 ${
                          kit?.some((item) => item.row?.id === row.id) ? 'border-lime-600 text-white' : 'border-gray-800 text-gray-300'
                        }`}
                      >
                        <span className="block text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-0.5">
                          {rowCategories(row).join(' · ')}
                        </span>
                        {displayRow(row)}
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
