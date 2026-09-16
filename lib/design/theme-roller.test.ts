// @vitest-environment jsdom
//
// The Theme Roller's state and DOM writes (P1.8; APEX: the Theme Roller dialog
// over a running page): edits with undo and redo, the preview as inline custom
// properties on <html>, the tab switching to a saved theme as the picker would,
// and what Save and Save as new theme wait for.

import { afterEach, describe, expect, it } from 'vitest';
import { SHIPPED_THEME_SET, shippedTheme, themeCss, themeDeclarations, type ThemeOption } from './theme-defaults';
import { THEME_CHANGE_EVENT, THEME_STORAGE_KEY } from '@/components/theme/ThemeScript';
import { applyPreview, clearPreview, editToken, isDirty, redo, resetTo, runningThemeKey, saveState, startRoller, switchTab, undo } from './theme-roller';

const midnight = shippedTheme('midnight').tokens;
const SUNSET: ThemeOption = { key: 'sunset', label: 'Sunset', hint: 'On Midnight', family: 'dark', base: 'midnight', tokens: { ...midnight, accent: '#ff9f1c' }, available: true, isDefault: false };

afterEach(() => {
  const root = document.documentElement;
  root.removeAttribute('style');
  delete root.dataset.theme;
  delete root.dataset.themeCustom;
  root.classList.remove('dark');
  document.querySelector('style[data-theme-roller]')?.remove();
  document.querySelector('meta[name="theme-color"]')?.remove();
  window.localStorage.clear();
});

describe('the roller state', () => {
  it('edits a token with undo and redo, leaves the state for a value that is not #rrggbb, and resets to the stored colours', () => {
    const s0 = startRoller(midnight);
    expect(isDirty(s0, midnight)).toBe(false);
    expect(undo(s0)).toBe(s0);
    expect(redo(s0)).toBe(s0);
    let s = editToken(s0, 'accent', '#FF9F1C');
    expect(s.tokens.accent).toBe('#ff9f1c');
    expect(isDirty(s, midnight)).toBe(true);
    expect(editToken(s, 'accent', 'orange')).toBe(s);
    expect(editToken(s, 'accent', '#ff9f1c')).toBe(s);
    s = editToken(s, 'bg', '#000000');
    s = undo(s);
    expect(s.tokens.bg).toBe(midnight.bg);
    expect(s.tokens.accent).toBe('#ff9f1c');
    s = redo(s);
    expect(s.tokens.bg).toBe('#000000');
    expect(redo(s)).toBe(s);
    s = resetTo(s, midnight);
    expect(isDirty(s, midnight)).toBe(false);
    expect(s.future).toEqual([]);
    // Reset is one more step: Undo brings the edits back.
    s = undo(s);
    expect(s.tokens.bg).toBe('#000000');
    expect(s.tokens.accent).toBe('#ff9f1c');
  });
});

