import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Metadata } from 'next';
import { DEFAULT_AUTHZ_SCHEMES } from './authz-defaults';
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
const currentUser = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ currentUser: () => currentUser() }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

import { applyFrame, loadPageFrame, pageMetadata, resetPageFrameMemo, withPageGate } from './page-frame';

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
    expect(await loadPageFrame('/calendar')).toEqual({ name: 'Calendar', title: null, indexable: true, authz: 'public' });
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
});
