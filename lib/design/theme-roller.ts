import { DEFAULT_THEME_KEY, THEME_TOKEN_KEYS, contrastProblems, isShippedThemeKey, shippedTheme, themeCss, themeDeclarations, type ThemeOption, type ThemeTokenKey, type ThemeTokens } from './theme-defaults';
import { normaliseHex } from './contrast';
import { THEME_CHANGE_EVENT, THEME_STORAGE_KEY } from '@/components/theme/ThemeScript';

// The Theme Roller's state and its writes to the page (P1.8; APEX: the Theme
// Roller dialog over a running page, opened from the Developer Toolbar's
// Customize menu). The component (components/page/ThemeRoller.tsx) keeps the
// fetches and the markup; this module keeps the edits with their undo and redo,
// the preview, the tab's switch to a saved theme, and what Save and Save as new
// theme wait for. Client-safe: nothing here reaches the server.

export interface RollerState {
  tokens: ThemeTokens;
  /** Earlier states, the latest last; Undo takes the last. */
  past: ThemeTokens[];
  /** States undone, the next first; Redo takes the first. An edit empties it. */
  future: ThemeTokens[];
}

export function startRoller(tokens: ThemeTokens): RollerState {
  return { tokens: { ...tokens }, past: [], future: [] };
}

/** One token set to a #rrggbb value (case folded). Any other value, or the value it already has, leaves the state as it is. */
export function editToken(s: RollerState, key: ThemeTokenKey, value: string): RollerState {
  const hex = normaliseHex(value);
  if (!hex || s.tokens[key] === hex) return s;
  return { tokens: { ...s.tokens, [key]: hex }, past: [...s.past, s.tokens], future: [] };
}

export function undo(s: RollerState): RollerState {
  if (s.past.length === 0) return s;
  return { tokens: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.tokens, ...s.future] };
}

export function redo(s: RollerState): RollerState {
  if (s.future.length === 0) return s;
  return { tokens: s.future[0], past: [...s.past, s.tokens], future: s.future.slice(1) };
}

/** Back to the stored colours, as one more step Undo can take back. */
export function resetTo(s: RollerState, tokens: ThemeTokens): RollerState {
  return { tokens: { ...tokens }, past: [...s.past, s.tokens], future: [] };
}

export function isDirty(s: RollerState, stored: ThemeTokens): boolean {
  return THEME_TOKEN_KEYS.some(k => s.tokens[k] !== stored[k]);
}

/** The theme this tab runs, read from <html> after the pre-paint script and the
 *  picker: the operator's key when one is on, else the shipped key, else the
 *  code's default. A 'system' choice has already resolved to midnight or paper. */
export function runningThemeKey(root: { dataset: { theme?: string; themeCustom?: string } }): string {
  return root.dataset.themeCustom || root.dataset.theme || DEFAULT_THEME_KEY;
}

interface StyleHost {
  style: { setProperty(name: string, value: string): void; removeProperty(name: string): void };
}

/** The names the preview writes: exactly what a custom theme's rule declares. */
const DECLARATION_NAMES = themeDeclarations(shippedTheme(DEFAULT_THEME_KEY).tokens).map(([name]) => name);

/** The preview: the theme's declarations as inline custom properties on <html>,
 *  which win over every rule of the stylesheet and of #paddock-themes; this tab
 *  only, nothing stored. */
export function applyPreview(root: StyleHost, tokens: ThemeTokens): void {
  for (const [name, value] of themeDeclarations(tokens)) root.style.setProperty(name, value);
}

export function clearPreview(root: StyleHost): void {
  for (const name of DECLARATION_NAMES) root.style.removeProperty(name);
}

/** After a save, the tab runs the saved theme as a visitor picking it would
 *  (ThemePicker's applyTheme): the shipped base's block, the operator's key, the
 *  dark class, the address-bar colour, the stored choice, and one rule for the
 *  key so the page renders the theme before the layout's set carries it (the
 *  themes memo lasts a minute). The preview goes: the theme itself paints now. */
export function switchTab(doc: Document, theme: ThemeOption): void {
  const root = doc.documentElement;
  const base = theme.base ?? (isShippedThemeKey(theme.key) ? theme.key : DEFAULT_THEME_KEY);
  root.dataset.theme = base;
  if (theme.base) root.dataset.themeCustom = theme.key;
  else delete root.dataset.themeCustom;
  root.classList.toggle('dark', theme.family === 'dark');
  doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.tokens.bg);
  if (theme.base) {
    let style = doc.querySelector<HTMLStyleElement>('style[data-theme-roller]');
    if (!style) {
      style = doc.createElement('style');
      style.setAttribute('data-theme-roller', '');
      doc.head.appendChild(style);
    }
    style.textContent = themeCss({ defaultKey: theme.key, themes: [theme] });
  }
  try {
    doc.defaultView?.localStorage.setItem(THEME_STORAGE_KEY, theme.key);
  } catch {
    /* no storage: the choice lives for the page's life */
  }
  doc.defaultView?.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  clearPreview(root);
}

export interface SaveState {
  /** Save keeps a theme of the operator's own: changed and through the gate. */
  save: boolean;
  /** Save as new theme: changed, named and through the gate, on any base. */
  saveAs: boolean;
  /** The gate's refusals, empty when the colours pass. */
  problems: string[];
  /** The line under the buttons: the refusal, or what is still wanted. */
  reason: string;
}

export function saveState(s: RollerState, stored: ThemeTokens, running: { shipped: boolean }, label: string): SaveState {
  const problems = contrastProblems(s.tokens);
  const dirty = isDirty(s, stored);
  const named = label.trim().length > 0;
  const save = !running.shipped && dirty && problems.length === 0;
  const saveAs = dirty && problems.length === 0 && named;
  let reason: string;
  if (problems.length > 0) reason = `The gate refuses: ${problems.join('; ')}. Saving is off until it passes.`;
  else if (!dirty) {
    reason = running.shipped
      ? 'Move a picker to begin. A shipped theme keeps its colours in the stylesheet, so a change becomes a new theme on this base.'
      : 'Move a picker to begin. Save keeps this theme; Save as new theme copies it under a name.';
  } else if (running.shipped) reason = named ? 'The gate passes. Save as new theme creates it on this base; this tab runs it then.' : 'The gate passes. Name the new theme to save it on this base.';
  else reason = named ? 'The gate passes. Save keeps this theme; Save as new theme copies it under the name.' : 'The gate passes. Save keeps this theme; name it to save a copy instead.';
  return { save, saveAs, problems, reason };
}
