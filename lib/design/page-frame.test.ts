import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Metadata } from 'next';
import { DEFAULT_AUTHZ_SCHEMES } from './authz-defaults';
import { SHIPPED_APPEARANCE } from './appearance-defaults';
import { SHIPPED_PRESETS } from './template-options';
import { RefusedPage } from '@/components/page/RefusedPage';

// The frame around a code page: the row's title and index rule over the code's
// metadata, the gate on the row's scheme, the code as the fallback throughout.

let configured = true;
let rows: { data: unknown; error: { message: string } | null } = { data: [], error: null };
const from = vi.fn();
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => configured,
  betDb: () => ({
    from: (table: string) => {
      from(table);
      const q: Record<string, unknown> = {};
      Object.assign(q, {
        select: () => q,
        eq: () => q,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(rows).then(resolve, reject),
      });
      return q;
    },
  }),
}));
vi.mock('./authz', () => ({ loadAuthzSchemes: async () => DEFAULT_AUTHZ_SCHEMES }));
const loadLiveFrame = vi.fn();
vi.mock('./live-page', () => ({
  loadLiveFrame: (path: string) => loadLiveFrame(path),
  loadAssetsById: async () => new Map(),
}));
vi.mock('./shortcuts', () => ({ loadShortcuts: async () => ({ 'times.local': 'All times are local.' }) }));
// The appearance (the templates' presets ride it, P1.2): what the frame hands the page.
const loadAppearance = vi.fn(async () => SHIPPED_APPEARANCE);
vi.mock('./appearance', () => ({ loadAppearance: () => loadAppearance() }));
vi.mock('./lists', () => ({
  loadNavLists: async () => ({ doors: [], bar: [], footerSite: [], footerLegal: [] }),
  loadDocumentLists: async (keys: string[]) => Object.fromEntries(keys.map(k => [k, []])),
}));
const currentUser = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ currentUser: () => currentUser() }));
// The components' server half: what a region draws, and whether a race weekend is on.
const raceWeekend = vi.fn(async () => false);
vi.mock('./component-render', () => ({
  renderComponents: async (doc: { regions: { id: string; kind: string }[] }) => Object.fromEntries(doc.regions.filter(r => r.kind === 'component').map(r => [r.id, `drawn ${r.id}`])),
  raceWeekendNow: () => raceWeekend(),
}));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

import { applyFrame, loadPageFrame, pageMetadata, resetPageFrameMemo, withPageGate } from './page-frame';
import { CodePageFrame, type RowPageData } from '@/components/page/RowPageView';
import type { Region } from './page-document';

const STAMP = '2026-09-08T16:00:00.505502+00:00';
const calendar = (over: Record<string, unknown> = {}) => ({
  id: 'c0de0000-0000-4000-8000-000000000002',
  path: '/calendar',
  name: 'Calendar',
  kind: 'code',
  group_key: 'calendar',
  template: 'paddock-standard',
  authz_key: 'public',
  title: null,
  rendering: 'cached',
  indexable: true,
  comments: null,
  updated_at: STAMP,
  ...over,
});
const own: Metadata = {
  title: 'Calendar',
  description: 'Every session.',
  openGraph: { title: 'Calendar — Paddock Tracker', description: 'Every session.', type: 'website' },
  twitter: { card: 'summary_large_image', title: 'Calendar — Paddock Tracker' },
};

beforeEach(() => {
  configured = true;
  rows = { data: [calendar()], error: null };
  from.mockReset();
  currentUser.mockReset();
  currentUser.mockResolvedValue(null);
  loadLiveFrame.mockReset();
  loadLiveFrame.mockResolvedValue(null);
  resetPageFrameMemo();
});
afterEach(() => {
  resetPageFrameMemo();
});

describe('applyFrame', () => {
  it('leaves the code alone when the row sets nothing beyond what the code says', () => {
    expect(applyFrame(own, { name: 'Calendar', title: null, indexable: true, authz: 'public' })).toEqual(own);
  });

  it("a title on the row replaces the page's own, in the tab and on the card with the site's suffix", () => {
    const out = applyFrame(own, { name: 'Calendar', title: 'Race calendar 2026', indexable: true, authz: 'public' });
    expect(out.title).toBe('Race calendar 2026');
    expect(out.openGraph).toMatchObject({ title: 'Race calendar 2026 — Paddock Tracker', description: 'Every session.' });
    expect(out.twitter).toMatchObject({ title: 'Race calendar 2026 — Paddock Tracker', card: 'summary_large_image' });
    expect(out.description).toBe('Every session.');
  });

  it('indexable off adds noindex, follow; the code saying noindex already is kept; indexable on leaves the code', () => {
    expect(applyFrame(own, { name: 'Calendar', title: null, indexable: false, authz: 'public' }).robots).toEqual({ index: false, follow: true });
    const strict: Metadata = { ...own, robots: { index: false, follow: false } };
    expect(applyFrame(strict, { name: 'Calendar', title: null, indexable: false, authz: 'public' }).robots).toEqual({ index: false, follow: false });
    expect(applyFrame({ ...own, robots: 'noindex' }, { name: 'Calendar', title: null, indexable: false, authz: 'public' }).robots).toBe('noindex');
    expect(applyFrame(own, { name: 'Calendar', title: null, indexable: true, authz: 'public' }).robots).toBeUndefined();
  });
});

