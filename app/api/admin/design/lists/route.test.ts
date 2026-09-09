import { beforeEach, describe, expect, it, vi } from 'vitest';

const currentUser = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ currentUser: () => currentUser() }));

let production = true;
vi.mock('@/lib/env', () => ({ isProductionWorker: () => production }));

// A fake database: the list rows and the entry rows for the reads, an insert
// that records what it was given and answers with a stamp or an error.
let listRows: { data: unknown; error: { message: string } | null } = { data: [], error: null };
let entryRows: { data: unknown; error: { message: string } | null } = { data: [], error: null };
const inserted: unknown[] = [];
let insertResult: { data: unknown; error: { message: string; code?: string } | null } = { data: { updated_at: '2026-09-09T02:00:00.000001+00:00' }, error: null };
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => true,
  betDb: () => ({
    from: (table: string) => {
      const result = table === 'list' ? listRows : entryRows;
      const q = {
        select: () => q,
        eq: () => q,
        in: () => q,
        order: () => q,
        insert: (row: unknown) => {
          inserted.push(row);
          return { select: () => ({ single: async () => insertResult }) };
        },
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject),
      };
      return q;
    },
  }),
}));

import { GET, POST } from './route';

const admin = { id: 'user_admin', publicMetadata: { role: 'admin' } };
const STAMP = '2026-09-08T06:34:16.728382+00:00';
const shell = [
  { key: 'bar', role: 'bar', label: 'Navigation Bar List', updated_at: STAMP },
  { key: 'doors', role: 'menu', label: 'Navigation Menu', updated_at: STAMP },
];
const post = (body: unknown) =>
  POST(new Request('https://paddock-tracker.com/api/admin/design/lists', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));

describe('/api/admin/design/lists', () => {
  beforeEach(() => {
    currentUser.mockReset();
    currentUser.mockResolvedValue(admin);
    production = true;
    listRows = { data: shell, error: null };
    entryRows = { data: [{ list_key: 'bar' }, { list_key: 'bar' }, { list_key: 'bar' }, { list_key: 'doors' }], error: null };
    inserted.length = 0;
    insertResult = { data: { updated_at: '2026-09-09T02:00:00.000001+00:00' }, error: null };
  });

  it('GET is 404 for a non-admin, else every list with its role, stamp and entry count', async () => {
    currentUser.mockResolvedValue({ id: 'u', publicMetadata: {} });
    expect((await GET()).status).toBe(404);
    currentUser.mockResolvedValue(admin);
    const res = await GET();
    expect(res.status).toBe(200);
    const json = (await res.json()) as { lists: { key: string; entries: number; updatedAt: string }[] };
    expect(json.lists.map(l => [l.key, l.entries])).toEqual([
      ['bar', 3],
      ['doors', 1],
    ]);
    expect(json.lists[0].updatedAt).toBe(STAMP);
  });

  it('POST refuses off production, and refuses a bad key, a shell key or an empty label before touching the database', async () => {
    production = false;
    expect((await post({ key: 'useful-links', label: 'Useful links' })).status).toBe(403);
    production = true;
    expect((await post({ key: 'Useful Links', label: 'Useful links' })).status).toBe(400);
    expect((await post({ key: 'doors', label: 'Doors again' })).status).toBe(400);
    expect((await post({ key: 'useful-links', label: '  ' })).status).toBe(400);
    expect(inserted).toEqual([]);
  });

  it('POST answers 409 with the current lists for a key already stored', async () => {
    const res = await post({ key: 'bar', label: 'x' });
    expect(res.status).toBe(400); // `bar` is a shell key: refused as such, before the store is asked
    listRows = { data: [...shell, { key: 'useful-links', role: 'generic', label: 'Useful links', updated_at: STAMP }], error: null };
    const dup = await post({ key: 'useful-links', label: 'Useful links' });
    expect(dup.status).toBe(409);
    expect(((await dup.json()) as { current: unknown[] }).current).toHaveLength(3);
    expect(inserted).toEqual([]);
  });

  it('POST inserts a generic list with the operator as its author and answers 201 with the list, no entries yet', async () => {
    const res = await post({ key: 'useful-links', label: ' Useful links ' });
    expect(res.status).toBe(201);
    expect(inserted).toEqual([{ application_key: 'paddock', key: 'useful-links', role: 'generic', label: 'Useful links', updated_by: 'user_admin' }]);
    const json = (await res.json()) as { list: { key: string; role: string; label: string; updatedAt: string; entries: unknown[] } };
    expect(json.list).toEqual({ key: 'useful-links', role: 'generic', label: 'Useful links', updatedAt: '2026-09-09T02:00:00.000001+00:00', entries: [] });
  });

  it('POST maps the unique constraint to 409', async () => {
    insertResult = { data: null, error: { message: 'duplicate key value violates unique constraint', code: '23505' } };
    expect((await post({ key: 'useful-links', label: 'Useful links' })).status).toBe(409);
  });
});
