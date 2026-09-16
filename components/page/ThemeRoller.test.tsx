// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SHIPPED_THEMES } from '@/lib/design/theme-defaults';
import { THEME_STORAGE_KEY } from '@/components/theme/ThemeScript';

// The Theme Roller (P1.8; APEX: Customize › Theme Roller, a live editor over
// the running page). It opens on the theme this tab runs, previews every edit
// on <html> for this tab only, shows the contrast gate's four ratios live,
// saves a theme of the operator's own in place or as a new theme through the
// themes routes, switches the tab to what it saved, and offers Set as default.

const record = vi.fn();
vi.mock('@/lib/design/debug-client', () => ({ record: (phase: string, text: string) => record(phase, text) }));
import { ThemeRoller } from './ThemeRoller';

const STAMP = '2026-09-16T12:00:00.505502+00:00';
const shipped = SHIPPED_THEMES.map(t => ({ key: t.key, label: t.label, hint: t.hint, family: t.family, base: null, tokens: t.tokens, available: true, isDefault: t.key === 'paper', shipped: true, updatedAt: STAMP }));
const midnight = shipped[0].tokens;
const sunset = { key: 'sunset', label: 'Sunset', hint: 'On Midnight', family: 'dark' as const, base: 'midnight' as const, tokens: { ...midnight, accent: '#ff9f1c' }, available: true, isDefault: false, shipped: false, updatedAt: '2026-09-16T12:30:00.000000+00:00' };
const fetchMock = vi.fn();
const listing = (themes: unknown[]) => ({ ok: true, status: 200, json: async () => ({ themes }) });
const runs = (theme: string, custom?: string) => {
  document.documentElement.dataset.theme = theme;
  if (custom) document.documentElement.dataset.themeCustom = custom;
};
const colour = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const gateLine = (label: string) => within(screen.getByRole('list', { name: 'The contrast gate' })).getByText(label).closest('li') as HTMLElement;
const inline = (name: string) => document.documentElement.style.getPropertyValue(name);

beforeEach(() => {
  fetchMock.mockReset();
  record.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  const root = document.documentElement;
  root.removeAttribute('style');
  delete root.dataset.theme;
  delete root.dataset.themeCustom;
  root.classList.remove('dark');
  document.querySelector('style[data-theme-roller]')?.remove();
  window.localStorage.clear();
});

