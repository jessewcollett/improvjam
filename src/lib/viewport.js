let probe;

function readInset(side) {
  if (typeof document === 'undefined') return 0;
  if (!probe) {
    probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)';
  }
  if (!probe.isConnected) document.documentElement.appendChild(probe);
  const cs = getComputedStyle(probe);
  return parseFloat(side === 'top' ? cs.paddingTop : cs.paddingBottom) || 0;
}

export function syncAppViewport() {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  const vv = window.visualViewport;
  const height = Math.round(vv?.height ?? window.innerHeight);
  const topInset = readInset('top');
  const bottomInset = readInset('bottom');
  const screenH = window.screen?.height || height;
  const chromeBottom = Math.max(0, screenH - height - topInset);
  const safeBottom = Math.max(0, Math.round(bottomInset - chromeBottom));
  root.style.setProperty('--app-height', `${height}px`);
  root.style.setProperty('--app-top', '0px');
  root.style.setProperty('--safe-bottom', `${safeBottom}px`);
  root.dataset.safeBottom = String(safeBottom);
  root.dataset.chromeBottom = String(Math.round(chromeBottom));
  root.dataset.topInset = String(Math.round(topInset));
  root.dataset.bottomInset = String(Math.round(bottomInset));
  if (window.scrollY !== 0 || root.scrollTop !== 0) {
    window.scrollTo(0, 0);
  }
}
