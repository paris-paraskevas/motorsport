import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentUser = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ currentUser: () => currentUser() }));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

// One fake table. The live-revision read answers with `live` (or `liveError`);
// the insert records its row and answers with a fresh id.
const insert = vi.fn();
let live: { id: string; published_at: string } | null = null;
let liveError: { message: string } | null = null;
function liveQuery() {
  const q = {
    eq: () => q,
    not: () => q,
    order: () => q,
    limit: () => q,
    maybeSingle: async () => ({ data: live, error: liveError }),
  };
  return q;
}
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => true,
  betDb: () => ({
    from: () => ({
      select: () => liveQuery(),
      insert: (row: unknown) => {
        insert(row);
        return { select: () => ({ single: async () => ({ data: { id: 'rev_new' }, error: null }) }) };
      },
    }),
  }),
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

type Inserted = {
  page_key: string;
  published_at: string | null;
  created_by: string | null;
  blocks: Array<{ id: string; hidden?: boolean }>;
};
const inserted = () => insert.mock.calls[0][0] as Inserted;

// The three Workers share one database, so this route is where two rules bite:
// "production knows it is production" (403 off production, nothing written) and
// "revisions, not overwrites" with the version check (409 when the live revision
// moved, nothing written).
describe('POST /api/admin/page-layout', () => {
  beforeEach(() => {
    currentUser.mockReset();
    currentUser.mockResolvedValue(admin);
    insert.mockReset();
    revalidatePath.mockClear();
    live = { id: 'rev_live', published_at: '2026-09-07T20:00:00.000Z' };
    liveError = null;
    process.env.PADDOCK_ENV = 'production';
  });
  afterEach(() => {
    delete process.env.PADDOCK_ENV;
  });

  it('is 404 for anyone who is not an administrator, whatever the environment', async () => {
    currentUser.mockResolvedValue({ id: 'user_reader', publicMetadata: {} });
    const res = await post({ blocks: [{ id: 'wire' }], action: 'publish', base: 'rev_live' });
    expect(res.status).toBe(404);
    expect(insert).not.toHaveBeenCalled();
  });

  it('refuses to write from a Worker that is not production', async () => {
    delete process.env.PADDOCK_ENV;
    const res = await post({ blocks: [{ id: 'wire' }], action: 'publish', base: 'rev_live' });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: string }).error).toMatch(/production/);
    expect(insert).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects a body without an action, so an old client cannot publish by accident', async () => {
    const res = await post({ blocks: [{ id: 'wire' }] });
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it('saves a draft as an unpublished row and leaves the live page alone', async () => {
    const res = await post({ blocks: [{ id: 'wire' }, { id: 'blog', hidden: true }], action: 'draft' });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; action: string; id: string | null };
    expect(json).toMatchObject({ ok: true, action: 'draft', id: 'rev_new' });
    expect(insert).toHaveBeenCalledTimes(1);
    expect(inserted().published_at).toBeNull();
    expect(inserted().created_by).toBe('user_admin');
    expect(inserted().blocks[0]).toMatchObject({ id: 'wire' });
    expect(inserted().blocks[1]).toMatchObject({ id: 'blog', hidden: true });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('publishes when the base is still the live revision, and refreshes the home page', async () => {
    const res = await post({ blocks: [{ id: 'wire' }], action: 'publish', base: 'rev_live' });
    expect(res.status).toBe(200);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(inserted().page_key).toBe('home');
    expect(typeof inserted().published_at).toBe('string');
    expect(revalidatePath).toHaveBeenCalledWith('/');
  });

  it('refuses a publish whose base is no longer live, writes nothing, and names the live revision', async () => {
    const res = await post({ blocks: [{ id: 'wire' }], action: 'publish', base: 'rev_stale' });
    expect(res.status).toBe(409);
    const json = (await res.json()) as { error: string; live: { id: string } | null };
    expect(json.live?.id).toBe('rev_live');
    expect(insert).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('treats "nothing was live when I loaded" as a base too', async () => {
    live = null;
    const first = await post({ blocks: [{ id: 'wire' }], action: 'publish', base: null });
    expect(first.status).toBe(200);
    live = { id: 'rev_live', published_at: '2026-09-07T20:00:00.000Z' };
    insert.mockReset();
    const stale = await post({ blocks: [{ id: 'wire' }], action: 'publish', base: null });
    expect(stale.status).toBe(409);
    expect(insert).not.toHaveBeenCalled();
  });

  it('refuses rather than waves through when the version cannot be read', async () => {
    liveError = { message: 'connection refused' };
    const res = await post({ blocks: [{ id: 'wire' }], action: 'publish', base: 'rev_live' });
    expect(res.status).toBe(500);
    expect(insert).not.toHaveBeenCalled();
  });
});
