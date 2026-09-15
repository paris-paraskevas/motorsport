// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The runtime Developer Toolbar (R5): APEX's floating bar at the foot of a
// running page, drawn only for an administrator once the page has loaded, so
// the HTML readers get is unchanged; APEX's nine entries in APEX's order, the
// built ones live, the rest disabled and naming their slot.

let user: { publicMetadata?: { role?: string } } | null = { publicMetadata: { role: 'admin' } };
let pathname = '/history/monza';
vi.mock('@clerk/nextjs', () => ({ useUser: () => ({ isLoaded: true, user }) }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));
import { DeveloperToolbar, matchesPattern } from './DeveloperToolbar';
import { patternMatches } from '@/lib/design/page-document';

const pages = [
  { id: 'a1b2c3d4-0000-4000-8000-000000000010', path: '/history/monza', name: 'Monza, a history', kind: 'row' },
  { id: 'c0de0003-0000-4000-8000-000000000003', path: '/series/[slug]', name: 'Series hub', kind: 'code' },
];
const report = {
  cid: 'ab12cd34',
  level: 6,
  page: '/history/monza',
  startedAt: '2026-09-10T13:00:00.000Z',
  totalMs: 40,
  entries: [
    { at: 0, level: 4, phase: 'resolve', text: '/history/monza', ms: 20 },
    { at: 20, level: 4, phase: 'render:intro', text: 'Static Content', ms: 3 },
  ],
};
const fetchMock = vi.fn(async (url: string) => (url.includes('/api/admin/design/debug') ? { ok: true, status: 200, json: async () => report } : { ok: true, status: 200, json: async () => ({ pages }) }));

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  user = { publicMetadata: { role: 'admin' } };
  pathname = '/history/monza';
  window.sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe('DeveloperToolbar', () => {
  it('draws nothing for a reader, and never asks for the pages', () => {
    user = null;
    const { container } = render(<DeveloperToolbar />);
    expect(container.firstChild).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("draws APEX's nine entries in order for an administrator: Home, App and Page live into the one developer tab, Customize disabled until its slot, and all of it in one root hidden below the large breakpoint", async () => {
    const { container } = render(<DeveloperToolbar />);
    const bar = screen.getByRole('region', { name: 'Developer toolbar' });
    await waitFor(() => expect(screen.getByRole('link', { name: /^Page a1b2c3d4/ })).toBeTruthy());
    expect([...bar.querySelectorAll('a, button')].map(el => el.textContent?.trim())).toEqual(['Home', 'App 100', 'Page a1b2c3d4', 'Session', 'Debug', 'Quick Edit', 'Customize', 'Info', 'Options']);
    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('href')).toBe('/admin/designer?ws=builder');
    expect(screen.getByRole('link', { name: 'App 100' }).getAttribute('href')).toBe('/admin/designer?ws=shared&sc=appdef');
    expect(screen.getByRole('link', { name: /^Page a1b2c3d4/ }).getAttribute('href')).toBe('/admin/designer?ws=builder&page=a1b2c3d4-0000-4000-8000-000000000010');
    // The operator, 2026-09-15: every link into the designer opens the one developer tab, the way Save and Run reuses the one running tab.
    for (const name of ['Home', 'App 100', /^Page a1b2c3d4/] as const) expect(screen.getByRole('link', { name }).getAttribute('target')).toBe('paddock-designer');
    const customize = screen.getByRole('button', { name: 'Customize' }) as HTMLButtonElement;
    expect(customize.disabled).toBe(true);
    expect(customize.title).toContain('P1.8');
    expect((screen.getByRole('button', { name: 'Session' }) as HTMLButtonElement).disabled).toBe(true);
    for (const name of ['Debug', 'Quick Edit', 'Info', 'Options']) expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(false);
    // The operator, 2026-09-15: "the bar shouldnt show on mobile for me": one root, out of the layout below lg, holding the bar and everything the bar opens.
    const root = container.firstElementChild as HTMLElement;
    expect(root.className.split(' ')).toEqual(expect.arrayContaining(['max-lg:hidden', 'lg:contents']));
    expect(root.contains(bar)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Debug' }));
    expect(root.contains(screen.getByRole('menu', { name: 'Debug' }))).toBe(true);
  });

  it('Quick Edit (P1.7): two checkable modes under the menu, one on at a time, the button pressed while one is on, the mode turned off again from the menu (the operator: hideable); the overlay mounts with the mode', async () => {
    render(<DeveloperToolbar />);
    await waitFor(() => expect(screen.getByRole('link', { name: /^Page a1b2c3d4/ })).toBeTruthy());
    const quick = () => screen.getByRole('button', { name: 'Quick Edit' });
    expect(quick().getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(quick());
    const menu = screen.getByRole('menu', { name: 'Quick Edit' });
    expect([...menu.querySelectorAll('button')].map(b => b.textContent)).toEqual(['Quick Edit Mode', 'Edit Live Template Options']);
    fireEvent.click(within(menu).getByRole('menuitemcheckbox', { name: 'Quick Edit Mode' }));
    expect(quick().getAttribute('aria-pressed')).toBe('true');
    await waitFor(() => expect(document.querySelector('[data-quick-edit="jump"]')).toBeTruthy());
    fireEvent.click(quick());
    expect(within(screen.getByRole('menu', { name: 'Quick Edit' })).getByRole('menuitemcheckbox', { name: 'Quick Edit Mode' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within(screen.getByRole('menu', { name: 'Quick Edit' })).getByRole('menuitemcheckbox', { name: 'Edit Live Template Options' }));
    await waitFor(() => expect(document.querySelector('[data-quick-edit="live"]')).toBeTruthy());
    expect(document.querySelector('[data-quick-edit="jump"]')).toBeNull();
    fireEvent.click(quick());
    fireEvent.click(within(screen.getByRole('menu', { name: 'Quick Edit' })).getByRole('menuitemcheckbox', { name: 'Edit Live Template Options' }));
    expect(quick().getAttribute('aria-pressed')).toBe('false');
    await waitFor(() => expect(document.querySelector('[data-quick-edit]')).toBeNull());
  });

  it('Info (P1.7): Show Layout Columns draws the twelve columns over the page and reads Hide Layout Columns while on; Show Page Timing opens the dialog', async () => {
    render(<DeveloperToolbar />);
    await waitFor(() => expect(screen.getByRole('link', { name: /^Page a1b2c3d4/ })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Info' }));
    const menu = screen.getByRole('menu', { name: 'Info' });
    expect([...menu.querySelectorAll('button')].map(b => b.textContent)).toEqual(['Show Layout Columns', 'Show Page Timing']);
    fireEvent.click(within(menu).getByRole('menuitemcheckbox', { name: 'Show Layout Columns' }));
    const columns = document.querySelector('[data-layout-columns]') as HTMLElement;
    expect(columns).toBeTruthy();
    expect(columns.querySelectorAll('[data-layout-column]').length).toBe(12);
    fireEvent.click(screen.getByRole('button', { name: 'Info' }));
    const hide = within(screen.getByRole('menu', { name: 'Info' })).getByRole('menuitemcheckbox', { name: 'Hide Layout Columns' });
    expect(hide.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(hide);
    expect(document.querySelector('[data-layout-columns]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Info' }));
    fireEvent.click(within(screen.getByRole('menu', { name: 'Info' })).getByRole('menuitem', { name: 'Show Page Timing' }));
    const dialog = await screen.findByRole('dialog', { name: 'Page Performance Timing' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close Page Timing' }));
    expect(screen.queryByRole('dialog', { name: 'Page Performance Timing' })).toBeNull();
  });

  it('Options (P1.7): Show Icons Only, Display Position and Auto Hide, kept for the browser and read back on the next page', async () => {
    render(<DeveloperToolbar />);
    await waitFor(() => expect(screen.getByRole('link', { name: /^Page a1b2c3d4/ })).toBeTruthy());
    const bar = () => screen.getByRole('region', { name: 'Developer toolbar' });
    expect(bar().getAttribute('data-position')).toBe('bottom');
    fireEvent.click(screen.getByRole('button', { name: 'Options' }));
    const menu = screen.getByRole('menu', { name: 'Developer Toolbar Options' });
    expect([...menu.querySelectorAll('button')].map(b => b.textContent)).toEqual(['Auto Hide', 'Show Icons Only', 'Top', 'Left', 'Bottom', 'Right']);
    expect(within(menu).getByRole('menuitemradio', { name: 'Bottom' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within(menu).getByRole('menuitemcheckbox', { name: 'Show Icons Only' }));
    expect(screen.getByRole('link', { name: 'Home' }).querySelector('span')?.className).toContain('sr-only');
    fireEvent.click(screen.getByRole('button', { name: 'Options' }));
    fireEvent.click(within(screen.getByRole('menu', { name: 'Developer Toolbar Options' })).getByRole('menuitemradio', { name: 'Top' }));
    expect(bar().getAttribute('data-position')).toBe('top');
    expect(bar().className).toContain('top-3');
    fireEvent.click(screen.getByRole('button', { name: 'Options' }));
    fireEvent.click(within(screen.getByRole('menu', { name: 'Developer Toolbar Options' })).getByRole('menuitemcheckbox', { name: 'Auto Hide' }));
    expect(bar().getAttribute('data-autohide')).toBe('true');
    expect(JSON.parse(window.localStorage.getItem('pd-toolbar') ?? '{}')).toEqual({ autoHide: true, iconsOnly: true, position: 'top' });
    cleanup();
    render(<DeveloperToolbar />);
    await waitFor(() => expect(screen.getByRole('link', { name: /^Page a1b2c3d4/ })).toBeTruthy());
    expect(bar().getAttribute('data-position')).toBe('top');
    expect(bar().getAttribute('data-autohide')).toBe('true');
    window.localStorage.removeItem('pd-toolbar');
  });

  it("Debug (P1.9): the menu as APEX lists it, a level kept for the tab and traced through the admin route, View Debug opening the panel, No Debug clearing it", async () => {
    render(<DeveloperToolbar />);
    await waitFor(() => expect(screen.getByRole('link', { name: /^Page a1b2c3d4/ })).toBeTruthy());
    const debug = screen.getByRole('button', { name: 'Debug' });
    expect(debug.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(debug);
    const menu = screen.getByRole('menu', { name: 'Debug' });
    expect([...menu.querySelectorAll('button')].map(b => b.textContent)).toEqual(['Enable Debug', 'No Debug', 'Info (default)', 'App Trace', 'Full Trace', 'View Debug']);
    expect((within(menu).getByRole('menuitem', { name: 'No Debug' }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(menu).getByRole('menuitem', { name: 'View Debug' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: 'App Trace' }));
    expect(window.sessionStorage.getItem('pd-debug')).toBe('app');
    expect(screen.getByRole('button', { name: 'Debug' }).getAttribute('aria-pressed')).toBe('true');
    await waitFor(() => expect(fetchMock.mock.calls.some(c => String(c[0]) === '/api/admin/design/debug?path=%2Fhistory%2Fmonza&level=app')).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: 'Debug' }));
    expect(within(screen.getByRole('menu', { name: 'Debug' })).getByRole('menuitemradio', { name: 'App Trace' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within(screen.getByRole('menu', { name: 'Debug' })).getByRole('menuitem', { name: 'View Debug' }));
    const panel = await screen.findByRole('dialog', { name: 'Debug' });
    await waitFor(() => expect(within(panel).getByText('render:intro')).toBeTruthy());
    expect(within(panel).getByText('id ab12cd34')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Debug' }));
    fireEvent.click(within(screen.getByRole('menu', { name: 'Debug' })).getByRole('menuitem', { name: 'No Debug' }));
    expect(window.sessionStorage.getItem('pd-debug')).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Debug' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Debug' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('reads a level the tab kept, and ?debug=LEVEL9 on the address for this visit', async () => {
    window.sessionStorage.setItem('pd-debug', 'info');
    render(<DeveloperToolbar />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Debug' }).getAttribute('aria-pressed')).toBe('true'));
    await waitFor(() => expect(fetchMock.mock.calls.some(c => String(c[0]).endsWith('level=info'))).toBe(true));
    cleanup();
    window.sessionStorage.clear();
    window.history.replaceState(null, '', '/history/monza?debug=LEVEL9');
    render(<DeveloperToolbar />);
    await waitFor(() => expect(fetchMock.mock.calls.some(c => String(c[0]).endsWith('level=full'))).toBe(true));
    window.history.replaceState(null, '', '/history/monza');
  });

  it('matches patterns exactly as lib/design/page-document does (the copy kept out of the public chunk)', () => {
    const cases: [string, string][] = [
      ['/series/[slug]', '/series/f1'],
      ['/series/[slug]', '/series/f1/standings'],
      ['/series/[slug]/[tab]', '/series/f1/standings'],
      ['/history/monza', '/history/monza'],
      ['/history/monza', '/history/spa'],
      ['/docs/[...rest]', '/docs/a/b/c'],
      ['/docs/[...rest]', '/docs'],
      ['/[a]/[b]', '/x'],
    ];
    for (const [pattern, path] of cases) expect(matchesPattern(pattern, path)).toBe(patternMatches(pattern, path));
  });

  it('names a pattern page by its pattern, and disables Page where no page of the application is served', async () => {
    pathname = '/series/f1';
    render(<DeveloperToolbar />);
    await waitFor(() => expect(screen.getByRole('link', { name: /^Page c0de0003/ })).toBeTruthy());
    cleanup();
    pathname = '/nowhere';
    render(<DeveloperToolbar />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect((screen.getByRole('button', { name: /^Page/ }) as HTMLButtonElement).title).toBe('Not a page of the application'));
  });
});
