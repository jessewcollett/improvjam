import { useMemo, useState } from 'react';
import { Dices, Minus, Plus, Star, Tag, Wand2, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore.js';
import CatalogIcon from './CatalogIcon.jsx';
import {
  catalogIdsFromState,
  emptyLinkDraft,
  linkFromCurrentGenerator,
  linkSummaryItems,
  normalizeGameGeneratorLink,
  resolveGameGeneratorLink,
  setDraftCount,
  toggleDraftId,
} from '../lib/gameGenerator.js';
import { clampDrawCount, DRAW_MAX, DRAW_MIN } from '../lib/generateDraw.js';

function byLabel(a, b) {
  const labelA = String(a?.label || a?.id || '');
  const labelB = String(b?.label || b?.id || '');
  const keyA = labelA.replace(/^[^0-9A-Za-z]+/, '');
  const keyB = labelB.replace(/^[^0-9A-Za-z]+/, '');
  return keyA.localeCompare(keyB, undefined, { sensitivity: 'base' })
    || labelA.localeCompare(labelB, undefined, { sensitivity: 'base' });
}

function LinkChip({ item, checked, count, onToggle, onCount }) {
  const n = clampDrawCount(count);
  const idleClass = item.session
    ? 'bg-lime-950/25 text-gray-200 border-lime-900/70'
    : 'bg-[#1A1A1A] text-gray-200 border-gray-800';
  return (
    <div
      className={`inline-flex items-center rounded-full border shrink-0 ${
        checked ? 'bg-lime-600/15 text-white border-lime-600/50' : idleClass
      }`}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggle();
        }}
        className={`inline-flex items-center gap-1 min-h-9 pl-2.5 ${checked ? 'pr-1' : 'pr-2.5'}`}
      >
        <CatalogIcon
          name={item.icon}
          className={`w-3.5 h-3.5 shrink-0 ${checked ? 'text-lime-400' : 'text-gray-500'}`}
          fallback={Tag}
        />
        <span className="text-xs font-bold leading-none whitespace-nowrap">
          {item.label}
          {item.session && item.count != null ? ` · ${item.count}` : ''}
        </span>
      </button>
      {checked ? (
        <div className="inline-flex items-center pr-1">
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onCount(n - 1);
            }}
            disabled={n <= DRAW_MIN}
            className="min-w-7 min-h-9 flex items-center justify-center text-gray-200 disabled:text-gray-600"
            aria-label={`Fewer ${item.label}`}
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="w-4 text-center text-xs font-black tabular-nums text-white">{n}</span>
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onCount(n + 1);
            }}
            disabled={n >= DRAW_MAX}
            className="min-w-7 min-h-9 flex items-center justify-center text-gray-200 disabled:text-gray-600"
            aria-label={`More ${item.label}`}
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ChipWrap({ items, draft, field, setDraft }) {
  return (
    <div className="flex flex-wrap gap-1 w-full min-w-0">
      {items.map((item) => {
        const checked = (draft[field] || []).includes(item.id);
        return (
          <LinkChip
            key={item.id}
            item={item}
            checked={checked}
            count={draft.drawCounts?.[item.id] ?? 1}
            onToggle={() => setDraft((prev) => toggleDraftId(prev, field, item.id))}
            onCount={(n) => setDraft((prev) => setDraftCount(prev, item.id, n, field))}
          />
        );
      })}
    </div>
  );
}

