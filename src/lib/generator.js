import { DEFAULT_BANK_ICONS, defaultBankIcon } from './icons.js';

export const BANK_CATEGORIES = [
  { id: 'Activities', label: 'Activities' },
  { id: 'Adjectives', label: 'Adjectives' },
  { id: 'Animals', label: 'Animals' },
  { id: 'Characters', label: 'Characters' },
  { id: 'Companies', label: 'Companies' },
  { id: 'Emotions', label: 'Emotions' },
  { id: 'Famous', label: 'Famous' },
  { id: 'Genres', label: 'Genres' },
  { id: 'Instructions', label: 'Instructions' },
  { id: 'Jobs', label: 'Jobs' },
  { id: 'Lines', label: 'Lines' },
  { id: 'Locations', label: 'Locations' },
  { id: 'Nouns', label: 'Nouns' },
  { id: 'Objects', label: 'Objects' },
  { id: 'Objectives', label: 'Objectives' },
  { id: 'PlayStyle', label: 'Play styles' },
  { id: 'Relationships', label: 'Relationships' },
  { id: 'Scenes', label: 'Scenes' },
  { id: 'Shapes', label: 'Shapes' },
  { id: 'Songs', label: 'Songs' },
  { id: 'Story Titles', label: 'Story titles' },
  { id: 'Verbs', label: 'Verbs' },
  { id: 'Words', label: 'Words' },
  { id: 'FUT', label: 'F.U.T.' },
];

const ASK_FOR_IDS = [
  'Activities',
  'Adjectives',
  'Animals',
  'Characters',
  'Companies',
  'Emotions',
  'Famous',
  'Genres',
  'Jobs',
  'Lines',
  'Locations',
  'Nouns',
  'Objects',
  'Relationships',
  'Scenes',
  'Shapes',
  'Songs',
  'Story Titles',
  'Verbs',
  'Words',
  'Instructions',
];

export const ASK_FOR_CATEGORIES = ASK_FOR_IDS.map((id) => BANK_CATEGORIES.find((cat) => cat.id === id)).filter(Boolean);

/** Defaults when Banks.group and Generator.group are blank. */
const DEFAULT_CATEGORY_GROUP = {
  FUT: 'skill',
  PlayStyle: 'skill',
  Lines: 'both',
  Objectives: 'skill',
  CORE: 'skill',
  Core: 'skill',
  'C.O.R.E.': 'skill',
  Instructions: 'both',
  Scenes: 'both',
};

