import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  LayoutGrid,
  Lock,
  LockOpen,
  Maximize2,
  Minimize2,
  Moon,
  PictureInPicture2,
  SlidersHorizontal,
  Sun,
  X,
} from 'lucide-react';
import {
  applyNeighborPush,
  buildStagePayload,
  dockStageTile,
  frameAtPoint,
  framesCoverSlots,
  listedStageSlots,
  moveFloatFrame,
  normalizeStageAlign,
  normalizeStageFloats,
  popOutStageTile,
  resizeFloatCorner,
  resizeFloatFrame,
  seedStageLayout,
  slotHasSuggestionCaptions,
  STAGE_SLOT_LABELS,
} from '../lib/stage.js';
import { useAppStore } from '../store/useAppStore.js';
import { StageSlotGrid } from './StageBoardContent.jsx';
import { GamePartToggles } from './StagePin.jsx';

const EDGE_ICON = {
  left: ChevronLeft,
  right: ChevronRight,
  top: ChevronUp,
  bottom: ChevronDown,
};

function useLandscapePreview() {
  const [landscape, setLandscape] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth >= window.innerHeight : false
  ));
  useEffect(() => {
    const sync = () => setLandscape(window.innerWidth >= window.innerHeight);
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);
  return landscape;
}

function frameStyle(frame) {
  return {
    left: `${frame.x}%`,
    top: `${frame.y}%`,
    width: `${frame.w}%`,
    height: `${frame.h}%`,
  };
}

