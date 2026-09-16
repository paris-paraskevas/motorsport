import { contrastRatio, formatRatio, isHexColour } from './contrast';

// Themes (APEX: Themes): the six looks the site ships, as the picker, the
// pre-paint script and the designer see them, plus what a theme the operator
// adds looks like. Client-safe: the picker and the pre-paint script render from
// this, the server loader (themes.ts) falls back to it.
//
// A shipped theme's live colours are the `:root[data-theme=…]` blocks in
// app/globals.css; the tokens here are a COPY of the nine an operator may set
// on a theme of their own, kept in sync by hand (the picker carried four of them
// before). A custom theme is a shipped theme (its "base", which decides the
// colour scheme, the dark family and the light themes' per-element tint rule)
// plus these nine tokens, applied by a generated style block on
// `:root[data-theme-custom=<key>]`.

export const THEME_TOKEN_KEYS = [
  'bg',
  'surface',
  'surfaceElevated',
  'border',
  'borderStrong',
  'text',
  'textMuted',
  'textFaint',
  'accent',
] as const;
export type ThemeTokenKey = (typeof THEME_TOKEN_KEYS)[number];
export type ThemeTokens = Record<ThemeTokenKey, string>;

/** What each token paints, in the operator's words. */
export const THEME_TOKEN_LABELS: Record<ThemeTokenKey, { label: string; paints: string }> = {
  bg: { label: 'Page', paints: 'the page behind everything' },
  surface: { label: 'Card', paints: 'boxes, cards and the header' },
  surfaceElevated: { label: 'Raised', paints: 'menus and panels that sit on a card' },
  border: { label: 'Hairline', paints: 'thin rules between things' },
  borderStrong: { label: 'Rule', paints: 'strong rules, button edges' },
  text: { label: 'Text', paints: 'body text' },
  textMuted: { label: 'Muted text', paints: 'secondary text' },
  textFaint: { label: 'Faint text', paints: 'labels, hints, timestamps' },
  accent: { label: 'Accent', paints: 'links, highlights, the brand colour' },
};

export type ThemeFamily = 'dark' | 'light';

export const SHIPPED_THEME_KEYS = ['midnight', 'carbon', 'ember', 'newsprint', 'paper', 'circuit'] as const;
export type ShippedThemeKey = (typeof SHIPPED_THEME_KEYS)[number];

export interface ShippedTheme {
  key: ShippedThemeKey;
  label: string;
  hint: string;
  family: ThemeFamily;
  tokens: ThemeTokens;
}

export const SHIPPED_THEMES: readonly ShippedTheme[] = [
  {
    key: 'midnight',
    label: 'Midnight',
    hint: 'Classic dark. Night races',
    family: 'dark',
    tokens: { bg: '#121215', surface: '#1b1b21', surfaceElevated: '#222229', border: '#30303b', borderStrong: '#40404d', text: '#e4e4e8', textMuted: '#a1a1aa', textFaint: '#8a8a94', accent: '#ffb400' },
  },
  {
    key: 'carbon',
    label: 'Carbon',
    hint: 'Cool graphite. Night races',
    family: 'dark',
    tokens: { bg: '#060a12', surface: '#111721', surfaceElevated: '#171e2a', border: '#2b3442', borderStrong: '#3e4a5c', text: '#f0f4f9', textMuted: '#9dabbc', textFaint: '#8291a4', accent: '#ffb400' },
  },
  {
    key: 'ember',
    label: 'Ember',
    hint: 'Amber instrument. Evening',
    family: 'dark',
    tokens: { bg: '#0c0a05', surface: '#1a140a', surfaceElevated: '#251d0f', border: '#3e321c', borderStrong: '#554524', text: '#f8f1e7', textMuted: '#c0ab85', textFaint: '#9a8760', accent: '#ffb400' },
  },
  {
    key: 'newsprint',
    label: 'Newsprint',
    hint: 'Paper light. Long reads',
    family: 'light',
    tokens: { bg: '#f7f3e8', surface: '#fbf7ec', surfaceElevated: '#fffcf2', border: '#d6cebb', borderStrong: '#a99c80', text: '#1e1a13', textMuted: '#5b5342', textFaint: '#6f6752', accent: '#7d5300' },
  },
  {
    key: 'paper',
    label: 'Paper',
    hint: 'Editorial',
    family: 'light',
    tokens: { bg: '#f7f3e8', surface: '#fbf7ec', surfaceElevated: '#fffcf2', border: '#c2b493', borderStrong: '#91825e', text: '#1e1a13', textMuted: '#5b5342', textFaint: '#6f6752', accent: '#8c1c13' },
  },
  {
    key: 'circuit',
    label: 'Circuit',
    hint: 'High contrast. Daylight',
    family: 'light',
    tokens: { bg: '#f4f4f5', surface: '#ffffff', surfaceElevated: '#fafafa', border: '#52525b', borderStrong: '#18181b', text: '#09090b', textMuted: '#3f3f46', textFaint: '#565661', accent: '#7d5300' },
  },
];

