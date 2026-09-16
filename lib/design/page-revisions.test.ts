import { beforeEach, describe, expect, it, vi } from 'vitest';

let configured = true;
let pageRows: { data: unknown; error: { message: string } | null } = { data: [], error: null };
let revRows: { data: unknown; error: { message: string } | null } = { data: [], error: null };
// Named by (P1.12 B2): the list entries and the live revisions' refs naming the page.
let entryRows: { data: unknown; error: { message: string } | null } = { data: [], error: null };
let listRows: { data: unknown; error: { message: string } | null } = { data: [], error: null };
let refRows: { data: unknown; error: { message: string } | null } = { data: [], error: null };
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => configured,
  betDb: () => ({
    from: (table: string) => {
      const result = table === 'page' ? pageRows : table === 'list_entry' ? entryRows : table === 'list' ? listRows : table === 'page_revision_ref' ? refRows : revRows;
      const q = {
        select: () => q,
        eq: () => q,
        in: () => q,
        is: () => q,
        not: () => q,
        order: () => q,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject),
      };
      return q;
    },
  }),
}));

import { loadPageDetail } from './page-revisions';

const ID = 'a1b2c3d4-0000-4000-8000-000000000010';
const page = {
  id: ID,
  path: '/history/monza',
  name: 'Monza, a history',
  kind: 'row',
  group_key: 'editorial',
  template: 'paddock-standard',
  authz_key: 'public',
  title: null,
  rendering: 'cached',
  indexable: false,
  comments: null,
  updated_at: '2026-09-08T16:00:00.505502+00:00',
};
const doc = { version: 1, regions: [{ id: 'intro', kind: 'static', position: 'body', seq: 10, column: 1, span: 12, text: 'Hello' }] };
const r1 = { id: 'b1b2c3d4-0000-4000-8000-000000000001', created_at: '2026-09-08T16:01:00+00:00', published_at: '2026-09-08T16:01:00+00:00', author: 'user_admin', base_revision_id: null, document: doc };
const r2 = { id: 'b1b2c3d4-0000-4000-8000-000000000002', created_at: '2026-09-08T16:05:00+00:00', published_at: null, author: 'user_admin', base_revision_id: r1.id, document: { ...doc, regions: [...doc.regions, { id: 'bad' }] } };

describe('loadPageDetail', () => {
  beforeEach(() => {
    configured = true;
    pageRows = { data: [page], error: null };
    revRows = { data: [r1, r2], error: null };
  });

  it('is null when unconfigured, for an id that is not a UUID, on an error, or for a page that does not exist', async () => {
    configured = false;
    expect(await loadPageDetail(ID)).toBeNull();
    configured = true;
    expect(await loadPageDetail('nope')).toBeNull();
    pageRows = { data: null, error: { message: 'boom' } };
    expect(await loadPageDetail(ID)).toBeNull();
    pageRows = { data: [], error: null };
    expect(await loadPageDetail(ID)).toBeNull();
  });

  it('returns the page, the live revision, the newest revision with its parsed document and problems, and every revision newest first', async () => {
    const d = await loadPageDetail(ID);
    expect(d?.page).toMatchObject({ path: '/history/monza', kind: 'row' });
    expect(d?.live?.id).toBe(r1.id);
    expect(d?.newest?.id).toBe(r2.id);
    expect(d?.newest?.document.regions.map(r => r.id)).toEqual(['intro']);
    expect(d?.newest?.problems).toEqual(['region bad: the kind must be static, image, list, button or component', 'region bad: the position must be one of the six', 'region bad: the sequence must be a whole number', 'region bad: the column must be 1 to 12', 'region bad: the span must be 1 to 12']);
    expect(d?.revisions.map(r => r.id)).toEqual([r2.id, r1.id]);
  });

  it('names what names the page (P1.12 B2): the lists holding an entry to it, and the pages whose LIVE revision carries a dest ref to it; nothing for a code page', async () => {
    const HOME = 'c0de0001-0000-4000-8000-000000000001';
    entryRows = { data: [{ list_key: 'footer-site' }, { list_key: 'footer-site' }, { list_key: 'useful' }], error: null };
    listRows = { data: [{ key: 'footer-site', label: 'Footer: Site' }, { key: 'useful', label: 'Useful links' }], error: null };
    refRows = {
      data: [
        { revision_id: 'b1b2c3d4-0000-4000-8000-000000000011', page_revision: { id: 'b1b2c3d4-0000-4000-8000-000000000011', page_id: HOME, published_at: '2026-09-08T16:01:00+00:00', page: { id: HOME, name: 'Home', deleted_at: null } } },
        // A superseded revision naming the page does not count: the live one is the newest published.
        { revision_id: 'b1b2c3d4-0000-4000-8000-000000000012', page_revision: { id: 'b1b2c3d4-0000-4000-8000-000000000012', page_id: 'c0de0002-0000-4000-8000-000000000002', published_at: '2026-09-08T16:01:00+00:00', page: { id: 'c0de0002-0000-4000-8000-000000000002', name: 'Calendar', deleted_at: null } } },
      ],
      error: null,
    };
    // The newest published revision per page: Home's is the one naming us; Calendar's is a later one.
    revRows = {
      data: [
        { id: 'b1b2c3d4-0000-4000-8000-000000000011', page_id: HOME, published_at: '2026-09-08T16:01:00+00:00' },
        { id: 'b1b2c3d4-0000-4000-8000-000000000013', page_id: 'c0de0002-0000-4000-8000-000000000002', published_at: '2026-09-09T16:01:00+00:00' },
        { id: 'b1b2c3d4-0000-4000-8000-000000000012', page_id: 'c0de0002-0000-4000-8000-000000000002', published_at: '2026-09-08T16:01:00+00:00' },
      ],
      error: null,
    };
    const d = await loadPageDetail(ID);
    expect(d?.namedBy).toEqual({ lists: ['Footer: Site', 'Useful links'], pages: ['Home'] });
    pageRows = { data: [{ ...page, kind: 'code', path: '/calendar' }], error: null };
    expect((await loadPageDetail(ID))?.namedBy).toEqual({ lists: [], pages: [] });
  });

  it('has no live and no newest revision for a page never saved', async () => {
    revRows = { data: [], error: null };
    const d = await loadPageDetail(ID);
    expect(d?.live).toBeNull();
    expect(d?.newest).toBeNull();
    expect(d?.revisions).toEqual([]);
  });
});
