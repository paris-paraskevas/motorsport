import { beforeEach, describe, expect, it, vi } from 'vitest';

const currentUser = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ currentUser: () => currentUser() }));

let pageRows: { data: unknown; error: { message: string } | null } = { data: [], error: null };
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => true,
  betDb: () => ({
    from: (table: string) => {
      const result = table === 'page' ? pageRows : { data: [], error: null };
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

import { GET } from './route';

const admin = { id: 'user_admin', publicMetadata: { role: 'admin' } };
const ID = 'a1b2c3d4-0000-4000-8000-000000000010';
const call = (id: string) => GET(new Request(`https://paddock-tracker.com/api/admin/design/pages/${id}`), { params: Promise.resolve({ id }) });

describe('/api/admin/design/pages/[id]', () => {
  beforeEach(() => {
    currentUser.mockReset();
    currentUser.mockResolvedValue(admin);
    pageRows = {
      data: [{ id: ID, path: '/history/monza', name: 'Monza, a history', kind: 'row', group_key: 'editorial', template: 'paddock-standard', authz_key: 'public', title: null, rendering: 'cached', indexable: false, comments: null, updated_at: '2026-09-08T16:00:00+00:00' }],
      error: null,
    };
  });

  it('is 404 for a non-admin and for a page that does not exist, and hands an admin the detail', async () => {
    currentUser.mockResolvedValue({ id: 'u', publicMetadata: {} });
    expect((await call(ID)).status).toBe(404);
    currentUser.mockResolvedValue(admin);
    pageRows = { data: [], error: null };
    expect((await call(ID)).status).toBe(404);
    pageRows = { data: [pageRows.data, { id: ID, path: '/history/monza', name: 'Monza, a history', kind: 'row', group_key: 'editorial', template: 'paddock-standard', authz_key: 'public', title: null, rendering: 'cached', indexable: false, comments: null, updated_at: '2026-09-08T16:00:00+00:00' }].flat(), error: null };
    const res = await call(ID);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { page: { path: string }; live: unknown; newest: unknown; revisions: unknown[] };
    expect(json.page.path).toBe('/history/monza');
    expect(json.live).toBeNull();
    expect(json.newest).toBeNull();
    expect(json.revisions).toEqual([]);
  });
});
