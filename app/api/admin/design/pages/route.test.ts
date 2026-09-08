import { beforeEach, describe, expect, it, vi } from 'vitest';

const currentUser = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ currentUser: () => currentUser() }));

let rows: { data: unknown; error: { message: string } | null } = { data: [], error: null };
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => true,
  betDb: () => ({
    from: () => {
      const read = {
        select: () => read,
        eq: () => read,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(rows).then(resolve, reject),
      };
      return { select: () => read };
    },
  }),
}));

import { GET } from './route';
import { CODE_PAGES } from '@/lib/design/page-registry';

const admin = { id: 'user_admin', publicMetadata: { role: 'admin' } };

describe('/api/admin/design/pages', () => {
  beforeEach(() => {
    currentUser.mockReset();
    currentUser.mockResolvedValue(admin);
    rows = { data: [], error: null };
  });

  it('is 404 for a non-admin and lists the registry for an admin', async () => {
    currentUser.mockResolvedValue({ id: 'u', publicMetadata: {} });
    expect((await GET()).status).toBe(404);
    currentUser.mockResolvedValue(admin);
    const res = await GET();
    expect(res.status).toBe(200);
    const json = (await res.json()) as { pages: { path: string }[] };
    expect(json.pages).toHaveLength(CODE_PAGES.length);
    expect(json.pages[0].path).toBe('/');
  });

  it('is 500 when the rows cannot be read', async () => {
    rows = { data: null, error: { message: 'boom' } };
    expect((await GET()).status).toBe(500);
  });
});
