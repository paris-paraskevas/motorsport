import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentUser = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ currentUser: () => currentUser() }));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

// A fake database: the list row and its entries for the reads, and the
// design_save_list function for the write.
const rpc = vi.fn();
let listRow: { data: unknown; error: { message: string } | null } = { data: null, error: null };
let entryRows: { data: unknown; error: { message: string } | null } = { data: [], error: null };
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => true,
  betDb: () => ({
    rpc: (fn: string, args: unknown) => rpc(fn, args),
    from: (table: string) => {
      const result = table === 'list' ? listRow : entryRows;
      const q = {
        select: () => q,
        eq: () => q,
        in: () => q,
        order: () => q,
        maybeSingle: async () => result,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject),
      };
      return q;
    },
  }),
}));

import { GET, PUT } from './route';

const admin = { id: 'user_admin', publicMetadata: { role: 'admin' } };
const STAMP = '2026-09-08T06:34:16.728382+00:00';
const params = (key: string) => ({ params: Promise.resolve({ key }) });

function put(key: string, body: unknown) {
  return PUT(
    new Request(`https://paddock-tracker.com/api/admin/design/lists/${key}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    params(key),
  );
}
const get = (key: string) => GET(new Request(`https://paddock-tracker.com/api/admin/design/lists/${key}`), params(key));

describe('/api/admin/design/lists/[key]', () => {
  beforeEach(() => {
    currentUser.mockReset();
    currentUser.mockResolvedValue(admin);
    rpc.mockReset();
    rpc.mockResolvedValue({ data: '2026-09-08T07:00:00.000001+00:00', error: null });
    revalidatePath.mockClear();
    listRow = { data: { key: 'doors', role: 'menu', label: 'Header doors', updated_at: STAMP }, error: null };
    entryRows = { data: [{ seq: 10, label: 'Calendar', dest_key: 'calendar' }], error: null };
    process.env.PADDOCK_ENV = 'production';
  });
  afterEach(() => {
    delete process.env.PADDOCK_ENV;
  });

  it('GET is 404 for a non-admin and for a list that does not exist, else the list with its stamp verbatim', async () => {
    currentUser.mockResolvedValue({ id: 'u', publicMetadata: {} });
    expect((await get('doors')).status).toBe(404);
    currentUser.mockResolvedValue(admin);
    listRow = { data: null, error: null };
    expect((await get('nope')).status).toBe(404);
    listRow = { data: { key: 'doors', role: 'menu', label: 'Header doors', updated_at: STAMP }, error: null };
    const res = await get('doors');
    expect(res.status).toBe(200);
    const json = (await res.json()) as { key: string; updatedAt: string; entries: unknown[] };
    expect(json.key).toBe('doors');
    expect(json.updatedAt).toBe(STAMP);
    expect(json.entries).toEqual([{ label: 'Calendar', dest: 'calendar' }]);
  });

  it('PUT refuses off production, writing nothing', async () => {
    delete process.env.PADDOCK_ENV;
    const res = await put('doors', { entries: [{ label: 'Calendar', dest: 'calendar' }], updatedAt: STAMP });
    expect(res.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('PUT rejects a typed URL, an empty label, a missing stamp and a bad bar count, before touching the database', async () => {
    let res = await put('doors', { entries: [{ label: 'Evil', dest: 'https://evil.example' }], updatedAt: STAMP });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/catalogue/);
    res = await put('doors', { entries: [{ label: '  ', dest: 'calendar' }], updatedAt: STAMP });
    expect(res.status).toBe(400);
    res = await put('doors', { entries: [{ label: 'Calendar', dest: 'calendar' }] });
    expect(res.status).toBe(400);
    listRow = { data: { key: 'bar', role: 'bar', label: 'Phone bar', updated_at: STAMP }, error: null };
    res = await put('bar', { entries: [{ label: 'Home', dest: 'home' }, { label: 'Learn', dest: 'learn' }], updatedAt: STAMP });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/3 to 5/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('PUT saves through design_save_list with the stamp verbatim, then refreshes every page', async () => {
    const res = await put('doors', {
      entries: [
        { label: 'Races', dest: 'calendar' },
        { label: 'Learn', dest: 'learn', icon: '', authz: 'signed_in' },
      ],
      updatedAt: STAMP,
    });
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(fn).toBe('design_save_list');
    expect(args.p_application).toBe('paddock');
    expect(args.p_key).toBe('doors');
    expect(args.p_expected).toBe(STAMP);
    expect(args.p_actor).toBe('user_admin');
    expect(args.p_entries).toEqual([
      { label: 'Races', dest_key: 'calendar', icon: null, authz_key: null },
      { label: 'Learn', dest_key: 'learn', icon: null, authz_key: 'signed_in' },
    ]);
    const json = (await res.json()) as { ok: boolean; updatedAt: string };
    expect(json.ok).toBe(true);
    expect(json.updatedAt).toBe('2026-09-08T07:00:00.000001+00:00');
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });

  it('PUT answers 409 with the current list when the function says the stamp is stale', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'stale' } });
    const res = await put('doors', { entries: [{ label: 'Races', dest: 'calendar' }], updatedAt: 'old' });
    expect(res.status).toBe(409);
    const json = (await res.json()) as { error: string; current: { updatedAt: string } | null };
    expect(json.current?.updatedAt).toBe(STAMP);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
