import { useMemo, useState } from 'react';
import { Dices, Minus, Plus, Tag, Wand2, X } from 'lucide-react';
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
import { parseSessionBankId } from '../lib/stage.js';

function CountStepper({ label, count, onCount }) {
  const n = clampDrawCount(count);
  return (
    <div className="inline-flex items-center shrink-0">
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onCount(n - 1);
        }}
        disabled={n <= DRAW_MIN}
        className="min-w-11 min-h-11 flex items-center justify-center text-gray-200 disabled:text-gray-600"
        aria-label={`Fewer ${label}`}
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <span className="w-5 text-center text-xs font-black tabular-nums text-white">{n}</span>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onCount(n + 1);
        }}
        disabled={n >= DRAW_MAX}
        className="min-w-11 min-h-11 flex items-center justify-center text-gray-200 disabled:text-gray-600"
        aria-label={`More ${label}`}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function PickRow({ item, checked, count, onToggle, onCount }) {
  return (
    <div className="flex items-center gap-0.5 min-w-0">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggle();
        }}
        className={`min-h-11 px-2 py-1.5 rounded-lg border flex items-center gap-1.5 min-w-0 flex-1 ${
          checked ? 'bg-lime-600/15 text-white border-lime-600/50' : 'bg-[#1A1A1A] text-gray-200 border-gray-800'
        }`}
      >
        <span
          className={`w-4 h-4 rounded border shrink-0 ${
            checked ? 'bg-lime-500 border-lime-400' : 'border-gray-600 bg-[#121212]'
          }`}
          aria-hidden="true"
        />
        <CatalogIcon name={item.icon} className={`w-3.5 h-3.5 shrink-0 ${checked ? 'text-lime-400' : 'text-gray-500'}`} fallback={Tag} />
        <span className="flex-1 text-xs font-bold leading-tight text-left truncate">{item.label}</span>
      </button>
      <CountStepper label={item.label} count={count} onCount={onCount} />
    </div>
  );
}

function GameGeneratorSheet({ gameId, catalog, draft, setDraft, onClose }) {
  const setGameGeneratorLink = useAppStore((s) => s.setGameGeneratorLink);
  const canUseCurrent = useAppStore((s) => (
    (s.generatorBanks || []).some((id) => id && !parseSessionBankId(id))
    || (s.generatorSkills || []).length > 0
  ));
  const selectedCount = (draft.banks?.length || 0) + (draft.skills?.length || 0);

  const save = (next) => {
    setGameGeneratorLink(gameId, next);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex flex-col justify-end">
      <button type="button" className="absolute inset-0 bg-black/70" aria-label="Close generator link" onClick={onClose} />
      <div className="relative bg-[#121212] border-t border-gray-800 rounded-t-3xl px-4 pt-3 pb-nav max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-sm font-black font-display text-white leading-tight">Build a generator</p>
          <button
            type="button"
            onClick={onClose}
            className="min-w-11 min-h-11 flex items-center justify-center text-gray-400"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-2xs text-gray-500 mb-2">
          Select as many categories as you want, then set how many to draw for each.
        </p>
        <button
          type="button"
          disabled={!canUseCurrent}
          onClick={() => {
            const next = linkFromCurrentGenerator(useAppStore.getState());
            setDraft(next || emptyLinkDraft());
          }}
          className="min-h-11 mb-2 rounded-xl bg-lime-600 disabled:bg-gray-800 disabled:text-gray-500 text-black text-sm font-black"
        >
          Use current Generator
        </button>
        <div className="overflow-y-auto scrollbar-hide flex-1 min-h-0 space-y-3 pb-3">
          {catalog.banks.length ? (
            <section>
              <p className="text-2xs uppercase tracking-wider text-gray-500 font-bold mb-1">
                Ask for
                {draft.banks?.length ? ` · ${draft.banks.length}` : ''}
              </p>
              <div className="grid grid-cols-1 gap-1">
                {catalog.banks.map((item) => (
                  <PickRow
                    key={item.id}
                    item={item}
                    checked={(draft.banks || []).includes(item.id)}
                    count={draft.drawCounts?.[item.id] ?? 1}
                    onToggle={() => setDraft((prev) => toggleDraftId(prev, 'banks', item.id))}
                    onCount={(n) => setDraft((prev) => setDraftCount(prev, item.id, n, 'banks'))}
                  />
                ))}
              </div>
            </section>
          ) : null}
          {catalog.skills.length ? (
            <section>
              <p className="text-2xs uppercase tracking-wider text-gray-500 font-bold mb-1">
                Skill building
                {draft.skills?.length ? ` · ${draft.skills.length}` : ''}
              </p>
              <div className="grid grid-cols-1 gap-1">
                {catalog.skills.map((item) => (
                  <PickRow
                    key={item.id}
                    item={item}
                    checked={(draft.skills || []).includes(item.id)}
                    count={draft.drawCounts?.[item.id] ?? 1}
                    onToggle={() => setDraft((prev) => toggleDraftId(prev, 'skills', item.id))}
                    onCount={(n) => setDraft((prev) => setDraftCount(prev, item.id, n, 'skills'))}
                  />
                ))}
              </div>
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

export default function GameGeneratorLink({ gameId }) {
  const rawLink = useAppStore((s) => s.gameGeneratorLinks?.[gameId]);
  const generateFromGame = useAppStore((s) => s.generateFromGame);
  const generator = useAppStore((s) => s.data.generator);
  const banks = useAppStore((s) => s.data.banks);
  const prompts = useAppStore((s) => s.data.prompts);
  const liveCatalog = useMemo(
    () => catalogIdsFromState({ data: { generator, banks, prompts } }),
    [generator, banks, prompts],
  );
  const resolved = resolveGameGeneratorLink(rawLink, liveCatalog);
  const chips = linkSummaryItems(rawLink, liveCatalog);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(emptyLinkDraft);

  const openSheet = (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    setDraft(normalizeGameGeneratorLink(rawLink) || emptyLinkDraft());
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
          gameId={gameId}
          catalog={liveCatalog}
          draft={draft}
          setDraft={setDraft}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
