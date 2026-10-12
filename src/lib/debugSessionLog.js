import { APP_VERSION } from './appVersion.js';

const KEY = 'improv-jam-debug-0b9969';
const INGEST = 'http://127.0.0.1:7258/ingest/fc20b96f-203a-49c4-9069-cc16583f397e';

function round(n) {
  return Math.round(Number(n) * 100) / 100;
}

function box(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return {
    top: round(r.top),
    bottom: round(r.bottom),
    height: round(r.height),
    width: round(r.width),
    padT: cs.paddingTop,
    padB: cs.paddingBottom,
    cssH: cs.height,
    pos: cs.position,
    overflow: cs.overflow,
  };
}

function unitH(kind) {
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = `position:fixed;left:0;top:0;width:0;visibility:hidden;height:${kind}`;
  document.documentElement.appendChild(el);
  const h = round(el.getBoundingClientRect().height);
  el.remove();
  return h;
}

function envPad(side) {
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = `position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)`;
  document.documentElement.appendChild(el);
  const cs = getComputedStyle(el);
  const v = parseFloat(side === 'top' ? cs.paddingTop : cs.paddingBottom) || 0;
  el.remove();
  return round(v);
}

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
      localStorage.setItem(KEY, JSON.stringify(prev.slice(-80)));
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

export function captureAppLayout(reason = 'copy') {
  const vv = window.visualViewport;
  const nav = document.querySelector('nav');
  const inner = nav?.firstElementChild;
  const data = {
    reason,
    version: APP_VERSION,
    standalone: Boolean(window.navigator.standalone),
    displayMode: window.matchMedia('(display-mode: standalone)').matches
      ? 'standalone'
      : window.matchMedia('(display-mode: fullscreen)').matches
        ? 'fullscreen'
        : 'browser',
    screenH: window.screen?.height,
    screenW: window.screen?.width,
    availH: window.screen?.availHeight,
    innerH: window.innerHeight,
    innerW: window.innerWidth,
    clientH: document.documentElement.clientHeight,
    bodyClientH: document.body?.clientHeight,
    vvH: vv?.height,
    vvW: vv?.width,
    vvOff: vv?.offsetTop,
    vvScale: vv?.scale,
    lvh: unitH('100lvh'),
    dvh: unitH('100dvh'),
    svh: unitH('100svh'),
    pct: unitH('100%'),
    topInset: envPad('top'),
    bottomInset: envPad('bottom'),
    html: box(document.documentElement),
    body: box(document.body),
    root: box(document.getElementById('root')),
    shell: box(document.querySelector('.app-shell')),
    main: box(document.querySelector('.app-shell > main')),
    nav: box(nav),
    navInner: box(inner),
    gapScreen: round((window.screen?.height || 0) - (nav?.getBoundingClientRect().bottom || 0)),
    gapInner: round((window.innerHeight || 0) - (nav?.getBoundingClientRect().bottom || 0)),
    gapVv: round((vv?.offsetTop || 0) + (vv?.height || 0) - (nav?.getBoundingClientRect().bottom || 0)),
  };
  // #region agent log
  debugSessionLog({
    hypothesisId: 'A-B-C-D-E',
    location: 'debugSessionLog.js:captureAppLayout',
    message: 'full layout',
    data,
  });
  // #endregion
  return data;
}

export function copyDebugBundle() {
  const layout = captureAppLayout('copy');
  let events = [];
  try {
    events = JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    events = [];
  }
  return JSON.stringify({ layout, events });
}

export function readDebugSessionLogs() {
  return copyDebugBundle();
}
