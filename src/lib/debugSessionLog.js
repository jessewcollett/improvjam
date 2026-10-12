const KEY = 'improv-jam-debug-0b9969';
const INGEST = 'http://127.0.0.1:7258/ingest/fc20b96f-203a-49c4-9069-cc16583f397e';

export function debugSessionLog({ hypothesisId, location, message, data }) {
  const payload = {
    sessionId: '0b9969',
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };
  try {
    const prev = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (Array.isArray(prev)) {
      prev.push(payload);
      localStorage.setItem(KEY, JSON.stringify(prev.slice(-120)));
    }
  } catch {
    /* quota */
  }
  fetch(INGEST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '0b9969' },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

export function readDebugSessionLogs() {
  try {
    return localStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
}
