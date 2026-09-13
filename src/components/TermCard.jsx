import { useState } from 'react';
import { ChevronRight, ExternalLink } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { termClass } from '../lib/categoryStyles.js';
import { splitList } from '../lib/generator.js';
import CatalogImage from './CatalogImage.jsx';
import { ItemSource } from './SourceCitation.jsx';
import { trustedSourceUrl } from '../lib/sheets.js';
import { useAppStore } from '../store/useAppStore.js';

export default function TermCard({ termData, onCategoryClick }) {
  const sources = useAppStore((s) => s.data.sources);
  const [expanded, setExpanded] = useState(false);
  const categories = termData.categories?.length ? termData.categories : splitList(termData.category);
  const originalHref = trustedSourceUrl(termData, sources);

  return (
    <div className="bg-card border border-gray-800 rounded-xl overflow-hidden h-full">
      <div className="w-full px-3 py-2.5 min-h-12 flex flex-wrap items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 min-w-0 text-left flex items-start justify-between gap-3"
          aria-expanded={expanded}
        >
          <h3 className="text-base font-bold font-display text-gray-100 leading-tight">{termData.term}</h3>
          <ChevronRight className={`w-4 h-4 text-gray-500 shrink-0 mt-0.5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
        <span className="flex flex-wrap items-center gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => onCategoryClick?.(cat)}
              className={`text-2xs font-medium px-2 py-0.5 rounded-full border ${termClass(cat)}`}
            >
              {cat}
            </button>
          ))}
        </span>
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">
              <CatalogImage src={termData.imageSrc || termData.image} alt={termData.term} />
              <p className="text-sm text-gray-400 leading-relaxed mb-2">{termData.definition}</p>
              {termData.definitions ? (
                <p className="text-sm text-gray-400 leading-relaxed mb-2 whitespace-pre-wrap">{termData.definitions}</p>
              ) : null}
              {originalHref ? (
                <a
                  href={originalHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-2xs text-blue-400 mb-2 min-h-9"
                >
                  Open original
                  <ExternalLink className="w-3 h-3 ml-1 opacity-70" />
                </a>
              ) : null}
              <ItemSource item={termData} sources={sources} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