describe('the preview', () => {
  it('writes exactly the declarations themeCss writes, as inline custom properties, then removes them', () => {
    const decls = themeDeclarations(SUNSET.tokens);
    expect(decls.map(([name]) => name)).toEqual(['--bg', '--surface', '--surface-elevated', '--border', '--border-strong', '--text', '--text-muted', '--text-faint', '--brand', '--brand-fill', '--numeral', '--tint-contrast']);
    expect(themeCss({ defaultKey: 'sunset', themes: [SUNSET] })).toBe(`:root[data-theme-custom='sunset']{${decls.map(([n, v]) => `${n}:${v}`).join(';')}}`);
    const root = document.documentElement;
    applyPreview(root, SUNSET.tokens);
    expect(root.style.getPropertyValue('--brand')).toBe('#ff9f1c');
    expect(root.style.getPropertyValue('--brand-fill')).toBe('#ff9f1c');
    expect(root.style.getPropertyValue('--tint-contrast')).toBe(SUNSET.tokens.bg);
    expect(root.style.getPropertyValue('--numeral')).toBe(SUNSET.tokens.text);
    clearPreview(root);
    for (const [name] of decls) expect(root.style.getPropertyValue(name)).toBe('');
  });

  it('names the theme the tab runs: the custom key, else the shipped key, else the default', () => {
    expect(runningThemeKey({ dataset: {} })).toBe('paper');
    expect(runningThemeKey({ dataset: { theme: 'midnight' } })).toBe('midnight');
    expect(runningThemeKey({ dataset: { theme: 'midnight', themeCustom: 'sunset' } })).toBe('sunset');
  });

  it('switches the tab to a saved theme as the picker would: the attributes, the class, the address-bar colour, the stored choice, one rule for the key, the preview gone', () => {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
    const root = document.documentElement;
    applyPreview(root, SUNSET.tokens);
    let events = 0;
    const onChange = () => {
      events += 1;
    };
    window.addEventListener(THEME_CHANGE_EVENT, onChange);
    switchTab(document, SUNSET);
    expect(root.dataset.theme).toBe('midnight');
    expect(root.dataset.themeCustom).toBe('sunset');
    expect(root.classList.contains('dark')).toBe(true);
    expect(meta.getAttribute('content')).toBe(SUNSET.tokens.bg);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('sunset');
    expect(document.querySelector('style[data-theme-roller]')?.textContent).toBe(themeCss({ defaultKey: 'sunset', themes: [SUNSET] }));
    expect(root.style.getPropertyValue('--brand')).toBe('');
    expect(events).toBe(1);
    // A later save replaces the rule; a light base drops the dark class.
    switchTab(document, { ...SUNSET, key: 'dawn', label: 'Dawn', base: 'paper', family: 'light' });
    expect(root.dataset.theme).toBe('paper');
    expect(root.dataset.themeCustom).toBe('dawn');
    expect(root.classList.contains('dark')).toBe(false);
    expect(document.querySelectorAll('style[data-theme-roller]').length).toBe(1);
    expect(document.querySelector('style[data-theme-roller]')?.textContent).toContain("[data-theme-custom='dawn']");
    // A shipped theme clears the custom key and needs no rule of its own.
    switchTab(document, SHIPPED_THEME_SET.themes[0]);
    expect(root.dataset.theme).toBe('midnight');
    expect(root.dataset.themeCustom).toBeUndefined();
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('midnight');
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
  });
});

describe('what Save waits for', () => {
  it('a shipped theme offers Save as new theme only, once changed, named and through the gate; a theme of yours offers Save too; the gate names its refusal', () => {
    const s0 = startRoller(midnight);
    expect(saveState(s0, midnight, { shipped: true }, 'Night race')).toMatchObject({ save: false, saveAs: false, problems: [] });
    const s1 = editToken(s0, 'accent', '#ff9f1c');
    expect(saveState(s1, midnight, { shipped: true }, '')).toMatchObject({ save: false, saveAs: false, problems: [] });
    expect(saveState(s1, midnight, { shipped: true }, ' ')).toMatchObject({ save: false, saveAs: false });
    expect(saveState(s1, midnight, { shipped: true }, 'Night race')).toMatchObject({ save: false, saveAs: true, problems: [] });
    expect(saveState(s1, midnight, { shipped: false }, '')).toMatchObject({ save: true, saveAs: false, problems: [] });
    expect(saveState(s1, midnight, { shipped: false }, 'Copy')).toMatchObject({ save: true, saveAs: true });
    const bad = editToken(s1, 'accent', '#2a2a30');
    const gate = saveState(bad, midnight, { shipped: false }, 'Night race');
    expect(gate.save).toBe(false);
    expect(gate.saveAs).toBe(false);
    expect(gate.problems).toEqual(['Accent on the page is 1.3:1, below 3.0:1']);
    expect(gate.reason).toContain('below 3.0:1');
    expect(saveState(s0, midnight, { shipped: true }, '').reason).toContain('stylesheet');
    expect(saveState(s1, midnight, { shipped: true }, '').reason).toContain('Name');
  });
});
