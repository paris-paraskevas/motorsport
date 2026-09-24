import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentAccount = vi.fn();
vi.mock('@/lib/auth/server', () => ({ currentAccount: () => currentAccount(), accountId: async () => ((await currentAccount()) as { id?: string } | null)?.id ?? null }));

// A fake `shortcut` table: `rows` answers the reads; `insert` records its
// payload and answers with `inserted` or `insertError`.
const insert = vi.fn();
let inserted: unknown = { updated_at: '2026-09-08T14:05:00.000001+00:00' };
let insertError: { code?: string; message: string } | null = null;
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
      return {
        select: () => read,
        insert: (payload: unknown) => {
          insert(payload);
          return { select: () => ({ single: async () => ({ data: inserted, error: insertError }) }) };
        },
      };
    },
  }),
}));

import { GET, POST } from './route';

const admin = { id: 'user_admin', role: 'admin' };
const STAMP = '2026-09-08T14:00:00.505502+00:00';
const seeded = [
  { key: 'times.local', text: 'All times are shown in your local time zone.', updated_at: STAMP },
  { key: 'data.sources', text: 'Results and standings follow the official timing.', updated_at: STAMP },
];

const post = (body: unknown) =>
  POST(
    new Request('https://paddock-tracker.com/api/admin/design/shortcuts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );

describe('/api/admin/design/shortcuts', () => {
  beforeEach(() => {
    currentAccount.mockReset();
    currentAccount.mockResolvedValue(admin);
    insert.mockReset();
    inserted = { updated_at: '2026-09-08T14:05:00.000001+00:00' };
    insertError = null;
    rows = { data: seeded, error: null };
    process.env.PADDOCK_ENV = 'production';
  });
  afterEach(() => {
    delete process.env.PADDOCK_ENV;
  });

  it('GET is 404 for a non-admin and lists the rows by key with their stamps for an admin', async () => {
    currentAccount.mockResolvedValue({ id: 'u' });
    expect((await GET()).status).toBe(404);
    currentAccount.mockResolvedValue(admin);
    const res = await GET();
    expect(res.status).toBe(200);
    const json = (await res.json()) as { shortcuts: { key: string; updatedAt: string }[] };
    expect(json.shortcuts.map(s => s.key)).toEqual(['data.sources', 'times.local']);
    expect(json.shortcuts[0].updatedAt).toBe(STAMP);
  });

  it('POST is 404 for a non-admin and 403 off production, before anything is written', async () => {
    currentAccount.mockResolvedValue({ id: 'u' });
    expect((await post({ key: 'new.one', text: 'x' })).status).toBe(404);
    currentAccount.mockResolvedValue(admin);
    delete process.env.PADDOCK_ENV;
    expect((await post({ key: 'new.one', text: 'x' })).status).toBe(403);
    expect(insert).not.toHaveBeenCalled();
  });

  it('refuses a bad key or an empty text with the reason, before the database', async () => {
    expect((await post({ key: 'New One', text: 'x' })).status).toBe(400);
    expect((await post({ key: 'new.one', text: '  ' })).status).toBe(400);
    const res = await post({ key: '', text: 'x' });
    expect(((await res.json()) as { error: string }).error).toBe('key: needs a key');
    expect(insert).not.toHaveBeenCalled();
  });

  it('creates a shortcut with a trimmed text and answers 201 with the row', async () => {
    const res = await post({ key: ' leagues.play ', text: '  Leagues play for points, never money.  ' });
    expect(res.status).toBe(201);
    expect(insert).toHaveBeenCalledWith({
      application_key: 'paddock',
      key: 'leagues.play',
      text: 'Leagues play for points, never money.',
      updated_by: 'user_admin',
    });
    const json = (await res.json()) as { shortcut: { key: string; text: string; updatedAt: string } };
    expect(json.shortcut).toEqual({ key: 'leagues.play', text: 'Leagues play for points, never money.', updatedAt: '2026-09-08T14:05:00.000001+00:00' });
  });

  it('answers 409 with the current list for a key that exists, before and from the database', async () => {
    const res = await post({ key: 'times.local', text: 'x' });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { current: unknown[] }).current).toHaveLength(2);
    expect(insert).not.toHaveBeenCalled();
    insertError = { code: '23505', message: 'duplicate key value violates unique constraint' };
    expect((await post({ key: 'raced.in', text: 'x' })).status).toBe(409);
  });
});
