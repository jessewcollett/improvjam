export function encodeSharedSet({ name, ids }) {
  const payload = {
    v: 1,
    n: String(name || '').trim().slice(0, 80),
    g: (Array.isArray(ids) ? ids : []).map((id) => String(id || '').trim()).filter(Boolean).slice(0, 200),
  };
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  bytes.forEach((byte) => {
    bin += String.fromCharCode(byte);
  });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeSharedSet(raw) {
  const token = String(raw || '').trim();
  if (!token) return null;
  try {
    const padded = token.replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
    const bin = atob(padded + pad);
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const data = JSON.parse(json);
    if (!data || typeof data !== 'object') return null;
    const ids = (Array.isArray(data.g) ? data.g : []).map((id) => String(id || '').trim()).filter(Boolean);
    if (!ids.length) return null;
    return {
      name: String(data.n || 'Shared set').trim() || 'Shared set',
      ids: ids.slice(0, 200),
    };
  } catch {
    return null;
  }
}

export function sharedSetUrl(payload, origin = typeof window !== 'undefined' ? window.location.origin : '') {
  const token = encodeSharedSet(payload);
  if (!token) return '';
  const base = String(origin || '').replace(/\/+$/, '');
  return `${base}/?set=${encodeURIComponent(token)}`;
}
