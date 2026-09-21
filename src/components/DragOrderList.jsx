import { useRef, useState } from 'react';
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { moveId } from '../lib/nav.js';

function haptic(ms = 12) {
  if (window.__improvJamHapticDing && navigator.vibrate) navigator.vibrate(ms);
}

export default function DragOrderList({ items, onOrder, renderAfter, onActivate }) {
  const listRef = useRef(null);
  const dragRef = useRef(null);
  const [dragFrom, setDragFrom] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const indexAt = (clientY) => {
    const list = listRef.current;
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
  };

  const endDrag = (clientY, cancelled) => {
    const from = dragRef.current?.from;
    dragRef.current = null;
    const to = cancelled ? -1 : indexAt(clientY);
    setDragFrom(null);
    setDragOver(null);
    if (!cancelled && from != null && to >= 0 && to !== from) {
      onOrder(moveId(items.map((item) => item.id), from, to));
      haptic(14);
    }
  };

  return (
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
                ? 'bg-gray-800 border-indigo-500'
                : over
                  ? 'bg-gray-800/80 border-indigo-700'
                  : 'bg-[#1A1A1A] border-gray-800'
            }`}
          >
            <button
              type="button"
              aria-label={`Drag to reorder ${item.label}`}
              className="min-w-11 min-h-11 flex items-center justify-center text-gray-500"
              style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
              onPointerDown={(event) => {
                if (event.pointerType === 'mouse' && event.button !== 0) return;
                event.preventDefault();
                try {
                  event.currentTarget.setPointerCapture?.(event.pointerId);
                } catch {
                  /* capture is optional */
                }
                dragRef.current = { from: index };
                setDragFrom(index);
                setDragOver(index);
                haptic(10);
              }}
              onPointerMove={(event) => {
                if (!dragRef.current) return;
                const overIndex = indexAt(event.clientY);
                if (overIndex >= 0) setDragOver(overIndex);
              }}
              onPointerUp={(event) => endDrag(event.clientY, false)}
              onPointerCancel={(event) => endDrag(event.clientY, true)}
            >
              <GripVertical className="w-4 h-4" />
            </button>
            {onActivate ? (
              <button type="button" onClick={() => onActivate(item)} className="flex-1 min-w-0 text-left min-h-11 py-2">
                <span className="block text-sm font-bold text-gray-100 truncate">{item.label}</span>
                {item.detail ? <span className="block text-xs text-gray-500 truncate">{item.detail}</span> : null}
              </button>
            ) : (
              <div className="flex-1 min-w-0 py-2">
                <span className="block text-sm font-bold text-gray-100 truncate">{item.label}</span>
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
  );
}
