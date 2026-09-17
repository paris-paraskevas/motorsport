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
const loadLiveComposed = vi.fn();
const loadAssetsById = vi.fn(async () => new Map());
vi.mock('@/lib/design/live-page', () => ({ loadLivePage: (p: string) => loadLivePage(p), loadLiveComposed: (p: string) => loadLiveComposed(p), loadAssetsById: () => loadAssetsById() }));
// A page served from rows (R4.1): the components draw as stand-ins that show
// what they were given, the family answers with fixed metadata and structured
// data, and `connection()` is counted rather than called.
const connection = vi.fn(async () => {});
vi.mock('next/server', () => ({ connection: () => connection() }));
vi.mock('@/lib/design/component-render', () => ({
  raceWeekendNow: async () => false,
  renderComponents: async (
    doc: { regions: { id: string; kind: string; component?: string }[] },
    where: { path: string; params?: Record<string, string>; page?: { title: string | null; name: string } },
  ) =>
    Object.fromEntries(
      doc.regions
        .filter(r => r.kind === 'component' && r.component !== 'page.body')
        .map(r => [r.id, r.component === 'page.heading' ? <h1>{where.page?.title ?? where.page?.name}</h1> : <div data-component={r.component}>{`${where.path} ${JSON.stringify(where.params ?? {})}`}</div>]),
    ),
}));
vi.mock('@/lib/design/page-families', () => ({
  familyMetadata: async (pattern: string) => ({ title: 'Calendar', description: 'Every session, every series.', openGraph: { title: 'Calendar — Paddock Tracker', url: `https://paddock-tracker.com${pattern}` } }),
  familyExtras: async () => <script type="application/ld+json">{'{"@type":"BreadcrumbList"}'}</script>,
}));
vi.mock('@/lib/design/shortcuts', () => ({ loadShortcuts: async () => ({ 'times.local': 'All times are local.' }) }));
// The appearance carries the templates' presets (P1.2); the page resolves every region against them.
const loadAppearance = vi.fn(async () => SHIPPED_APPEARANCE);
vi.mock('@/lib/design/appearance', () => ({ loadAppearance: () => loadAppearance() }));
vi.mock('@/lib/design/lists', async () => {
  const actual = await vi.importActual<typeof import('@/lib/design/lists')>('@/lib/design/lists');
  const field: Record<string, keyof typeof actual.DEFAULT_NAV> = { doors: 'doors', bar: 'bar', 'footer-site': 'footerSite', 'footer-legal': 'footerLegal' };
  return {
    loadNavLists: async () => actual.DEFAULT_NAV,
    loadDocumentLists: async (keys: string[]) => Object.fromEntries(keys.map(k => [k, field[k] ? actual.DEFAULT_NAV[field[k]] : []])),
  };
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
import { SHIPPED_APPEARANCE } from '@/lib/design/appearance-defaults';
import { SHIPPED_PRESETS } from '@/lib/design/template-options';

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

  it('P1.2: a region on Use Template Defaults is drawn with the stored presets, the shipped ones when nothing is stored', async () => {
    loadLivePage.mockResolvedValue(live());
    const shipped = renderToStaticMarkup(await CatchAll({ params }));
    expect(shipped).not.toMatch(/id="region-intro"[^>]*class="[^"]*py-4/);
    loadAppearance.mockResolvedValueOnce({ ...SHIPPED_APPEARANCE, templates: { ...SHIPPED_PRESETS, standard: { ...SHIPPED_PRESETS.standard, spacing: 'SPACING_ROOMY' } } });
    const roomy = renderToStaticMarkup(await CatchAll({ params }));
    expect(roomy).toMatch(/id="region-intro"[^>]*class="[^"]*py-4/);
    expect(roomy).toContain('class="space-y-6"');
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

  it('P2.6: a region with condition Never does not render, whoever visits; Current Page is in compares the visited address; neither reads the session', async () => {
    const at = (id: string, text: string, condition: unknown, seq: number) => ({ id, kind: 'static', title: id, position: 'body', seq, column: 1, span: 12, newRow: false, authz: null, text, condition });
    loadLivePage.mockResolvedValue(
      live({}, [
        at('gone', 'Never drawn', { type: 'never' }, 20),
        at('here', 'On this page', { type: 'page-in', pages: ['/history/monza', '/history/spa'] }, 30),
        at('elsewhere', 'On another page', { type: 'page-in', pages: ['/history/spa'] }, 40),
      ]),
    );
    const html = renderToStaticMarkup(await CatchAll({ params }));
    expect(html).toContain('Opened in 1922');
    expect(html).not.toContain('Never drawn');
    expect(html).toContain('On this page');
    expect(html).not.toContain('On another page');
    expect(currentVisitor).not.toHaveBeenCalled();
  });
});

