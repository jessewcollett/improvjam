import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Copy, EyeOff, QrCode, RefreshCw, Star, Type, Tv, X } from 'lucide-react';
import { ASK_FOR_CATEGORIES } from '../lib/generator.js';
import {
  buildStagePayload,
  copyText,
  DEFAULT_STAGE_MESSAGES,
  layoutsForCount,
  listedStageSlots,
  normalizeStageBoardStyle,
  normalizeStageCode,
  normalizeStageLayout,
  normalizeStageIdeasMap,
  sanitizeStageCodeInput,
  slotSummary,
  suggestionLine,
  STAGE_SLOT_LABELS,
  STAGE_IDEAS_POLL_MS,
  stageBoardUrl,
  stageIdeasUrl,
} from '../lib/stage.js';
import { useAppStore } from '../store/useAppStore.js';
import { STAGE_MANAGER_ID } from '../lib/nav.js';
import { LiveStageTime } from './StageBoardContent.jsx';
import { GamePartToggles } from './StagePin.jsx';
import IdeaQueue from './IdeaQueue.jsx';
import {
  MESSAGE_MAX,
  messageFromClipboard,
  htmlToText,
  stageMessageHtml,
  stageMessageText,
} from '../lib/stageMessage.js';

function useCopiedFlag() {
  const [copied, setCopied] = useState(false);
  const mark = () => {
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  return [copied, mark];
}

async function copyStageLink(code) {
  return copyText(stageBoardUrl(code));
}

function StageItemRows({ slots, onClearSlot, onClearItem, onMove, onToggleGamePart }) {
  if (!slots.length) {
    return <p className="text-sm text-gray-500">Nothing on stage yet. Pin a panel, then it shows here and on the TV.</p>;
  }
  return (
    <ul className="space-y-2">
      {slots.map((slot, index) => {
        const nested = Array.isArray(slot.value) && (slot.id === 'games' || slot.id === 'suggestions' || slot.id === 'whosup');
        const name = STAGE_SLOT_LABELS[slot.id] || slot.id;
        return (
          <li key={slot.id} className="rounded-xl border border-gray-800 bg-[#1A1A1A] overflow-hidden">
            <div className="flex items-start gap-1 min-h-11 pl-3">
              <div className="flex-1 min-w-0 py-2">
                <p className="text-2xs uppercase tracking-wider text-gray-500 font-bold">
                  {name}
                </p>
                {slot.id === 'timer' ? (
                  <p className="text-sm font-bold text-gray-100 leading-snug truncate tabular-nums">
                    <LiveStageTime timer={slot.value} />
                  </p>
                ) : !nested ? (
                  <p className="text-sm font-bold text-gray-100 leading-snug truncate">
                    {slotSummary(slot.id, slot.value) || 'On stage'}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => onClearSlot(slot.id)}
                className="min-w-11 min-h-11 flex items-center justify-center text-gray-400 hover:text-red-300 shrink-0"
                aria-label={`Clear ${name} from stage`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-between border-t border-gray-800">
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => onMove(slot.id, -1)}
                  disabled={index === 0}
                  className="min-w-11 min-h-11 flex items-center justify-center text-gray-200 disabled:text-gray-600"
                  aria-label={`Move ${name} up`}
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onMove(slot.id, 1)}
                  disabled={index === slots.length - 1}
                  className="min-w-11 min-h-11 flex items-center justify-center text-gray-200 disabled:text-gray-600"
                  aria-label={`Move ${name} down`}
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>
            {nested ? (
              <ul className="border-t border-gray-800">
                {slot.value.map((item, itemIndex) => {
                  const label = slot.id === 'games'
                    ? item?.name
                    : slot.id === 'whosup'
                      ? item
                      : item?.label || (item?.texts || []).map((entry) => suggestionLine(entry).text).filter(Boolean).join(', ');
                  return (
                    <li key={`${slot.id}-${itemIndex}`}>
                      <div className="flex items-center gap-1 pl-3 min-h-11">
                        <span className="flex-1 min-w-0 text-sm text-gray-200 truncate">{label}</span>
                        <button
                          type="button"
                          onClick={() => onClearItem(slot.id, itemIndex)}
                          className="min-w-11 min-h-11 flex items-center justify-center text-gray-500 hover:text-red-300 shrink-0"
                          aria-label={`Remove ${label} from stage`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {slot.id === 'games' ? (
                        <GamePartToggles
                          game={item}
                          onToggle={(partId) => onToggleGamePart?.(item, partId)}
                          className="px-3 pb-2"
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function SegmentPills({ label, value, onChange, options, className = '' }) {
  return (
    <div className={`flex items-center gap-1.5 shrink-0 ${className}`}>
      {label ? (
        <p className="text-2xs uppercase tracking-wider text-gray-500 font-bold min-w-0 truncate">{label}</p>
      ) : null}
      <div className="inline-flex p-0.5 rounded-full border border-gray-800 bg-[#1A1A1A] shrink-0">
        {options.map((opt) => {
          const on = value === opt.id;
          return (
            <button
              key={String(opt.id)}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(opt.id)}
              className={`px-2.5 min-h-9 text-xs font-bold rounded-full inline-flex items-center gap-1 ${
                on ? (opt.activeClass || 'bg-lime-700 text-white') : 'text-gray-400'
              }`}
              aria-label={opt.ariaLabel || opt.label}
            >
              {opt.icon || null}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StageSessionBar() {
  const on = useAppStore((s) => s.settings.stageOn);
  const code = useAppStore((s) => s.settings.stageCode);
  const hideCode = useAppStore((s) => s.stageHideCode);
  const setStageOn = useAppStore((s) => s.setStageOn);
  const setStageCode = useAppStore((s) => s.setStageCode);
  const mintNewStageCode = useAppStore((s) => s.mintNewStageCode);
  const setStageHideCode = useAppStore((s) => s.setStageHideCode);
  const [draft, setDraft] = useState(code || '');

  useEffect(() => {
    setDraft(code || '');
  }, [code]);

  const commit = () => {
    const next = normalizeStageCode(draft);
    if (next) {
      setStageCode(next);
      setDraft(next);
      return;
    }
    setDraft(code || '');
  };

  return (
    <div className="mb-3 flex items-center gap-1.5 min-w-0">
      <SegmentPills
        value={on}
        onChange={setStageOn}
        options={[
          { id: false, label: 'Off', activeClass: 'bg-gray-700 text-white' },
          { id: true, label: 'On' },
        ]}
      />
      {on && code ? (
        <div className="ml-auto flex items-center gap-1.5 min-w-0 shrink-0">
          <input
            value={draft}
            onChange={(e) => setDraft(sanitizeStageCodeInput(e.target.value))}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              }
            }}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={5}
            aria-label="Session code"
            className="w-[4.75rem] min-h-9 rounded-lg bg-[#1A1A1A] border border-gray-700 px-2 text-sm font-black font-display tracking-[0.18em] text-white text-center focus:outline-none focus:border-lime-600 shrink-0"
          />
          <button
            type="button"
            onClick={() => mintNewStageCode()}
            className="min-h-9 px-2 rounded-lg bg-gray-800 border border-gray-700 text-xs font-bold text-gray-100 inline-flex items-center gap-1 shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            New
          </button>
          <SegmentPills
            value={hideCode}
            onChange={setStageHideCode}
            options={[
              { id: false, label: 'Show', ariaLabel: 'Show code', activeClass: 'bg-gray-700 text-white' },
              { id: true, label: 'Hide', ariaLabel: 'Hide code', icon: <EyeOff className="w-3.5 h-3.5" /> },
            ]}
          />
        </div>
      ) : null}
    </div>
  );
}

function PressChip({ on, onClick, label, activeClass, badge, ariaLabel }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      aria-label={ariaLabel || label}
      className={`min-h-11 px-3 rounded-full text-xs font-bold border inline-flex items-center gap-1 ${
        on
          ? (activeClass || 'bg-lime-700 text-white border-lime-500')
          : 'bg-[#1A1A1A] text-gray-300 border-gray-800'
      }`}
    >
      {label}
      {badge ? <span className="tabular-nums opacity-90">({badge})</span> : null}
    </button>
  );
}

function audienceStatus(open, use, hold) {
  const parts = [];
  if (open) parts.push('Collect');
  if (use) parts.push('Use');
  if (hold) parts.push('Hold');
  return parts.length ? parts.join(' · ') : 'Off';
}

function pendingIdeaCount(map) {
  return Object.values(map || {}).reduce((n, rows) => n + (Array.isArray(rows) ? rows.length : 0), 0);
}

function StageBoardChrome({ boardStyle, onBoardStyle, count, layout, onLayout }) {
  const currentStyle = normalizeStageBoardStyle(boardStyle);
  const options = layoutsForCount(count);
  const currentLayout = normalizeStageLayout(layout);
  const matching = options.some((item) => item.id === currentLayout);
  const chip = (id, label, title, active) => (
    <button
      key={id || 'auto'}
      type="button"
      title={title || label}
      aria-pressed={active}
      onClick={() => onLayout(id)}
      className={`min-h-11 px-2.5 rounded-full text-xs font-bold border ${
        active ? 'bg-lime-700 text-white border-lime-500' : 'bg-[#1A1A1A] text-gray-200 border-gray-800'
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-2xs uppercase tracking-wider text-gray-500 font-bold">Board</p>
        {[['cards', 'Cards'], ['compact', 'Compact']].map(([id, label]) => {
          const active = currentStyle === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => onBoardStyle(id)}
              className={`min-h-11 px-2.5 rounded-full text-xs font-bold border ${
                active ? 'bg-lime-700 text-white border-lime-500' : 'bg-[#1A1A1A] text-gray-200 border-gray-800'
              }`}
            >
              {label}
            </button>
          );
        })}
        {count && options.length ? (
          <>
            <span className="w-px h-4 bg-gray-800" aria-hidden />
            {chip('', 'Auto', 'Even pack', !matching)}
            {options.map((item) => chip(item.id, item.short, item.name, matching && currentLayout === item.id))}
          </>
        ) : null}
      </div>
    </div>
  );
}

function StageAudiencePanel() {
  const code = useAppStore((s) => s.settings.stageCode);
  const ideasOpen = useAppStore((s) => s.stageIdeasOpen);
  const ideasUse = useAppStore((s) => s.stageIdeasUse);
  const ideasHold = useAppStore((s) => s.stageIdeasHold);
  const ideaCats = useAppStore((s) => s.stageIdeaCats);
  const pendingCount = pendingIdeaCount(normalizeStageIdeasMap(useAppStore((s) => s.stageIdeasPending)));
  const displayPinned = useAppStore((s) => s.stagePins.includes('display'));
  const setStageIdeasOpen = useAppStore((s) => s.setStageIdeasOpen);
  const setStageIdeasUse = useAppStore((s) => s.setStageIdeasUse);
  const setStageIdeasHold = useAppStore((s) => s.setStageIdeasHold);
  const setStageIdeaCats = useAppStore((s) => s.setStageIdeaCats);
  const toggleStageIdeaCat = useAppStore((s) => s.toggleStageIdeaCat);
  const toggleStageDisplay = useAppStore((s) => s.toggleStageDisplay);
  const pullStageIdeas = useAppStore((s) => s.pullStageIdeas);
  const [copied, markCopied] = useCopiedFlag();
  const [catsOpen, setCatsOpen] = useState(false);
  const url = code ? stageIdeasUrl(code) : '';
  const showCats = ideasOpen || ideasUse;
  const showDetails = showCats;
  const showQueue = showCats || pendingCount > 0;
  const selectedCats = ASK_FOR_CATEGORIES.filter((cat) => ideaCats.includes(cat.id));
  const catSummary = selectedCats.length
    ? selectedCats.map((cat) => cat.label).join(', ')
    : 'None selected';

  useEffect(() => {
    if (!(ideasOpen || ideasUse)) return undefined;
    pullStageIdeas();
    const id = window.setInterval(pullStageIdeas, STAGE_IDEAS_POLL_MS);
    return () => window.clearInterval(id);
  }, [ideasOpen, ideasUse, pullStageIdeas]);

  const onCopy = async () => {
    if (!url) return;
    if (await copyText(url)) markCopied();
  };

  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <p className="text-2xs uppercase tracking-wider text-gray-500 font-bold">Audience</p>
        <PressChip
          on={ideasOpen}
          onClick={() => setStageIdeasOpen(!ideasOpen)}
          label="Collect"
        />
        <PressChip
          on={ideasUse}
          onClick={() => setStageIdeasUse(!ideasUse)}
          label="Use"
          ariaLabel="Use session pool"
        />
        <PressChip
          on={ideasHold}
          onClick={() => setStageIdeasHold(!ideasHold)}
          label="Approve"
          ariaLabel="Approve before Stage"
          activeClass="bg-amber-700 text-white border-amber-500"
          badge={pendingCount || null}
        />
        <span className="text-xs text-gray-500">{audienceStatus(ideasOpen, ideasUse, ideasHold)}</span>
      </div>
      {showDetails ? (
        <>
          <div className="flex flex-wrap gap-2 mb-2">
            <button
              type="button"
              onClick={() => toggleStageDisplay()}
              aria-pressed={displayPinned}
              className={`min-h-11 px-3 rounded-xl border text-sm font-bold inline-flex items-center gap-2 ${
                displayPinned
                  ? 'bg-lime-700 text-white border-lime-500'
                  : 'bg-gray-800 text-gray-100 border-gray-700'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              {displayPinned ? 'On board' : 'Show on board'}
            </button>
            <button
              type="button"
              onClick={onCopy}
              disabled={!url}
              className="min-h-11 px-3 rounded-xl bg-gray-800 border border-gray-700 text-sm font-bold text-gray-100 inline-flex items-center gap-2 disabled:text-gray-600"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-lime-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
          {showCats ? (
            <button
              type="button"
              onClick={() => setCatsOpen(true)}
              className="w-full min-h-11 px-3 rounded-xl border border-gray-800 bg-[#1A1A1A] flex items-center justify-between gap-2"
            >
              <span className="min-w-0 text-left">
                <span className="block text-2xs uppercase tracking-wider text-gray-500 font-bold">Categories</span>
                <span className="block text-sm font-bold text-gray-100 truncate">{catSummary}</span>
              </span>
              <span className="text-xs font-bold text-lime-400 shrink-0">
                {selectedCats.length ? 'Edit' : 'Choose'}
              </span>
            </button>
          ) : null}
        </>
      ) : null}
      {catsOpen ? (
        <div className="fixed inset-0 z-[80] flex flex-col justify-end">
          <button type="button" className="absolute inset-0 bg-black/70" aria-label="Close categories" onClick={() => setCatsOpen(false)} />
          <div className="relative bg-[#121212] border-t border-gray-800 rounded-t-3xl px-4 pt-3 pb-nav max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-sm font-black font-display text-white leading-tight">Ask the room for</p>
              <button
                type="button"
                onClick={() => setCatsOpen(false)}
                className="min-w-11 min-h-11 flex items-center justify-center text-gray-400"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-1.5 mb-2">
              <button
                type="button"
                onClick={() => setStageIdeaCats(ASK_FOR_CATEGORIES.map((cat) => cat.id))}
                className="min-h-8 px-2.5 rounded-full bg-gray-800 border border-gray-700 text-xs font-bold text-gray-100"
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStageIdeaCats([])}
                className="min-h-8 px-2.5 rounded-full bg-gray-800 border border-gray-700 text-xs font-bold text-gray-100"
              >
                None
              </button>
            </div>
            <div className="overflow-y-auto scrollbar-hide flex flex-wrap gap-1.5 content-start pb-3">
              {ASK_FOR_CATEGORIES.map((cat) => {
                const active = ideaCats.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleStageIdeaCat(cat.id)}
                    className={`min-h-11 px-2.5 rounded-full text-xs font-bold border ${
                      active ? 'bg-lime-700 text-white border-lime-500' : 'bg-[#1A1A1A] text-gray-200 border-gray-800'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setCatsOpen(false)}
              className="min-h-11 rounded-xl bg-lime-600 text-black text-sm font-black"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
      {showQueue ? (
        <div className="mt-3">
          <p className="text-2xs uppercase tracking-wider text-gray-500 font-bold mb-2">Queue</p>
          <IdeaQueue />
        </div>
      ) : null}
    </div>
  );
}

function StageMessagePanel() {
  const message = useAppStore((s) => s.stageSlots.message);
  const html = stageMessageHtml(message);
  const text = html ? (htmlToText(html) || stageMessageText(message)) : stageMessageText(message);
  const pinned = useAppStore((s) => s.stagePins.includes('message'));
  const extras = useAppStore((s) => s.stageMessageFavorites) || [];
  const setStageMessage = useAppStore((s) => s.setStageMessage);
  const toggleStageMessage = useAppStore((s) => s.toggleStageMessage);
  const addStageMessageFavorite = useAppStore((s) => s.addStageMessageFavorite);
  const removeStageMessageFavorite = useAppStore((s) => s.removeStageMessageFavorite);
  const ignoreInputUntil = useRef(0);
  const extraSet = new Set(extras.map((item) => item.toLowerCase()));
  const defaultSet = new Set(DEFAULT_STAGE_MESSAGES.map((item) => item.toLowerCase()));
  const saved = extras.filter((item) => !defaultSet.has(item.toLowerCase()));
  const trimmed = text.trim();
  const canFavorite = Boolean(trimmed)
    && trimmed.length <= 80
    && !trimmed.includes('\n')
    && !defaultSet.has(trimmed.toLowerCase())
    && !extraSet.has(trimmed.toLowerCase());

  const onPaste = (event) => {
    const pastedHtml = event.clipboardData?.getData('text/html') || '';
    const plain = event.clipboardData?.getData('text/plain') || '';
    if (!pastedHtml && !plain) return;
    event.preventDefault();
    event.stopPropagation();
    const next = messageFromClipboard(pastedHtml, plain);
    if (!next) return;
    ignoreInputUntil.current = Date.now() + 600;
    setStageMessage(next);
  };

  return (
    <div className="mb-3">
      <p className="text-2xs uppercase tracking-wider text-gray-500 font-bold mb-2">Board message</p>
      <textarea
        value={text}
        onChange={(event) => {
          if (Date.now() < ignoreInputUntil.current) return;
          setStageMessage(event.target.value);
        }}
        onPaste={onPaste}
        rows={6}
        maxLength={MESSAGE_MAX}
        placeholder="Welcome, class norms, questions… Paste bullets from Docs."
        className="w-full rounded-xl bg-[#1A1A1A] border border-gray-800 px-3 py-2.5 text-sm font-bold text-white placeholder:text-gray-600 mb-1 min-h-[8.5rem]"
      />
      <p className="text-2xs text-gray-500 mb-2 tabular-nums">{trimmed.length} / {MESSAGE_MAX}</p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {DEFAULT_STAGE_MESSAGES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setStageMessage(item)}
            aria-pressed={text === item}
            className={`min-h-10 px-2.5 rounded-lg text-xs font-bold border ${
              text === item ? 'bg-lime-700 text-white border-lime-500' : 'bg-[#1A1A1A] text-gray-200 border-gray-800'
            }`}
          >
            {item}
          </button>
        ))}
        {saved.map((item) => (
          <span
            key={item}
            className={`inline-flex items-center min-h-10 rounded-lg border overflow-hidden ${
              text === item ? 'bg-lime-700 text-white border-lime-500' : 'bg-[#1A1A1A] text-gray-200 border-gray-800'
            }`}
          >
            <button
              type="button"
              onClick={() => setStageMessage(item)}
              className="px-2.5 text-xs font-bold"
            >
              {item}
            </button>
            <button
              type="button"
              onClick={() => removeStageMessageFavorite(item)}
              className="min-w-9 min-h-10 flex items-center justify-center text-gray-400 hover:text-red-300 border-l border-white/10"
              aria-label={`Remove ${item} favorite`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => toggleStageMessage()}
          disabled={!trimmed && !pinned}
          aria-pressed={pinned}
          className={`min-h-11 px-3 rounded-xl border text-sm font-bold inline-flex items-center gap-2 disabled:text-gray-600 ${
            pinned
              ? 'bg-lime-700 text-white border-lime-500'
              : 'bg-gray-800 text-gray-100 border-gray-700'
          }`}
        >
          <Type className="w-3.5 h-3.5" />
          {pinned ? 'On board' : 'Show on board'}
        </button>
        <button
          type="button"
          onClick={() => addStageMessageFavorite(trimmed)}
          disabled={!canFavorite}
          className="min-h-11 px-3 rounded-xl bg-gray-800 border border-gray-700 text-sm font-bold text-gray-100 inline-flex items-center gap-2 disabled:text-gray-600"
        >
          <Star className="w-3.5 h-3.5" />
          Save favorite
        </button>
      </div>
    </div>
  );
}

function useStagePreview() {
  const pins = useAppStore((s) => s.stagePins);
  const slots = useAppStore((s) => s.stageSlots);
  const sizes = useAppStore((s) => s.stageSizes);
  const zooms = useAppStore((s) => s.stageZooms);
  const frames = useAppStore((s) => s.stageFrames);
  const layout = useAppStore((s) => s.stageLayout);
  const unpinStageSlot = useAppStore((s) => s.unpinStageSlot);
  const removeStageSlotItem = useAppStore((s) => s.removeStageSlotItem);
  const moveStagePin = useAppStore((s) => s.moveStagePin);
  const setStageLayout = useAppStore((s) => s.setStageLayout);
  const boardStyle = useAppStore((s) => s.settings.stageBoardStyle);
  const setStageBoardStyle = useAppStore((s) => s.setStageBoardStyle);
  const toggleStageGamePart = useAppStore((s) => s.toggleStageGamePart);
  const listed = listedStageSlots(buildStagePayload(pins, slots, sizes, layout, boardStyle, zooms, frames));
  return {
    listed,
    layout,
    boardStyle,
    setStageLayout,
    setStageBoardStyle,
    toggleStageGamePart,
    unpinStageSlot,
    removeStageSlotItem,
    moveStagePin,
    pinCount: pins.length,
  };
}

export function StageBoardChromeBar() {
  const { listed, layout, boardStyle, setStageLayout, setStageBoardStyle } = useStagePreview();
  return (
    <StageBoardChrome
      boardStyle={boardStyle}
      onBoardStyle={setStageBoardStyle}
      count={listed.length}
      layout={layout}
      onLayout={setStageLayout}
    />
  );
}

export function StageRemoteBody({ footer = null, extra = null, showPinList = true, showFirst = false }) {
  const {
    listed,
    layout,
    boardStyle,
    setStageLayout,
    setStageBoardStyle,
    toggleStageGamePart,
    unpinStageSlot,
    removeStageSlotItem,
    moveStagePin,
    pinCount,
  } = useStagePreview();
  const clearStagePins = useAppStore((s) => s.clearStagePins);
  const chrome = (
    <StageBoardChrome
      boardStyle={boardStyle}
      onBoardStyle={setStageBoardStyle}
      count={listed.length}
      layout={layout}
      onLayout={setStageLayout}
    />
  );
  const pins = showPinList ? (
    <StageItemRows
      slots={listed}
      onClearSlot={unpinStageSlot}
      onClearItem={removeStageSlotItem}
      onMove={moveStagePin}
      onToggleGamePart={toggleStageGamePart}
    />
  ) : null;
  const clear = (
    <div className="flex flex-wrap gap-2 pt-2">
      {footer}
      <button
        type="button"
        onClick={() => clearStagePins()}
        disabled={!pinCount}
        className="min-h-11 px-3 rounded-xl bg-gray-800 border border-gray-700 text-sm font-bold text-gray-100 disabled:text-gray-600"
      >
        Clear all
      </button>
    </div>
  );

  if (showFirst) {
    return (
      <>
        <StageSessionBar />
        {extra}
        <StageAudiencePanel />
        <StageMessagePanel />
        {pins}
        {clear}
      </>
    );
  }

  return (
    <>
      <StageSessionBar />
      <StageAudiencePanel />
      <StageMessagePanel />
      {chrome}
      {extra}
      {pins}
      {clear}
    </>
  );
}

export function StageHeaderControl() {
  const code = useAppStore((s) => s.settings.stageCode);
  const stageOn = useAppStore((s) => s.settings.stageOn);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const setStageOn = useAppStore((s) => s.setStageOn);
  const [copied, markCopied] = useCopiedFlag();
  const preview = useStagePreview();

  const onCopy = async (event) => {
    event.stopPropagation();
    if (!stageOn || !code) return;
    if (await copyStageLink(code)) markCopied();
  };

  const openStageTab = () => {
    if (!stageOn) setStageOn(true);
    updateSettings({ lastRoute: STAGE_MANAGER_ID });
  };

  return (
    <div className="flex items-center gap-0.5 rounded-xl border border-gray-800 bg-[#1A1A1A] pl-0.5 pr-0.5">
      <button
        type="button"
        onClick={openStageTab}
        className="flex items-center gap-1 min-h-11 pl-2 pr-1 rounded-lg"
        aria-label="Open Stage"
      >
        <Tv className={`w-3.5 h-3.5 shrink-0 ${stageOn ? 'text-lime-400' : 'text-gray-500'}`} aria-hidden />
        <span className="text-xs font-black font-display tracking-[0.16em] text-gray-200 tabular-nums min-w-[3.25rem]">
          {stageOn && code ? code : 'Off'}
        </span>
        {stageOn && preview.pinCount ? (
          <span className="text-2xs font-bold text-lime-400">{preview.pinCount}</span>
        ) : null}
      </button>
      <button
        type="button"
        onClick={onCopy}
        disabled={!stageOn || !code}
        className="flex items-center justify-center min-w-11 min-h-11 rounded-lg text-gray-300 disabled:text-gray-600"
        aria-label={copied ? 'Stage link copied' : 'Copy stage link'}
      >
        {copied ? <Check className="w-3.5 h-3.5 text-lime-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

export function StageSettingsPanel() {
  const code = useAppStore((s) => s.settings.stageCode);
  const stageOn = useAppStore((s) => s.settings.stageOn);
  const publishError = useAppStore((s) => s.stagePublishError);
  const ensureStageCode = useAppStore((s) => s.ensureStageCode);
  const setStageOn = useAppStore((s) => s.setStageOn);
  const [copied, markCopied] = useCopiedFlag();

  const onCopy = async () => {
    if (!stageOn) setStageOn(true);
    const next = ensureStageCode();
    if (await copyStageLink(next)) markCopied();
  };

  const url = stageOn && code ? stageBoardUrl(code) : '';

  return (
    <div>
      <p className="text-sm text-gray-400 mb-3">
        Turn Stage on to publish pins to a classroom computer or Apple TV. Music and SFX stay here.
      </p>
      {url ? <p className="text-xs text-gray-500 break-all mb-3">{url}</p> : null}
      <StageRemoteBody
        footer={(
          <button
            type="button"
            onClick={onCopy}
            className="min-h-11 px-3 rounded-xl bg-gray-800 border border-gray-700 text-sm font-bold text-gray-100 inline-flex items-center gap-2"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-lime-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy link'}
          </button>
        )}
      />
      {publishError ? (
        <p className="text-xs text-amber-300 bg-amber-900/20 border border-amber-800/40 rounded-lg p-2 mt-3">
          {publishError}
        </p>
      ) : null}
    </div>
  );
}
