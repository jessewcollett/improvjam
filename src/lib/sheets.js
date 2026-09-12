import fallback from '../data/mockData.json';
import { promptsFromRows, rowsFromPrompts, splitList, withTermIds } from './generator.js';

export const SHEETS_URL = import.meta.env.VITE_SHEETS_URL || '';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeGame(game) {
  const categories = splitList(game?.categories || game?.category);
  return {
    ...game,
    categories,
    category: categories[0] || String(game?.category || '').trim(),
    tags: splitList(game?.tags),
    lifeSkills: splitList(game?.lifeSkills),
    sourceIds: splitList(game?.sourceIds),
  };
}

function normalizeTerm(term) {
  const categories = splitList(term?.category);
  return {
    ...term,
    categories,
    category: categories[0] || String(term?.category || '').trim(),
    sourceIds: splitList(term?.sourceIds),
  };
}

export function normalizePayload(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      ...fallback,
      games: asArray(fallback.games).map(normalizeGame),
      terms: withTermIds(fallback.terms).map(normalizeTerm),
      generator: asArray(fallback.generator).length ? fallback.generator : rowsFromPrompts(fallback.prompts),
    };
  }

  const generator = asArray(raw.generator).length
    ? raw.generator
    : asArray(fallback.generator).length
      ? fallback.generator
      : rowsFromPrompts(raw.prompts || fallback.prompts);

  return {
    games: (asArray(raw.games).length ? raw.games : fallback.games).map(normalizeGame),
    terms: withTermIds(asArray(raw.terms).length ? raw.terms : fallback.terms).map(normalizeTerm),
    sources: asArray(raw.sources).length ? raw.sources : fallback.sources,
    generator,
    prompts: promptsFromRows(generator, fallback.prompts),
  };
}

export async function fetchSheetData(url = SHEETS_URL) {
  if (!url) {
    throw new Error('No Google Sheets URL configured.');
  }
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Sheet fetch failed (${res.status}). Redeploy the Apps Script as Anyone.`);
  }
  const text = await res.text();
  if (text.trim().startsWith('<')) {
    throw new Error('Sheet URL asked for a Google login. Redeploy the web app as Anyone.');
  }
  return normalizePayload(JSON.parse(text));
}

export function sourceById(sources, id) {
  return asArray(sources).find((s) => s.id === id);
}

export function sourceLabel(item, sources) {
  if (item.source) return item.source;
  const ids = splitList(item.sourceIds);
  const names = ids.map((id) => sourceById(sources, id)?.name).filter(Boolean);
  return names.join(' · ') || 'Unknown source';
}

export function sourceHref(item, sources) {
  const ids = splitList(item.sourceIds);
  for (const id of ids) {
    const href = sourceById(sources, id)?.url;
    if (href) return href;
  }
  return '';
}
