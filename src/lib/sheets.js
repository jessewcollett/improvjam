import fallback from '../data/mockData.json';
import { defaultBanks, promptsFromRows, rowsFromPrompts, splitList, withTermIds, joinCategories } from './generator.js';
import { playbackUrl } from './mediaUrl.js';
import { sheetAudioTags } from './music.js';

export const SHEETS_URL = import.meta.env.VITE_SHEETS_URL || '';
export const INTAKE_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLScoQ1oUaXuDKDReAzZE4l105L7QyT-AC_GrMiF-XGQQAL7ghg/viewform';

export const ATTRIBUTION_SOURCE_IDS = ['src-jam-terms', 'src-encyclopedia', 'src-learnimprov', 'src-irc-wiki'];

const DEFAULT_ATTRIBUTION_SOURCES = [
  {
    id: 'src-jam-terms',
    name: 'Improv Jam Terms',
    url: '',
    note: 'Teaching notes used in rehearsal.',
  },
  {
    id: 'src-encyclopedia',
    name: 'Improv Encyclopedia',
    url: 'https://improvencyclopedia.org/Download.html',
    note: 'Version 2.0.6 catalog entries. Free to use with attribution to improvencyclopedia.org.',
  },
  {
    id: 'src-learnimprov',
    name: 'Learn Improv',
    url: 'https://www.learnimprov.com/',
    note: 'CC BY-SA 4.0. https://www.learnimprov.com/about/legal/',
  },
  {
    id: 'src-irc-wiki',
    name: 'IRC Improv Wiki',
    url: 'https://wiki.improvresourcecenter.com/',
    note: 'GFDL 1.2 / CC BY-SA 3.0. Rehearsal cards are adapted from the wiki with attribution.',
  },
];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isEnabled(value) {
  if (value === false || value === 0) return false;
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'false' || raw === 'no' || raw === '0' || raw === 'off') return false;
  return true;
}

function keepActive(row) {
  if (!row) return false;
  return isEnabled(row.active ?? row.enabled);
}

function normalizeKind(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'track' || raw === 'music' || raw === 'song') return 'track';
  return 'sfx';
}

export function normalizeAudio(row) {
  const id = String(row?.id || '').trim();
  const url = String(row?.url || '').trim();
  if (!id) return null;
  return {
    id,
    name: String(row?.name || id).trim(),
    kind: normalizeKind(row?.kind),
    url,
    playUrl: playbackUrl(url),
    icon: String(row?.icon || 'bell').trim() || 'bell',
    credit: String(row?.credit || '').trim(),
    creditUrl: String(row?.creditUrl || row?.crediturl || '').trim(),
    notes: String(row?.notes || '').trim(),
    tags: sheetAudioTags(row),
    enabled: isEnabled(row?.active ?? row?.enabled),
  };
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
    image: String(game?.image || '').trim(),
    imageSrc: playbackUrl(game?.image),
    setup: String(game?.setup || '').trim(),
    howToPlay: String(game?.howToPlay || '').trim(),
    gimmicks: String(game?.gimmicks || '').trim(),
    variations: splitList(game?.variations),
    synonyms: splitList(game?.synonyms),
    relatedIds: splitList(game?.relatedIds),
    sourceUrl: String(game?.sourceUrl || '').trim(),
  };
}

function normalizeTerm(term) {
  const categories = splitList(term?.category);
  return {
    ...term,
    categories,
    category: categories[0] || String(term?.category || '').trim(),
    sourceIds: splitList(term?.sourceIds),
    image: String(term?.image || '').trim(),
    imageSrc: playbackUrl(term?.image),
    sourceUrl: String(term?.sourceUrl || '').trim(),
    definitions: String(term?.definitions || '').trim(),
  };
}

