import { Tag } from 'lucide-react';
import { firstEmoji, lucideById } from '../lib/icons.js';

export default function CatalogIcon({ name, className = '', fallback: Fallback = Tag }) {
  const raw = String(name || '').trim();
  const Icon = lucideById(raw);
  if (Icon) return <Icon className={className} />;
  const emoji = firstEmoji(raw);
  if (emoji) {
    return (
      <span
        className={`inline-flex items-center justify-center leading-none ${className}`}
        aria-hidden="true"
      >
        {emoji}
      </span>
    );
  }
  return <Fallback className={className} />;
}
