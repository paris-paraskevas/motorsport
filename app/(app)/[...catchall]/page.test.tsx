import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

const NOT_FOUND = new Error('NEXT_NOT_FOUND');
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw NOT_FOUND;
  },
}));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: unknown; children: React.ReactNode }) => <a href={String(href)}>{children}</a>,
}));
// The stand-in for next/image renders a plain image element.
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => React.createElement('img', { src, alt }),
}));

const loadLivePage = vi.fn();
const loadAssetsById = vi.fn(async () => new Map());
vi.mock('@/lib/design/live-page', () => ({ loadLivePage: (p: string) => loadLivePage(p), loadAssetsById: () => loadAssetsById() }));
vi.mock('@/lib/design/shortcuts', () => ({ loadShortcuts: async () => ({ 'times.local': 'All times are local.' }) }));
vi.mock('@/lib/design/lists', async () => {
  const actual = await vi.importActual<typeof import('@/lib/design/lists')>('@/lib/design/lists');
  return { loadNavLists: async () => actual.DEFAULT_NAV };
});
vi.mock('@/lib/design/authz', async () => {
  const d = await vi.importActual<typeof import('@/lib/design/authz-defaults')>('@/lib/design/authz-defaults');
  return { loadAuthzSchemes: async () => d.DEFAULT_AUTHZ_SCHEMES };
});
const currentVisitor = vi.fn();
vi.mock('@/lib/design/authz-evaluate', async () => {
  const actual = await vi.importActual<typeof import('@/lib/design/authz-evaluate')>('@/lib/design/authz-evaluate');
  return { ...actual, currentVisitor: () => currentVisitor() };
});

import CatchAll, { generateMetadata, revalidate } from './page';
import type { PageRow } from '@/lib/design/pages';

const ANON = { signedIn: false, role: null, author: false, emails: [] };
const page: PageRow = { id: 'p', path: '/history/monza', name: 'Monza, a history', kind: 'row', group: 'editorial', template: 'paddock-standard', authz: 'public', title: null, rendering: 'cached', indexable: false, comments: null, updatedAt: 'x' };
const live = (over: Partial<PageRow> = {}, regions: unknown[] = []) => ({
  page: { ...page, ...over },
  revisionId: 'r1',
  publishedAt: '2026-09-08T17:10:00Z',
  document: {
    version: 1,
    actions: [],
    regions: [
      { id: 'intro', kind: 'static', title: 'History', position: 'body', seq: 10, column: 1, span: 12, newRow: false, authz: null, text: 'Opened in 1922. {shortcut:times.local}' },
      ...regions,
    ],
  },
});
const params = Promise.resolve({ catchall: ['history', 'monza'] });

describe('the catch-all serving row pages', () => {
  beforeEach(() => {
    loadLivePage.mockReset();
    currentVisitor.mockReset();
    currentVisitor.mockResolvedValue(ANON);
  });

  it('revalidates every five minutes and renders the 404 when no row page is live at the path', async () => {
    expect(revalidate).toBe(300);
    loadLivePage.mockResolvedValue(null);
    await expect(CatchAll({ params })).rejects.toBe(NOT_FOUND);
    expect(loadLivePage).toHaveBeenCalledWith('/history/monza');
    expect(await generateMetadata({ params })).toEqual({});
  });

  it('serves a public page without reading the session, with the shortcut substituted and noindex until indexable', async () => {
    loadLivePage.mockResolvedValue(live());
    const html = renderToStaticMarkup(await CatchAll({ params }));
    expect(html).toContain('Monza, a history');
    expect(html).toContain('Opened in 1922. All times are local.');
    expect(currentVisitor).not.toHaveBeenCalled();
    const meta = await generateMetadata({ params });
    expect(meta.title).toBe('Monza, a history');
    expect(meta.description).toBe('Opened in 1922. All times are local.');
    expect(meta.robots).toEqual({ index: false, follow: true });
    expect(meta.alternates).toEqual({ canonical: 'https://paddock-tracker.com/history/monza' });
  });

  it('indexes a public page once indexable, never a gated one', async () => {
    loadLivePage.mockResolvedValue(live({ indexable: true, title: 'Monza' }));
    expect((await generateMetadata({ params })).robots).toEqual({ index: true, follow: true });
    expect((await generateMetadata({ params })).title).toBe('Monza');
    loadLivePage.mockResolvedValue(live({ indexable: true, authz: 'signed_in' }));
    expect((await generateMetadata({ params })).robots).toEqual({ index: false, follow: true });
  });

  it('shows a gated page’s message and a sign-in link to an anonymous visitor, and the page to one who passes', async () => {
    loadLivePage.mockResolvedValue(live({ authz: 'signed_in' }));
    const refused = renderToStaticMarkup(await CatchAll({ params }));
    expect(refused).toContain('Sign in to see this.');
    expect(refused).toContain('href="/sign-in"');
    expect(refused).not.toContain('Opened in 1922');
    currentVisitor.mockResolvedValue({ ...ANON, signedIn: true });
    const shown = renderToStaticMarkup(await CatchAll({ params }));
    expect(shown).toContain('Opened in 1922');
  });

  it('renders the 404 for a gated page whose scheme has no message, so its existence leaks nothing', async () => {
    loadLivePage.mockResolvedValue(live({ authz: 'administrator' }));
    await expect(CatchAll({ params })).rejects.toBe(NOT_FOUND);
    expect(currentVisitor).toHaveBeenCalled();
  });

  it('reads the session when only a region asks for a scheme, and leaves that region out for a visitor who fails', async () => {
    loadLivePage.mockResolvedValue(
      live({}, [{ id: 'members', kind: 'static', title: 'Members', position: 'body', seq: 20, column: 1, span: 12, newRow: false, authz: 'contributor', text: 'For writers' }]),
    );
    const html = renderToStaticMarkup(await CatchAll({ params }));
    expect(currentVisitor).toHaveBeenCalled();
    expect(html).toContain('Opened in 1922');
    expect(html).not.toContain('For writers');
    expect(html).toContain('For approved writers.');
  });
});
