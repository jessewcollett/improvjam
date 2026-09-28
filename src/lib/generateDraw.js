import { ASK_FOR_CATEGORIES, rowCategories, skillItemsFromRows } from './generator.js';
import { ideaText, parseSessionBankId, sessionBankId, suggestionsFromGenerator } from './stage.js';

export const DRAW_MIN = 1;
export const DRAW_MAX = 12;

function pick(arr) {
  if (!arr?.length) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

export function clampDrawCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DRAW_MIN;
  return Math.max(DRAW_MIN, Math.min(DRAW_MAX, Math.round(n)));
}

function asSuggestion(value) {
  if (!value) return null;
  if (typeof value === 'string') return { text: value, extra: '' };
  return value;
}

function drawMany(rows, n, previous = []) {
  const count = clampDrawCount(n);
  if (!rows.length || count < 1) return [];
  const avoid = new Set(previous.map((row) => row?.id).filter(Boolean));
  const picked = [];
  const used = new Set();
  for (let i = 0; i < count; i += 1) {
    const unused = rows.filter((row) => !used.has(row.id));
    const fresh = unused.filter((row) => !avoid.has(row.id));
    const pool = fresh.length ? fresh : unused.length ? unused : rows;
    const next = pick(pool);
    if (!next) break;
    picked.push(next);
    used.add(next.id);
  }
  return picked;
}

function catMeta(catId, banks) {
  const ask = ASK_FOR_CATEGORIES.find((cat) => cat.id === catId);
  if (ask) return { id: catId, label: ask.label, icon: ask.icon };
  const bank = (banks || []).find((item) => String(item?.id || '').trim() === catId);
  return { id: catId, label: bank?.label || catId, icon: bank?.icon };
}

function countFor(state, id) {
  return clampDrawCount(state?.generatorDrawCounts?.[id] ?? 1);
}

function sessionRowsFor(state, catId) {
  return (state?.stageIdeas?.[catId] || [])
    .map((item, index) => {
      const text = ideaText(item);
      return { id: `idea:${catId}:${index}:${text}`, text };
    })
    .filter((row) => row.text);
}

function buildCore(prompts) {
  const { characters, objectives, relationships, environments } = prompts.core || {};
  return {
    type: 'core',
    title: 'C.O.R.E. Setup',
    content: {
      c: pick(characters),
      o: pick(objectives),
      r: pick(relationships),
      e: pick(environments),
    },
  };
}

function pickSkillRow(generator, cat, fallbackList) {
  const rows = generator.filter((row) => rowCategories(row).includes(cat) && row.text);
  return asSuggestion(pick(rows.length ? rows : fallbackList));
}

function buildSkill(skill, generator, prompts) {
  const id = typeof skill === 'string' ? skill : skill?.id;
  if (!id) return null;
  const category = (typeof skill === 'object' && skill.category)
    || (String(id).startsWith('cat:') ? id.slice(4) : id);
  const title = (typeof skill === 'object' && skill.label) || category;
  if (id === 'core') return { ...buildCore(prompts), id };
  if (id === 'fut') {
    const item = pick(prompts.fut);
    return item ? { id, type: 'fut', title: 'F.U.T. Starter', content: item } : null;
  }
  if (id === 'line') {
    const line = pickSkillRow(generator, 'Lines', prompts.lines);
    return line ? { id, type: 'line', title: 'Line', content: line } : null;
  }
  if (id === 'two') {
    const scene = pickSkillRow(generator, 'Scenes', prompts.twoPerson);
    return scene ? { id, type: 'two', title: 'Two-Person Scene', content: scene } : null;
  }
  if (id === 'style') {
    const style = pick(prompts.playStyles);
    return style ? { id, type: 'style', title: 'Play Style', content: style } : null;
  }
  if (id === 'instruction') {
    const instruction = pickSkillRow(generator, 'Instructions', prompts.instructions);
    return instruction ? { id, type: 'instruction', title: 'Secret Instruction', content: instruction } : null;
  }
  const row = pickSkillRow(generator, category, []);
  return row ? { id, type: 'bank', title, content: row } : null;
}

export function generateKitFromStore(state) {
  const generator = state?.data?.generator || [];
  const banks = state?.data?.banks;
  const selectedIds = (state?.generatorBanks || []).filter((id) => !parseSessionBankId(id));
  const sessionIds = (state?.generatorBanks || []).map((id) => parseSessionBankId(id)).filter(Boolean);

  const sessionKit = sessionIds.map((catId) => {
    const meta = catMeta(catId, banks);
    const bankId = sessionBankId(catId);
    const rows = sessionRowsFor(state, catId);
    if (!rows.length) {
      return {
        id: bankId,
        label: meta.label,
        icon: meta.icon,
        rows: [],
        waiting: true,
        session: true,
      };
    }
    return {
      id: bankId,
      label: meta.label,
      icon: meta.icon,
      rows: drawMany(rows, countFor(state, bankId), []),
      waiting: false,
      session: true,
    };
  });

  const catalogKit = selectedIds.map((catId) => {
    const meta = catMeta(catId, banks);
    const rows = generator.filter((row) => rowCategories(row).includes(catId) && row.text);
    return {
      id: catId,
      label: meta.label,
      icon: meta.icon,
      rows: drawMany(rows, countFor(state, catId), []),
      waiting: false,
    };
  });

  return [...sessionKit, ...catalogKit];
}

export function generateSkillResultsFromStore(state) {
  const generator = state?.data?.generator || [];
  const prompts = state?.data?.prompts || {};
  const items = skillItemsFromRows(generator, prompts, state?.data?.banks);
  const selected = new Set(state?.generatorSkills || []);
  const selectedItems = items.filter((item) => selected.has(item.id));
  return selectedItems.flatMap((skill) => {
    const repeats = countFor(state, skill.id);
    const batch = [];
    for (let i = 0; i < repeats; i += 1) {
      const built = buildSkill(skill, generator, prompts);
      if (!built) continue;
      batch.push({
        ...built,
        id: repeats > 1 ? `${skill.id}-${i}` : skill.id,
      });
    }
    return batch;
  });
}

/** Draw suggestions from persisted Generator banks/counts + session ideas. Independent of GeneratorView kit state. */
export function generateSuggestionsFromStore(state) {
  const kit = generateKitFromStore(state);
  const skillResults = generateSkillResultsFromStore(state);
  return suggestionsFromGenerator(kit, skillResults);
}

export function hasGeneratorSelection(state) {
  return (state?.generatorBanks || []).length > 0 || (state?.generatorSkills || []).length > 0;
}

export function rollHatFromPrompts(prompts = {}) {
  const s = prompts.suggestions || {};
  const pickOr = (arr, fallback) => {
    const list = Array.isArray(arr) ? arr.filter(Boolean) : [];
    return list.length ? pick(list) : fallback;
  };
  return {
    location: pickOr(s.locations, 'a grocery store'),
    occupation: pickOr(s.occupations, 'a dentist'),
    relationship: pickOr(s.relationships, 'siblings'),
    object: pickOr(s.objects, 'a rubber chicken'),
  };
}

export function flipCoin() {
  return Math.random() < 0.5 ? 'Heads / Yes' : 'Tails / No';
}
