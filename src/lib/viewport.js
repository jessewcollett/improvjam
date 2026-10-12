let insetProbe;
let unitProbe;

function readInset(side) {
  if (typeof document === 'undefined') return 0;
  if (!insetProbe) {
    insetProbe = document.createElement('div');
    insetProbe.setAttribute('aria-hidden', 'true');
    insetProbe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)';
  }
  if (!insetProbe.isConnected) document.documentElement.appendChild(insetProbe);
  const cs = getComputedStyle(insetProbe);
  return parseFloat(side === 'top' ? cs.paddingTop : cs.paddingBottom) || 0;
}

function readUnitHeight(kind) {
  if (typeof document === 'undefined') return 0;
  if (!unitProbe) {
    unitProbe = document.createElement('div');
    unitProbe.setAttribute('aria-hidden', 'true');
    unitProbe.style.cssText = 'position:fixed;left:0;top:0;width:0;visibility:hidden;pointer-events:none';
  }
  if (!unitProbe.isConnected) document.documentElement.appendChild(unitProbe);
  unitProbe.style.height = kind;
  return Math.round(unitProbe.getBoundingClientRect().height) || 0;
}

export function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.navigator.standalone)
    || window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches;
}

export function syncAppViewport() {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  const vv = window.visualViewport;
  const vvH = Math.round(vv?.height ?? window.innerHeight);
  const innerH = window.innerHeight;
  const screenH = window.screen?.height || innerH;
  const lvh = readUnitHeight('100lvh');
  const dvh = readUnitHeight('100dvh');
  const svh = readUnitHeight('100svh');
  const standalone = isStandaloneDisplay();
  const keyboard = vvH < Math.min(innerH, screenH, lvh || screenH) - 120;
  let height = vvH;
  if (!keyboard) {
    height = Math.max(vvH, lvh, dvh);
    if (standalone && screenH > height + 20) height = screenH;
  }
  const topInset = readInset('top');
  const bottomInset = readInset('bottom');
  const fillsScreen = height >= screenH - 1;
  const chromeBottom = fillsScreen ? 0 : Math.max(0, screenH - height - topInset);
  const safeBottom = Math.max(0, Math.round(bottomInset - chromeBottom));
  root.style.setProperty('--app-height', `${Math.round(height)}px`);
  root.style.setProperty('--app-top', '0px');
  root.style.setProperty('--safe-bottom', `${safeBottom}px`);
  root.dataset.safeBottom = String(safeBottom);
  root.dataset.chromeBottom = String(Math.round(chromeBottom));
  root.dataset.topInset = String(Math.round(topInset));
  root.dataset.bottomInset = String(Math.round(bottomInset));
  root.dataset.standalone = standalone ? '1' : '0';
  root.dataset.keyboard = keyboard ? '1' : '0';
  root.dataset.lvh = String(lvh);
  root.dataset.dvh = String(dvh);
  root.dataset.svh = String(svh);
  if (window.scrollY !== 0 || root.scrollTop !== 0) {
    window.scrollTo(0, 0);
  }
}
