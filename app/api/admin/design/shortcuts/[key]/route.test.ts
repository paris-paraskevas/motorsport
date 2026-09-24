import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentAccount = vi.fn();
vi.mock('@/lib/auth/server', () => ({ currentAccount: () => currentAccount(), accountId: async () => ((await currentAccount()) as { id?: string } | null)?.id ?? null }));

// A fake `shortcut` table: `rows` answers the reads; `update` and `remove`
// record their payload and filters and answer with `touched` (the rows the
// conditional statement reached).
const update = vi.fn();
const remove = vi.fn();
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
          remove();
          return chain;
        },
      };
    },
  }),
}));

import { DELETE, PUT } from './route';

const admin = { id: 'user_admin', role: 'admin' };
const STAMP = '2026-09-08T14:00:00.505502+00:00';
const seeded = [{ key: 'times.local', text: 'All times are shown in your local time zone.', updated_at: STAMP }];

const params = (key: string) => ({ params: Promise.resolve({ key }) });
const call = (method: 'PUT' | 'DELETE', key: string, body: unknown) => {
  const req = new Request(`https://paddock-tracker.com/api/admin/design/shortcuts/${key}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return method === 'PUT' ? PUT(req, params(key)) : DELETE(req, params(key));
};

describe('/api/admin/design/shortcuts/[key]', () => {
  beforeEach(() => {
    currentAccount.mockReset();
    currentAccount.mockResolvedValue(admin);
    update.mockReset();
    remove.mockReset();
    filters.mockReset();
    touched = [{ updated_at: '2026-09-08T14:05:00.000001+00:00', key: 'times.local' }];
    rows = { data: seeded, error: null };
    process.env.PADDOCK_ENV = 'production';
  });
  afterEach(() => {
    delete process.env.PADDOCK_ENV;
  });

  it('is 404 for a non-admin and for a key outside the rule; 403 off production', async () => {
    currentAccount.mockResolvedValue({ id: 'u' });
    expect((await call('PUT', 'times.local', { text: 'x', updatedAt: STAMP })).status).toBe(404);
    currentAccount.mockResolvedValue(admin);
    expect((await call('PUT', 'Not A Key', { text: 'x', updatedAt: STAMP })).status).toBe(404);
    delete process.env.PADDOCK_ENV;
    expect((await call('PUT', 'times.local', { text: 'x', updatedAt: STAMP })).status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it('refuses a missing stamp and an empty text before the database, then writes one conditional update', async () => {
    expect((await call('PUT', 'times.local', { text: 'x' })).status).toBe(400);
    expect((await call('PUT', 'times.local', { text: '   ', updatedAt: STAMP })).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
    const res = await call('PUT', 'times.local', { text: '  Every time is your local time.  ', updatedAt: STAMP });
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ text: 'Every time is your local time.', updated_by: 'user_admin' });
    expect(filters.mock.calls).toEqual([
      ['application_key', 'paddock'],
      ['key', 'times.local'],
      ['updated_at', STAMP],
    ]);
    const json = (await res.json()) as { text: string; updatedAt: string };
    expect(json.text).toBe('Every time is your local time.');
    expect(json.updatedAt).toBe('2026-09-08T14:05:00.000001+00:00');
  });

  it('answers 409 with the current list when no row matched the stamp', async () => {
    touched = [];
    const res = await call('PUT', 'times.local', { text: 'x', updatedAt: 'old' });
    expect(res.status).toBe(409);
    const json = (await res.json()) as { current: { key: string }[] | null };
    expect(json.current?.map(s => s.key)).toEqual(['times.local']);
  });

  it('DELETE removes a row on its stamp and answers 409 when it moved', async () => {
    const res = await call('DELETE', 'times.local', { updatedAt: STAMP });
    expect(res.status).toBe(200);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(filters.mock.calls).toEqual([
      ['application_key', 'paddock'],
      ['key', 'times.local'],
      ['updated_at', STAMP],
    ]);
    touched = [];
    expect((await call('DELETE', 'times.local', { updatedAt: 'old' })).status).toBe(409);
    expect((await call('DELETE', 'times.local', {})).status).toBe(400);
  });
});
