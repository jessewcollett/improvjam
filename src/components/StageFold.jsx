import { ChevronDown } from 'lucide-react';
import { useAppStore } from '../store/useAppStore.js';

export default function StageFold({
  id,
  title,
  accent = 'text-gray-500',
  summary,
  boxed = false,
  className,
  children,
}) {
  const open = useAppStore((s) => s.stageFolds?.[id] !== false);
  const toggleStageFold = useAppStore((s) => s.toggleStageFold);

  const header = (
    <button
      type="button"
      onClick={() => toggleStageFold(id)}
      aria-expanded={open}
      className={`w-full min-h-9 flex items-center gap-2 text-left ${boxed ? 'px-3 py-2' : 'py-0.5'}`}
    >
      <span className={`text-2xs uppercase tracking-wider font-bold ${accent}`}>{title}</span>
      {!open && summary ? (
        <span className="flex-1 min-w-0 text-xs text-gray-500 truncate">{summary}</span>
      ) : (
        <span className="flex-1" />
      )}
      <ChevronDown
        className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
      />
    </button>
  );

  if (boxed) {
    return (
      <section className={`mb-3 rounded-xl border border-gray-800 bg-[#1A1A1A] overflow-hidden ${className || ''}`}>
        {header}
        {open ? <div className="px-3 pb-3">{children}</div> : null}
      </section>
    );
  }

  return (
    <section className={className || 'mb-2'}>
      {header}
      {open ? children : null}
    </section>
  );
}
