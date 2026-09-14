import { useEffect, useRef, useState } from 'react';
import {
  applySplitterDrag,
  buildStagePayload,
  framesCoverSlots,
  layoutSplitters,
  listedStageSlots,
  seedStageFrames,
} from '../lib/stage.js';
import { useAppStore } from '../store/useAppStore.js';
import { StageSlotGrid } from './StageBoardContent.jsx';

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

export default function StageLayoutEditor() {
  const pins = useAppStore((s) => s.stagePins);
  const slots = useAppStore((s) => s.stageSlots);
  const sizes = useAppStore((s) => s.stageSizes);
  const zooms = useAppStore((s) => s.stageZooms);
  const layout = useAppStore((s) => s.stageLayout);
  const frames = useAppStore((s) => s.stageFrames);
  const boardStyle = useAppStore((s) => s.settings.stageBoardStyle);
  const setStageFrames = useAppStore((s) => s.setStageFrames);
  const resetStageFrames = useAppStore((s) => s.resetStageFrames);
  const listed = listedStageSlots(buildStagePayload(pins, slots, sizes, layout, boardStyle, zooms, frames));
  const boxRef = useRef(null);
  const dragRef = useRef(null);
  const phoneLandscape = useLandscapePreview();
  const ids = listed.map((slot) => slot.id);
  const working = framesCoverSlots(frames, ids) ? frames : seedStageFrames(listed, true, layout);
  const splitters = layoutSplitters(working);
  const [dragId, setDragId] = useState('');

  const splitterId = (splitter) => (
    splitter.axis === 'x'
      ? `v:${(splitter.left || []).join('-')}|${(splitter.right || []).join('-')}`
      : `h:${(splitter.top || []).join('-')}|${(splitter.bottom || []).join('-')}`
  );

  const onPointerDown = (event, splitter) => {
    if (!boxRef.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { splitter, frames: working };
    setDragId(splitterId(splitter));
  };

  const onPointerMove = (event) => {
    const drag = dragRef.current;
    const box = boxRef.current;
    if (!drag || !box) return;
    const rect = box.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) return;
    const nextAt = drag.splitter.axis === 'x'
      ? ((event.clientX - rect.left) / rect.width) * 100
      : ((event.clientY - rect.top) / rect.height) * 100;
    const next = applySplitterDrag(drag.frames, drag.splitter, nextAt);
    drag.frames = next;
    setStageFrames(next);
  };

  const onPointerUp = (event) => {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setDragId('');
  };

  if (!listed.length) {
    return (
      <div className="mb-3">
        <p className="text-2xs uppercase tracking-wider text-gray-500 font-bold mb-2">Layout preview</p>
        <p className="text-sm text-gray-500">Pin a panel to resize tiles here.</p>
      </div>
    );
  }

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-2xs uppercase tracking-wider text-gray-500 font-bold">Layout preview</p>
        <button
          type="button"
          onClick={() => resetStageFrames()}
          className="min-h-11 px-3 rounded-lg bg-gray-800 border border-gray-700 text-xs font-bold text-gray-100"
        >
          Auto layout
        </button>
      </div>
      <div
        ref={boxRef}
        className={`relative w-full rounded-xl overflow-hidden border border-gray-800 bg-black touch-none ${
          phoneLandscape ? 'h-[min(52vh,20rem)]' : 'aspect-video max-h-52'
        }`}
      >
        <div className="absolute inset-0 pointer-events-none">
          <StageSlotGrid slots={listed} layout={layout} boardStyle={boardStyle} frames={working} />
        </div>
        {splitters.vertical.map((splitter) => (
          <div
            key={splitterId(splitter)}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize columns"
            onPointerDown={(event) => onPointerDown(event, splitter)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className={`absolute z-20 top-0 h-full w-11 -ml-[22px] cursor-ew-resize touch-none ${
              dragId === splitterId(splitter) ? 'bg-lime-400/10' : ''
            }`}
            style={{ left: `${splitter.at}%` }}
          >
            <span className="absolute left-1/2 top-2 bottom-2 w-1 -ml-0.5 rounded-full bg-lime-400/90 pointer-events-none" />
          </div>
        ))}
        {splitters.horizontal.map((splitter) => (
          <div
            key={splitterId(splitter)}
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize rows"
            onPointerDown={(event) => onPointerDown(event, splitter)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className={`absolute z-20 left-0 w-full h-11 -mt-[22px] cursor-ns-resize touch-none ${
              dragId === splitterId(splitter) ? 'bg-lime-400/10' : ''
            }`}
            style={{ top: `${splitter.at}%` }}
          >
            <span className="absolute top-1/2 left-2 right-2 h-1 -mt-0.5 rounded-full bg-lime-400/90 pointer-events-none" />
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Drag the lime bars to resize tiles. Auto layout re-packs the board.
      </p>
    </div>
  );
}
