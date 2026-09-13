import { BookOpen, ExternalLink } from 'lucide-react';
import { INTAKE_FORM_URL, itemSourceLinks, sourceLabel } from '../lib/sheets.js';

function SourceLink({ href, className, title, children }) {
  if (!href) {
    return (
      <span className={className} title={title}>
        {children}
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      title={title}
    >
      {children}
      <ExternalLink className="w-3 h-3 ml-1 opacity-70 shrink-0" />
    </a>
  );
}

export function ItemSource({ item, sources, className = '' }) {
  const links = itemSourceLinks(item, sources);

  if (links.length > 1) {
    return (
      <div className={`flex flex-wrap gap-1 min-w-0 ${className}`}>
        {links.map((src) => (
          src.href ? (
            <a
              key={src.id}
              href={src.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-2xs text-blue-300 bg-blue-900/20 border border-blue-800/40 px-1.5 py-0.5 rounded-full break-words max-w-full"
            >
              {src.name}
              <ExternalLink className="w-2.5 h-2.5 ml-1 opacity-70 shrink-0" />
            </a>
          ) : (
            <span
              key={src.id}
              className="text-2xs text-gray-400 bg-gray-800 border border-gray-700 px-1.5 py-0.5 rounded-full break-words max-w-full"
            >
              {src.name}
            </span>
          )
        ))}
      </div>
    );
  }

  const single = links[0];
  const label = single?.name || sourceLabel(item, sources);
  const href = single?.href || '';
  if (!label) return null;
  return (
    <SourceLink
      href={href}
      className={
        href
          ? `inline-flex items-center text-2xs text-blue-400/90 italic break-words hover:text-blue-300 ${className}`
          : `text-2xs text-gray-500 italic break-words ${className}`
      }
      title={label}
    >
      {label}
    </SourceLink>
  );
}

export function LibraryFooter({ sources }) {
  const encyclopedia = sources.find((s) => s.id === 'src-encyclopedia');
  const learnImprov = sources.find((s) => s.id === 'src-learnimprov');
  return (
    <div className="mt-8 mb-4 pt-4 border-t border-gray-800 flex flex-col items-center justify-center text-center">
      <p className="text-xs text-gray-500 mb-2">
        Catalog entries adapted from jam teaching notes, the Improv Encyclopedia, and Learn Improv.
        Encyclopedia and Learn Improv content is used with attribution (Learn Improv is CC BY-SA 4.0).
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
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
      <a
        href={learnImprov?.url || 'https://www.learnimprov.com/'}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors bg-blue-900/20 px-4 py-2 rounded-lg border border-blue-800/50"
      >
        <BookOpen className="w-4 h-4 mr-2" />
        Learn Improv
        <ExternalLink className="w-3 h-3 ml-2 opacity-70" />
      </a>
      </div>
      <a
        href={INTAKE_FORM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 text-xs text-gray-500 hover:text-blue-400"
      >
        Submit to the catalog
      </a>
    </div>
  );
}
