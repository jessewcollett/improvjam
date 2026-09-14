import { useEffect, useState } from 'react';
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
  sanitizeStageCodeInput,
  slotSummary,
  suggestionLine,
  STAGE_SLOT_LABELS,
  stageBoardUrl,
  stageIdeasUrl,
} from '../lib/stage.js';
import { useAppStore } from '../store/useAppStore.js';
import { LiveStageTime } from './StageBoardContent.jsx';
import { GamePartToggles } from './StagePin.jsx';

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

function StageOnToggle() {
  const on = useAppStore((s) => s.settings.stageOn);
  const setStageOn = useAppStore((s) => s.setStageOn);
  return (
    <div className="mb-3">
      <p className="text-2xs uppercase tracking-wider text-gray-500 font-bold mb-2">Stage</p>
      <div className="flex bg-[#1A1A1A] p-1 rounded-xl border border-gray-800">
        <button
          type="button"
          className={`flex-1 py-2 text-sm font-bold rounded-lg min-h-11 ${
            !on ? 'bg-gray-700 text-white' : 'text-gray-400'
          }`}
          onClick={() => setStageOn(false)}
          aria-pressed={!on}
        >
          Off
        </button>
        <button
          type="button"
          className={`flex-1 py-2 text-sm font-bold rounded-lg min-h-11 ${
            on ? 'bg-lime-700 text-white' : 'text-gray-400'
          }`}
          onClick={() => setStageOn(true)}
          aria-pressed={on}
        >
          On
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        {on
          ? 'This phone is publishing to the TV board.'
          : 'Stage stays off until you turn it on. Pins stay on the phone only.'}
      </p>
    </div>
  );
}