/** The default for a visitor who has not chosen (operator, 2026-08-19), and the
 *  fallback when the rows cannot be read. */
export const DEFAULT_THEME_KEY: ShippedThemeKey = 'paper';

export const THEME_LABEL_MAX = 40;
export const THEME_KEY = /^[a-z0-9][a-z0-9-]{0,39}$/;

export function isShippedThemeKey(key: unknown): key is ShippedThemeKey {
  return typeof key === 'string' && (SHIPPED_THEME_KEYS as readonly string[]).includes(key);
}

export function shippedTheme(key: ShippedThemeKey): ShippedTheme {
  return SHIPPED_THEMES.find(t => t.key === key)!;
}

/** A theme as the site, the picker and the pre-paint script see it. Shipped
 *  themes have no base; a custom theme names the shipped theme it builds on. */
export interface ThemeOption {
  key: string;
  label: string;
  hint: string;
  family: ThemeFamily;
  base: ShippedThemeKey | null;
  tokens: ThemeTokens;
  available: boolean;
  isDefault: boolean;
}

export interface ThemeSet {
  defaultKey: string;
  /** Shipped first in their order, then the operator's, by label. */
  themes: ThemeOption[];
}

/** What the code ships: the six, all available, Paper the default. */
export const SHIPPED_THEME_SET: ThemeSet = {
  defaultKey: DEFAULT_THEME_KEY,
  themes: SHIPPED_THEMES.map(t => ({
    key: t.key,
    label: t.label,
    hint: t.hint,
    family: t.family,
    base: null,
    tokens: t.tokens,
    available: true,
    isDefault: t.key === DEFAULT_THEME_KEY,
  })),
};

export function themeOption(set: ThemeSet, key: string): ThemeOption | undefined {
  return set.themes.find(t => t.key === key);
}

/** The themes a visitor may pick: the available ones, the default always among them. */
export function pickableThemes(set: ThemeSet): ThemeOption[] {
  return set.themes.filter(t => t.available || t.key === set.defaultKey);
}

/** What the <html> element carries for a theme: the shipped theme whose CSS
 *  block applies (`data-theme`), the custom key when one overrides it
 *  (`data-theme-custom`), and whether the dark class is on. An unknown key is
 *  the set's default. */
export function resolveThemeAttributes(
  set: ThemeSet,
  key: string,
): { dataTheme: ShippedThemeKey; custom: string | null; dark: boolean } {
  const option = themeOption(set, key) ?? themeOption(set, set.defaultKey) ?? SHIPPED_THEME_SET.themes[4];
  const dataTheme = option.base ?? (isShippedThemeKey(option.key) ? option.key : DEFAULT_THEME_KEY);
  return { dataTheme, custom: option.base ? option.key : null, dark: option.family === 'dark' };
}

