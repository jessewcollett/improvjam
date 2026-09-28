import { ASK_FOR_CATEGORIES, askForCategoriesFromRows, skillItemsFromRows } from './generator.js';
import { clampDrawCount, DRAW_MAX } from './generateDraw.js';
import { ideaText, parseSessionBankId, sessionBankId } from './stage.js';

export const LINK_ID_CAP = 40;

function uniqueIds(list, max, allowSession = false) {
  const cap = Number.isFinite(max) ? Math.max(0, max) : LINK_ID_CAP;
  const seen = new Set();
  const out = [];
  (Array.isArray(list) ? list : []).forEach((raw) => {
    if (out.length >= cap) return;
    const id = String(raw || '').trim();
    if (!id || seen.has(id)) return;
    const sessionCat = parseSessionBankId(id);
    if (sessionCat) {
      if (!allowSession) return;
      const canonical = sessionBankId(sessionCat);
      if (!canonical || seen.has(canonical)) return;
      seen.add(canonical);
      out.push(canonical);
      return;
    }
    seen.add(id);
    out.push(id);
  });
  return out;
}

export function sessionLinkActive(state) {
  return Boolean(state?.settings?.stageOn && (state.stageIdeasOpen || state.stageIdeasUse));
}

export function sessionBanksFromState(state) {
  if (!sessionLinkActive(state)) return [];
  const generator = state?.data?.generator || [];
  const banks = state?.data?.banks;
  const fromRows = askForCategoriesFromRows(generator, banks);
  const byId = new Map(ASK_FOR_CATEGORIES.map((item) => [item.id, { ...item, count: 0 }]));
  fromRows.forEach((item) => byId.set(item.id, item));
  const ideas = state?.stageIdeas || {};
  const ideaCats = new Set((state?.stageIdeaCats || []).map((id) => String(id || '').trim()).filter(Boolean));
  const out = [];
  const seen = new Set();
  const consider = (id) => {
    const key = String(id || '').trim();
    if (!key || seen.has(key) || parseSessionBankId(key)) return;
    const rows = (ideas[key] || []).map(ideaText).filter(Boolean);
    if (!rows.length && !ideaCats.has(key)) return;
    seen.add(key);
    const cat = byId.get(key) || { id: key, label: key };
    out.push({
      id: sessionBankId(key),
      label: cat.label || key,
      icon: cat.icon,
      count: rows.length,
      session: true,
    });
  };
  ASK_FOR_CATEGORIES.forEach((cat) => consider(cat.id));
  ideaCats.forEach(consider);
  Object.keys(ideas).forEach(consider);
  return out;
}

export function normalizeGameGeneratorLink(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const banks = uniqueIds(raw.banks, LINK_ID_CAP, true);
  const skills = uniqueIds(raw.skills, LINK_ID_CAP - banks.length);
  if (!banks.length && !skills.length) return null;
  const wanted = new Set([...banks, ...skills]);
  const drawCounts = {};
  const countsRaw = raw.drawCounts && typeof raw.drawCounts === 'object' && !Array.isArray(raw.drawCounts)
    ? raw.drawCounts
    : {};
  wanted.forEach((id) => {
    drawCounts[id] = clampDrawCount(countsRaw[id] ?? 1);
  });
  return { banks, skills, drawCounts };
}

export function normalizeGameGeneratorLinks(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const next = {};
  Object.entries(raw).forEach(([gameId, value]) => {
    const id = String(gameId || '').trim();
    if (!id) return;
    const link = normalizeGameGeneratorLink(value);
    if (!link) return;
    next[id] = link;
  });
  return next;
}

export function catalogIdsFromState(state) {
  const generator = state?.data?.generator || [];
  const banks = state?.data?.banks;
  const prompts = state?.data?.prompts || {};
  const fromRows = askForCategoriesFromRows(generator, banks);
  const byId = new Map(ASK_FOR_CATEGORIES.map((item) => [item.id, { ...item, count: 0 }]));
  fromRows.forEach((item) => byId.set(item.id, item));
  const ask = [...byId.values()];
  const skills = skillItemsFromRows(generator, prompts, banks);
  const sessionBanks = sessionBanksFromState(state);
  return {
    bankIds: new Set([...ask.map((item) => item.id), ...sessionBanks.map((item) => item.id)]),
    skillIds: new Set(skills.map((item) => item.id)),
    banks: ask,
    skills,
    sessionBanks,
    sessionActive: sessionLinkActive(state),
  };
}

export function resolveGameGeneratorLink(link, catalog) {
  const normalized = normalizeGameGeneratorLink(link);
  if (!normalized) return null;
  if (!catalog) return normalized;
  const banks = normalized.banks.filter((id) => catalog.bankIds.has(id));
  const skills = normalized.skills.filter((id) => catalog.skillIds.has(id));
  if (!banks.length && !skills.length) return null;
  const wanted = new Set([...banks, ...skills]);
  const drawCounts = {};
  wanted.forEach((id) => {
    if (normalized.drawCounts[id] != null) drawCounts[id] = normalized.drawCounts[id];
  });
  return { banks, skills, drawCounts };
}

