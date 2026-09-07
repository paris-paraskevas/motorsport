import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentUser = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ currentUser: () => currentUser() }));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

const insert = vi.fn();
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => true,
  betDb: () => ({ from: () => ({ insert: (row: unknown) => insert(row) }) }),
}));

import { POST } from './route';

const admin = { id: 'user_admin', publicMetadata: { role: 'admin' } };

function post(body: unknown) {
  return POST(
    new Request('https://paddock-tracker.com/api/admin/page-layout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

// The three Workers share one database, so the layout route is the first place
// the "production knows it is production" rule bites: a publish from a preview
// must be refused, and nothing may be written before that refusal.
describe('POST /api/admin/page-layout', () => {
  beforeEach(() => {
    currentUser.mockReset();
    currentUser.mockResolvedValue(admin);
    insert.mockReset();
    insert.mockResolvedValue({ error: null });
    revalidatePath.mockClear();
  });
  afterEach(() => {
    delete process.env.PADDOCK_ENV;
  });

  it('is 404 for anyone who is not an administrator, whatever the environment', async () => {
    process.env.PADDOCK_ENV = 'production';
    currentUser.mockResolvedValue({ id: 'user_reader', publicMetadata: {} });
    const res = await post({ blocks: [{ id: 'wire' }] });
    expect(res.status).toBe(404);
    expect(insert).not.toHaveBeenCalled();
  });

  it('refuses to publish from a Worker that is not production, writing nothing', async () => {
    delete process.env.PADDOCK_ENV;
    const res = await post({ blocks: [{ id: 'wire' }] });
    expect(res.status).toBe(403);
    const json = (await res.json()) as { error: string };
    expect(json.error).toMatch(/production/);
    expect(insert).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('publishes a new revision on production and refreshes the home page', async () => {
    process.env.PADDOCK_ENV = 'production';
    const res = await post({ blocks: [{ id: 'wire' }, { id: 'blog', hidden: true }] });
    expect(res.status).toBe(200);
    expect(insert).toHaveBeenCalledTimes(1);
    const row = insert.mock.calls[0][0] as {
      page_key: string;
      published_at: string | null;
      created_by: string | null;
      blocks: Array<{ id: string; hidden?: boolean }>;
    };
    expect(row.page_key).toBe('home');
    expect(typeof row.published_at).toBe('string');
    expect(row.created_by).toBe('user_admin');
    expect(row.blocks[0]).toMatchObject({ id: 'wire' });
    expect(row.blocks[1]).toMatchObject({ id: 'blog', hidden: true });
    expect(revalidatePath).toHaveBeenCalledWith('/');
  });
});
