import { BookOpen, ExternalLink } from 'lucide-react';
import { sourceHref, sourceLabel } from '../lib/sheets.js';

export function ItemSource({ item, sources, className = '' }) {
  const label = sourceLabel(item, sources);
  const href = sourceHref(item, sources);
  if (!label) return null;
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`text-[10px] text-blue-400/90 italic truncate hover:text-blue-300 ${className}`}
        title={label}
      >
        {label}
      </a>
    );
  }
  return (
    <span className={`text-[10px] text-gray-500 italic truncate ${className}`} title={label}>
      {label}
    </span>
  );
}

export function LibraryFooter({ sources }) {
  const encyclopedia = sources.find((s) => s.id === 'src-encyclopedia');
  return (
    <div className="mt-8 mb-4 pt-4 border-t border-gray-800 flex flex-col items-center justify-center text-center">
      <p className="text-xs text-gray-500 mb-2">
        Catalog entries adapted from jam teaching notes and the Improv Encyclopedia. Encyclopedia content is used with attribution.
      </p>
      <a
        href={encyclopedia?.url || 'https://improvencyclopedia.org/Download.html'}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors bg-blue-900/20 px-4 py-2 rounded-lg border border-blue-800/50"
      >
        <BookOpen className="w-4 h-4 mr-2" />
        The Improv Encyclopedia
        <ExternalLink className="w-3 h-3 ml-2 opacity-70" />
      </a>
    </div>
  );
}