describe('loadPageFrame', () => {
  it('reads the code rows once a minute and answers by path; nothing without a row or a database', async () => {
    expect(await loadPageFrame('/calendar')).toMatchObject({ name: 'Calendar', title: null, indexable: true, authz: 'public', row: { path: '/calendar', kind: 'code' } });
    expect(await loadPageFrame('/about')).toBeNull();
    expect(from).toHaveBeenCalledTimes(1);
    configured = false;
    resetPageFrameMemo();
    expect(await loadPageFrame('/calendar')).toBeNull();
  });

  it('does not memoise a failed read, and leaves out a row the parser cannot use', async () => {
    rows = { data: null, error: { message: 'down' } };
    expect(await loadPageFrame('/calendar')).toBeNull();
    rows = { data: [calendar(), { ...calendar({ path: 'not a path' }) }], error: null };
    expect(await loadPageFrame('/calendar')).not.toBeNull();
    expect(from).toHaveBeenCalledTimes(2);
  });
});

describe('pageMetadata', () => {
  it('wraps a metadata object and a metadata function alike, applying the row when there is one', async () => {
    rows = { data: [calendar({ title: 'Race calendar 2026', indexable: false })], error: null };
    const fromObject = pageMetadata('/calendar', own);
    expect(await fromObject(undefined)).toMatchObject({ title: 'Race calendar 2026', robots: { index: false, follow: true } });
    const fromFunction = pageMetadata('/calendar', async ({ params }: { params: Promise<{ slug: string }> }) => ({ title: `Series ${(await params).slug}` }));
    expect(await fromFunction({ params: Promise.resolve({ slug: 'f1' }) })).toMatchObject({ title: 'Race calendar 2026' });
  });

  it('hands the code its own metadata when the path has no row or the database cannot be read', async () => {
    expect(await pageMetadata('/about', own)(undefined)).toEqual(own);
    rows = { data: null, error: { message: 'down' } };
    resetPageFrameMemo();
    expect(await pageMetadata('/calendar', own)(undefined)).toEqual(own);
  });
});

