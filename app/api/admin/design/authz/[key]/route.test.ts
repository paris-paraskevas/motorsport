import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentAccount = vi.fn();
vi.mock('@/lib/auth/server', () => ({ currentAccount: () => currentAccount(), accountId: async () => ((await currentAccount()) as { id?: string } | null)?.id ?? null }));
const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

// The update chain records its payload and filters and answers with `updated`
// (the rows the conditional update touched); the read for a 409 answers `rows`;
// the delete chain records its filters and answers with `deleted`.
const update = vi.fn();
const filters = vi.fn();
const del = vi.fn();
let updated: { updated_at: string }[] = [];
let deleted: { data: unknown; error: { code?: string; message: string } | null } = { data: [], error: null };
let rows: { data: unknown; error: { message: string } | null } = { data: [], error: null };
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => true,
  betDb: () => ({
    from: () => {
      const read = {
        select: () => read,
        eq: () => read,
        in: () => read,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(rows).then(resolve, reject),
      };
      return {
        select: () => read,
        update: (payload: unknown) => {
          update(payload);
          const chain = {
            eq: (col: string, val: unknown) => {
              filters(col, val);
              return chain;
            },
            select: async () => ({ data: updated, error: null }),
          };
          return chain;
        },
        delete: () => {
          const chain = {
            eq: (col: string, val: unknown) => {
              del(col, val);
              return chain;
            },
            select: async () => deleted,
          };
          return chain;
        },
      };
    },
  }),
}));

import { DELETE, PUT } from './route';

const admin = { id: 'user_admin', role: 'admin' };
const STAMP = '2026-09-08T10:12:42.505502+00:00';

function put(key: string, body: unknown) {
  return PUT(
    new Request(`https://paddock-tracker.com/api/admin/design/authz/${key}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ key }) },
  );
}

describe('PUT /api/admin/design/authz/[key]', () => {
  beforeEach(() => {
    currentAccount.mockReset();
    currentAccount.mockResolvedValue(admin);
    update.mockReset();
    filters.mockReset();
    revalidatePath.mockReset();
    updated = [{ updated_at: '2026-09-08T10:20:00.000001+00:00' }];
    rows = {
      data: [{ key: 'signed_in', label: 'Signed in', type: 'signed_in', value: null, message: 'Sign in to see this.', updated_at: STAMP }],
      error: null,
    };
    process.env.PADDOCK_ENV = 'production';
  });
  afterEach(() => {
    delete process.env.PADDOCK_ENV;
  });

  it('is 404 for a non-admin and for a key that is not a key', async () => {
    currentAccount.mockResolvedValue({ id: 'u' });
    expect((await put('signed_in', { label: 'Members', updatedAt: STAMP })).status).toBe(404);
    currentAccount.mockResolvedValue(admin);
    expect((await put('Not A Key', { label: 'Members', updatedAt: STAMP })).status).toBe(404);
    expect(update).not.toHaveBeenCalled();
  });

  it('refuses off production, writing nothing', async () => {
    delete process.env.PADDOCK_ENV;
    expect((await put('signed_in', { label: 'Members', updatedAt: STAMP })).status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects an empty label, an over-long label or message, and a missing stamp, before the database', async () => {
    expect((await put('signed_in', { label: '  ', updatedAt: STAMP })).status).toBe(400);
    expect((await put('signed_in', { label: 'x'.repeat(61), updatedAt: STAMP })).status).toBe(400);
    expect((await put('signed_in', { label: 'Members', message: 'x'.repeat(201), updatedAt: STAMP })).status).toBe(400);
    expect((await put('signed_in', { label: 'Members' })).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('updates the label and the message of the one row whose stamp still matches, an empty message stored as null', async () => {
    let res = await put('signed_in', { label: ' Members ', message: ' Sign in first. ', updatedAt: STAMP });
    expect(res.status).toBe(200);
    expect(update).toHaveBeenLastCalledWith({ label: 'Members', message: 'Sign in first.', updated_by: 'user_admin' });
    expect(filters.mock.calls).toEqual([
      ['application_key', 'paddock'],
      ['key', 'signed_in'],
      ['updated_at', STAMP],
    ]);
    let json = (await res.json()) as { ok: boolean; label: string; message: string | null; updatedAt: string };
    expect(json).toEqual({ ok: true, key: 'signed_in', label: 'Members', message: 'Sign in first.', updatedAt: '2026-09-08T10:20:00.000001+00:00' });

    res = await put('administrator', { label: 'Administrator', message: '', updatedAt: STAMP });
    expect(res.status).toBe(200);
    expect(update).toHaveBeenLastCalledWith({ label: 'Administrator', message: null, updated_by: 'user_admin' });
    json = (await res.json()) as { ok: boolean; label: string; message: string | null; updatedAt: string };
    expect(json.message).toBeNull();
  });

  it('answers 409 with the current schemes when no row matched the stamp', async () => {
    updated = [];
    const res = await put('signed_in', { label: 'Members', updatedAt: 'old' });
    expect(res.status).toBe(409);
    const json = (await res.json()) as { current: { key: string; label: string; updatedAt: string | null }[] | null };
    const row = json.current?.find(r => r.key === 'signed_in');
    expect(row?.label).toBe('Signed in');
    expect(row?.updatedAt).toBe(STAMP);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('revalidates the layout after a save, because the served pages and the lists read the schemes', async () => {
    await put('signed_in', { label: 'Members', updatedAt: STAMP });
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });
});

const remove = (key: string) =>
  DELETE(new Request(`https://paddock-tracker.com/api/admin/design/authz/${key}`, { method: 'DELETE' }), { params: Promise.resolve({ key }) });

describe('DELETE /api/admin/design/authz/[key]', () => {
  beforeEach(() => {
    currentAccount.mockReset();
    currentAccount.mockResolvedValue(admin);
    del.mockReset();
    revalidatePath.mockReset();
    deleted = { data: [{ key: 'moderators' }], error: null };
    rows = { data: [{ key: 'signed_in', label: 'Signed in', type: 'signed_in', value: null, message: null, updated_at: STAMP }], error: null };
    process.env.PADDOCK_ENV = 'production';
  });
  afterEach(() => {
    delete process.env.PADDOCK_ENV;
  });

  it('is 404 for a non-admin and a key that is not a key, 403 off production, and 400 for a shipped scheme, deleting nothing', async () => {
    currentAccount.mockResolvedValue({ id: 'u' });
    expect((await remove('moderators')).status).toBe(404);
    currentAccount.mockResolvedValue(admin);
    expect((await remove('Not A Key')).status).toBe(404);
    delete process.env.PADDOCK_ENV;
    expect((await remove('moderators')).status).toBe(403);
    process.env.PADDOCK_ENV = 'production';
    expect((await remove('signed_in')).status).toBe(400);
    expect((await remove('public')).status).toBe(400);
    expect(del).not.toHaveBeenCalled();
  });

  it('removes a scheme of the operator’s own and revalidates the layout', async () => {
    const res = await remove('moderators');
    expect(res.status).toBe(200);
    expect(del.mock.calls).toEqual([
      ['application_key', 'paddock'],
      ['key', 'moderators'],
    ]);
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });

  it('answers 409 with the current rows when a page, a region or an entry still names the scheme, and 404 when it is gone', async () => {
    deleted = { data: null, error: { code: '23503', message: 'update or delete on table "authz_scheme" violates foreign key constraint' } };
    const res = await remove('moderators');
    expect(res.status).toBe(409);
    expect(((await res.json()) as { current: unknown[] }).current).toHaveLength(1);
    deleted = { data: [], error: null };
    expect((await remove('moderators')).status).toBe(404);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
