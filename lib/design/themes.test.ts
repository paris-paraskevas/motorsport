import { beforeEach, describe, expect, it, vi } from 'vitest';

let configured = true;
let result: { data: unknown; error: { message: string } | null } = { data: [], error: null };
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => configured,
  betDb: () => ({
    from: () => {
      const q = {
        select: () => q,
        eq: () => q,
        in: () => q,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject),
      };
      return q;
    },
  }),
}));

import {
  SHIPPED_THEMES,
  SHIPPED_THEME_SET,
  contrastProblems,
  loadThemeSet,
  loadThemesForEditing,
  pickableThemes,
  resetThemesMemo,
  resolveThemeAttributes,
  themeContrast,
  themeCss,
  themeKeyFromLabel,
  themeSetFromRows,
} from './themes';
import { contrastRatio, formatRatio, isHexColour } from './contrast';

const STAMP = '2026-09-08T11:30:00.505502+00:00';
const SUNSET = {
  bg: '#1a0f1f',
  surface: '#26172d',
  surfaceElevated: '#31203a',
  border: '#4a3355',
  borderStrong: '#66477a',
  text: '#f6ecf9',
  textMuted: '#c9b3d2',
  textFaint: '#a892b2',
  accent: '#ff9f43',
};
const seeded = SHIPPED_THEMES.map(t => ({ key: t.key, label: t.label, tokens: {}, is_default: t.key === 'paper', available: true, base: null, updated_at: STAMP }));
const sunsetRow = { key: 'sunset', label: 'Sunset', tokens: SUNSET, is_default: false, available: true, base: 'midnight', updated_at: STAMP };

describe('contrast', () => {
  it('computes WCAG ratios: white on black is 21:1, a colour on itself 1:1', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 2);
    expect(contrastRatio('#8c1c13', '#8c1c13')).toBeCloseTo(1, 5);
    expect(formatRatio(4.62)).toBe('4.6:1');
    expect(isHexColour('#FFB400')).toBe(true);
    expect(isHexColour('#fb4')).toBe(false);
    expect(isHexColour('ffb400')).toBe(false);
  });

  it('every shipped theme passes the gate, and a grey-on-grey theme fails it', () => {
    for (const t of SHIPPED_THEMES) expect(contrastProblems(t.tokens), t.key).toEqual([]);
    const faint = { ...SUNSET, text: '#777777', bg: '#666666' };
    const problems = contrastProblems(faint);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems[0]).toMatch(/Text on the page is 1\.\d:1, below 4\.5:1/);
    expect(themeContrast(SUNSET).every(r => r.pass)).toBe(true);
  });
});

describe('themeSetFromRows — the six shipped themes are the fallback', () => {
  it('is the shipped set for anything that is not an array', () => {
    expect(themeSetFromRows(null)).toEqual(SHIPPED_THEME_SET);
    expect(SHIPPED_THEME_SET.defaultKey).toBe('paper');
    expect(SHIPPED_THEME_SET.themes.map(t => t.key)).toEqual(['midnight', 'carbon', 'ember', 'newsprint', 'paper', 'circuit']);
  });

  it('takes availability and the default from the shipped rows, and adds a usable custom theme after them', () => {
    const set = themeSetFromRows([
      ...seeded.map(r => (r.key === 'paper' ? { ...r, is_default: false } : r.key === 'midnight' ? { ...r, is_default: true } : r.key === 'circuit' ? { ...r, available: false } : r)),
      sunsetRow,
    ]);
    expect(set.defaultKey).toBe('midnight');
    expect(set.themes.map(t => t.key)).toEqual(['midnight', 'carbon', 'ember', 'newsprint', 'paper', 'circuit', 'sunset']);
    expect(set.themes.find(t => t.key === 'circuit')?.available).toBe(false);
    const sunset = set.themes.find(t => t.key === 'sunset')!;
    expect(sunset).toMatchObject({ label: 'Sunset', base: 'midnight', family: 'dark', hint: 'On Midnight', available: true, isDefault: false });
    expect(set.themes.filter(t => t.isDefault).map(t => t.key)).toEqual(['midnight']);
  });

  it('leaves out a custom row without a shipped base, a label or nine colours, and falls back to Paper when the flagged default is unusable', () => {
    const set = themeSetFromRows([
      ...seeded.map(r => ({ ...r, is_default: false })),
      { ...sunsetRow, key: 'nobase', base: 'sunset' },
      { ...sunsetRow, key: 'nolabel', label: '  ' },
      { ...sunsetRow, key: 'badhex', tokens: { ...SUNSET, accent: 'orange' } },
      { ...sunsetRow, key: 'Bad Key' },
      { ...sunsetRow, key: 'hidden', available: false, is_default: true },
    ]);
    expect(set.themes.map(t => t.key)).toEqual(['midnight', 'carbon', 'ember', 'newsprint', 'paper', 'circuit', 'hidden']);
    expect(set.defaultKey).toBe('paper');
    expect(set.themes.find(t => t.key === 'paper')?.isDefault).toBe(true);
  });
});

