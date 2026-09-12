export const THEME_COLORS = {
  dark: '#121212',
  light: '#f3efe6',
};

export function normalizeTheme(theme) {
  return theme === 'light' ? 'light' : 'dark';
}

export function applyTheme(theme) {
  const mode = normalizeTheme(theme);
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.classList.toggle('theme-light', mode === 'light');
  if (document.body) document.body.classList.toggle('theme-light', mode === 'light');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLORS[mode]);
}

export function readStoredTheme() {
  try {
    const raw = JSON.parse(localStorage.getItem('improv-jam-store') || '{}');
    return normalizeTheme(raw?.state?.settings?.theme);
  } catch {
    return 'dark';
  }
}