describe('withPageGate', () => {
  const Page = async ({ params }: { params: Promise<{ slug: string }> }) => `page ${(await params).slug}`;
  const props = { params: Promise.resolve({ slug: 'f1' }) };
  const typeOf = (el: unknown) => (el as { type: unknown }).type;
  const propsOf = (el: unknown) => (el as { props: Record<string, unknown> }).props;

  it("renders the page as it is, by calling it, without a row, with a public row, or when the rows cannot be read; the session is never read", async () => {
    const gated = withPageGate('/calendar', Page);
    expect(await gated(props)).toBe('page f1');
    expect(await withPageGate('/about', Page)(props)).toBe('page f1');
    rows = { data: null, error: { message: 'down' } };
    resetPageFrameMemo();
    expect(await gated(props)).toBe('page f1');
    expect(currentUser).not.toHaveBeenCalled();
  });

  it("lets the page's own notFound and redirect propagate", async () => {
    const NotThere = async () => {
      throw new Error('NEXT_NOT_FOUND');
    };
    await expect(withPageGate('/calendar', NotThere)({})).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it("refuses an anonymous visitor a Signed in page with the scheme's message and Sign in; lets a signed-in one through", async () => {
    rows = { data: [calendar({ authz_key: 'signed_in', title: 'Race calendar 2026' })], error: null };
    const gated = withPageGate('/calendar', Page);
    const refused = await gated(props);
    expect(typeOf(refused)).toBe(RefusedPage);
    expect(propsOf(refused)).toEqual({ title: 'Race calendar 2026', message: 'Sign in to see this.', signInHelps: true });
    currentUser.mockResolvedValue({ id: 'u', publicMetadata: {}, emailAddresses: [] });
    expect(await gated(props)).toBe('page f1');
  });

  it('meets the 404 when the scheme has no message, and uses the name when the row has no title', async () => {
    rows = { data: [calendar({ authz_key: 'administrator' })], error: null };
    await expect(withPageGate('/calendar', Page)(props)).rejects.toThrow('NEXT_NOT_FOUND');
    rows = { data: [calendar({ authz_key: 'contributor' })], error: null };
    resetPageFrameMemo();
    currentUser.mockResolvedValue({ id: 'u', publicMetadata: {}, emailAddresses: [] });
    const refused = await withPageGate('/calendar', Page)(props);
    expect(typeOf(refused)).toBe(RefusedPage);
    expect(propsOf(refused)).toEqual({ title: 'Calendar', message: 'For approved writers.', signInHelps: false });
  });

  const welcome = (over: Partial<Region> = {}): Region =>
    ({ id: 'welcome', kind: 'static', title: 'Welcome', position: 'header', seq: 10, column: 1, span: 12, newRow: true, hidden: false, authz: null, text: 'Every session, {shortcut:times.local}', ...over }) as Region;
  const live = (regions: Region[]) => ({ revisionId: 'r1', publishedAt: STAMP, document: { version: 1, regions, actions: [] } });
  const dataOf = (el: unknown) => (propsOf(el) as { d: RowPageData }).d;

  it("puts the live revision's regions around the code's page; without a live frame, without regions, or when it cannot be read the page is left alone", async () => {
    loadLiveFrame.mockResolvedValue(live([welcome()]));
    const gated = withPageGate('/calendar', Page);
    const framed = await gated(props);
    expect(typeOf(framed)).toBe(CodePageFrame);
    expect(propsOf(framed).children).toBe('page f1');
    const d = dataOf(framed);
    expect(d.page.path).toBe('/calendar');
    expect(d.document.regions.map(r => r.id)).toEqual(['welcome']);
    expect(d.shortcuts['times.local']).toBe('All times are local.');
    expect([...d.allowed]).toEqual([]);
    expect(loadLiveFrame).toHaveBeenCalledWith('/calendar');
    expect(currentUser).not.toHaveBeenCalled();

    loadLiveFrame.mockResolvedValue(live([]));
    expect(await gated(props)).toBe('page f1');
    loadLiveFrame.mockRejectedValue(new Error('down'));
    expect(await gated(props)).toBe('page f1');
    expect(await withPageGate('/about', Page)(props)).toBe('page f1');
  });

  it("reads the session only when a region asks for a scheme, and hands the frame the scheme's message for a visitor who fails it", async () => {
    loadLiveFrame.mockResolvedValue(live([welcome({ authz: 'signed_in' })]));
    const gated = withPageGate('/calendar', Page);
    const anonymous = dataOf(await gated(props));
    expect([...anonymous.allowed]).toEqual([]);
    expect(anonymous.messages).toEqual({ signed_in: 'Sign in to see this.' });
    expect(currentUser).toHaveBeenCalledTimes(1);
    currentUser.mockResolvedValue({ id: 'u', publicMetadata: {}, emailAddresses: [] });
    expect([...dataOf(await gated(props)).allowed]).toEqual(['signed_in']);
  });

  it('R2a: body regions go around the code’s body, and a signed-in rule reads the session and leaves the region out for an anonymous visitor', async () => {
    const legacy: Region = { id: 'code-body', kind: 'component', component: 'page.body', settings: {}, title: '', position: 'body', seq: 20, column: 1, span: 12, newRow: true, hidden: false, authz: null };
    loadLiveFrame.mockResolvedValue(live([welcome({ id: 'above', position: 'body', seq: 10 }), legacy, welcome({ id: 'members', position: 'body', seq: 30, show: 'signed-in' })]));
    const gated = withPageGate('/calendar', Page);
    const anonymous = await gated(props);
    expect(typeOf(anonymous)).toBe(CodePageFrame);
    expect(dataOf(anonymous).document.regions.map(r => r.id)).toEqual(['above', 'code-body']);
    expect(currentUser).toHaveBeenCalledTimes(1);
    currentUser.mockResolvedValue({ id: 'u', publicMetadata: {}, emailAddresses: [] });
    expect(dataOf(await gated(props)).document.regions.map(r => r.id)).toEqual(['above', 'code-body', 'members']);
  });

  it('R2b: the components a revision places are drawn for the frame, and a race-weekend rule reads the calendar fact only when a rule asks', async () => {
    const wire: Region = { id: 'wire', kind: 'component', component: 'home.wire', settings: { items: 5 }, title: '', position: 'body', seq: 10, column: 1, span: 12, newRow: true, hidden: false, authz: null };
    loadLiveFrame.mockResolvedValue(live([wire, welcome({ id: 'quiet', position: 'body', seq: 20, show: 'between-weekends' })]));
    const gated = withPageGate('/calendar', Page);
    raceWeekend.mockResolvedValue(true);
    let d = dataOf(await gated(props));
    expect(d.components).toEqual({ wire: 'drawn wire' });
    expect(d.document.regions.map(r => r.id)).toEqual(['wire']);
    expect(raceWeekend).toHaveBeenCalledTimes(1);
    raceWeekend.mockResolvedValue(false);
    d = dataOf(await gated(props));
    expect(d.document.regions.map(r => r.id)).toEqual(['wire', 'quiet']);
    raceWeekend.mockClear();
    loadLiveFrame.mockResolvedValue(live([wire]));
    await gated(props);
    expect(raceWeekend).not.toHaveBeenCalled();
  });

  it('P1.2: the templates’ presets ride the frame’s data from the appearance, the shipped ones when nothing is stored', async () => {
    loadLiveFrame.mockResolvedValue(live([welcome({ id: 'above', position: 'header', seq: 10 })]));
    const gated = withPageGate('/calendar', Page);
    expect(dataOf(await gated(props)).templates).toEqual(SHIPPED_PRESETS);
    const roomy = { standard: { ...SHIPPED_PRESETS.standard, spacing: 'SPACING_ROOMY' } };
    loadAppearance.mockResolvedValueOnce({ ...SHIPPED_APPEARANCE, templates: roomy });
    expect(dataOf(await gated(props)).templates).toEqual(roomy);
  });
});
