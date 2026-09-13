import { useCallback, useEffect, useRef, useState } from 'react';

const HOLD_MS = 420;
const SLIP_PX = 18;
const DRAG_PX = 28;

export function padIndexAt(clientX, clientY, gridEl, cols, rows, count) {
  if (!gridEl || count <= 0) return -1;
  const rect = gridEl.getBoundingClientRect();
  if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
    return -1;
  }
  const col = Math.min(cols - 1, Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * cols)));
  const row = Math.min(rows - 1, Math.max(0, Math.floor(((clientY - rect.top) / rect.height) * rows)));
  const index = row * cols + col;
  return index < count ? index : -1;
}

function haptic(ms = 12) {
  if (window.__improvJamHapticDing && navigator.vibrate) navigator.vibrate(ms);
}

export function usePadReorder({
  slotCount,
  cols,
  rows,
  onMove,
  onEmptyTap,
  onPlayStart,
  onPlayRelease,
}) {
  const gridRef = useRef(null);
  const pointerRef = useRef(null);
  const holdTimer = useRef(null);
  const metaRef = useRef({ slotCount, cols, rows, onMove, onEmptyTap, onPlayStart, onPlayRelease });
  metaRef.current = { slotCount, cols, rows, onMove, onEmptyTap, onPlayStart, onPlayRelease };
  const [dragFrom, setDragFrom] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [dragging, setDragging] = useState(false);

  const clearHold = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  const beginDrag = useCallback((p) => {
    if (!p || p.dragging) return;
    p.dragging = true;
    p.armed = true;
    metaRef.current.onPlayRelease?.();
    setDragging(true);
    setDragFrom(p.index);
    setDragOver(p.index);
    haptic(18);
  }, []);

  const endPointer = useCallback((event, cancelled) => {
    const p = pointerRef.current;
    pointerRef.current = null;
    clearHold();
    metaRef.current.onPlayRelease?.();
    const { cols: c, rows: r, slotCount: n } = metaRef.current;
    const over = event
      ? padIndexAt(event.clientX, event.clientY, gridRef.current, c, r, n)
      : -1;
    if (!cancelled && p?.dragging && p.index != null && over >= 0 && over !== p.index) {
      metaRef.current.onMove?.(p.index, over);
    } else if (!cancelled && p && !p.dragging && !p.hasPad) {
      metaRef.current.onEmptyTap?.(p.index);
    }
    setDragFrom(null);
    setDragOver(null);
    setDragging(false);
  }, [clearHold]);

  useEffect(() => () => {
    clearHold();
    metaRef.current.onPlayRelease?.();
  }, [clearHold]);

  const bindPad = useCallback((index, hasPad) => ({
    onPointerDown: (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      clearHold();
      pointerRef.current = {
        index,
        hasPad,
        dragging: false,
        armed: false,
        start: { x: event.clientX, y: event.clientY, t: performance.now() },
      };
      if (hasPad) metaRef.current.onPlayStart?.(index);
      holdTimer.current = setTimeout(() => {
        const p = pointerRef.current;
        if (!p || p.index !== index) return;
        if (!hasPad) {
          beginDrag(p);
          return;
        }
        p.armed = true;
        setDragFrom(index);
        setDragOver(index);
        haptic(12);
      }, HOLD_MS);
    },
    onPointerMove: (event) => {
      const p = pointerRef.current;
      if (!p) return;
      const { cols: c, rows: r, slotCount: n } = metaRef.current;
      const over = padIndexAt(event.clientX, event.clientY, gridRef.current, c, r, n);
      if (p.dragging) {
        if (over >= 0) setDragOver(over);
        return;
      }
      const dist = Math.hypot(event.clientX - p.start.x, event.clientY - p.start.y);
      if (p.armed && dist > DRAG_PX) {
        beginDrag(p);
        if (over >= 0) setDragOver(over);
        return;
      }
      if (!p.armed && dist > SLIP_PX) clearHold();
    },
    onPointerUp: (event) => endPointer(event, false),
    onPointerCancel: (event) => endPointer(event, true),
    onContextMenu: (event) => event.preventDefault(),
    style: { touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' },
  }), [beginDrag, clearHold, endPointer]);

  return { gridRef, dragFrom, dragOver, dragging, bindPad };
}
