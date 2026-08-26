const key = 'fde.theme';
const root = document.documentElement;
const button = document.querySelector('#theme-toggle');
const themeColor = document.querySelector('meta[name="theme-color"]');
const systemQuery = window.matchMedia?.('(prefers-color-scheme: dark)') || null;

function storage() {
  try { return window.localStorage; } catch { return null; }
}

function read() {
  try {
    const value = storage()?.getItem(key) || 'system';
    return ['system', 'light', 'dark'].includes(value) ? value : 'system';
  } catch {
    return 'system';
  }
}

function write(value) {
  try { storage()?.setItem(key, value); } catch { /* appearance still works for this page */ }
}

function resolvedTheme(preference) {
  if (preference === 'light' || preference === 'dark') return preference;
  return systemQuery?.matches ? 'dark' : 'light';
}

function nextPreference(preference) {
  return preference === 'system' ? 'dark' : preference === 'dark' ? 'light' : 'system';
}

function label(preference) {
  return preference === 'dark' ? 'Dark' : preference === 'light' ? 'Light' : 'System';
}

function apply(preference = read()) {
  const chosen = ['system', 'light', 'dark'].includes(preference) ? preference : 'system';
  const resolved = resolvedTheme(chosen);
  root.dataset.theme = resolved;
  root.dataset.themePreference = chosen;
  if (themeColor) themeColor.setAttribute('content', resolved === 'dark' ? '#050914' : '#f4f6fb');
  if (button) {
    const next = nextPreference(chosen);
    const visible = `${label(next)} appearance`;
    button.textContent = visible;
    button.setAttribute('aria-label', `${visible}. Current appearance: ${label(chosen)}${chosen === 'system' ? ` (${label(resolved)} now)` : ''}.`);
  }
}

apply();
button?.addEventListener('click', () => {
  const current = read();
  const next = nextPreference(current);
  write(next);
  apply(next);
});
systemQuery?.addEventListener?.('change', () => {
  if (read() === 'system') apply('system');
});
