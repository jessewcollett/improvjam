import { useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Copy, Minus, Plus, Tv, X } from 'lucide-react';
import {
  buildStagePayload,
  clampStageSize,
  copyText,
  layoutsForCount,
  listedStageSlots,
  normalizeStageBoardStyle,
  normalizeStageLayout,
  slotSummary,
  suggestionLine,
  STAGE_SIZE_LABELS,
  STAGE_SIZE_MAX,
  STAGE_SIZE_MIN,
  STAGE_SLOT_LABELS,
  stageBoardUrl,
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

function StageItemRows({ slots, onClearSlot, onClearItem, onMove, onSize, onToggleGamePart }) {
  if (!slots.length) {
    return <p className="text-sm text-gray-500">Nothing on stage yet. Pin a panel, then it shows here and on the TV.</p>;
  }
  return (
    <ul className="space-y-2">
      {slots.map((slot, index) => {
        const nested = Array.isArray(slot.value) && (slot.id === 'games' || slot.id === 'suggestions' || slot.id === 'whosup');
        const name = STAGE_SLOT_LABELS[slot.id] || slot.id;
        const size = clampStageSize(slot.size);
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
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => onSize(slot.id, size - 1)}
                  disabled={size <= STAGE_SIZE_MIN}
                  className="min-w-11 min-h-11 flex items-center justify-center text-gray-200 disabled:text-gray-600"
                  aria-label={`Smaller ${name}`}
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-6 text-center text-sm font-black tabular-nums text-white" aria-hidden>
                  {STAGE_SIZE_LABELS[size]}
                </span>
                <button
                  type="button"
                  onClick={() => onSize(slot.id, size + 1)}
                  disabled={size >= STAGE_SIZE_MAX}
                  className="min-w-11 min-h-11 flex items-center justify-center text-gray-200 disabled:text-gray-600"
                  aria-label={`Larger ${name}`}
                >
                  <Plus className="w-3.5 h-3.5" />
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
        {chip('', 'Auto', 'Even or S/M/L packer')}
        {options.map((layout) => chip(layout.id, layout.short, layout.name))}
      </div>
    </div>
  );
}

function useStagePreview() {
  const pins = useAppStore((s) => s.stagePins);
  const slots = useAppStore((s) => s.stageSlots);
  const sizes = useAppStore((s) => s.stageSizes);
  const layout = useAppStore((s) => s.stageLayout);
  const unpinStageSlot = useAppStore((s) => s.unpinStageSlot);
  const removeStageSlotItem = useAppStore((s) => s.removeStageSlotItem);
  const moveStagePin = useAppStore((s) => s.moveStagePin);
  const setStageSize = useAppStore((s) => s.setStageSize);
  const setStageLayout = useAppStore((s) => s.setStageLayout);
  const boardStyle = useAppStore((s) => s.settings.stageBoardStyle);
  const setStageBoardStyle = useAppStore((s) => s.setStageBoardStyle);
  const toggleStageGamePart = useAppStore((s) => s.toggleStageGamePart);
  const listed = listedStageSlots(buildStagePayload(pins, slots, sizes, layout, boardStyle));
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
    setStageSize,
    pinCount: pins.length,
  };
}

export function StageHeaderControl() {
  const code = useAppStore((s) => s.settings.stageCode);
  const ensureStageCode = useAppStore((s) => s.ensureStageCode);
  const [copied, markCopied] = useCopiedFlag();
  const [open, setOpen] = useState(false);
  const preview = useStagePreview();

  useEffect(() => {
    ensureStageCode();
  }, [ensureStageCode]);

  const onCopy = async (event) => {
    event.stopPropagation();
    const next = ensureStageCode();
    if (await copyStageLink(next)) markCopied();
  };

  return (
    <>
      <div className="flex items-center gap-0.5 rounded-xl border border-gray-800 bg-[#1A1A1A] pl-0.5 pr-0.5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1 min-h-11 pl-2 pr-1 rounded-lg"
          aria-label="View stage"
        >
          <Tv className="w-3.5 h-3.5 text-gray-500 shrink-0" aria-hidden />
          <span className="text-xs font-black font-display tracking-[0.16em] text-gray-200 tabular-nums min-w-[3.25rem]">
            {code || '····'}
          </span>
          {preview.pinCount ? (
            <span className="text-2xs font-bold text-lime-400">{preview.pinCount}</span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={onCopy}
          className="flex items-center justify-center min-w-11 min-h-11 rounded-lg text-gray-300"
          aria-label={copied ? 'Stage link copied' : 'Copy stage link'}
        >
          {copied ? <Check className="w-3.5 h-3.5 text-lime-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      {open ? (
        <StageRemoteSheet
          code={code}
          onClose={() => setOpen(false)}
          onCopy={onCopy}
          copied={copied}
        />
      ) : null}
    </>
  );
}

function StageRemoteSheet({ code, onClose, onCopy, copied }) {
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
    setStageSize,
    pinCount,
  } = useStagePreview();
  const clearStagePins = useAppStore((s) => s.clearStagePins);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end">
      <button type="button" className="absolute inset-0 bg-black/70" aria-label="Close stage preview" onClick={onClose} />
      <div className="relative bg-[#121212] border-t border-gray-800 rounded-t-3xl px-4 pt-3 pb-nav max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <p className="text-base font-black font-display text-white leading-tight">On stage</p>
            <p className="text-xs text-gray-500 tracking-[0.16em] font-bold">{code || '····'}</p>
          </div>
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
          <StageBoardStylePicker value={boardStyle} onChange={setStageBoardStyle} />
          <StageLayoutPicker count={listed.length} value={layout} onChange={setStageLayout} />
          <StageItemRows
            slots={listed}
            onClearSlot={unpinStageSlot}
            onClearItem={removeStageSlotItem}
            onMove={moveStagePin}
            onSize={setStageSize}
            onToggleGamePart={toggleStageGamePart}
          />
        </div>
        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-800">
          <button
            type="button"
            onClick={onCopy}
            className="min-h-11 px-3 rounded-xl bg-gray-800 border border-gray-700 text-sm font-bold text-gray-100 inline-flex items-center gap-2"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-lime-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy link'}
          </button>
          <button
            type="button"
            onClick={() => clearStagePins()}
            disabled={!pinCount}
            className="min-h-11 px-3 rounded-xl bg-gray-800 border border-gray-700 text-sm font-bold text-gray-100 disabled:text-gray-600"
          >
            Clear all
          </button>
        </div>
      </div>
    </div>
  );
}

export function StageSettingsPanel() {
  const code = useAppStore((s) => s.settings.stageCode);
  const publishError = useAppStore((s) => s.stagePublishError);
  const ensureStageCode = useAppStore((s) => s.ensureStageCode);
  const clearStagePins = useAppStore((s) => s.clearStagePins);
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
    setStageSize,
    pinCount,
  } = useStagePreview();
  const [copied, markCopied] = useCopiedFlag();

  useEffect(() => {
    ensureStageCode();
  }, [ensureStageCode]);

  const onCopy = async () => {
    const next = ensureStageCode();
    if (await copyStageLink(next)) markCopied();
  };

  const url = code ? stageBoardUrl(code) : '';

  return (
    <div>
      <p className="text-sm text-gray-400 mb-3">
        Pin panels on your phone. Open this link on a classroom computer or Apple TV. Music and SFX stay here.
      </p>
      <p className="text-2xs uppercase tracking-wider text-gray-500 font-bold mb-1">Session code</p>
      <p className="text-3xl font-black font-display tracking-[0.2em] text-white mb-3">{code || '····'}</p>
      {url ? <p className="text-xs text-gray-500 break-all mb-3">{url}</p> : null}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={onCopy}
          className="min-h-11 px-3 rounded-xl bg-gray-800 border border-gray-700 text-sm font-bold text-gray-100 inline-flex items-center gap-2"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-lime-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied' : 'Copy link'}
        </button>
        <button
          type="button"
          onClick={() => clearStagePins()}
          disabled={!pinCount}
          className="min-h-11 px-3 rounded-xl bg-gray-800 border border-gray-700 text-sm font-bold text-gray-100 disabled:text-gray-600"
        >
          Clear all
        </button>
      </div>
      <p className="text-2xs uppercase tracking-wider text-gray-500 font-bold mb-2">On stage</p>
      <StageBoardStylePicker value={boardStyle} onChange={setStageBoardStyle} />
      <StageLayoutPicker count={listed.length} value={layout} onChange={setStageLayout} />
      <StageItemRows
        slots={listed}
        onClearSlot={unpinStageSlot}
        onClearItem={removeStageSlotItem}
        onMove={moveStagePin}
        onSize={setStageSize}
        onToggleGamePart={toggleStageGamePart}
      />
      {publishError ? (
        <p className="text-xs text-amber-300 bg-amber-900/20 border border-amber-800/40 rounded-lg p-2 mt-3">
          {publishError} The board still works once the Stage sheet tab is live.
        </p>
      ) : null}
    </div>
  );
}
