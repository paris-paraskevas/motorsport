import 'server-only';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import {
  DEFAULT_THEME_KEY,
  SHIPPED_THEME_SET,
  THEME_KEY,
  THEME_LABEL_MAX,
  isShippedThemeKey,
  parseThemeTokens,
  shippedTheme,
  type ThemeOption,
  type ThemeSet,
} from './theme-defaults';

export {
  CONTRAST_CHECKS,
  DEFAULT_THEME_KEY,
  SHIPPED_THEME_KEYS,
  SHIPPED_THEME_SET,
  SHIPPED_THEMES,
  THEME_KEY,
  THEME_LABEL_MAX,
  THEME_TOKEN_KEYS,
  THEME_TOKEN_LABELS,
  contrastProblems,
  isShippedThemeKey,
  parseThemeTokens,
  pickableThemes,
  resolveThemeAttributes,
  shippedTheme,
  themeContrast,
  themeCss,
  themeKeyFromLabel,
  themeOption,
} from './theme-defaults';
export type { ShippedThemeKey, ThemeFamily, ThemeOption, ThemeSet, ThemeTokenKey, ThemeTokens } from './theme-defaults';

// Themes (APEX: Themes), read from the `theme` rows for this application: which
// of the six shipped looks a visitor gets before choosing, which looks may be
// picked at all, and the operator's own themes with their nine colours. Phase 2
// step 7 of the designer plan; the rows are seeded by migration 20260908190000.
//
// THE RULE THIS FILE ENFORCES: the code's six themes with Paper as the default
// are the fallback for every failure. An unconfigured database, a missing table,
// a query error or an empty table all read as exactly what the site shipped, and
// a custom row the parser cannot use (no base, no label, a colour that is not
// #rrggbb) is left out rather than guessed at. A row can never blank the page.
//
// Writes go through app/api/admin/design/themes/* only: the default through the
// database function design_set_default_theme(), everything else as one
// conditional statement per row on the stamp the caller loaded.

const APPLICATION_KEY = 'paddock';

/** Coerce rows into the set. Shipped themes take availability and the default
 *  flag from their rows; a custom row needs a shipped base, a label and nine
 *  colours. The default is the row flagged, when it is known and available;
 *  else Paper. Shipped first in their order, then the operator's by label. */
export function themeSetFromRows(rows: unknown): ThemeSet {
  const shipped: ThemeOption[] = SHIPPED_THEME_SET.themes.map(t => ({ ...t, isDefault: false }));
  const custom: ThemeOption[] = [];
  let flagged: string | null = null;
  if (Array.isArray(rows)) {
    for (const item of rows) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      if (typeof row.key !== 'string') continue;
      const available = row.available !== false;
      if (isShippedThemeKey(row.key)) {
        const t = shipped.find(s => s.key === row.key)!;
        t.available = available;
        if (row.is_default === true) flagged = row.key;
        continue;
      }
      if (!THEME_KEY.test(row.key) || !isShippedThemeKey(row.base)) continue;
      const label = typeof row.label === 'string' ? row.label.trim().slice(0, THEME_LABEL_MAX) : '';
      if (!label) continue;
      const tokens = parseThemeTokens(row.tokens);
      if (!tokens) continue;
      const base = shippedTheme(row.base);
      custom.push({ key: row.key, label, hint: `On ${base.label}`, family: base.family, base: base.key, tokens, available, isDefault: false });
      if (row.is_default === true) flagged = row.key;
    }
  }
  custom.sort((a, b) => a.label.localeCompare(b.label));
  const themes = [...shipped, ...custom];
  const defaultKey = flagged && themes.some(t => t.key === flagged && t.available) ? flagged : DEFAULT_THEME_KEY;
  for (const t of themes) t.isDefault = t.key === defaultKey;
  return { defaultKey, themes };
}

const MEMO_MS = 60_000;
let memo: { at: number; value: ThemeSet } | null = null;

export function resetThemesMemo(): void {
  memo = null;
}

/** The set for the site: the layout, the pre-paint script, the picker. Never throws. */
export async function loadThemeSet(): Promise<ThemeSet> {
  if (!isBettingConfigured()) return SHIPPED_THEME_SET;
  if (memo && Date.now() - memo.at < MEMO_MS) return memo.value;
  try {
    const { data, error } = await betDb()
      .from('theme')
      .select('key, label, tokens, is_default, available, base')
      .eq('application_key', APPLICATION_KEY);
    if (error || !data || data.length === 0) return SHIPPED_THEME_SET;
    const value = themeSetFromRows(data);
    memo = { at: Date.now(), value };
    return value;
  } catch {
    return SHIPPED_THEME_SET;
  }
}

/** A theme as the editor sees it. `shipped` themes keep their colours in the
 *  stylesheet and offer only their availability and the default; a theme the
 *  operator made offers everything. `updatedAt` is the row's stamp exactly as
 *  PostgREST sent it (microseconds intact); null when the row does not exist,
 *  in which case the editor shows the shipped theme and cannot save it. */
export interface EditableTheme extends ThemeOption {
  shipped: boolean;
  updatedAt: string | null;
}

/** Every theme with its row's stamp, or the shipped six with none. Null on any failure. */
export async function loadThemesForEditing(): Promise<EditableTheme[] | null> {
  if (!isBettingConfigured()) return null;
  try {
    const { data, error } = await betDb()
      .from('theme')
      .select('key, label, tokens, is_default, available, base, updated_at')
      .eq('application_key', APPLICATION_KEY);
    if (error) return null;
    const rows = (data ?? []) as Record<string, unknown>[];
    const set = rows.length === 0 ? SHIPPED_THEME_SET : themeSetFromRows(rows);
    const stampOf = new Map<string, string | null>();
    for (const row of rows) {
      if (typeof row.key === 'string') stampOf.set(row.key, row.updated_at != null ? String(row.updated_at) : null);
    }
    return set.themes.map(t => ({ ...t, shipped: t.base === null, updatedAt: stampOf.get(t.key) ?? null }));
  } catch {
    return null;
  }
}

export { APPLICATION_KEY as THEME_APPLICATION_KEY };
