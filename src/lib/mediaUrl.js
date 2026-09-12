export function driveFileId(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^[a-zA-Z0-9_-]{20,}$/.test(raw) && !raw.includes('/')) return raw;
  const match = raw.match(/\/d\/([a-zA-Z0-9_-]{10,})/)
    || raw.match(/[?&]id=([a-zA-Z0-9_-]{10,})/)
    || raw.match(/open\?id=([a-zA-Z0-9_-]{10,})/);
  return match ? match[1] : '';
}

export function playbackUrl(rawUrl) {
  const value = String(rawUrl || '').trim();
  if (!value) return '';
  if (value.startsWith('/')) return value;

  const id = driveFileId(value);
  if (id) return `/api/media?id=${encodeURIComponent(id)}`;

  try {
    const parsed = new URL(value);
    if (parsed.hostname.includes('drive.google') || parsed.hostname.includes('googleusercontent')) {
      const nested = driveFileId(value);
      return nested ? `/api/media?id=${encodeURIComponent(nested)}` : `/api/media?url=${encodeURIComponent(value)}`;
    }
    return value;
  } catch {
    return value;
  }
}