export const SKILL_ITEM_BY_CATEGORY = {
  FUT: { id: 'fut', label: 'F.U.T.' },
  Lines: { id: 'line', label: 'Line in a Pocket' },
  Scenes: { id: 'two', label: 'Two-Person Scene' },
  PlayStyle: { id: 'style', label: 'Play Style' },
  Instructions: { id: 'instruction', label: 'Secret Instruction' },
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function splitList(value) {
  if (Array.isArray(value)) return value.flatMap((item) => splitList(item));
  return String(value || '')
    .split(/[|,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function splitCategories(raw) {
  return splitList(raw);
}

export function joinCategories(categories) {
  return asArray(categories).map((s) => String(s).trim()).filter(Boolean).join(', ');
}

export function rowCategories(row) {
  return splitCategories(row?.categories || row?.category || '');
}

export function normalizeGroup(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  if (/^skill/.test(raw) || raw === 'skills' || raw === 'yes' || raw === 'true' || raw === '1') return 'skill';
  if (/^ask/.test(raw) || raw === 'no' || raw === 'false' || raw === '0') return 'ask';
  if (raw === 'both' || raw === 'all') return 'both';
  return '';
}

export function rowGroup(row) {
  return normalizeGroup(row?.group || row?.section);
}

export function findBank(banks, id) {
  const want = String(id || '').trim().toLowerCase();
  return asArray(banks).find((bank) => String(bank?.id || '').trim().toLowerCase() === want);
}

function displayGroupLabel(internal) {
  if (internal === 'skill') return 'Skill Building';
  if (internal === 'both') return 'Both';
  return 'Ask-for';
}

export function defaultBanks() {
  const rows = BANK_CATEGORIES.map((cat) => ({
    id: cat.id,
    label: cat.label,
    group: displayGroupLabel(DEFAULT_CATEGORY_GROUP[cat.id] || 'ask'),
    icon: DEFAULT_BANK_ICONS[cat.id] || '',
  }));
  rows.push({
    id: 'CORE',
    label: 'C.O.R.E.',
    group: 'Skill Building',
    icon: DEFAULT_BANK_ICONS.CORE,
  });
  return rows;
}

function bankMeta(id, banks) {
  const bank = findBank(banks, id);
  const known = BANK_CATEGORIES.find((cat) => cat.id === id);
  return {
    id,
    label: bank?.label || known?.label || id,
    icon: bank?.icon || defaultBankIcon(id),
  };
}

function applyGroupFlags(group, flags) {
  if (group === 'skill') flags.skill = true;
  else if (group === 'ask') flags.ask = true;
  else if (group === 'both') {
    flags.skill = true;
    flags.ask = true;
  }
}

export function groupForCategory(category, rows, banks) {
  const flags = { skill: false, ask: false };
  applyGroupFlags(DEFAULT_CATEGORY_GROUP[category] || '', flags);
  applyGroupFlags(normalizeGroup(findBank(banks, category)?.group), flags);
  asArray(rows).forEach((row) => {
    if (!rowCategories(row).includes(category)) return;
    applyGroupFlags(rowGroup(row), flags);
  });
  if (flags.skill && flags.ask) return 'both';
  if (flags.skill) return 'skill';
  if (flags.ask) return 'ask';
  return DEFAULT_CATEGORY_GROUP[category] || 'ask';
}

function countedCategories(rows) {
  const counts = new Map();
  asArray(rows).forEach((row) => {
    if (!String(row?.text || '').trim()) return;
    rowCategories(row).forEach((cat) => {
      counts.set(cat, (counts.get(cat) || 0) + 1);
    });
  });
  return counts;
}

function orderedCategoryIds(counts) {
  const known = ASK_FOR_IDS.filter((id) => counts.has(id));
  const unknown = Array.from(counts.keys())
    .filter((id) => !ASK_FOR_IDS.includes(id))
    .sort((a, b) => a.localeCompare(b));
  return [...known, ...unknown];
}

export function askForCategoriesFromRows(rows, banks) {
  const counts = countedCategories(rows);
  return orderedCategoryIds(counts)
    .filter((id) => {
      const group = groupForCategory(id, rows, banks);
      return group === 'ask' || group === 'both';
    })
    .map((id) => {
      const group = groupForCategory(id, rows, banks);
      return { ...bankMeta(id, banks), count: counts.get(id) || 0, group };
    });
}

export function skillItemsFromRows(rows, prompts = {}, banks) {
  const counts = countedCategories(rows);
  const items = [];
  const coreGroup = groupForCategory('CORE', rows, banks);
  if (coreGroup === 'skill' || coreGroup === 'both') {
    const core = bankMeta('CORE', banks);
    items.push({
      id: 'core',
      category: 'CORE',
      label: core.label || 'C.O.R.E.',
      icon: core.icon || defaultBankIcon('CORE', 'core'),
      count: prompts.core?.characters?.length || counts.get('Characters') || 0,
    });
  }
  const seen = new Set(items.map((item) => item.id));
  orderedCategoryIds(counts).forEach((id) => {
    if (id === 'CORE' || id === 'Core' || id === 'C.O.R.E.' || id === 'Objectives') return;
    const group = groupForCategory(id, rows, banks);
    if (group !== 'skill' && group !== 'both') return;
    const special = SKILL_ITEM_BY_CATEGORY[id];
    const meta = bankMeta(id, banks);
    const item = special
      ? {
        ...special,
        category: id,
        icon: meta.icon || defaultBankIcon(id, special.id),
        count: counts.get(id) || 0,
      }
      : {
        id: `cat:${id}`,
        category: id,
        label: meta.label,
        icon: meta.icon || defaultBankIcon(id),
        count: counts.get(id) || 0,
      };
    if (seen.has(item.id)) return;
    seen.add(item.id);
    items.push(item);
  });
  return items;
}

/** Read the optional second line from a generator row. Does not invent values. */
export function rowExtra(row) {
  if (row == null || typeof row !== 'object') return '';
  const raw = row.extra ?? row.extras;
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item || '').trim()).filter(Boolean).join(' ');
  }
  return String(raw || '').trim();
}

function applyCategory(out, cat, text, extra) {
  switch (cat) {
    case 'Characters':
    case 'Character':
      out.core.characters.push(text);
      break;
    case 'Objectives':
    case 'Objective':
      out.core.objectives.push(text);
      break;
    case 'Relationships':
    case 'Relationship':
      out.core.relationships.push(text);
      out.suggestions.relationships.push(text);
      break;
    case 'Locations':
    case 'Location':
      out.core.environments.push(text);
      out.suggestions.locations.push(text);
      break;
    case 'Objects':
    case 'Object':
      out.suggestions.objects.push(text);
      break;
    case 'Jobs':
    case 'Occupation':
      out.suggestions.occupations.push(text);
      break;
    case 'Lines':
    case 'Line':
      out.lines.push(text);
      break;
    case 'Scenes':
    case 'Prompt':
      out.twoPerson.push(text);
      break;
    case 'PlayStyle':
      out.playStyles.push({ name: text, description: extra });
      break;
    case 'FUT':
      out.fut.push({ reality: text, weirdThing: extra });
      break;
    case 'Instructions':
      out.instructions.push(text);
      break;
    default:
      break;
  }
}

export function rowsFromPrompts(prompts = {}) {
  const rows = [];
  const add = (categories, text, extra = '') => {
    if (!text) return;
    const cats = asArray(categories);
    rows.push({
      id: `gen-${rows.length + 1}`,
      categories: joinCategories(cats),
      category: cats[0] || '',
      text,
      extra,
    });
  };
  const core = prompts.core || {};
  asArray(core.characters).forEach((text) => add(['Characters'], text));
  asArray(core.objectives).forEach((text) => add(['Objectives', 'Activities'], text));
  asArray(core.relationships).forEach((text) => add(['Relationships'], text));
  asArray(core.environments).forEach((text) => add(['Locations'], text));
  asArray(prompts.suggestions?.locations).forEach((text) => add(['Locations'], text));
  asArray(prompts.suggestions?.objects).forEach((text) => add(['Objects', 'Nouns'], text));
  asArray(prompts.suggestions?.occupations).forEach((text) => add(['Jobs'], text));
  asArray(prompts.lines).forEach((text) => add(['Lines', 'Words'], text));
  asArray(prompts.twoPerson).forEach((text) => add(['Scenes'], text));
  asArray(prompts.playStyles).forEach((style) => add(['PlayStyle'], style.name || style, style.description || ''));
  asArray(prompts.fut).forEach((item) => add(['FUT', 'Scenes'], item.reality, item.weirdThing));
  asArray(prompts.instructions).forEach((text) => add(['Instructions'], text));
  return rows;
}

export function promptsFromRows(rows, fallback = {}) {
  const out = {
    core: { characters: [], objectives: [], relationships: [], environments: [] },
    fut: [],
    lines: [],
    twoPerson: [],
    playStyles: [],
    instructions: [],
    suggestions: { locations: [], occupations: [], relationships: [], objects: [] },
  };
  asArray(rows).forEach((row) => {
    const text = String(row.text || '').trim();
    const extra = rowExtra(row);
    if (!text) return;
    rowCategories(row).forEach((cat) => applyCategory(out, cat, text, extra));
  });

  const pick = (primary, backup) => (primary.length ? primary : asArray(backup));
  return {
    core: {
      characters: pick(out.core.characters, fallback.core?.characters),
      objectives: pick(out.core.objectives, fallback.core?.objectives),
      relationships: pick(out.core.relationships, fallback.core?.relationships),
      environments: pick(out.core.environments, fallback.core?.environments),
    },
    fut: pick(out.fut, fallback.fut),
    lines: pick(out.lines, fallback.lines),
    twoPerson: pick(out.twoPerson, fallback.twoPerson),
    playStyles: pick(out.playStyles, fallback.playStyles),
    instructions: pick(out.instructions, fallback.instructions),
    suggestions: {
      locations: pick(out.suggestions.locations, fallback.suggestions?.locations),
      occupations: pick(out.suggestions.occupations, fallback.suggestions?.occupations),
      relationships: pick(out.suggestions.relationships, fallback.suggestions?.relationships),
      objects: pick(out.suggestions.objects, fallback.suggestions?.objects),
    },
  };
}

export function withTermIds(terms) {
  return asArray(terms).map((term) => ({
    ...term,
    id: term.id || `term-${String(term.term || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
  }));
}
