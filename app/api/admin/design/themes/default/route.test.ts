import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentUser = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ currentUser: () => currentUser() }));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

// The database function does the work; the fake records its arguments and
// answers with `rpcResult`. `rows` answers the read a 409 carries.
const rpc = vi.fn();
let rpcResult: { data: unknown; error: { message: string } | null } = { data: null, error: null };
let rows: { data: unknown; error: { message: string } | null } = { data: [], error: null };
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => true,
  betDb: () => ({
    rpc: (fn: string, args: unknown) => {
      rpc(fn, args);
      return Promise.resolve(rpcResult);
    },
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

import { PUT } from './route';

const admin = { id: 'user_admin', publicMetadata: { role: 'admin' } };
const STAMP = '2026-09-08T11:30:00.505502+00:00';

function put(body: unknown) {
  return PUT(
    new Request('https://paddock-tracker.com/api/admin/design/themes/default', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

describe('PUT /api/admin/design/themes/default', () => {
  beforeEach(() => {
    currentUser.mockReset();
    currentUser.mockResolvedValue(admin);
    rpc.mockReset();
    revalidatePath.mockClear();
    rpcResult = { data: '2026-09-08T11:40:00.000001+00:00', error: null };
    rows = { data: [{ key: 'paper', label: 'Paper', tokens: {}, is_default: true, available: true, base: null, updated_at: STAMP }], error: null };
    process.env.PADDOCK_ENV = 'production';
  });
  afterEach(() => {
    delete process.env.PADDOCK_ENV;
  });

  it('is 404 for a non-admin, 403 off production, 400 for a bad key or stamp, touching nothing', async () => {
    currentUser.mockResolvedValue({ id: 'u', publicMetadata: {} });
    expect((await put({ key: 'midnight', updatedAt: STAMP })).status).toBe(404);
    currentUser.mockResolvedValue(admin);
    delete process.env.PADDOCK_ENV;
    expect((await put({ key: 'midnight', updatedAt: STAMP })).status).toBe(403);
    process.env.PADDOCK_ENV = 'production';
    expect((await put({ key: 'Not A Key', updatedAt: STAMP })).status).toBe(400);
    expect((await put({ key: 'midnight' })).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('calls design_set_default_theme with the current default’s stamp verbatim and refreshes every page', async () => {
    const res = await put({ key: 'midnight', updatedAt: STAMP });
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('design_set_default_theme', {
      p_application: 'paddock',
      p_key: 'midnight',
      p_expected: STAMP,
      p_actor: 'user_admin',
    });
    expect((await res.json()) as unknown).toEqual({ ok: true, key: 'midnight', updatedAt: '2026-09-08T11:40:00.000001+00:00' });
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });

  it('passes null when the table has no default yet', async () => {
    expect((await put({ key: 'midnight', updatedAt: null })).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('design_set_default_theme', expect.objectContaining({ p_expected: null }));
  });

  it('answers 409 with the current themes when the function says stale, and 400 for an unavailable theme', async () => {
    rpcResult = { data: null, error: { message: 'stale' } };
    const res = await put({ key: 'midnight', updatedAt: 'old' });
    expect(res.status).toBe(409);
    const json = (await res.json()) as { current: { key: string; isDefault: boolean }[] | null };
    expect(json.current?.find(t => t.key === 'paper')?.isDefault).toBe(true);
    rpcResult = { data: null, error: { message: 'unknown or unavailable theme: ember' } };
    expect((await put({ key: 'ember', updatedAt: STAMP })).status).toBe(400);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