function GameGeneratorSheet({ catalog, draft, setDraft, onClose, onSave, heading = 'Build a generator' }) {
  const favoriteIds = useAppStore((s) => s.generatorBankFavorites) || [];
  const canUseCurrent = useAppStore((s) => (
    (s.generatorBanks || []).length > 0
    || (s.generatorSessionBanks || []).length > 0
    || (s.generatorSkills || []).length > 0
  ));
  const selectedCount = (draft.banks?.length || 0) + (draft.skills?.length || 0);
  const sessionBanks = useMemo(
    () => [...(catalog.sessionBanks || [])].sort(byLabel),
    [catalog.sessionBanks],
  );
  const sessionIds = useMemo(
    () => new Set(sessionBanks.map((item) => item.id)),
    [sessionBanks],
  );
  const sessionSelected = (draft.banks || []).filter((id) => sessionIds.has(id)).length;
  const askSelected = (draft.banks || []).filter((id) => !sessionIds.has(id)).length;

  const banks = useMemo(() => [...(catalog.banks || [])].sort(byLabel), [catalog.banks]);
  const skills = useMemo(() => [...(catalog.skills || [])].sort(byLabel), [catalog.skills]);
  const favoriteBanks = useMemo(
    () => banks.filter((item) => favoriteIds.includes(item.id)),
    [banks, favoriteIds],
  );
  const remainingBanks = useMemo(
    () => banks.filter((item) => !favoriteIds.includes(item.id)),
    [banks, favoriteIds],
  );

  const save = (next) => {
    onSave(next);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex flex-col justify-end">
      <button type="button" className="absolute inset-0 bg-black/70" aria-label="Close generator link" onClick={onClose} />
      <div className="relative bg-[#121212] border-t border-gray-800 rounded-t-3xl px-4 pt-3 pb-nav max-h-[80vh] flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <p className="text-sm font-black font-display text-white leading-tight">{heading}</p>
            <p className="text-2xs text-gray-500 mt-0.5">Tap to pick. Use − / + for how many.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-11 min-h-11 flex items-center justify-center text-gray-400 shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <button
          type="button"
          disabled={!canUseCurrent}
          onClick={() => {
            const next = linkFromCurrentGenerator(useAppStore.getState());
            setDraft(next || emptyLinkDraft());
          }}
          className="min-h-9 mb-3 px-3 self-start rounded-full border border-gray-700 bg-[#1A1A1A] disabled:text-gray-600 disabled:border-gray-800 text-xs font-bold text-gray-200"
        >
          Use current Generator
        </button>
        <div className="overflow-y-auto overflow-x-hidden scrollbar-hide flex-1 min-h-0 min-w-0 w-full space-y-3 pb-3">
          {catalog.sessionActive ? (
            <section>
              <p className="text-2xs uppercase tracking-wider text-lime-400 font-bold mb-1">
                This session
                {sessionSelected ? ` · ${sessionSelected}` : ''}
              </p>
              {sessionBanks.length ? (
                <ChipWrap items={sessionBanks} draft={draft} field="banks" setDraft={setDraft} />
              ) : (
                <p className="text-xs text-gray-500 leading-snug">
                  No audience ideas yet. They’ll show up here as they come in.
                </p>
              )}
            </section>
          ) : null}
          {banks.length ? (
            <section>
              <p className="text-2xs uppercase tracking-wider text-gray-500 font-bold mb-1">
                Ask for
                {askSelected ? ` · ${askSelected}` : ''}
              </p>
              {favoriteBanks.length > 0 ? (
                <>
                  <p className="text-2xs uppercase tracking-wider text-yellow-500/80 font-bold px-0.5 mb-1 inline-flex items-center gap-1">
                    <Star className="w-3 h-3" fill="currentColor" />
                    Favorites
                  </p>
                  <ChipWrap items={favoriteBanks} draft={draft} field="banks" setDraft={setDraft} />
                </>
              ) : null}
              {remainingBanks.length > 0 ? (
                <>
                  {favoriteBanks.length ? (
                    <p className="text-2xs uppercase tracking-wider text-gray-500 font-bold px-0.5 mt-2.5 mb-1">All banks</p>
                  ) : null}
                  <ChipWrap items={remainingBanks} draft={draft} field="banks" setDraft={setDraft} />
                </>
              ) : null}
            </section>
          ) : null}
          {skills.length ? (
            <section>
              <p className="text-2xs uppercase tracking-wider text-gray-500 font-bold mb-1">
                Skill building
                {draft.skills?.length ? ` · ${draft.skills.length}` : ''}
              </p>
              <ChipWrap items={skills} draft={draft} field="skills" setDraft={setDraft} />
            </section>
          ) : null}
        </div>
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => save(null)}
            className="min-h-11 flex-1 rounded-xl bg-gray-800 border border-gray-700 text-sm font-bold text-gray-200"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => save(normalizeGameGeneratorLink(draft))}
            className="min-h-11 flex-[2] rounded-xl bg-lime-600 text-black text-sm font-black"
          >
            Save{selectedCount ? ` · ${selectedCount}` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useGeneratorCatalog() {
  const generator = useAppStore((s) => s.data.generator);
  const banks = useAppStore((s) => s.data.banks);
  const prompts = useAppStore((s) => s.data.prompts);
  const stageOn = useAppStore((s) => s.settings.stageOn);
  const stageIdeasOpen = useAppStore((s) => s.stageIdeasOpen);
  const stageIdeasUse = useAppStore((s) => s.stageIdeasUse);
  const stageIdeas = useAppStore((s) => s.stageIdeas);
  const stageIdeaCats = useAppStore((s) => s.stageIdeaCats);
  return useMemo(
    () => catalogIdsFromState(useAppStore.getState()),
    [generator, banks, prompts, stageOn, stageIdeasOpen, stageIdeasUse, stageIdeas, stageIdeaCats],
  );
}

export { GameGeneratorSheet };

export default function GameGeneratorLink({ gameId }) {
  const rawLink = useAppStore((s) => s.gameGeneratorLinks?.[gameId]);
  const generateFromGame = useAppStore((s) => s.generateFromGame);
  const setGameGeneratorLink = useAppStore((s) => s.setGameGeneratorLink);
  const liveCatalog = useGeneratorCatalog();
  const resolved = resolveGameGeneratorLink(rawLink, liveCatalog);
  const chips = linkSummaryItems(rawLink, liveCatalog);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(emptyLinkDraft);

  const openSheet = (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    setDraft(normalizeGameGeneratorLink(resolved) || emptyLinkDraft());
    setOpen(true);
  };

  return (
    <div className="mb-2">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-xs font-bold text-gray-400">Generator</span>
        {resolved ? (
          <button
            type="button"
            onClick={openSheet}
            className="text-xs font-bold text-lime-400 min-h-11 px-2"
          >
            Edit
          </button>
        ) : null}
      </div>
      {resolved ? (
        <>
          <div className="flex flex-wrap gap-1 mb-1.5">
            {chips.map((chip) => (
              <span
                key={chip.id}
                className="inline-flex items-center gap-1 max-w-full rounded-full border border-lime-800/50 bg-lime-950/30 px-2 py-0.5"
              >
                <CatalogIcon name={chip.icon} className="w-3 h-3 text-lime-400 shrink-0" fallback={Tag} />
                <span className="text-2xs font-bold text-lime-100 truncate">
                  {chip.label} ×{chip.count}
                </span>
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              generateFromGame(gameId);
            }}
            className="w-full min-h-11 rounded-xl bg-lime-600 text-black text-sm font-black inline-flex items-center justify-center gap-2"
          >
            <Wand2 className="w-4 h-4" />
            Generate
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={openSheet}
          className="w-full min-h-11 rounded-xl border border-gray-800 bg-[#1A1A1A] text-sm font-bold text-gray-300 inline-flex items-center justify-center gap-2"
        >
          <Dices className="w-4 h-4 text-gray-500" />
          Link a generator
        </button>
      )}
      {open ? (
        <GameGeneratorSheet
          catalog={liveCatalog}
          draft={draft}
          setDraft={setDraft}
          onClose={() => setOpen(false)}
          onSave={(next) => setGameGeneratorLink(gameId, next)}
          heading="Link a generator"
        />
      ) : null}
    </div>
  );
}
