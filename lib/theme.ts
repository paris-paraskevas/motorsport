/* Shared theme store — extracted from ThemePicker so the header toggle and the
   settings picker drive ONE mechanism (two real consumers, hence the module).
   localStorage IS the store; there is no server state, so guests theme too.
   The token blocks themselves live in app/globals.css as :root[data-theme=…].

   Keys must stay in sync across three places (see ThemeScript.tsx): the `var K`
   allowlist in the inline no-flash script, THEMES below, and the
   :root[data-theme=…] blocks in globals.css. */
import { THEME_STORAGE_KEY } from '@/components/theme/ThemeScript';

// Palette metadata for previews and for the dark/light classification only —
// the live values are the token blocks in globals.css (WCAG-gated there).
export const THEMES = [
  { key: 'midnight', label: 'Midnight', hint: 'Classic dark. The default', bg: '#07070a', surface: '#14141a', text: '#f5f5f7', accent: '#ffb400', dark: true },
  { key: 'carbon', label: 'Carbon', hint: 'Cool graphite. Night races', bg: '#060a12', surface: '#111721', text: '#f0f4f9', accent: '#ffb400', dark: true },
  { key: 'ember', label: 'Ember', hint: 'Amber instrument. Evening', bg: '#0c0a05', surface: '#1a140a', text: '#f8f1e7', accent: '#ffb400', dark: true },
  { key: 'newsprint', label: 'Newsprint', hint: 'Paper light. Long reads', bg: '#f7f3e8', surface: '#fbf7ec', text: '#1e1a13', accent: '#7d5300', dark: false },
  { key: 'circuit', label: 'Circuit', hint: 'High contrast. Daylight', bg: '#f4f4f5', surface: '#ffffff', text: '#09090b', accent: '#7d5300', dark: false },
] as const;

export type ThemeKey = (typeof THEMES)[number]['key'];
export type ThemeChoice = ThemeKey | 'system';

/** Remembers the last pick per family so a header flip out of Carbon and back
    returns to Carbon, not to Midnight. */
const LAST_DARK_KEY = 'paddock:theme-last-dark';
const LAST_LIGHT_KEY = 'paddock:theme-last-light';

// Same-tab picks dispatch this so useSyncExternalStore re-reads; cross-tab
// picks arrive via the native storage event.
export const CHANGE_EVENT = 'paddock:theme-change';

export function systemResolved(): ThemeKey {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'midnight' : 'newsprint';
}

export function applyTheme(choice: ThemeChoice) {
  const resolved = choice === 'system' ? systemResolved() : choice;
  const def = THEMES.find(t => t.key === resolved) ?? THEMES[0];
  const el = document.documentElement;
  el.dataset.theme = def.key;
  el.classList.toggle('dark', def.dark);
  // PWA / mobile address bar follows the active chassis.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', def.bg);
}

export function readChoice(): ThemeChoice {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'system' || THEMES.some(t => t.key === stored)) return stored as ThemeChoice;
  return 'midnight';
}

export function subscribe(onStoreChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  window.addEventListener('storage', onStoreChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
    window.removeEventListener('storage', onStoreChange);
  };
}

/** Persist + apply + notify. Every write goes through here so the picker and
    the header toggle can never drift apart in the same tab. */
export function setChoice(next: ThemeChoice) {
  localStorage.setItem(THEME_STORAGE_KEY, next);
  if (next !== 'system') {
    const def = THEMES.find(t => t.key === next);
    if (def) localStorage.setItem(def.dark ? LAST_DARK_KEY : LAST_LIGHT_KEY, def.key);
  }
  applyTheme(next);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** True when the given choice renders a dark chassis ('system' resolves first). */
export function isDark(choice: ThemeChoice): boolean {
  const resolved = choice === 'system' ? systemResolved() : choice;
  return THEMES.find(t => t.key === resolved)?.dark ?? true;
}

function remembered(key: string, fallback: ThemeKey, wantDark: boolean): ThemeKey {
  const stored = localStorage.getItem(key);
  const def = THEMES.find(t => t.key === stored);
  return def && def.dark === wantDark ? def.key : fallback;
}

/** Flip to the other family, restoring that family's last explicit pick. */
export function toggleLightDark() {
  setChoice(
    isDark(readChoice())
      ? remembered(LAST_LIGHT_KEY, 'newsprint', false)
      : remembered(LAST_DARK_KEY, 'midnight', true),
  );
}