export function mergePreservedSessionBanks(next, previous, catalog) {
  if (!next) return null;
  const prev = normalizeGameGeneratorLink(previous);
  if (!prev) return next;
  const available = catalog?.bankIds || new Set();
  const keep = prev.banks.filter((id) => parseSessionBankId(id) && !available.has(id));
  if (!keep.length) return next;
  const drawCounts = { ...prev.drawCounts, ...next.drawCounts };
  keep.forEach((id) => {
    if (drawCounts[id] == null) drawCounts[id] = prev.drawCounts[id] ?? 1;
  });
  return normalizeGameGeneratorLink({
    banks: [...keep, ...next.banks],
    skills: next.skills,
    drawCounts,
  });
}

export function splitGeneratorSelection(applied) {
  const banks = [];
  const sessionBanks = [];
  (applied?.banks || []).forEach((id) => {
    const key = String(id || '').trim();
    if (!key) return;
    if (parseSessionBankId(key)) sessionBanks.push(key);
    else banks.push(key);
  });
  return {
    generatorBanks: banks,
    generatorSessionBanks: uniqueIds(sessionBanks, LINK_ID_CAP, true),
    generatorSkills: applied?.skills || [],
    generatorDrawCounts: applied?.drawCounts || {},
  };
}

export function linkFromCurrentGenerator(state) {
  const catalog = catalogIdsFromState(state);
  const banks = uniqueIds(
    [...(state?.generatorSessionBanks || []), ...(state?.generatorBanks || [])],
    LINK_ID_CAP,
    true,
  ).filter((id) => catalog.bankIds.has(id));
  const skills = uniqueIds(state?.generatorSkills, LINK_ID_CAP - banks.length)
    .filter((id) => catalog.skillIds.has(id));
  const counts = state?.generatorDrawCounts || {};
  const drawCounts = {};
  [...banks, ...skills].forEach((id) => {
    if (counts[id] == null) return;
    drawCounts[id] = clampDrawCount(counts[id]);
  });
  return normalizeGameGeneratorLink({ banks, skills, drawCounts });
}

export function applyGameGeneratorLink(state, gameId) {
  const key = String(gameId || '').trim();
  if (!key) return null;
  return selectionFromLink(state, state?.gameGeneratorLinks?.[key]);
}

export function selectionFromLink(state, link) {
  const catalog = catalogIdsFromState(state);
  const resolved = resolveGameGeneratorLink(link, catalog);
  if (!resolved) return null;
  const drawCounts = {};
  [...resolved.banks, ...resolved.skills].forEach((id) => {
    drawCounts[id] = clampDrawCount(resolved.drawCounts[id] ?? 1);
  });
  return {
    banks: resolved.banks,
    skills: resolved.skills,
    drawCounts,
  };
}

export function linkSummaryItems(link, catalog) {
  const resolved = resolveGameGeneratorLink(link, catalog);
  if (!resolved) return [];
  const byId = new Map([
    ...(catalog?.sessionBanks || []).map((item) => [item.id, item]),
    ...(catalog?.banks || []).map((item) => [item.id, item]),
    ...(catalog?.skills || []).map((item) => [item.id, item]),
  ]);
  return [...resolved.banks, ...resolved.skills].map((id) => {
    const meta = byId.get(id) || { id, label: id };
    const session = Boolean(meta.session || parseSessionBankId(id));
    return {
      id,
      label: session ? `Audience ${meta.label || parseSessionBankId(id) || id}` : (meta.label || id),
      icon: meta.icon,
      count: clampDrawCount(resolved.drawCounts[id] ?? 1),
      session,
    };
  });
}

export function emptyLinkDraft() {
  return { banks: [], skills: [], drawCounts: {} };
}

export function toggleDraftId(draft, field, id) {
  const key = String(id || '').trim();
  if (!key || (field !== 'banks' && field !== 'skills')) return draft || emptyLinkDraft();
  const current = Array.isArray(draft?.[field]) ? draft[field] : [];
  const has = current.includes(key);
  if (has) {
    const nextIds = current.filter((item) => item !== key);
    const drawCounts = { ...(draft?.drawCounts || {}) };
    delete drawCounts[key];
    return {
      banks: field === 'banks' ? nextIds : (draft?.banks || []),
      skills: field === 'skills' ? nextIds : (draft?.skills || []),
      drawCounts,
    };
  }
  const other = field === 'banks' ? (draft?.skills || []) : (draft?.banks || []);
  if (current.length + other.length >= LINK_ID_CAP) return draft || emptyLinkDraft();
  return {
    banks: field === 'banks' ? [...current, key] : (draft?.banks || []),
    skills: field === 'skills' ? [...current, key] : (draft?.skills || []),
    drawCounts: {
      ...(draft?.drawCounts || {}),
      [key]: clampDrawCount(draft?.drawCounts?.[key] ?? 1),
    },
  };
}

export function setDraftCount(draft, id, count, field) {
  const key = String(id || '').trim();
  if (!key) return draft || emptyLinkDraft();
  const next = {
    banks: Array.isArray(draft?.banks) ? [...draft.banks] : [],
    skills: Array.isArray(draft?.skills) ? [...draft.skills] : [],
    drawCounts: {
      ...(draft?.drawCounts || {}),
      [key]: Math.min(DRAW_MAX, clampDrawCount(count)),
    },
  };
  if (field === 'banks' || field === 'skills') {
    if (!next[field].includes(key) && next.banks.length + next.skills.length < LINK_ID_CAP) {
      next[field].push(key);
    }
  }
  return next;
}
