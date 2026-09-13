import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Minus,
  Pencil,
  Play,
  Plus,
  Square,
  Star,
  Volume2,
} from 'lucide-react';
import { clampFadeSeconds, fadeAllPads, playPad, preloadPadSamples, releaseDing, startPad, stopAllPads } from '../lib/audio.js';
import { PAD_ICON_CHOICES } from '../lib/icons.js';
import { usePadReorder } from '../lib/usePadReorder.js';
import {
  PAD_COLOR_IDS,
  PAD_COLORS,
  SFX_SLOT_MAX,
  SFX_SLOT_MIN,
  clampPadColor,
  clampSfxSlotCount,
  padGridShape,
} from '../lib/sfxPad.js';
import CatalogIcon from './CatalogIcon.jsx';
import SearchField from './SearchField.jsx';

function SfxIcon({ name, className }) {
  return <CatalogIcon name={name} className={className} fallback={Bell} />;
}

function effectiveIcon(pad, overrides) {
  if (!pad) return 'bell';
  return overrides?.[pad.id] || pad.icon || 'bell';
}

function ColorDots({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1">
      {PAD_COLOR_IDS.map((id) => {
        const tone = PAD_COLORS[id];
        const selected = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`w-8 h-8 rounded-full border-2 ${tone.swatch} ${
              selected ? 'border-white scale-110' : 'border-black/40'
            }`}
            aria-label={`${id} pad color`}
            aria-pressed={selected}
          />
        );
      })}
    </div>
  );
}

