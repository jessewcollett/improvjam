import fallback from '../data/mockData.json';
import { promptsFromRows, rowsFromPrompts, withTermIds } from './generator.js';

export const SHEETS_URL = import.meta.env.VITE_SHEETS_URL || '';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function normalizePayload(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      ...fallback,
      terms: withTermIds(fallback.terms),
      generator: asArray(fallback.generator).length ? fallback.generator : rowsFromPrompts(fallback.prompts),
    };
  }

  const generator = asArray(raw.generator).length
    ? raw.generator
    : asArray(fallback.generator).length
      ? fallback.generator
      : rowsFromPrompts(raw.prompts || fallback.prompts);

  return {
    games: asArray(raw.games).length ? raw.games : fallback.games,
    terms: withTermIds(asArray(raw.terms).length ? raw.terms : fallback.terms),
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
  const ids = asArray(item.sourceIds);
  const names = ids.map((id) => sourceById(sources, id)?.name).filter(Boolean);
  return names.join(' · ') || 'Unknown source';
}

export function sourceHref(item, sources) {
  const ids = asArray(item.sourceIds);
  for (const id of ids) {
    const href = sourceById(sources, id)?.url;
    if (href) return href;
  }
  return '';
}
