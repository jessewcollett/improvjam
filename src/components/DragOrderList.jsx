import { Fragment, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, GripVertical, Trash2 } from 'lucide-react';
import { moveId } from '../lib/nav.js';

const SWIPE_MAX = 96;
const SWIPE_COMMIT = 72;
const SCROLL_EDGE = 48;
const SCROLL_MIN = 4;
const SCROLL_MAX = 18;

function haptic(ms = 12) {
  if (window.__improvJamHapticDing && navigator.vibrate) navigator.vibrate(ms);
}

function scrollParent(node) {
  let current = node;
  while (current && current !== document.body && current !== document.documentElement) {
    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') && current.scrollHeight > current.clientHeight + 1) {
      return current;
    }
    current = current.parentElement;
  }
  const root = document.scrollingElement || document.documentElement;
  return root.scrollHeight > root.clientHeight + 1 ? root : null;
}

function edgeScrollDelta(clientY, pane) {
  const rect = pane.getBoundingClientRect();
  const topDist = clientY - rect.top;
  const bottomDist = rect.bottom - clientY;
  if (topDist < SCROLL_EDGE && pane.scrollTop > 0) {
    const t = 1 - Math.max(0, topDist) / SCROLL_EDGE;
    return -Math.ceil(SCROLL_MIN + t * (SCROLL_MAX - SCROLL_MIN));
  }
  if (bottomDist < SCROLL_EDGE && pane.scrollTop + pane.clientHeight < pane.scrollHeight - 1) {
    const t = 1 - Math.max(0, bottomDist) / SCROLL_EDGE;
    return Math.ceil(SCROLL_MIN + t * (SCROLL_MAX - SCROLL_MIN));
  }
  return 0;
}

function floatTransform(clientY, offsetY) {
  return `translate3d(0, ${clientY - offsetY}px, 0)`;
}

function slotAt(list, clientY, count) {
  if (!list || count <= 0) return 0;
  const rows = [...list.querySelectorAll('[data-reorder-index]')];
  if (!rows.length) return 0;
  if (clientY < rows[0].getBoundingClientRect().top) return 0;
  for (const row of rows) {
    const rect = row.getBoundingClientRect();
    const index = Number(row.dataset.reorderIndex);
    const mid = (rect.top + rect.bottom) / 2;
    if (clientY < mid) return index;
  }
  return count;
}

function slotToIndex(from, slot) {
  if (slot < 0) return from;
  return slot > from ? slot - 1 : slot;
}

function RowLabel({ item }) {
  return (
    <>
      <span className="flex items-center gap-1.5 min-w-0">
        {item.badge ? (
          <span className={`text-2xs font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${item.badgeClass || 'bg-gray-800 text-gray-300 border-gray-700'}`}>
            {item.badge}
          </span>
        ) : null}
        <span className="block text-sm font-bold text-gray-100 truncate">{item.label}</span>
      </span>
      {item.detail ? <span className="block text-xs text-gray-500 truncate">{item.detail}</span> : null}
    </>
  );
}