function normalizeGeneratorRow(row) {
  if (!row || typeof row !== 'object') return row;
  const categories = splitList(row.categories || row.category);
  return {
    ...row,
    id: String(row.id || '').trim(),
    categories: joinCategories(categories),
    category: categories[0] || String(row.category || '').trim(),
    text: String(row.text ?? '').trim(),
    extra: String(row.extra ?? row.extras ?? '').trim(),
    group: String(row.group || row.section || '').trim(),
  };
}

function normalizeBank(row) {
  const id = String(row?.id || row?.category || '').trim();
  if (!id) return null;
  return {
    id,
    label: String(row?.label || id).trim(),
    group: String(row?.group || row?.section || '').trim(),
    icon: String(row?.icon || '').trim(),
  };
}

function normalizeIconRow(row) {
  const id = String(row?.id || '').trim();
  if (!id) return null;
  return {
    id,
    name: String(row?.name || id).trim(),
    kind: String(row?.kind || '').trim().toLowerCase() || 'lucide',
    sample: String(row?.sample || '').trim(),
  };
}

function hrefOrEmpty(value) {
  const raw = String(value || '').trim();
  if (!raw || !/^https?:\/\//i.test(raw)) return '';
  return raw;
}

function normalizeSource(row) {
  const id = String(row?.id || '').trim();
  if (!id) return null;
  return {
    id,
    name: String(row?.name || id).trim(),
    url: hrefOrEmpty(row?.url),
    note: String(row?.note || '').trim(),
    active: isEnabled(row?.active ?? row?.enabled),
  };
}

function mergeCatalogSources(primary, fallbackSources) {
  const byId = new Map();
  asArray(primary).forEach((row) => {
    const src = normalizeSource(row);
    if (src) byId.set(src.id, src);
  });
  [...asArray(fallbackSources), ...DEFAULT_ATTRIBUTION_SOURCES].forEach((row) => {
    const src = normalizeSource(row);
    if (src && !byId.has(src.id) && ATTRIBUTION_SOURCE_IDS.includes(src.id)) {
      byId.set(src.id, { ...src, active: true });
    }
  });
  return [...byId.values()]
    .filter((src) => src.active || ATTRIBUTION_SOURCE_IDS.includes(src.id))
    .sort((a, b) => {
      const ai = ATTRIBUTION_SOURCE_IDS.indexOf(a.id);
      const bi = ATTRIBUTION_SOURCE_IDS.indexOf(b.id);
      if (ai === -1 && bi === -1) return String(a.name).localeCompare(String(b.name));
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
}

export function normalizePayload(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      ...fallback,
      games: asArray(fallback.games).map(normalizeGame).filter(keepActive),
      terms: withTermIds(fallback.terms).map(normalizeTerm).filter(keepActive),
      generator: asArray(fallback.generator).length
        ? fallback.generator.map(normalizeGeneratorRow).filter(keepActive)
        : rowsFromPrompts(fallback.prompts),
      banks: asArray(fallback.banks).map(normalizeBank).filter(Boolean).filter(keepActive).length
        ? asArray(fallback.banks).map(normalizeBank).filter(Boolean).filter(keepActive)
        : defaultBanks(),
      icons: asArray(fallback.icons).map(normalizeIconRow).filter(Boolean).filter(keepActive),
      sources: mergeCatalogSources(fallback.sources, fallback.sources),
      audio: asArray(fallback.audio).map(normalizeAudio).filter(Boolean).filter((row) => row.enabled),
    };
  }

  const generator = (asArray(raw.generator).length
    ? raw.generator
    : asArray(fallback.generator).length
      ? fallback.generator
      : rowsFromPrompts(raw.prompts || fallback.prompts)
  ).map(normalizeGeneratorRow).filter(keepActive);

  const banks = asArray(raw.banks).map(normalizeBank).filter(Boolean).filter(keepActive);

  return {
    games: (asArray(raw.games).length ? raw.games : fallback.games).map(normalizeGame).filter(keepActive),
    terms: withTermIds(asArray(raw.terms).length ? raw.terms : fallback.terms).map(normalizeTerm).filter(keepActive),
    sources: mergeCatalogSources(asArray(raw.sources).length ? raw.sources : fallback.sources, fallback.sources),
    generator,
    banks: banks.length ? banks : defaultBanks(),
    icons: asArray(raw.icons).map(normalizeIconRow).filter(Boolean).filter(keepActive),
    prompts: promptsFromRows(generator, fallback.prompts),
    audio: asArray(raw.audio).map(normalizeAudio).filter(Boolean).filter((row) => row.enabled),
  };
}

function withCacheBust(url) {
  const join = url.includes('?') ? '&' : '?';
  return `${url}${join}_=${Date.now()}`;
}

function catalogEndpoints(preferred) {
  const endpoints = [];
  endpoints.push('/api/catalog');
  if (preferred && !preferred.includes('/api/catalog')) endpoints.push(preferred);
  return [...new Set(endpoints)];
}

async function fetchJson(url) {
  const res = await fetch(withCacheBust(url));
  if (!res.ok) {
    throw new Error(`Sheet fetch failed (${res.status}). Redeploy the Apps Script as Anyone.`);
  }
  const text = await res.text();
  if (text.trim().startsWith('<')) {
    throw new Error('Sheet URL asked for a Google login. Redeploy the web app as Anyone.');
  }
  return JSON.parse(text);
}

export async function fetchSheetData(url = SHEETS_URL) {
  const endpoints = catalogEndpoints(url);
  if (!endpoints.length) {
    throw new Error('No Google Sheets URL configured.');
  }

  let lastError;
  for (const endpoint of endpoints) {
    try {
      return normalizePayload(await fetchJson(endpoint));
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export function sourceById(sources, id) {
  return asArray(sources).find((s) => s.id === id);
}

function urlHost(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

export function urlBelongsToSource(url, source) {
  const href = hrefOrEmpty(url);
  if (!href || !source) return false;
  const hrefHost = urlHost(href);
  const sourceHost = urlHost(source.url);
  if (!hrefHost) return false;
  if (sourceHost && (hrefHost === sourceHost || hrefHost.endsWith(`.${sourceHost}`))) return true;
  if (source.id === 'src-learnimprov' && hrefHost.endsWith('learnimprov.com')) return true;
  if (source.id === 'src-encyclopedia' && hrefHost.endsWith('improvencyclopedia.org')) return true;
  if (source.id === 'src-irc-wiki' && hrefHost.endsWith('improvresourcecenter.com')) return true;
  return false;
}

export function itemSourceLinks(item, sources) {
  const catalog = asArray(sources);
  const pageUrl = hrefOrEmpty(item?.sourceUrl);
  const ids = splitList(item?.sourceIds);
  const seen = new Set();
  const links = [];

  ids.forEach((id) => {
    if (seen.has(id)) return;
    seen.add(id);
    const src = sourceById(catalog, id);
    const name = src?.name || id;
    let href = '';
    if (pageUrl && src && urlBelongsToSource(pageUrl, src)) href = pageUrl;
    else if (src?.url) href = src.url;
    links.push({ id, name, href });
  });

  return links;
}

export function trustedSourceUrl(item, sources) {
  const pageUrl = hrefOrEmpty(item?.sourceUrl);
  if (!pageUrl) return '';
  const ids = splitList(item?.sourceIds);
  const matchesSource = ids.some((id) => urlBelongsToSource(pageUrl, sourceById(sources, id)));
  return matchesSource ? pageUrl : '';
}

export function sourceLabel(item, sources) {
  if (item.source) return item.source;
  const names = itemSourceLinks(item, sources).map((src) => src.name).filter(Boolean);
  return names.join(' · ') || 'Unknown source';
}

export function sourceHref(item, sources) {
  const trusted = trustedSourceUrl(item, sources);
  if (trusted) return trusted;
  const links = itemSourceLinks(item, sources);
  for (const link of links) {
    if (link.href) return link.href;
  }
  return '';
}