describe('what the html element and the style block carry', () => {
  const set = themeSetFromRows([...seeded, sunsetRow, { ...sunsetRow, key: 'dawn', label: 'Dawn', base: 'paper' }]);

  it('resolves a shipped theme to itself, a custom theme to its base with the custom key, and an unknown key to the default', () => {
    expect(resolveThemeAttributes(set, 'carbon')).toEqual({ dataTheme: 'carbon', custom: null, dark: true });
    expect(resolveThemeAttributes(set, 'sunset')).toEqual({ dataTheme: 'midnight', custom: 'sunset', dark: true });
    expect(resolveThemeAttributes(set, 'dawn')).toEqual({ dataTheme: 'paper', custom: 'dawn', dark: false });
    expect(resolveThemeAttributes(set, 'nope')).toEqual({ dataTheme: 'paper', custom: null, dark: false });
  });

  it('writes one rule per custom theme with the nine tokens and the three derived ones, nothing for the shipped six', () => {
    expect(themeCss(SHIPPED_THEME_SET)).toBe('');
    const css = themeCss(set);
    expect(css.split('\n')).toHaveLength(2);
    expect(css).toContain(":root[data-theme-custom='sunset']{--bg:#1a0f1f;--surface:#26172d;--surface-elevated:#31203a;--border:#4a3355;--border-strong:#66477a;--text:#f6ecf9;--text-muted:#c9b3d2;--text-faint:#a892b2;--brand:#ff9f43;--brand-fill:#ff9f43;--numeral:#f6ecf9;--tint-contrast:#1a0f1f}");
  });

  it('offers the available themes and always the default', () => {
    const hidden = themeSetFromRows([...seeded.map(r => (r.key === 'paper' ? { ...r, available: false } : r))]);
    expect(pickableThemes(hidden).map(t => t.key)).toContain('paper');
    expect(pickableThemes(themeSetFromRows([...seeded.map(r => (r.key === 'ember' ? { ...r, available: false } : r))])).map(t => t.key)).not.toContain('ember');
  });

  it('makes a key from a label and never a shipped one', () => {
    expect(themeKeyFromLabel('  Sunset Orange! ')).toBe('sunset-orange');
    expect(themeKeyFromLabel('Café Noir')).toBe('cafe-noir');
    expect(themeKeyFromLabel('Paper')).toBe('paper-2');
    expect(themeKeyFromLabel('***')).toBe('');
  });
});

describe('loadThemeSet', () => {
  beforeEach(() => {
    configured = true;
    result = { data: [], error: null };
    resetThemesMemo();
  });

  it('is the shipped set when unconfigured, on error, and on an empty table', async () => {
    configured = false;
    expect(await loadThemeSet()).toEqual(SHIPPED_THEME_SET);
    configured = true;
    result = { data: null, error: { message: 'boom' } };
    expect(await loadThemeSet()).toEqual(SHIPPED_THEME_SET);
    result = { data: [], error: null };
    expect(await loadThemeSet()).toEqual(SHIPPED_THEME_SET);
  });

  it('reads rows, memoises for a minute, forgets on reset', async () => {
    result = { data: seeded.map(r => ({ ...r, is_default: r.key === 'ember' })), error: null };
    expect((await loadThemeSet()).defaultKey).toBe('ember');
    result = { data: seeded, error: null };
    expect((await loadThemeSet()).defaultKey).toBe('ember');
    resetThemesMemo();
    expect((await loadThemeSet()).defaultKey).toBe('paper');
  });
});

describe('loadThemesForEditing', () => {
  beforeEach(() => {
    configured = true;
    result = { data: [], error: null };
  });

  it('lists the shipped six with their stamps and a custom theme after them', async () => {
    result = { data: [...seeded, sunsetRow], error: null };
    const rows = await loadThemesForEditing();
    expect(rows?.map(r => r.key)).toEqual(['midnight', 'carbon', 'ember', 'newsprint', 'paper', 'circuit', 'sunset']);
    expect(rows?.[4]).toMatchObject({ key: 'paper', shipped: true, isDefault: true, updatedAt: STAMP });
    expect(rows?.[6]).toMatchObject({ key: 'sunset', shipped: false, base: 'midnight', updatedAt: STAMP });
  });

  it('shows the shipped six with no stamp when the table holds nothing, and is null when unconfigured or on error', async () => {
    const rows = await loadThemesForEditing();
    expect(rows).toHaveLength(6);
    expect(rows?.every(r => r.updatedAt === null && r.shipped)).toBe(true);
    configured = false;
    expect(await loadThemesForEditing()).toBeNull();
    configured = true;
    result = { data: null, error: { message: 'boom' } };
    expect(await loadThemesForEditing()).toBeNull();
  });
});