function TileCustomizeOverlay({ slot }) {
  const setStageAlign = useAppStore((s) => s.setStageAlign);
  const setStageCaptions = useAppStore((s) => s.setStageCaptions);
  const toggleStageGamePart = useAppStore((s) => s.toggleStageGamePart);
  const removeStageSlotItem = useAppStore((s) => s.removeStageSlotItem);
  const align = slot.align === 'left' ? 'left' : 'center';
  const captionsOn = slot.captions !== false;
  const showCaptionsToggle = (slot.id === 'suggestions' && slotHasSuggestionCaptions(slot.value))
    || slot.id === 'display';
  const nested = Array.isArray(slot.value) && (slot.id === 'games' || slot.id === 'suggestions' || slot.id === 'whosup');

  return (
    <div
      className="absolute z-[15] top-10 left-2 right-10 bottom-10 overflow-auto scrollbar-hide rounded-lg bg-black/70 p-2 pointer-events-auto"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <p className="text-2xs uppercase tracking-wider text-gray-400 font-bold mb-1">Align</p>
      <div className="flex gap-1 mb-2">
        {[['left', 'Left'], ['center', 'Center']].map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={align === id}
            onClick={() => setStageAlign(slot.id, id)}
            className={`min-h-8 px-2 rounded-md text-2xs font-bold ${
              align === id ? 'bg-lime-700 text-white' : 'bg-white/10 text-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {showCaptionsToggle ? (
        <button
          type="button"
          aria-pressed={captionsOn}
          onClick={() => setStageCaptions(slot.id, !captionsOn)}
          className={`min-h-8 px-2 mb-2 rounded-md text-2xs font-bold ${
            captionsOn ? 'bg-lime-700 text-white' : 'bg-white/10 text-gray-200'
          }`}
        >
          Captions {captionsOn ? 'on' : 'off'}
        </button>
      ) : null}
      {nested ? (
        <ul className="space-y-1.5">
          {slot.value.map((item, index) => {
            const label = slot.id === 'games'
              ? item?.name
              : slot.id === 'whosup'
                ? item
                : item?.label || 'Item';
            return (
              <li key={`${slot.id}-${index}`} className="rounded-md bg-black/40 p-1.5">
                <div className="flex items-center gap-1">
                  <span className="flex-1 min-w-0 text-2xs font-bold text-gray-100 truncate">{label}</span>
                  <button
                    type="button"
                    onClick={() => removeStageSlotItem(slot.id, index)}
                    className="min-w-8 min-h-8 inline-flex items-center justify-center text-gray-400 hover:text-red-300"
                    aria-label={`Remove ${label}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {slot.id === 'games' ? (
                  <GamePartToggles
                    game={item}
                    onToggle={(partId) => toggleStageGamePart(item, partId)}
                    className="mt-1"
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export default function StageLayoutEditor() {
  const pins = useAppStore((s) => s.stagePins);
  const slots = useAppStore((s) => s.stageSlots);
  const sizes = useAppStore((s) => s.stageSizes);
  const zooms = useAppStore((s) => s.stageZooms);
  const layout = useAppStore((s) => s.stageLayout);
  const frames = useAppStore((s) => s.stageFrames);
  const floats = useAppStore((s) => s.stageFloats);
  const aligns = useAppStore((s) => s.stageAligns);
  const captions = useAppStore((s) => s.stageCaptions);
  const boardStyle = useAppStore((s) => s.settings.stageBoardStyle);
  const stageTheme = useAppStore((s) => s.stageTheme);
  const setStageTheme = useAppStore((s) => s.setStageTheme);
  const spotlight = useAppStore((s) => s.stageSpotlight);
  const toggleStageSpotlight = useAppStore((s) => s.toggleStageSpotlight);
  const applyStageLayout = useAppStore((s) => s.applyStageLayout);
  const resetStageFrames = useAppStore((s) => s.resetStageFrames);
  const swapStagePins = useAppStore((s) => s.swapStagePins);
  const unpinStageSlot = useAppStore((s) => s.unpinStageSlot);
  const listed = listedStageSlots(buildStagePayload(pins, slots, sizes, layout, boardStyle, zooms, frames)).map((slot) => ({
    ...slot,
    align: normalizeStageAlign(aligns?.[slot.id]),
    captions: captions?.[slot.id] !== false,
  }));
  const boxRef = useRef(null);
  const dragRef = useRef(null);
  const phoneLandscape = useLandscapePreview();
  const ids = listed.map((slot) => slot.id);
  const seeded = seedStageLayout(listed, true, layout);
  const covering = framesCoverSlots(frames, ids);
  const working = covering ? frames : seeded.frames;
  const workingFloats = covering ? normalizeStageFloats(floats, ids) : seeded.floats;
  const spotlightOn = ids.includes(spotlight) ? spotlight : '';
  const [activeId, setActiveId] = useState('');
  const [hoverId, setHoverId] = useState('');
  const [overlayOn, setOverlayOn] = useState(false);
  const [resizeLocked, setResizeLocked] = useState(false);

  const pointPct = (event) => {
    const box = boxRef.current;
    if (!box) return { x: 0, y: 0 };
    const rect = box.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) return { x: 0, y: 0 };
    return {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    };
  };

  const commit = (nextFrames, nextFloats) => {
    applyStageLayout(nextFrames, nextFloats);
  };

  const onPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const pct = pointPct(event);
    if (drag.type === 'resize') {
      const nextAt = drag.edge === 'left' || drag.edge === 'right' ? pct.x : pct.y;
      if (drag.floats.includes(drag.id)) {
        const next = {
          ...drag.frames,
          [drag.id]: resizeFloatFrame(drag.frames[drag.id], drag.edge, nextAt),
        };
        drag.frames = next;
        commit(next, drag.floats);
      } else {
        const docked = ids.filter((id) => !drag.floats.includes(id));
        const next = applyNeighborPush(drag.frames, drag.id, drag.edge, nextAt, docked);
        drag.frames = next;
        commit(next, drag.floats);
      }
      return;
    }
    if (drag.type === 'corner') {
      const next = {
        ...drag.frames,
        [drag.id]: resizeFloatCorner(drag.frames[drag.id], drag.corner, pct.x, pct.y),
      };
      drag.frames = next;
      commit(next, drag.floats);
      return;
    }
    if (drag.type === 'move') {
      const next = {
        ...drag.frames,
        [drag.id]: moveFloatFrame(drag.startFrame, pct.x - drag.originX, pct.y - drag.originY),
      };
      drag.frames = next;
      commit(next, drag.floats);
      return;
    }
    if (drag.type === 'swap') {
      const docked = ids.filter((id) => !drag.floats.includes(id) && id !== drag.id);
      setHoverId(frameAtPoint(drag.frames, docked, pct.x, pct.y));
    }
  };

  const onPointerUp = (event) => {
    const drag = dragRef.current;
    try {
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      /* synthetic / ended pointer */
    }
    if (drag?.type === 'swap') {
      const pct = pointPct(event);
      const docked = ids.filter((id) => !drag.floats.includes(id) && id !== drag.id);
      const hit = frameAtPoint(drag.frames, docked, pct.x, pct.y);
      if (hit) {
        applyStageLayout(drag.frames, drag.floats);
        swapStagePins(drag.id, hit);
      }
    }
    dragRef.current = null;
    setActiveId('');
    setHoverId('');
  };

  const capturePointer = (event) => {
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* synthetic / unsupported */
    }
  };

  const startResize = (event, id, edge) => {
    if (!boxRef.current || resizeLocked) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = { type: 'resize', id, edge, frames: working, floats: workingFloats };
    capturePointer(event);
    setActiveId(id);
  };

  const startCorner = (event, id, corner) => {
    if (!boxRef.current || resizeLocked) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = { type: 'corner', id, corner, frames: working, floats: workingFloats };
    capturePointer(event);
    setActiveId(id);
  };

  const startBody = (event, id) => {
    if (!boxRef.current || resizeLocked) return;
    event.preventDefault();
    const pct = pointPct(event);
    const floating = workingFloats.includes(id);
    dragRef.current = {
      type: floating ? 'move' : 'swap',
      id,
      originX: pct.x,
      originY: pct.y,
      startFrame: working[id],
      frames: working,
      floats: workingFloats,
    };
    capturePointer(event);
    setActiveId(id);
  };

  const toggleFloat = (event, id) => {
    event.preventDefault();
    event.stopPropagation();
    const next = workingFloats.includes(id)
      ? dockStageTile(working, workingFloats, id, ids)
      : popOutStageTile(working, workingFloats, id, ids);
    commit(next.frames, next.floats);
  };

  if (!listed.length) {
    return (
      <div className="mb-3">
        <p className="text-2xs uppercase tracking-wider text-gray-500 font-bold mb-2">Stage board</p>
        <p className="text-sm text-gray-500">Pin a panel from Generator or Tools and it shows up here.</p>
      </div>
    );
  }

  return (
    <div className="mb-3">
      <div className="mb-2">
        <p className="text-2xs uppercase tracking-wider text-gray-500 font-bold mb-1.5">Stage board</p>
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setStageTheme(stageTheme === 'light' ? 'dark' : 'light')}
            className="w-8 h-8 rounded-md inline-flex items-center justify-center text-gray-400 hover:text-gray-100"
            aria-label={stageTheme === 'light' ? 'Dark mode for Stage' : 'Light mode for Stage'}
            aria-pressed={stageTheme === 'light'}
            title="Stage light/dark"
          >
            {stageTheme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            aria-pressed={overlayOn}
            onClick={() => setOverlayOn((on) => !on)}
            className={`min-h-10 px-2.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 border ${
              overlayOn ? 'bg-lime-700 text-white border-lime-500' : 'bg-gray-800 text-gray-100 border-gray-700'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Overlay
          </button>
          <button
            type="button"
            aria-pressed={resizeLocked}
            onClick={() => setResizeLocked((on) => !on)}
            className={`min-h-10 px-2.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 border ${
              resizeLocked ? 'bg-gray-700 text-white border-gray-600' : 'bg-gray-800 text-gray-100 border-gray-700'
            }`}
          >
            {resizeLocked ? <Lock className="w-3.5 h-3.5" /> : <LockOpen className="w-3.5 h-3.5" />}
            {resizeLocked ? 'Locked' : 'Resize'}
          </button>
          <button
            type="button"
            onClick={() => resetStageFrames()}
            className="min-h-10 px-2.5 rounded-lg bg-gray-800 border border-gray-700 text-xs font-bold text-gray-100"
          >
            Auto layout
          </button>
        </div>
      </div>
      <div
        ref={boxRef}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`stage-board relative w-full rounded-xl overflow-hidden border border-gray-800 bg-stage touch-none ${
          phoneLandscape ? 'h-[min(58vh,24rem)]' : 'aspect-video max-h-[min(52vh,20rem)]'
        }`}
      >
        <div className="absolute inset-0 pointer-events-none">
          <StageSlotGrid
            slots={listed}
            layout={layout}
            boardStyle={boardStyle}
            frames={working}
            floats={workingFloats}
            spotlight={spotlightOn}
          />
        </div>
        {listed.map((slot) => {
          const id = slot.id;
          const frame = working[id];
          if (!frame) return null;
          if (spotlightOn && id !== spotlightOn) return null;
          const floating = workingFloats.includes(id);
          const name = STAGE_SLOT_LABELS[id] || id;
          const PopIcon = floating ? LayoutGrid : PictureInPicture2;
          const popLabel = floating ? 'Dock tile' : 'Pop out tile';
          const lit = spotlightOn === id;
          const SpotIcon = lit ? Minimize2 : Maximize2;
          const spotLabel = lit ? `Exit spotlight` : `Spotlight ${name}`;
          const canResize = !resizeLocked && !lit;
          return (
            <div
              key={id}
              className={`absolute ${floating && !lit ? 'z-30' : 'z-20'} ${hoverId === id ? 'ring-1 ring-lime-400/80' : ''}`}
              style={lit ? { left: 0, top: 0, width: '100%', height: '100%' } : frameStyle(frame)}
            >
              {canResize ? (
                <div
                  role="presentation"
                  onPointerDown={(event) => startBody(event, id)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  className="absolute inset-0 touch-none cursor-grab"
                />
              ) : null}
              {canResize ? ['left', 'right', 'top', 'bottom'].map((edge) => {
                const vertical = edge === 'left' || edge === 'right';
                const Icon = EDGE_ICON[edge];
                return (
                  <button
                    key={edge}
                    type="button"
                    aria-label={`Resize ${edge}`}
                    onPointerDown={(event) => startResize(event, id, edge)}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    className={`absolute z-10 touch-none text-lime-300/90 ${
                      vertical ? 'top-10 bottom-10 w-11 cursor-ew-resize' : 'left-10 right-10 h-11 cursor-ns-resize'
                    } ${edge === 'left' ? 'left-0' : ''} ${edge === 'right' ? 'right-0' : ''} ${
                      edge === 'top' ? 'top-0' : ''
                    } ${edge === 'bottom' ? 'bottom-0' : ''}`}
                  >
                    <span
                      className={`absolute bg-lime-400/55 pointer-events-none ${
                        vertical
                          ? 'left-1/2 top-5 bottom-5 w-px -ml-px'
                          : 'top-1/2 left-5 right-5 h-px -mt-px'
                      }`}
                    />
                    <Icon className="absolute left-1/2 top-1/2 w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
                  </button>
                );
              }) : null}
              {canResize && floating ? ['nw', 'ne', 'sw', 'se'].map((corner) => (
                <button
                  key={corner}
                  type="button"
                  aria-label={`Resize ${corner}`}
                  onPointerDown={(event) => startCorner(event, id, corner)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  className={`absolute z-10 w-11 h-11 touch-none ${
                    corner === 'nw' || corner === 'sw' ? 'left-0' : 'right-0'
                  } ${corner === 'nw' || corner === 'ne' ? 'top-0' : 'bottom-0'} ${
                    corner === 'nw' || corner === 'se' ? 'cursor-nwse-resize' : 'cursor-nesw-resize'
                  }`}
                >
                  <span
                    className={`absolute w-2.5 h-2.5 border-lime-400/80 pointer-events-none ${
                      corner === 'nw' ? 'top-1.5 left-1.5 border-t border-l' : ''
                    } ${corner === 'ne' ? 'top-1.5 right-1.5 border-t border-r' : ''} ${
                      corner === 'sw' ? 'bottom-1.5 left-1.5 border-b border-l' : ''
                    } ${corner === 'se' ? 'bottom-1.5 right-1.5 border-b border-r' : ''}`}
                  />
                </button>
              )) : null}
              {overlayOn ? <TileCustomizeOverlay slot={slot} /> : null}
              <button
                type="button"
                aria-label={spotLabel}
                title={spotLabel}
                aria-pressed={lit}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={() => toggleStageSpotlight(id)}
                className={`absolute z-30 top-0 left-0 w-11 h-11 inline-flex items-center justify-center bg-black/40 ${
                  lit ? 'text-lime-300' : 'text-gray-300 hover:text-lime-200'
                }`}
              >
                <SpotIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label={`Remove ${name} from stage`}
                title={`Remove ${name}`}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={() => unpinStageSlot(id)}
                className="absolute z-30 top-0 right-0 w-11 h-11 inline-flex items-center justify-center text-gray-300 hover:text-red-300 bg-black/40"
              >
                <X className="w-4 h-4" />
              </button>
              {lit ? null : (
                <button
                  type="button"
                  aria-label={popLabel}
                  title={popLabel}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onClick={(event) => toggleFloat(event, id)}
                  className="absolute z-30 bottom-0 right-0 w-11 h-11 inline-flex items-center justify-center text-lime-300/90 hover:text-lime-200 bg-black/40"
                >
                  <PopIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-gray-500 mt-2">
        {spotlightOn
          ? 'Spotlight fills the TV. Tap it again to restore the previous layout.'
          : resizeLocked
            ? 'Resize is locked. Top-left spotlights a window. X unpins. Bottom-right pops it out or docks it.'
            : 'Top-left spotlights a window. Drag edges to resize. Drag a window onto another to swap.'}
      </p>
    </div>
  );
}
