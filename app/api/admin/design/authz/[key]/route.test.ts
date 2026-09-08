import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentUser = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ currentUser: () => currentUser() }));

// The update chain records its payload and filters and answers with `updated`
// (the rows the conditional update touched); the read for a 409 answers `rows`.
const update = vi.fn();
const filters = vi.fn();
let updated: { updated_at: string }[] = [];
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
      };
    },
  }),
}));

import { PUT } from './route';

const admin = { id: 'user_admin', publicMetadata: { role: 'admin' } };
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
    currentUser.mockReset();
    currentUser.mockResolvedValue(admin);
    update.mockReset();
    filters.mockReset();
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
    currentUser.mockResolvedValue({ id: 'u', publicMetadata: {} });
    expect((await put('signed_in', { label: 'Members', updatedAt: STAMP })).status).toBe(404);
    currentUser.mockResolvedValue(admin);
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
  });
});
