import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { termClass } from '../lib/categoryStyles.js';
import { ItemSource } from './SourceCitation.jsx';
import { useAppStore } from '../store/useAppStore.js';

export default function TermCard({ termData }) {
  const sources = useAppStore((s) => s.data.sources);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-card border border-gray-800 rounded-xl mb-2 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-3 py-2.5 min-h-12 flex items-center justify-between gap-3"
        aria-expanded={expanded}
      >
        <h3 className="text-[15px] font-bold font-display text-gray-100 truncate">{termData.term}</h3>
        <span className="flex items-center gap-1.5 shrink-0">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${termClass(termData.category)}`}>
            {termData.category}
          </span>
          <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">
              <p className="text-sm text-gray-400 leading-relaxed mb-2">{termData.definition}</p>
              <ItemSource item={termData} sources={sources} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