describe('ThemeRoller', () => {
  it('opens on the theme the tab runs, nine pickers in order with the gate beneath, previews an edit on <html>, and holds saving while the gate refuses', async () => {
    runs('midnight');
    fetchMock.mockResolvedValueOnce(listing([...shipped, sunset]));
    render(<ThemeRoller barPosition="bottom" onClose={() => {}} />);
    const dialog = await screen.findByRole('dialog', { name: 'Theme Roller' });
    await within(dialog).findByText('On Midnight · shipped');
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/admin/design/themes');
    expect([...dialog.querySelectorAll('input[type="color"]')].map(i => i.getAttribute('aria-label'))).toEqual(['Page', 'Card', 'Raised', 'Hairline', 'Rule', 'Text', 'Muted text', 'Faint text', 'Accent']);
    expect(colour('Accent').value).toBe('#ffb400');
    expect(screen.getByText('links, highlights, the brand colour')).toBeTruthy();
    expect([...screen.getByRole('list', { name: 'The contrast gate' }).querySelectorAll('li')].map(li => li.textContent)).toEqual([
      'Text on the page14.7:1 · ok',
      'Muted text on a card6.7:1 · ok',
      'Faint text on a raised panel4.6:1 · ok',
      'Accent on the page10.5:1 · ok',
    ]);
    const save = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    const saveAs = screen.getByRole('button', { name: 'Save as new theme' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(save.title).toContain('stylesheet');
    expect(saveAs.disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Reset' }) as HTMLButtonElement).disabled).toBe(true);
    expect(inline('--brand')).toBe('');
    // An edit previews at once, for this tab only: nothing stored.
    fireEvent.change(colour('Accent'), { target: { value: '#2a2a30' } });
    expect(inline('--brand')).toBe('#2a2a30');
    expect(inline('--brand-fill')).toBe('#2a2a30');
    expect((screen.getByLabelText('Accent as #rrggbb') as HTMLInputElement).value).toBe('#2a2a30');
    expect(gateLine('Accent on the page').textContent).toBe('Accent on the page1.3:1 · below 3.0:1');
    expect(gateLine('Accent on the page').className).toContain('text-negative');
    fireEvent.change(screen.getByLabelText('Name of the new theme'), { target: { value: 'Night race' } });
    expect(saveAs.disabled).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('below 3.0:1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Typed as text, the same token; a passing value opens Save as new theme.
    fireEvent.change(screen.getByLabelText('Accent as #rrggbb'), { target: { value: '#FFD166' } });
    expect(colour('Accent').value).toBe('#ffd166');
    expect(inline('--brand')).toBe('#ffd166');
    expect(gateLine('Accent on the page').textContent).toContain('· ok');
    expect(saveAs.disabled).toBe(false);
    expect(save.disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(inline('--brand')).toBe('#2a2a30');
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    expect(inline('--brand')).toBe('#ffd166');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(inline('--brand')).toBe('');
    expect(colour('Accent').value).toBe('#ffb400');
    expect(record).toHaveBeenCalledWith('theme', expect.stringContaining('Midnight'));
  });

  it('Save as new theme posts the base, the name and the colours; the reply switches the tab to the new theme and offers Set as default with the current default’s stamp', async () => {
    runs('midnight');
    fetchMock.mockResolvedValueOnce(listing([...shipped, sunset]));
    render(<ThemeRoller barPosition="bottom" onClose={() => {}} />);
    await screen.findByText('On Midnight · shipped');
    fireEvent.change(colour('Accent'), { target: { value: '#ffd166' } });
    fireEvent.change(screen.getByLabelText('Name of the new theme'), { target: { value: ' Night race ' } });
    const created = { key: 'night-race', label: 'Night race', hint: 'On Midnight', family: 'dark', base: 'midnight', tokens: { ...midnight, accent: '#ffd166' }, available: true, isDefault: false, shipped: false, updatedAt: '2026-09-16T14:00:00.123456+00:00' };
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ ok: true, theme: created }) });
    fireEvent.click(screen.getByRole('button', { name: 'Save as new theme' }));
    await screen.findByText('On Night race · yours');
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe('/api/admin/design/themes');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ label: 'Night race', base: 'midnight', tokens: { ...midnight, accent: '#ffd166' }, available: true });
    // The tab runs the new theme as a visitor picking it would; the preview is gone.
    expect(document.documentElement.dataset.themeCustom).toBe('night-race');
    expect(document.documentElement.dataset.theme).toBe('midnight');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('night-race');
    expect(document.querySelector('style[data-theme-roller]')?.textContent).toContain(":root[data-theme-custom='night-race']{");
    expect(inline('--brand')).toBe('');
    expect(screen.getByRole('status').textContent).toContain('Saved “Night race”');
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('Name of the new theme') as HTMLInputElement).value).toBe('');
    // Set as default: the second, deliberate step; the current default is Paper, so its stamp travels.
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, key: 'night-race', updatedAt: '2026-09-16T14:01:00.000000+00:00' }) });
    fireEvent.click(screen.getByRole('button', { name: 'Set as default' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const [durl, dinit] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(durl).toBe('/api/admin/design/themes/default');
    expect(dinit.method).toBe('PUT');
    expect(JSON.parse(String(dinit.body))).toEqual({ key: 'night-race', updatedAt: STAMP });
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('default'));
    expect(screen.queryByRole('button', { name: 'Set as default' })).toBeNull();
    expect(record).toHaveBeenCalledWith('theme', expect.stringContaining('Night race'));
  });

  it('a theme of yours offers Save with its stamp; a 409 takes the current stamps and says so; the next Save carries the new stamp', async () => {
    runs('midnight', 'sunset');
    fetchMock.mockResolvedValueOnce(listing([...shipped, sunset]));
    render(<ThemeRoller barPosition="right" onClose={() => {}} />);
    const dialog = await screen.findByRole('dialog', { name: 'Theme Roller' });
    await screen.findByText('On Sunset · yours');
    expect(dialog.className).toContain('right-16');
    expect(colour('Accent').value).toBe('#ff9f1c');
    expect(screen.queryByRole('button', { name: 'Set as default' })).toBeTruthy();
    fireEvent.change(colour('Accent'), { target: { value: '#ffd166' } });
    const save = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    fetchMock.mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: 'This theme was saved again after you loaded it.', current: [...shipped, { ...sunset, updatedAt: 'moved' }] }) });
    fireEvent.click(save);
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('saved again'));
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe('/api/admin/design/themes/sunset');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(String(init.body))).toEqual({ tokens: { ...midnight, accent: '#ffd166' }, updatedAt: sunset.updatedAt });
    // The edit stands; the stamp moved with the reply.
    expect(inline('--brand')).toBe('#ffd166');
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, key: 'sunset', updatedAt: 'moved-again' }) });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(JSON.parse(String((fetchMock.mock.calls[2] as [string, RequestInit])[1].body))).toEqual({ tokens: { ...midnight, accent: '#ffd166' }, updatedAt: 'moved' });
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Saved “Sunset”'));
    // Saved in place: the tab runs it with the new colours and no preview.
    expect(document.documentElement.dataset.themeCustom).toBe('sunset');
    expect(document.querySelector('style[data-theme-roller]')?.textContent).toContain('--brand:#ffd166');
    expect(inline('--brand')).toBe('');
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('Escape closes the panel alone, taken before Quick Edit’s own listener; Close clears the preview; a failed read shows the route’s words', async () => {
    runs('midnight');
    fetchMock.mockResolvedValueOnce(listing([...shipped]));
    const onClose = vi.fn();
    const quickEdit = vi.fn();
    document.addEventListener('keydown', quickEdit);
    render(<ThemeRoller barPosition="bottom" onClose={onClose} />);
    await screen.findByText('On Midnight · shipped');
    fireEvent.change(colour('Accent'), { target: { value: '#ffd166' } });
    fireEvent.keyDown(colour('Accent'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(quickEdit).not.toHaveBeenCalled();
    fireEvent.keyDown(colour('Accent'), { key: 'a' });
    expect(quickEdit).toHaveBeenCalledTimes(1);
    expect(inline('--brand')).toBe('');
    document.removeEventListener('keydown', quickEdit);
    // The mock kept the panel mounted; a further edit previews again, Close takes it away.
    fireEvent.change(colour('Accent'), { target: { value: '#ffc857' } });
    expect(inline('--brand')).toBe('#ffc857');
    fireEvent.click(screen.getByRole('button', { name: 'Close Theme Roller' }));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(inline('--brand')).toBe('');
    cleanup();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ error: 'database not configured' }) });
    render(<ThemeRoller barPosition="bottom" onClose={onClose} />);
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('database not configured'));
    expect(document.querySelectorAll('input[type="color"]').length).toBe(0);
  });
});