const CSS_TOKEN: Record<ThemeTokenKey, string> = {
  bg: '--bg',
  surface: '--surface',
  surfaceElevated: '--surface-elevated',
  border: '--border',
  borderStrong: '--border-strong',
  text: '--text',
  textMuted: '--text-muted',
  textFaint: '--text-faint',
  accent: '--brand',
};

/** What a custom theme declares: the nine tokens as the stylesheet's custom
 *  properties, then the three the stylesheet derives from them. One list, so
 *  the style block (themeCss) and the Theme Roller's live preview (P1.8) can
 *  never disagree. */
export function themeDeclarations(tokens: ThemeTokens): [string, string][] {
  const decls: [string, string][] = THEME_TOKEN_KEYS.map(k => [CSS_TOKEN[k], tokens[k]]);
  decls.push(['--brand-fill', tokens.accent], ['--numeral', tokens.text], ['--tint-contrast', tokens.bg]);
  return decls;
}

/** The style block that makes the operator's themes real: one rule per custom
 *  theme on `:root[data-theme-custom=<key>]`, later in the document than the
 *  stylesheet so it wins at equal specificity. The base theme's block keeps
 *  supplying everything not listed here (signals, colour scheme, the light
 *  themes' tint rule). Empty when there is no custom theme. */
export function themeCss(set: ThemeSet): string {
  return set.themes
    .filter(t => t.base !== null)
    .map(t => `:root[data-theme-custom='${t.key}']{${themeDeclarations(t.tokens).map(([name, value]) => `${name}:${value}`).join(';')}}`)
    .join('\n');
}

/** A key from a label: lower case, hyphens, nothing else. Empty when nothing
 *  survives. Never a shipped key: those are the code's. */
export function themeKeyFromLabel(label: string): string {
  const key = label
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return isShippedThemeKey(key) ? `${key}-2` : key;
}

/** Nine colours, all #rrggbb, or null. */
export function parseThemeTokens(raw: unknown): ThemeTokens | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const out = {} as ThemeTokens;
  for (const k of THEME_TOKEN_KEYS) {
    if (!isHexColour(r[k])) return null;
    out[k] = (r[k] as string).toLowerCase();
  }
  return out;
}

/** The contrast gate (field guide §02: "refuses a default below 4.5:1"), applied
 *  to every theme saved: body text on the page, muted text on a card and faint
 *  text on a raised panel at 4.5:1 (WCAG AA for text), the accent on the page at
 *  3:1 (AA for large text and controls). The six shipped themes pass it. */
export const CONTRAST_CHECKS: { id: string; label: string; fg: ThemeTokenKey; bg: ThemeTokenKey; min: number }[] = [
  { id: 'text', label: 'Text on the page', fg: 'text', bg: 'bg', min: 4.5 },
  { id: 'muted', label: 'Muted text on a card', fg: 'textMuted', bg: 'surface', min: 4.5 },
  { id: 'faint', label: 'Faint text on a raised panel', fg: 'textFaint', bg: 'surfaceElevated', min: 4.5 },
  { id: 'accent', label: 'Accent on the page', fg: 'accent', bg: 'bg', min: 3 },
];

export interface ContrastResult {
  id: string;
  label: string;
  ratio: number;
  min: number;
  pass: boolean;
}

export function themeContrast(tokens: ThemeTokens): ContrastResult[] {
  return CONTRAST_CHECKS.map(c => {
    const ratio = contrastRatio(tokens[c.fg], tokens[c.bg]);
    return { id: c.id, label: c.label, ratio, min: c.min, pass: ratio >= c.min };
  });
}

/** The gate's refusals in plain words; empty when the theme passes. */
export function contrastProblems(tokens: ThemeTokens): string[] {
  return themeContrast(tokens)
    .filter(r => !r.pass)
    .map(r => `${r.label} is ${formatRatio(r.ratio)}, below ${formatRatio(r.min)}`);
}