function IconPicker({ value, sheetIcon, onChange }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-2xs font-bold uppercase tracking-wider text-gray-500">Icon</span>
        {value && value !== sheetIcon ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-2xs font-bold text-yellow-300"
          >
            Use sheet
          </button>
        ) : null}
      </div>
      <div className="grid grid-cols-8 gap-0.5 max-h-28 overflow-y-auto overflow-x-hidden">
        {PAD_ICON_CHOICES.map((id) => {
          const selected = value === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`min-h-9 min-w-9 rounded-md border inline-flex items-center justify-center ${
                selected ? 'border-yellow-400 bg-yellow-600/30' : 'border-gray-800 bg-[#1A1A1A]'
              }`}
              aria-label={`Icon ${id}`}
              aria-pressed={selected}
            >
              <SfxIcon name={id} className="w-4 h-4 text-yellow-300" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function SfxPad({
  pads,
  slots,
  colors,
  defaultPad,
  volume,
  countInBeats,
  fadeSeconds,
  dingHold,
  onAssign,
  onSetDefault,
  onVolume,
  onCountInBeats,
  onSlotCount,
  onSlotColor,
  onCountIn,
  iconOverrides,
  onIconOverride,
  onMoveSlot,
}) {
  const [picking, setPicking] = useState(null);
  const [query, setQuery] = useState('');
  const byId = useMemo(() => new Map(pads.map((pad) => [pad.id, pad])), [pads]);
  const slotCount = clampSfxSlotCount(slots?.length);
  const fadeSec = clampFadeSeconds(fadeSeconds);
  const shape = padGridShape(slotCount);
  const grid = useMemo(() => {
    return Array.from({ length: slotCount }, (_, i) => byId.get(slots?.[i]) || null);
  }, [byId, slots, slotCount]);
  const slotColors = useMemo(
    () => Array.from({ length: slotCount }, (_, i) => clampPadColor(colors?.[i])),
    [colors, slotCount],
  );

  const filteredPads = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pads;
    return pads.filter((sound) => {
      const hay = [sound.name, sound.credit, sound.notes, sound.hint].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [pads, query]);

  useEffect(() => {
    preloadPadSamples(pads);
  }, [pads]);

  useEffect(() => {
    if (picking != null && picking >= slotCount) setPicking(Math.max(0, slotCount - 1));
  }, [picking, slotCount]);

  const openPicker = (index) => {
    setPicking(index);
  };

  const closePicker = () => {
    setPicking(null);
    setQuery('');
  };

  const place = (index, id) => {
    onAssign(index, id);
  };

  const pickingPad = picking != null ? grid[picking] : null;
  const pickingColor = picking != null ? slotColors[picking] : 'slate';
  const pickingIcon = pickingPad ? effectiveIcon(pickingPad, iconOverrides) : '';
  const gridLive = useRef(grid);
  const volumeRef = useRef(volume);
  const voiceRef = useRef(null);
  gridLive.current = grid;
  volumeRef.current = volume;

  const { gridRef, dragFrom, dragOver, dragging, bindPad } = usePadReorder({
    slotCount,
    cols: shape.cols,
    rows: shape.rows,
    onMove: onMoveSlot,
    onEmptyTap: openPicker,
    onPlayStart: (index) => {
      if (voiceRef.current) {
        releaseDing(voiceRef.current, { heldMs: 0, cut: !voiceRef.current.oneShot });
        voiceRef.current = null;
      }
      const pad = gridLive.current[index];
      if (pad) voiceRef.current = startPad(pad, volumeRef.current);
    },
    onPlayRelease: ({ heldMs = 0, cut = false } = {}) => {
      if (!voiceRef.current) return;
      releaseDing(voiceRef.current, { heldMs, cut });
      voiceRef.current = null;
    },
  });

  return (
    <section className="h-full min-h-0 flex flex-col justify-end">
      <div className="relative px-1 h-[50dvh] max-h-full min-h-0">
        <button
          type="button"
          onClick={() => openPicker(grid.findIndex((slot) => !slot) === -1 ? 0 : grid.findIndex((slot) => !slot))}
          className="absolute top-0.5 right-0.5 z-10 min-w-11 min-h-11 rounded-xl bg-black/50 text-gray-200 inline-flex items-center justify-center"
          aria-label="Edit pads"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <div
          ref={gridRef}
          className="h-full min-h-0 grid gap-1"
          style={{
            gridTemplateColumns: `repeat(${shape.cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${shape.rows}, minmax(0, 1fr))`,
          }}
        >
          {grid.map((pad, index) => {
            const tone = PAD_COLORS[slotColors[index]] || PAD_COLORS.slate;
            const active = pad && defaultPad?.id === pad.id;
            const iconName = effectiveIcon(pad, iconOverrides);
            const bind = bindPad(index, Boolean(pad));
            const lifting = dragFrom === index;
            const dropTarget = dragOver === index && dragFrom != null && dragFrom !== index;
            const padClass = `w-full h-full min-h-11 min-w-11 rounded-xl border flex flex-col items-center justify-center gap-0.5 px-0.5 ${
              pad ? tone.fill : `border-2 border-dashed ${tone.empty}`
            } ${lifting && dragging ? 'opacity-70 scale-95' : ''} ${
              lifting && !dragging ? 'ring-2 ring-yellow-300 scale-[1.04]' : ''
            } ${dropTarget ? 'ring-2 ring-yellow-400' : ''}`;
            return (
              <div key={pad ? `${pad.id}-${index}` : `empty-${index}`} className="relative min-h-0">
                <button
                  type="button"
                  {...bind}
                  className={padClass}
                  aria-pressed={Boolean(active)}
                  aria-label={pad ? pad.name : `Add sound to pad ${index + 1}`}
                >
                  {pad ? (
                    <>
                      <SfxIcon name={iconName} className="w-5 h-5" />
                      <span className="text-2xs font-bold leading-tight text-center line-clamp-2">{pad.name}</span>
                    </>
                  ) : (
                    <Plus className="w-5 h-5" />
                  )}
                </button>
                {active ? (
                  <Star className="absolute top-1 left-1 w-3 h-3 fill-current pointer-events-none opacity-90" />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="shrink-0 px-1 pt-1 pb-nav">
        <label className="flex items-center gap-2 px-1 py-0.5">
          <Volume2 className="w-3.5 h-3.5 text-gray-500 shrink-0" />
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => onVolume(Number(e.target.value))}
            className="flex-1 accent-yellow-500 h-6"
            aria-label="SFX volume"
          />
          <span className="text-2xs tabular-nums text-gray-400 w-8 text-right">{Math.round(volume * 100)}%</span>
        </label>
        <div className="flex gap-1">
          <button
            type="button"
            {...dingHold}
            className="flex-1 min-h-12 rounded-xl bg-yellow-500 text-black font-black inline-flex items-center justify-center gap-1.5 active:scale-95"
            aria-label="Ding, hold to sustain"
          >
            <Bell className="w-4 h-4" />
            Ding
          </button>
          <button
            type="button"
            onClick={() => fadeAllPads(fadeSec)}
            className="flex-1 min-h-12 rounded-xl border border-yellow-800/60 bg-[#1A1A1A] text-yellow-200 font-bold"
          >
            Fade
          </button>
          <button
            type="button"
            onClick={() => stopAllPads()}
            className="flex-1 min-h-12 rounded-xl border border-red-800/60 bg-red-950/40 text-red-200 font-bold inline-flex items-center justify-center gap-1"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            Stop
          </button>
          <div className="flex-1 min-w-0 flex rounded-xl overflow-hidden border border-gray-700">
            <button
              type="button"
              onClick={onCountIn}
              className="flex-1 min-h-12 bg-gray-800 text-gray-100 font-bold inline-flex items-center justify-center gap-1"
              aria-label={`${countInBeats}-count`}
            >
              <Play className="w-3.5 h-3.5" />
              {countInBeats}
            </button>
            <button
              type="button"
              onClick={() => onCountInBeats(countInBeats >= 5 ? 3 : countInBeats + 1)}
              className="min-w-11 min-h-12 bg-[#1A1A1A] text-gray-100 border-l border-gray-700 inline-flex items-center justify-center"
              aria-label="Longer count-in"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {picking != null ? (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 p-2 sm:p-3">
          <div
            className="w-full max-w-md h-[min(85dvh,100%)] max-h-[85dvh] min-h-0 overflow-hidden flex flex-col rounded-2xl border border-gray-700 bg-[#161616]"
            role="dialog"
            aria-modal="true"
            aria-label="Edit pads"
          >
            <div className="shrink-0 border-b border-gray-800">
              <div className="flex items-center gap-2 px-2 py-1">
                <p className="flex-1 text-sm font-black text-yellow-200 leading-none">
                  Edit pads
                  <span className="ml-2 text-xs font-bold text-gray-400">#{picking + 1}</span>
                </p>
                <div className="inline-flex items-center rounded-lg border border-gray-700 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => onSlotCount(slotCount - 1)}
                    disabled={slotCount <= SFX_SLOT_MIN}
                    className="min-w-10 min-h-10 flex items-center justify-center text-gray-200 disabled:text-gray-600"
                    aria-label="Fewer pads"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-6 text-center text-sm font-black tabular-nums">{slotCount}</span>
                  <button
                    type="button"
                    onClick={() => onSlotCount(slotCount + 1)}
                    disabled={slotCount >= SFX_SLOT_MAX}
                    className="min-w-10 min-h-10 flex items-center justify-center text-gray-200 disabled:text-gray-600"
                    aria-label="More pads"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={closePicker}
                  className="min-h-10 px-3 rounded-lg bg-yellow-600 text-black text-sm font-black"
                >
                  Done
                </button>
              </div>
              <div
                className="grid gap-1 px-2 pb-2"
                style={{ gridTemplateColumns: `repeat(${Math.min(slotCount, 8)}, minmax(0, 1fr))` }}
              >
                {grid.map((slot, index) => (
                  <button
                    key={`pick-${index}`}
                    type="button"
                    onClick={() => setPicking(index)}
                    className={`min-h-11 rounded-lg text-xs font-black border ${
                      picking === index
                        ? 'bg-yellow-600 text-black border-yellow-400'
                        : slot
                          ? 'bg-[#1A1A1A] text-gray-200 border-gray-700'
                          : 'bg-transparent text-gray-500 border-dashed border-gray-700'
                    }`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            </div>

            <div className="shrink-0 px-2 py-1.5 border-b border-gray-800 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-2xs font-bold uppercase tracking-wider text-gray-500 w-12 shrink-0">Color</span>
                <ColorDots value={pickingColor} onChange={(id) => onSlotColor(picking, id)} />
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={!pickingPad}
                  onClick={() => pickingPad && onSetDefault(pickingPad.id)}
                  className={`flex-1 min-h-10 rounded-lg border text-sm font-bold inline-flex items-center justify-center gap-1 disabled:opacity-40 ${
                    pickingPad && defaultPad?.id === pickingPad.id
                      ? 'bg-yellow-600 text-black border-yellow-400'
                      : 'bg-[#1A1A1A] text-gray-200 border-gray-800'
                  }`}
                >
                  <Star className="w-3.5 h-3.5" fill={pickingPad && defaultPad?.id === pickingPad.id ? 'currentColor' : 'none'} />
                  Ding
                </button>
                <button
                  type="button"
                  disabled={!pickingPad}
                  onClick={() => place(picking, null)}
                  className="flex-1 min-h-10 rounded-lg border border-gray-800 bg-[#1A1A1A] text-sm font-bold text-gray-200 disabled:opacity-40"
                >
                  Clear
                </button>
              </div>
              <SearchField
                value={query}
                onChange={setQuery}
                placeholder="Search sounds"
                ringClass="focus:ring-yellow-500"
                compact
              />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-2 py-1.5">
              {pickingPad ? (
                <div className="mb-2">
                  <IconPicker
                    value={pickingIcon}
                    sheetIcon={pickingPad.icon}
                    onChange={(id) => onIconOverride(pickingPad.id, id)}
                  />
                </div>
              ) : (
                <p className="text-2xs text-gray-500 mb-2">Assign a sound to pick an icon.</p>
              )}
              {filteredPads.length === 0 ? (
                <p className="text-xs text-gray-500 py-2">No sounds match.</p>
              ) : (
                filteredPads.map((sound) => {
                  const assigned = pickingPad?.id === sound.id;
                  return (
                    <div
                      key={sound.id}
                      className={`flex items-center gap-1 rounded-lg border px-1 mb-0.5 last:mb-0 ${
                        assigned ? 'border-yellow-400 bg-yellow-600/15' : 'border-gray-800 bg-[#1A1A1A]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => playPad(sound, volume)}
                        className="shrink-0 min-w-10 min-h-10 rounded-lg text-yellow-300"
                        aria-label={`Preview ${sound.name}`}
                      >
                        <Play className="w-4 h-4 mx-auto" />
                      </button>
                      <button
                        type="button"
                        onClick={() => place(picking, sound.id)}
                        className="flex-1 min-w-0 min-h-10 text-left flex items-center gap-2"
                      >
                        <SfxIcon name={effectiveIcon(sound, iconOverrides)} className="w-4 h-4 text-yellow-400 shrink-0" />
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-gray-100 truncate">{sound.name}</span>
                          {sound.credit ? (
                            <span className="block text-2xs text-gray-500 truncate">{sound.credit}</span>
                          ) : null}
                        </span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