export default function DragOrderList({ items, onOrder, renderAfter, onActivate, onDelete }) {
  const listRef = useRef(null);
  const dragRef = useRef(null);
  const floatRef = useRef(null);
  const itemsRef = useRef(items);
  const onOrderRef = useRef(onOrder);
  const onDeleteRef = useRef(onDelete);
  const swipeRef = useRef(null);
  const skipClickRef = useRef('');
  const [dragFrom, setDragFrom] = useState(null);
  const [dropSlot, setDropSlot] = useState(null);
  const [float, setFloat] = useState(null);
  const [swipe, setSwipe] = useState({ id: '', x: 0 });
  itemsRef.current = items;
  onOrderRef.current = onOrder;
  onDeleteRef.current = onDelete;

  const placeFloat = (clientY) => {
    const drag = dragRef.current;
    const node = floatRef.current;
    if (!drag || !node) return;
    node.style.transform = floatTransform(clientY, drag.offsetY);
  };

  const applySlot = (clientY) => {
    const nextSlot = slotAt(listRef.current, clientY, itemsRef.current.length);
    setDropSlot((prev) => {
      if (prev !== nextSlot) haptic(8);
      return nextSlot;
    });
  };

  const stopDrag = (clientY, cancelled) => {
    const from = dragRef.current?.from;
    const count = itemsRef.current.length;
    const slot = cancelled ? -1 : slotAt(listRef.current, clientY, count);
    const to = cancelled || from == null ? -1 : slotToIndex(from, slot);
    dragRef.current = null;
    document.body.classList.remove('reorder-dragging');
    setDragFrom(null);
    setDropSlot(null);
    setFloat(null);
    if (!cancelled && from != null && to >= 0 && to !== from) {
      onOrderRef.current(moveId(itemsRef.current.map((item) => item.id), from, to));
      haptic(14);
    }
  };

  useEffect(() => {
    if (dragFrom == null) return undefined;
    const onMove = (event) => {
      if (!dragRef.current) return;
      event.preventDefault();
      dragRef.current.lastY = event.clientY;
      placeFloat(event.clientY);
      applySlot(event.clientY);
    };
    const onUp = (event) => stopDrag(event.clientY, false);
    const onCancel = (event) => stopDrag(event.clientY, true);
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    let raf = 0;
    const tick = () => {
      const drag = dragRef.current;
      if (!drag) return;
      const pane = scrollParent(listRef.current);
      const y = drag.lastY;
      if (pane && y != null) {
        const dy = edgeScrollDelta(y, pane);
        if (dy) {
          pane.scrollTop += dy;
          placeFloat(y);
          applySlot(y);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      document.body.classList.remove('reorder-dragging');
    };
  }, [dragFrom]);

  useEffect(() => {
    const onMove = (event) => {
      const swipeState = swipeRef.current;
      if (!swipeState || swipeState.pointerId !== event.pointerId) return;
      const dx = event.clientX - swipeState.x;
      const dy = event.clientY - swipeState.y;
      if (!swipeState.locked) {
        if (Math.abs(dy) > 8 && Math.abs(dy) >= Math.abs(dx)) {
          swipeRef.current = null;
          setSwipe({ id: '', x: 0 });
          return;
        }
        if (dx > -8) return;
        swipeState.locked = true;
      }
      event.preventDefault();
      const next = Math.max(-SWIPE_MAX, Math.min(0, dx));
      swipeState.dx = next;
      setSwipe({ id: swipeState.id, x: next });
    };
    const finish = (event) => {
      const swipeState = swipeRef.current;
      if (!swipeState || swipeState.pointerId !== event.pointerId) return;
      const dx = swipeState.dx || 0;
      const id = swipeState.id;
      if (swipeState.locked) skipClickRef.current = id;
      swipeRef.current = null;
      setSwipe({ id: '', x: 0 });
      if (swipeState.locked && dx <= -SWIPE_COMMIT) {
        const item = itemsRef.current.find((entry) => entry.id === id);
        if (item) onDeleteRef.current?.(item);
        haptic(14);
      }
    };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }, []);

  const startDrag = (event, index, row) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    swipeRef.current = null;
    setSwipe({ id: '', x: 0 });
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      /* capture is optional */
    }
    const rect = row.getBoundingClientRect();
    dragRef.current = { from: index, offsetY: event.clientY - rect.top, lastY: event.clientY };
    setDragFrom(index);
    setDropSlot(index);
    setFloat({
      left: rect.left,
      width: rect.width,
      height: rect.height,
      item: items[index],
      top: rect.top,
    });
    document.body.classList.add('reorder-dragging');
    haptic(10);
  };

  const startSwipe = (event, item) => {
    if (!onDelete || dragFrom != null) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    swipeRef.current = {
      id: item.id,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      dx: 0,
      locked: false,
    };
  };

  const slotMarker = (slot) => {
    const active = dropSlot === slot && dragFrom != null && slot !== dragFrom && slot !== dragFrom + 1;
    return (
      <li
        key={`slot-${slot}`}
        aria-hidden
        className={`list-none px-3 pointer-events-none overflow-hidden transition-[height,margin] duration-150 ${
          active ? 'h-2.5 my-0.5' : 'h-0 my-0'
        }`}
      >
        <span
          className={`block h-0.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)] transition-opacity duration-150 ${
            active ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </li>
    );
  };

  return (
    <>
      <ol ref={listRef} className="list-none">
        {items.map((item, index) => {
          const dragging = dragFrom === index;
          const swipeX = swipe.id === item.id ? swipe.x : 0;
          const swiping = swipeX < 0;
          return (
            <Fragment key={item.id}>
              {index === 0 ? slotMarker(0) : null}
              <li className="relative overflow-hidden rounded-xl mb-1">
                {onDelete && dragFrom == null ? (
                  <div className="absolute inset-y-0 right-0 w-24 bg-red-900/85 text-red-100 flex items-center justify-end pr-3 pointer-events-none">
                    <Trash2 className="w-4 h-4 mr-1" />
                    <span className="text-2xs font-bold uppercase tracking-wider">Remove</span>
                  </div>
                ) : null}
                <div
                  data-reorder-index={index}
                  className={`relative z-[1] flex items-center gap-0.5 min-h-11 rounded-xl border px-1 ${
                    dragging
                      ? 'bg-indigo-950/40 border-dashed border-indigo-700 opacity-40'
                      : 'bg-[#1A1A1A] border-gray-800'
                  }`}
                  style={{
                    transform: swiping ? `translateX(${swipeX}px)` : undefined,
                    transition: swiping ? 'none' : 'transform 160ms ease-out',
                  }}
                >
                  <button
                    type="button"
                    aria-label={`Drag to reorder ${item.label}`}
                    className="min-w-11 min-h-11 flex items-center justify-center text-gray-500"
                    style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
                    onPointerDown={(event) => startDrag(event, index, event.currentTarget.closest('[data-reorder-index]'))}
                  >
                    <GripVertical className="w-4 h-4" />
                  </button>
                  {onActivate ? (
                    <button
                      type="button"
                      onPointerDown={(event) => startSwipe(event, item)}
                      onClick={() => {
                        if (skipClickRef.current === item.id) {
                          skipClickRef.current = '';
                          return;
                        }
                        onActivate(item);
                      }}
                      className="flex-1 min-w-0 text-left min-h-11 py-2"
                      style={{ touchAction: onDelete ? 'pan-y' : undefined }}
                    >
                      <RowLabel item={item} />
                    </button>
                  ) : (
                    <div
                      className="flex-1 min-w-0 py-2"
                      onPointerDown={(event) => startSwipe(event, item)}
                      style={{ touchAction: onDelete ? 'pan-y' : undefined }}
                    >
                      <RowLabel item={item} />
                    </div>
                  )}
                  <button
                    type="button"
                    aria-label={`Move ${item.label} up`}
                    disabled={index === 0}
                    onClick={() => onOrder(moveId(items.map((entry) => entry.id), index, index - 1))}
                    className="min-w-11 min-h-11 flex items-center justify-center text-gray-200 disabled:text-gray-600"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${item.label} down`}
                    disabled={index === items.length - 1}
                    onClick={() => onOrder(moveId(items.map((entry) => entry.id), index, index + 1))}
                    className="min-w-11 min-h-11 flex items-center justify-center text-gray-200 disabled:text-gray-600"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  {renderAfter ? renderAfter(item) : null}
                </div>
              </li>
              {slotMarker(index + 1)}
            </Fragment>
          );
        })}
      </ol>
      {float?.item ? createPortal(
        <div
          ref={(node) => {
            floatRef.current = node;
            if (node) node.style.transform = floatTransform(float.top, 0);
          }}
          className="pointer-events-none fixed z-[90] left-0 top-0 rounded-xl border border-indigo-400/70 bg-[#2a2a2a]/80 opacity-80 shadow-[0_8px_24px_rgba(0,0,0,0.4)] flex items-center gap-0.5 px-1"
          style={{
            width: float.width,
            height: float.height,
            marginLeft: float.left,
            transform: floatTransform(float.top, 0),
          }}
        >
          <span className="min-w-11 min-h-11 flex items-center justify-center text-indigo-300 shrink-0">
            <GripVertical className="w-4 h-4" />
          </span>
          <div className="flex-1 min-w-0 py-2 pr-3">
            <RowLabel item={float.item} />
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
