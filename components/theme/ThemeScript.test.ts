import { describe, expect, it } from 'vitest';
import { SHIPPED_THEME_SET, type ThemeSet } from '@/lib/design/theme-defaults';
import { themeInitScript } from './ThemeScript';

// The pre-paint script is generated from the theme set, so these cases pin
// what a visitor's browser runs: the shipped keys, the default for no choice,
// and a custom theme mapped to its base with its own key beside it.

const SUNSET: ThemeSet = {
  defaultKey: 'sunset',
  themes: [
    ...SHIPPED_THEME_SET.themes.map(t => ({ ...t, isDefault: false, available: t.key !== 'ember' })),
    {
      key: 'sunset',
      label: 'Sunset',
      hint: 'On Midnight',
      family: 'dark',
      base: 'midnight',
      tokens: SHIPPED_THEME_SET.themes[0].tokens,
      available: true,
      isDefault: true,
    },
  ],
};

describe('themeInitScript', () => {
  it('ships the six keys mapped to themselves, the three dark ones marked, Paper as the fallback', () => {
    const s = themeInitScript(SHIPPED_THEME_SET);
    expect(s).toContain('var K={"midnight":"midnight","carbon":"carbon","ember":"ember","newsprint":"newsprint","paper":"paper","circuit":"circuit"}');
    expect(s).toContain('D={"midnight":1,"carbon":1,"ember":1}');
    expect(s).toContain('C={}');
    expect(s).toContain('F="paper"');
    expect(s).toContain("localStorage.getItem('paddock:theme')");
  });

  it('maps a custom theme to its base, marks it custom and dark, leaves out an unavailable shipped theme, and falls back to the set default', () => {
    const s = themeInitScript(SUNSET);
    expect(s).toContain('"sunset":"midnight"');
    expect(s).not.toContain('"ember":"ember"');
    expect(s).toContain('C={"sunset":1}');
    expect(s).toMatch(/D=\{[^}]*"sunset":1/);
    expect(s).toContain('F="sunset"');
    expect(s).toContain("if(C[r])d.dataset.themeCustom=r;else delete d.dataset.themeCustom;");
  });
});
