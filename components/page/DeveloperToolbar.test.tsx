// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
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
const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ pages }) }));

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  user = { publicMetadata: { role: 'admin' } };
  pathname = '/history/monza';
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('DeveloperToolbar', () => {
  it('draws nothing for a reader, and never asks for the pages', () => {
    user = null;
    const { container } = render(<DeveloperToolbar />);
    expect(container.firstChild).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("draws APEX's nine entries in order for an administrator: Home, App and Page live, the rest disabled until their slot", async () => {
    render(<DeveloperToolbar />);
    const bar = screen.getByRole('region', { name: 'Developer toolbar' });
    await waitFor(() => expect(screen.getByRole('link', { name: /^Page a1b2c3d4/ })).toBeTruthy());
    expect([...bar.querySelectorAll('a, button')].map(el => el.textContent?.trim())).toEqual(['Home', 'App 100', 'Page a1b2c3d4', 'Session', 'Debug', 'Quick Edit', 'Customize', 'Info', 'Options']);
    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('href')).toBe('/admin/designer?ws=builder');
    expect(screen.getByRole('link', { name: 'App 100' }).getAttribute('href')).toBe('/admin/designer?ws=shared&sc=appdef');
    expect(screen.getByRole('link', { name: /^Page a1b2c3d4/ }).getAttribute('href')).toBe('/admin/designer?ws=builder&page=a1b2c3d4-0000-4000-8000-000000000010');
    for (const [label, slot] of [
      ['Debug', 'P1.9'],
      ['Quick Edit', 'P1.7'],
      ['Customize', 'P1.8'],
      ['Info', 'P1.7'],
      ['Options', 'P1.7'],
    ] as const) {
      const b = screen.getByRole('button', { name: label }) as HTMLButtonElement;
      expect(b.disabled).toBe(true);
      expect(b.title).toContain(slot);
    }
    expect((screen.getByRole('button', { name: 'Session' }) as HTMLButtonElement).disabled).toBe(true);
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