describe('the catch-all serving a page from rows (R4.1)', () => {
  const calendar: PageRow = { ...page, id: 'c', path: '/calendar', name: 'Calendar', kind: 'code', served: 'rows', group: 'site', indexable: true };
  const cparams = Promise.resolve({ catchall: ['calendar'] });
  const region = (over: Record<string, unknown>) => ({ title: '', position: 'body', seq: 10, column: 1, span: 12, newRow: true, hidden: false, authz: null, ...over });
  const revision = (regions: unknown[]) => ({ id: 'r', publishedAt: '2026-09-09T12:00:00Z', document: { version: 1, actions: [], regions } });
  beforeEach(() => {
    loadLivePage.mockReset();
    loadLivePage.mockResolvedValue(null);
    loadLiveComposed.mockReset();
    connection.mockClear();
    currentVisitor.mockReset();
    currentVisitor.mockResolvedValue(ANON);
  });

  it('renders the default composition when nothing is published, in the code frame, with the family’s metadata, canonical and structured data', async () => {
    loadLiveComposed.mockResolvedValue({ page: calendar, revision: null });
    const html = renderToStaticMarkup(await CatchAll({ params: cparams }));
    expect(html).toContain('<h1>Calendar</h1>');
    expect(html).toContain('data-component="calendar.month"');
    expect(html).toContain('/calendar {}');
    expect(html).toContain('data-page-frame="body"');
    expect(html).toContain('BreadcrumbList');
    expect(connection).not.toHaveBeenCalled();
    expect(currentVisitor).not.toHaveBeenCalled();
    const meta = await generateMetadata({ params: cparams });
    expect(meta.title).toBe('Calendar');
    expect(meta.description).toBe('Every session, every series.');
    expect(meta.robots).toBeUndefined();
    expect(meta.alternates).toEqual({ canonical: 'https://paddock-tracker.com/calendar' });
  });

  it('stands the registry in for a missing row; a row that renders per visit opts out of the cache and lends its title and index rule', async () => {
    loadLiveComposed.mockResolvedValue(null);
    expect(renderToStaticMarkup(await CatchAll({ params: cparams }))).toContain('<h1>Calendar</h1>');
    loadLiveComposed.mockResolvedValue({ page: { ...calendar, rendering: 'dynamic', title: 'Race calendar 2026', indexable: false }, revision: null });
    expect(renderToStaticMarkup(await CatchAll({ params: cparams }))).toContain('<h1>Race calendar 2026</h1>');
    expect(connection).toHaveBeenCalledTimes(1);
    const meta = await generateMetadata({ params: cparams });
    expect(meta.title).toBe('Race calendar 2026');
    expect(meta.openGraph?.title).toBe('Race calendar 2026 — Paddock Tracker');
    expect(meta.robots).toEqual({ index: false, follow: true });
  });

  it('renders a published composition as it is, and puts the recipe where a published transitional body sits', async () => {
    const own = region({ id: 'own', kind: 'static', title: 'Note', text: 'Times are local.' });
    loadLiveComposed.mockResolvedValue({ page: calendar, revision: revision([own]) });
    const html = renderToStaticMarkup(await CatchAll({ params: cparams }));
    expect(html).toContain('Times are local.');
    expect(html).not.toContain('data-component="calendar.month"');
    const legacy = region({ id: 'code-body', kind: 'component', component: 'page.body', settings: {}, seq: 20 });
    loadLiveComposed.mockResolvedValue({ page: calendar, revision: revision([own, legacy]) });
    const adopted = renderToStaticMarkup(await CatchAll({ params: cparams }));
    expect(adopted).toContain('Times are local.');
    expect(adopted).toContain('<h1>Calendar</h1>');
    expect(adopted).toContain('data-component="calendar.month"');
    expect(adopted).toContain('data-page-frame="body"');
    expect(adopted).not.toContain('data-page-frame="body-after"');
  });

  it('P2.6: on a composed page a Never region leaves and a Request = Value naming a part the address does not have shows (a fact not known)', async () => {
    const own = region({ id: 'own', kind: 'static', title: 'Note', text: 'Times are local.' });
    const f1 = region({ id: 'f1', kind: 'static', title: 'F1', text: 'F1 only', seq: 20, condition: { type: 'request-equals', part: 'slug', value: 'f1' } });
    const gone = region({ id: 'gone', kind: 'static', title: 'Gone', text: 'Never drawn', seq: 30, condition: { type: 'never' } });
    loadLiveComposed.mockResolvedValue({ page: calendar, revision: revision([own, f1, gone]) });
    const html = renderToStaticMarkup(await CatchAll({ params: cparams }));
    expect(html).toContain('Times are local.');
    expect(html).toContain('F1 only');
    expect(html).not.toContain('Never drawn');
    expect(currentVisitor).not.toHaveBeenCalled();
  });

  it('renders the 404 for an address under the pattern that is not the page', async () => {
    await expect(CatchAll({ params: Promise.resolve({ catchall: ['calendar', 'extra'] }) })).rejects.toBe(NOT_FOUND);
    expect(loadLiveComposed).not.toHaveBeenCalled();
  });
});
