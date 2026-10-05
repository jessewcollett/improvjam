export const THEME_COLORS = {
  dark: '#121212',
  light: '#f3efe6',
};

export const THEME_KEY = 'improv-jam-theme';

export function normalizeTheme(theme) {
  return theme === 'light' ? 'light' : 'dark';
}

export function applyTheme(theme) {
  const mode = normalizeTheme(theme);
  const root = document.documentElement;
  root.dataset.theme = mode;
  delete root.dataset.palette;
  root.classList.toggle('theme-light', mode === 'light');
  if (document.body) document.body.classList.toggle('theme-light', mode === 'light');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLORS[mode]);
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    /* private mode */
  }
}

export function readStoredTheme() {
  try {
    const quick = localStorage.getItem(THEME_KEY);
    if (quick === 'light' || quick === 'dark') return quick;
  } catch {
    /* private mode */
  }
  try {
    const raw = JSON.parse(localStorage.getItem('improv-jam-store') || '{}');
    return normalizeTheme(raw?.state?.settings?.theme);
  } catch {
    return 'dark';
  }
}

const STAGE_THEME_KEY = 'improv-jam-tv-theme';

export function readStageTheme() {
  try {
    return normalizeTheme(window.sessionStorage.getItem(STAGE_THEME_KEY));
  } catch {
    return 'dark';
  }
}

export function writeStageTheme(theme) {
  const mode = normalizeTheme(theme);
  try {
    window.sessionStorage.setItem(STAGE_THEME_KEY, mode);
  } catch {
    /* private mode */
  }
  applyTheme(mode);
  return mode;
}
