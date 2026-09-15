import { beforeEach, describe, expect, it, vi } from 'vitest';

let configured = true;
let tables: Record<string, { data: unknown; error: { message: string } | null }> = {};
const calls: string[] = [];
/** Every `.is(col, value)` step, by table: the readers' skip of deleted rows (P1.12). */
const isCalls: [string, string, unknown][] = [];
// The fake answers a table's reads with its rows; `.not(col, 'is', null)` is
// honoured (the live-revision read filters published ones), the other filters
// are not.
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => configured,
  betDb: () => ({
    from: (table: string) => {
      calls.push(table);
      let notNull: string | null = null;
      const q: Record<string, unknown> = {};
      const chain = () => q;
      Object.assign(q, {
        select: chain,
        eq: chain,
        order: chain,
        limit: chain,
        in: chain,
        is: (col: string, value: unknown) => {
          isCalls.push([table, col, value]);
          return q;
        },
        not: (col: string) => {
          notNull = col;
          return q;
        },
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
          const res = tables[table] ?? { data: [], error: null };
          const data =
            notNull && Array.isArray(res.data) ? (res.data as Record<string, unknown>[]).filter(r => r[notNull!] != null) : res.data;
          return Promise.resolve({ ...res, data }).then(resolve, reject);
        },
      });
      return q;
    },
  }),
}));

import { loadAssetsById, loadLiveComposed, loadLiveFrame, loadLivePage, loadRevisionPreview } from './live-page';

const ID = 'a1b2c3d4-0000-4000-8000-000000000010';
const ASSET = 'c1b2c3d4-0000-4000-8000-000000000031';
const page = {
  id: ID,
  path: '/history/monza',
  name: 'Monza, a history',
  kind: 'row',
  group_key: 'editorial',
  template: 'paddock-standard',
  authz_key: 'public',
  title: 'Monza',
  rendering: 'cached',
  indexable: true,
  comments: null,
  updated_at: '2026-09-08T16:00:00+00:00',
};
const revision = {
  id: 'b1b2c3d4-0000-4000-8000-000000000001',
  published_at: '2026-09-08T17:10:00+00:00',
  document: {
    version: 1,
    regions: [
      { id: 'intro', kind: 'static', position: 'body', seq: 10, column: 1, span: 12, text: 'Hello {shortcut:times.local}' },
      { id: 'broken', kind: 'image', position: 'body', seq: 20, column: 1, span: 12 },
    ],
  },
};

describe('loadLivePage', () => {
  beforeEach(() => {
    configured = true;
    calls.length = 0;
    tables = { page: { data: [page], error: null }, page_revision: { data: [revision], error: null } };
  });

  it('is null when unconfigured or for a path outside the row-page rule, without touching the database', async () => {
    configured = false;
    expect(await loadLivePage('/history/monza')).toBeNull();
    configured = true;
    expect(await loadLivePage('/History/Monza')).toBeNull();
    expect(await loadLivePage('/series/[slug]')).toBeNull();
    expect(calls).toEqual([]);
  });

  it('is null on an error, when the page does not exist, when it is a code page, or when nothing is published', async () => {
    tables.page = { data: null, error: { message: 'boom' } };
    expect(await loadLivePage('/history/monza')).toBeNull();
    tables.page = { data: [], error: null };
    expect(await loadLivePage('/history/monza')).toBeNull();
    tables.page = { data: [{ ...page, kind: 'code' }], error: null };
    expect(await loadLivePage('/history/monza')).toBeNull();
    tables.page = { data: [page], error: null };
    tables.page_revision = { data: [], error: null };
    expect(await loadLivePage('/history/monza')).toBeNull();
    tables.page_revision = { data: null, error: { message: 'boom' } };
    expect(await loadLivePage('/history/monza')).toBeNull();
  });

  it('returns the page and its live revision with the usable part of the document', async () => {
    const live = await loadLivePage('/history/monza');
    expect(live?.page).toMatchObject({ path: '/history/monza', title: 'Monza', indexable: true });
    expect(live?.revisionId).toBe(revision.id);
    expect(live?.publishedAt).toBe(revision.published_at);
    expect(live?.document.regions.map(r => r.id)).toEqual(['intro']);
  });

  it('skips a deleted page (P1.12): every reader of the page table asks for deleted_at null', async () => {
    isCalls.length = 0;
    await loadLivePage('/history/monza');
    expect(isCalls).toEqual([['page', 'deleted_at', null]]);
    isCalls.length = 0;
    await loadLiveComposed('/calendar');
    expect(isCalls).toEqual([['page', 'deleted_at', null]]);
    isCalls.length = 0;
    tables.page_revision = { data: [{ ...revision, page_id: ID, created_at: '2026-09-08T17:10:00+00:00' }], error: null };
    await loadRevisionPreview(revision.id);
    expect(isCalls).toEqual([['page', 'deleted_at', null]]);
  });
});

