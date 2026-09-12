import { playbackUrl } from '../lib/mediaUrl.js';

export default function CatalogImage({ src, alt }) {
  const url = playbackUrl(src);
  if (!url) return null;
  return (
    <img
      src={url}
      alt={alt || ''}
      className="w-full max-h-56 md:max-h-72 object-contain rounded-xl border border-gray-800 bg-black/30 mb-3"
      loading="lazy"
    />
  );
}
