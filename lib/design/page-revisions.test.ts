import { beforeEach, describe, expect, it, vi } from 'vitest';

let configured = true;
let pageRows: { data: unknown; error: { message: string } | null } = { data: [], error: null };
let revRows: { data: unknown; error: { message: string } | null } = { data: [], error: null };
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => configured,
  betDb: () => ({
    from: (table: string) => {
      const result = table === 'page' ? pageRows : revRows;
      const q = {
        select: () => q,
        eq: () => q,
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
    expect(d?.newest?.problems).toEqual(['region bad: the kind must be static, image or list', 'region bad: the position must be one of the six', 'region bad: the sequence must be a whole number', 'region bad: the column must be 1 to 12', 'region bad: the span must be 1 to 12']);
    expect(d?.revisions.map(r => r.id)).toEqual([r2.id, r1.id]);
  });

  it('has no live and no newest revision for a page never saved', async () => {
    revRows = { data: [], error: null };
    const d = await loadPageDetail(ID);
    expect(d?.live).toBeNull();
    expect(d?.newest).toBeNull();
    expect(d?.revisions).toEqual([]);
  });
});
