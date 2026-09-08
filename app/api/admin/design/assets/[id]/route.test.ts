import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentUser = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ currentUser: () => currentUser() }));

// A fake `asset` table: `rows` answers the reads; `update` and `remove` record
// their payload and filters and answer with `touched`.
const update = vi.fn();
const removeRow = vi.fn();
const filters = vi.fn();
let touched: unknown[] = [];
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
      const chain = {
        eq: (col: string, val: unknown) => {
          filters(col, val);
          return chain;
        },
        select: async () => ({ data: touched, error: null }),
      };
      return {
        select: () => read,
        update: (payload: unknown) => {
          update(payload);
          return chain;
        },
        delete: () => {
          removeRow();
          return chain;
        },
      };
    },
  }),
}));

const removeFile = vi.fn();
let bucketPresent = true;
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: () => ({
    env: bucketPresent
      ? {
          MEDIA: {
            put: async () => undefined,
            get: async () => null,
            delete: async (key: string) => {
              removeFile(key);
            },
          },
        }
      : {},
  }),
}));

import { DELETE, PUT } from './route';

const admin = { id: 'user_admin', publicMetadata: { role: 'admin' } };
const ID = 'a1b2c3d4-0000-4000-8000-000000000001';
const KEY = '2026/09/a1b2c3d4-0000-4000-8000-000000000001.jpg';
const STAMP = '2026-09-08T14:30:00.505502+00:00';
const row = {
  id: ID,
  r2_key: KEY,
  caption: 'Antonelli on the grid',
  credit: 'Paris Paraskevas',
  licence: 'Own work',
  width: 4032,
  height: 3024,
  bytes: 2_400_000,
  content_type: 'image/jpeg',
  created_at: '2026-09-08T14:29:00+00:00',
  updated_at: STAMP,
};

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const call = (method: 'PUT' | 'DELETE', id: string, body: unknown) => {
  const req = new Request(`https://paddock-tracker.com/api/admin/design/assets/${id}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return method === 'PUT' ? PUT(req, params(id)) : DELETE(req, params(id));
};

describe('/api/admin/design/assets/[id]', () => {
  beforeEach(() => {
    currentUser.mockReset();
    currentUser.mockResolvedValue(admin);
    update.mockReset();
    removeRow.mockReset();
    removeFile.mockReset();
    filters.mockReset();
    bucketPresent = true;
    touched = [{ ...row, caption: 'Grid', updated_at: '2026-09-08T14:35:00.000001+00:00' }];
    rows = { data: [row], error: null };
    process.env.PADDOCK_ENV = 'production';
  });
  afterEach(() => {
    delete process.env.PADDOCK_ENV;
  });

  it('is 404 for a non-admin and for an id that is not a UUID; 403 off production', async () => {
    currentUser.mockResolvedValue({ id: 'u', publicMetadata: {} });
    expect((await call('PUT', ID, { ...row, updatedAt: STAMP })).status).toBe(404);
    currentUser.mockResolvedValue(admin);
    expect((await call('PUT', 'not-a-uuid', { ...row, updatedAt: STAMP })).status).toBe(404);
    delete process.env.PADDOCK_ENV;
    expect((await call('PUT', ID, { ...row, updatedAt: STAMP })).status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it('refuses a missing stamp and a missing credit before the database, then writes the words as one conditional update', async () => {
    expect((await call('PUT', ID, { caption: 'Grid', credit: 'Paris', licence: 'Own work' })).status).toBe(400);
    expect((await call('PUT', ID, { caption: 'Grid', credit: '', licence: 'Own work', updatedAt: STAMP })).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
    const res = await call('PUT', ID, { caption: ' Grid ', credit: 'Paris Paraskevas', licence: 'CC BY 4.0', updatedAt: STAMP });
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ caption: 'Grid', credit: 'Paris Paraskevas', licence: 'CC BY 4.0', updated_by: 'user_admin' });
    expect(filters.mock.calls).toEqual([
      ['application_key', 'paddock'],
      ['id', ID],
      ['updated_at', STAMP],
    ]);
    const json = (await res.json()) as { asset: { caption: string; updatedAt: string } };
    expect(json.asset.caption).toBe('Grid');
    expect(json.asset.updatedAt).toBe('2026-09-08T14:35:00.000001+00:00');
  });

  it('answers 409 with the current list when no row matched the stamp', async () => {
    touched = [];
    const res = await call('PUT', ID, { caption: 'Grid', credit: 'Paris', licence: 'Own work', updatedAt: 'old' });
    expect(res.status).toBe(409);
    const json = (await res.json()) as { current: { id: string }[] | null };
    expect(json.current?.map(a => a.id)).toEqual([ID]);
  });

  it('DELETE removes the row on its stamp and then the file, reports when the file could not go, and answers 409 when the row moved', async () => {
    touched = [{ r2_key: KEY }];
    const res = await call('DELETE', ID, { updatedAt: STAMP });
    expect(res.status).toBe(200);
    expect(removeRow).toHaveBeenCalledTimes(1);
    expect(filters.mock.calls).toEqual([
      ['application_key', 'paddock'],
      ['id', ID],
      ['updated_at', STAMP],
    ]);
    expect(removeFile).toHaveBeenCalledWith(KEY);
    expect(await res.json()).toEqual({ ok: true, id: ID, key: KEY, fileRemoved: true });
    bucketPresent = false;
    const noBucket = await call('DELETE', ID, { updatedAt: STAMP });
    expect(((await noBucket.json()) as { fileRemoved: boolean }).fileRemoved).toBe(false);
    touched = [];
    expect((await call('DELETE', ID, { updatedAt: 'old' })).status).toBe(409);
    expect((await call('DELETE', ID, {})).status).toBe(400);
  });
});
