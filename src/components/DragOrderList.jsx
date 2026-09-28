import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { moveId } from '../lib/nav.js';

function haptic(ms = 12) {
  if (window.__improvJamHapticDing && navigator.vibrate) navigator.vibrate(ms);
}

function indexAt(list, clientY) {
  if (!list) return -1;
  const rows = [...list.querySelectorAll('[data-reorder-index]')];
  for (const row of rows) {
    const rect = row.getBoundingClientRect();
    if (clientY >= rect.top && clientY <= rect.bottom) {
      return Number(row.dataset.reorderIndex);
    }
  }
  if (!rows.length) return -1;
  if (clientY < rows[0].getBoundingClientRect().top) return 0;
  return rows.length - 1;
}

export default function DragOrderList({ items, onOrder, renderAfter, onActivate }) {
  const listRef = useRef(null);
  const dragRef = useRef(null);
  const floatRef = useRef(null);
  const itemsRef = useRef(items);
  const onOrderRef = useRef(onOrder);
  const [dragFrom, setDragFrom] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [float, setFloat] = useState(null);
  itemsRef.current = items;
  onOrderRef.current = onOrder;

  const placeFloat = (clientY) => {
    const drag = dragRef.current;
    const node = floatRef.current;
    if (!drag || !node) return;
    node.style.transform = `translate3d(6px, ${clientY - drag.offsetY - 12}px, 0) scale(1.08) rotate(-1deg)`;
  };

  const stopDrag = (clientY, cancelled) => {
    const from = dragRef.current?.from;
    dragRef.current = null;
    document.body.classList.remove('reorder-dragging');
    const to = cancelled ? -1 : indexAt(listRef.current, clientY);
    setDragFrom(null);
    setDragOver(null);
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
      placeFloat(event.clientY);
      const overIndex = indexAt(listRef.current, event.clientY);
      if (overIndex >= 0) setDragOver(overIndex);
    };
    const onUp = (event) => stopDrag(event.clientY, false);
    const onCancel = (event) => stopDrag(event.clientY, true);
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      document.body.classList.remove('reorder-dragging');
    };
  }, [dragFrom]);

  const startDrag = (event, index, row) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      /* capture is optional */
    }
    const rect = row.getBoundingClientRect();
    dragRef.current = { from: index, offsetY: event.clientY - rect.top };
    setDragFrom(index);
    setDragOver(index);
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

  return (
    <>
      <ol ref={listRef} className="space-y-1">
        {items.map((item, index) => {
          const dragging = dragFrom === index;
          const over = dragOver === index && dragFrom !== index;
          return (
            <li
              key={item.id}
              data-reorder-index={index}
              className={`flex items-center gap-0.5 min-h-11 rounded-xl border px-1 ${
                dragging
                  ? 'bg-indigo-950/40 border-dashed border-indigo-700 opacity-40'
                  : over
                    ? 'bg-indigo-950/50 border-indigo-500'
                    : 'bg-[#1A1A1A] border-gray-800'
              }`}
            >
              <button
                type="button"
                aria-label={`Drag to reorder ${item.label}`}
                className="min-w-11 min-h-11 flex items-center justify-center text-gray-500"
                style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
                onPointerDown={(event) => startDrag(event, index, event.currentTarget.closest('li'))}
              >
                <GripVertical className="w-4 h-4" />
              </button>
              {onActivate ? (
                <button type="button" onClick={() => onActivate(item)} className="flex-1 min-w-0 text-left min-h-11 py-2">
                  <span className="flex items-center gap-1.5 min-w-0">
                    {item.badge ? (
                      <span className={`text-2xs font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${item.badgeClass || 'bg-gray-800 text-gray-300 border-gray-700'}`}>
                        {item.badge}
                      </span>
                    ) : null}
                    <span className="block text-sm font-bold text-gray-100 truncate">{item.label}</span>
                  </span>
                  {item.detail ? <span className="block text-xs text-gray-500 truncate">{item.detail}</span> : null}
                </button>
              ) : (
                <div className="flex-1 min-w-0 py-2">
                  <span className="flex items-center gap-1.5 min-w-0">
                    {item.badge ? (
                      <span className={`text-2xs font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${item.badgeClass || 'bg-gray-800 text-gray-300 border-gray-700'}`}>
                        {item.badge}
                      </span>
                    ) : null}
                    <span className="block text-sm font-bold text-gray-100 truncate">{item.label}</span>
                  </span>
                  {item.detail ? <span className="block text-xs text-gray-500 truncate">{item.detail}</span> : null}
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
            </li>
          );
        })}
      </ol>
      {float?.item ? createPortal(
        <div
          ref={(node) => {
            floatRef.current = node;
            if (node && dragRef.current) {
              node.style.transform = `translate3d(6px, ${float.top - 12}px, 0) scale(1.08) rotate(-1deg)`;
            }
          }}
          className="pointer-events-none fixed z-[90] left-0 top-0 rounded-xl border-2 border-indigo-300 bg-[#2a2a2a] shadow-[0_22px_50px_rgba(0,0,0,0.65),0_0_0_1px_rgba(165,180,252,0.35)] flex items-center gap-0.5 px-1"
          style={{
            width: float.width,
            height: float.height,
            marginLeft: float.left,
            transform: `translate3d(6px, ${float.top - 12}px, 0) scale(1.08) rotate(-1deg)`,
            transformOrigin: 'center center',
          }}
        >
          <span className="min-w-11 min-h-11 flex items-center justify-center text-indigo-300 shrink-0">
            <GripVertical className="w-4 h-4" />
          </span>
          <div className="flex-1 min-w-0 py-2 pr-3">
            <span className="flex items-center gap-1.5 min-w-0">
              {float.item.badge ? (
                <span className={`text-2xs font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${float.item.badgeClass || 'bg-gray-800 text-gray-300 border-gray-700'}`}>
                  {float.item.badge}
                </span>
              ) : null}
              <span className="block text-sm font-bold text-white truncate">{float.item.label}</span>
            </span>
            {float.item.detail ? (
              <span className="block text-xs text-gray-400 truncate">{float.item.detail}</span>
            ) : null}
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