function StageBoardStylePicker({ value, onChange }) {
  const current = normalizeStageBoardStyle(value);
  return (
    <div className="mb-3">
      <p className="text-2xs uppercase tracking-wider text-gray-500 font-bold mb-2">Board style</p>
      <div className="flex flex-wrap gap-1.5">
        {[['cards', 'Cards'], ['compact', 'Compact']].map(([id, label]) => {
          const active = current === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(id)}
              className={`min-h-10 px-2.5 rounded-lg text-xs font-bold border ${
                active ? 'bg-lime-700 text-white border-lime-500' : 'bg-[#1A1A1A] text-gray-200 border-gray-800'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StageLayoutPicker({ count, value, onChange }) {
  const options = layoutsForCount(count);
  if (!count || !options.length) return null;
  const current = normalizeStageLayout(value);
  const matching = options.some((layout) => layout.id === current);
  const chip = (id, label, title) => {
    const active = id ? current === id : !matching;
    return (
      <button
        key={id || 'auto'}
        type="button"
        title={title || label}
        aria-pressed={active}
        onClick={() => onChange(id)}
        className={`min-h-10 px-2.5 rounded-lg text-xs font-bold border ${
          active ? 'bg-lime-700 text-white border-lime-500' : 'bg-[#1A1A1A] text-gray-200 border-gray-800'
        }`}
      >
        {label}
      </button>
    );
  };
  return (
    <div className="mb-3">
      <p className="text-2xs uppercase tracking-wider text-gray-500 font-bold mb-2">Layout</p>
      <div className="flex flex-wrap gap-1.5">
        {chip('', 'Auto', 'Even pack')}
        {options.map((layout) => chip(layout.id, layout.short, layout.name))}
      </div>
    </div>
  );
}

function StageCodeVisibilityToggle() {
  const hideCode = useAppStore((s) => s.stageHideCode);
  const setStageHideCode = useAppStore((s) => s.setStageHideCode);
  return (
    <div className="flex bg-[#1A1A1A] p-1 rounded-xl border border-gray-800 mt-2 mb-2">
      <button
        type="button"
        className={`flex-1 py-2 text-sm font-bold rounded-lg min-h-11 ${
          !hideCode ? 'bg-gray-700 text-white' : 'text-gray-400'
        }`}
        onClick={() => setStageHideCode(false)}
        aria-pressed={!hideCode}
      >
        Show code
      </button>
      <button
        type="button"
        className={`flex-1 py-2 text-sm font-bold rounded-lg min-h-11 inline-flex items-center justify-center gap-1.5 ${
          hideCode ? 'bg-lime-700 text-white' : 'text-gray-400'
        }`}
        onClick={() => setStageHideCode(true)}
        aria-pressed={hideCode}
      >
        <EyeOff className="w-3.5 h-3.5" />
        Hide code
      </button>
    </div>
  );
}

function StageCodeField({ code, compact }) {
  const setStageCode = useAppStore((s) => s.setStageCode);
  const mintNewStageCode = useAppStore((s) => s.mintNewStageCode);
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
    <div className={compact ? '' : 'mb-3'}>
      <div className={`flex items-center gap-2 ${compact ? '' : 'mb-2'}`}>
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
          className={`min-w-0 rounded-xl bg-[#1A1A1A] border border-gray-700 px-3 font-black font-display tracking-[0.2em] text-white focus:outline-none focus:border-lime-600 ${
            compact
              ? 'flex-1 min-h-11 text-lg'
              : 'w-40 min-h-14 text-3xl'
          }`}
        />
        <button
          type="button"
          onClick={() => mintNewStageCode()}
          className="min-h-11 px-3 rounded-xl bg-gray-800 border border-gray-700 text-sm font-bold text-gray-100 inline-flex items-center gap-2 shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          New
        </button>
      </div>
      <StageCodeVisibilityToggle />
      {compact ? null : (
        <p className="text-xs text-gray-500">
          4–5 characters (no 0, O, 1, or I). A shared code is a shared board — last write wins.
        </p>
      )}
    </div>
  );
}

function StageAudiencePanel() {
  const code = useAppStore((s) => s.settings.stageCode);
  const ideasOpen = useAppStore((s) => s.stageIdeasOpen);
  const ideasUse = useAppStore((s) => s.stageIdeasUse);
  const ideaCats = useAppStore((s) => s.stageIdeaCats);
  const displayPinned = useAppStore((s) => s.stagePins.includes('display'));
  const setStageIdeasOpen = useAppStore((s) => s.setStageIdeasOpen);
  const setStageIdeasUse = useAppStore((s) => s.setStageIdeasUse);
  const setStageIdeaCats = useAppStore((s) => s.setStageIdeaCats);
  const toggleStageIdeaCat = useAppStore((s) => s.toggleStageIdeaCat);
  const toggleStageDisplay = useAppStore((s) => s.toggleStageDisplay);
  const [copied, markCopied] = useCopiedFlag();
  const [catsOpen, setCatsOpen] = useState(false);
  const url = code ? stageIdeasUrl(code) : '';
  const showCats = ideasOpen || ideasUse;
  const selectedCats = ASK_FOR_CATEGORIES.filter((cat) => ideaCats.includes(cat.id));
  const catSummary = selectedCats.length
    ? selectedCats.map((cat) => cat.label).join(', ')
    : 'None selected';

  const onCopy = async () => {
    if (!url) return;
    if (await copyText(url)) markCopied();
  };

  return (
    <div className="mb-3">
      <p className="text-2xs uppercase tracking-wider text-gray-500 font-bold mb-2">Audience ideas</p>
      <p className="text-2xs uppercase tracking-wider text-gray-500 font-bold mb-1">Receive</p>
      <div className="flex bg-[#1A1A1A] p-1 rounded-xl border border-gray-800 mb-2">
        <button
          type="button"
          className={`flex-1 py-2 text-sm font-bold rounded-lg min-h-11 ${
            !ideasOpen ? 'bg-gray-700 text-white' : 'text-gray-400'
          }`}
          onClick={() => setStageIdeasOpen(false)}
          aria-pressed={!ideasOpen}
        >
          Off
        </button>
        <button
          type="button"
          className={`flex-1 py-2 text-sm font-bold rounded-lg min-h-11 ${
            ideasOpen ? 'bg-lime-700 text-white' : 'text-gray-400'
          }`}
          onClick={() => setStageIdeasOpen(true)}
          aria-pressed={ideasOpen}
        >
          On
        </button>
      </div>
      <p className="text-2xs uppercase tracking-wider text-gray-500 font-bold mb-1">Use session pool</p>
      <div className="flex bg-[#1A1A1A] p-1 rounded-xl border border-gray-800 mb-2">
        <button
          type="button"
          className={`flex-1 py-2 text-sm font-bold rounded-lg min-h-11 ${
            !ideasUse ? 'bg-gray-700 text-white' : 'text-gray-400'
          }`}
          onClick={() => setStageIdeasUse(false)}
          aria-pressed={!ideasUse}
        >
          Off
        </button>
        <button
          type="button"
          className={`flex-1 py-2 text-sm font-bold rounded-lg min-h-11 ${
            ideasUse ? 'bg-lime-700 text-white' : 'text-gray-400'
          }`}
          onClick={() => setStageIdeasUse(true)}
          aria-pressed={ideasUse}
        >
          On
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-2">
        {ideasOpen && ideasUse
          ? 'Audience can submit. Generate has a This session section for received ideas.'
          : ideasOpen
            ? 'Audience can submit. Turn on Use session pool to generate from what they send.'
            : ideasUse
              ? 'Generate can draw from this session. /ideas is closed until Receive is on.'
              : 'Off until you want the room to submit or draw from this session.'}
      </p>
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
                    className={`min-h-8 px-2.5 rounded-full text-xs font-bold border ${
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
    </div>
  );
}

function StageMessagePanel() {
  const text = useAppStore((s) => String(s.stageSlots.message || ''));
  const pinned = useAppStore((s) => s.stagePins.includes('message'));
  const extras = useAppStore((s) => s.stageMessageFavorites) || [];
  const setStageMessage = useAppStore((s) => s.setStageMessage);
  const toggleStageMessage = useAppStore((s) => s.toggleStageMessage);
  const addStageMessageFavorite = useAppStore((s) => s.addStageMessageFavorite);
  const removeStageMessageFavorite = useAppStore((s) => s.removeStageMessageFavorite);
  const extraSet = new Set(extras.map((item) => item.toLowerCase()));
  const defaultSet = new Set(DEFAULT_STAGE_MESSAGES.map((item) => item.toLowerCase()));
  const saved = extras.filter((item) => !defaultSet.has(item.toLowerCase()));
  const trimmed = text.trim();
  const canFavorite = Boolean(trimmed) && !defaultSet.has(trimmed.toLowerCase()) && !extraSet.has(trimmed.toLowerCase());

  return (
    <div className="mb-3">
      <p className="text-2xs uppercase tracking-wider text-gray-500 font-bold mb-2">Board message</p>
      <textarea
        value={text}
        onChange={(event) => setStageMessage(event.target.value)}
        rows={2}
        maxLength={160}
        placeholder="Welcome, Thank you, Next game…"
        className="w-full rounded-xl bg-[#1A1A1A] border border-gray-800 px-3 py-2.5 text-sm font-bold text-white placeholder:text-gray-600 mb-2"
      />
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

export function StageRemoteBody({ footer = null, extra = null, showPinList = true }) {
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
  const stageOn = useAppStore((s) => s.settings.stageOn);
  const code = useAppStore((s) => s.settings.stageCode);

  return (
    <>
      <StageOnToggle />
      {stageOn && code ? <StageCodeField code={code} compact /> : null}
      <StageAudiencePanel />
      <StageMessagePanel />
      <StageBoardStylePicker value={boardStyle} onChange={setStageBoardStyle} />
      <StageLayoutPicker count={listed.length} value={layout} onChange={setStageLayout} />
      {extra}
      {showPinList ? (
        <StageItemRows
          slots={listed}
          onClearSlot={unpinStageSlot}
          onClearItem={removeStageSlotItem}
          onMove={moveStagePin}
          onToggleGamePart={toggleStageGamePart}
        />
      ) : null}
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
    </>
  );
}

export function StageHeaderControl() {
  const code = useAppStore((s) => s.settings.stageCode);
  const stageOn = useAppStore((s) => s.settings.stageOn);
  const [copied, markCopied] = useCopiedFlag();
  const [open, setOpen] = useState(false);
  const preview = useStagePreview();

  const onCopy = async (event) => {
    event.stopPropagation();
    if (!stageOn || !code) return;
    if (await copyStageLink(code)) markCopied();
  };

  return (
    <>
      <div className="flex items-center gap-0.5 rounded-xl border border-gray-800 bg-[#1A1A1A] pl-0.5 pr-0.5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1 min-h-11 pl-2 pr-1 rounded-lg"
          aria-label="Stage Manager"
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
      {open ? (
        <StageRemoteSheet
          onClose={() => setOpen(false)}
          onCopy={onCopy}
          copied={copied}
        />
      ) : null}
    </>
  );
}

function StageRemoteSheet({ onClose, onCopy, copied }) {
  return (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end">
      <button type="button" className="absolute inset-0 bg-black/70" aria-label="Close Stage Manager" onClick={onClose} />
      <div className="relative bg-[#121212] border-t border-gray-800 rounded-t-3xl px-4 pt-3 pb-nav max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-base font-black font-display text-white leading-tight">Stage Manager</p>
          <button
            type="button"
            onClick={onClose}
            className="min-w-11 min-h-11 flex items-center justify-center text-gray-400"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-hide pb-2">
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
        </div>
      </div>
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