describe('loadRevisionPreview', () => {
  const stored = { ...revision, page_id: ID, created_at: '2026-09-08T17:10:00+00:00' };
  const draft = { ...stored, id: 'b1b2c3d4-0000-4000-8000-000000000002', created_at: '2026-09-08T19:20:00+00:00', published_at: null };
  beforeEach(() => {
    configured = true;
    calls.length = 0;
    tables = { page: { data: [page], error: null }, page_revision: { data: [stored], error: null } };
  });

  it('is null when unconfigured, for an id that is not one, for a missing revision, or for a page that is not a row page', async () => {
    configured = false;
    expect(await loadRevisionPreview(revision.id)).toBeNull();
    configured = true;
    expect(await loadRevisionPreview('nope')).toBeNull();
    expect(calls).toEqual([]);
    tables.page_revision = { data: [], error: null };
    expect(await loadRevisionPreview(revision.id)).toBeNull();
    tables.page_revision = { data: [stored], error: null };
    tables.page = { data: [{ ...page, kind: 'code' }], error: null };
    expect(await loadRevisionPreview(revision.id)).toBeNull();
    // A code page served from rows (R4.1) has a preview: its revision is what the site serves.
    tables.page = { data: [{ ...page, path: '/calendar', name: 'Calendar', kind: 'code' }], error: null };
    const composed = await loadRevisionPreview(revision.id);
    expect(composed?.page.served).toBe('rows');
    expect(composed?.page.path).toBe('/calendar');
  });

  it('returns the revision with its page, whether it is the live one, and the usable part of the document with its problems', async () => {
    // The fake answers every page_revision read with the same rows: the
    // revision looked up is also the newest published one, so it is live.
    const live = await loadRevisionPreview(revision.id);
    expect(live?.page.path).toBe('/history/monza');
    expect(live?.isLive).toBe(true);
    expect(live?.document.regions.map(r => r.id)).toEqual(['intro']);
    expect(live?.problems).toEqual(['region broken: the image must name one of your photos']);
    tables.page_revision = { data: [draft], error: null };
    const d = await loadRevisionPreview(draft.id);
    expect(d?.publishedAt).toBeNull();
    expect(d?.isLive).toBe(false);
  });
});

describe('loadAssetsById', () => {
  beforeEach(() => {
    configured = true;
    tables = {
      asset: {
        data: [
          { id: ASSET, r2_key: '2026/09/a1b2c3d4-0000-4000-8000-000000000001.jpg', caption: 'The banking', credit: 'P.P.', licence: 'CC BY 4.0', width: 600, height: 400, bytes: 1000, content_type: 'image/jpeg', created_at: '2026-09-08T16:00:00+00:00', updated_at: '2026-09-08T16:00:00+00:00' },
          { id: 'not-a-uuid', r2_key: 'x' },
        ],
        error: null,
      },
    };
  });

  it('is empty for no ids, when unconfigured or on an error, and maps the usable rows by id otherwise', async () => {
    expect((await loadAssetsById([])).size).toBe(0);
    configured = false;
    expect((await loadAssetsById([ASSET])).size).toBe(0);
    configured = true;
    const map = await loadAssetsById([ASSET]);
    expect(map.size).toBe(1);
    expect(map.get(ASSET)?.url).toBe('/media/2026/09/a1b2c3d4-0000-4000-8000-000000000001.jpg');
    tables.asset = { data: null, error: { message: 'boom' } };
    expect((await loadAssetsById([ASSET])).size).toBe(0);
  });
});

describe('loadLiveFrame', () => {
  const frameRevision = {
    id: 'b1b2c3d4-0000-4000-8000-000000000007',
    published_at: '2026-09-09T00:10:00+00:00',
    document: { version: 1, regions: [{ id: 'welcome', kind: 'static', position: 'header', seq: 10, column: 1, span: 12, text: 'Hello' }], actions: [] },
    page: { id: 'c0de0000-0000-4000-8000-000000000002' },
  };
  beforeEach(() => {
    configured = true;
    calls.length = 0;
    tables = { page_revision: { data: [frameRevision], error: null } };
  });

  it('is null when unconfigured, on an error, and when the code page has nothing published, without a second table read', async () => {
    configured = false;
    expect(await loadLiveFrame('/about')).toBeNull();
    expect(calls).toEqual([]);
    configured = true;
    tables = { page_revision: { data: null, error: { message: 'down' } } };
    expect(await loadLiveFrame('/about')).toBeNull();
    tables = { page_revision: { data: [], error: null } };
    expect(await loadLiveFrame('/about')).toBeNull();
    tables = { page_revision: { data: [{ ...frameRevision, published_at: null }], error: null } };
    expect(await loadLiveFrame('/about')).toBeNull();
    expect(calls).toEqual(['page_revision', 'page_revision', 'page_revision']);
  });

  it('returns the live revision with the usable part of its document, from the one joined read', async () => {
    const frame = await loadLiveFrame('/about');
    expect(frame?.revisionId).toBe(frameRevision.id);
    expect(frame?.publishedAt).toBe('2026-09-09T00:10:00+00:00');
    expect(frame?.document.regions.map(r => `${r.position}:${r.id}`)).toEqual(['header:welcome']);
    expect(calls).toEqual(['page_revision']);
  });
});
