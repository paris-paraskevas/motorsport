import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentAccount = vi.fn();
vi.mock('@/lib/auth/server', () => ({ currentAccount: () => currentAccount(), accountId: async () => ((await currentAccount()) as { id?: string } | null)?.id ?? null }));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

// A fake database: the list row and its entries for the reads, the scheme rows
// the authorization check consults, and the design_save_list function for the
// write.
const rpc = vi.fn();
let listRow: { data: unknown; error: { message: string } | null } = { data: null, error: null };
let entryRows: { data: unknown; error: { message: string } | null } = { data: [], error: null };
// A delete answers with the rows it removed, or the store's refusal.
let deleteResult: { data: unknown; error: { message: string; code?: string } | null } = { data: [], error: null };
let deleting = false;
// The live row pages a page: destination may name (P1.12 B1).
const MONZA = 'a1b2c3d4-0000-4000-8000-000000000010';
const pageRows = { data: [{ id: MONZA, path: '/history/monza', name: 'Monza, a history' }], error: null };
const schemeRows = {
  data: [
    { key: 'public', label: 'Public', type: 'public', value: null, message: null },
    { key: 'signed_in', label: 'Signed in', type: 'signed_in', value: null, message: 'Sign in to see this.' },
  ],
  error: null,
};
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => true,
  betDb: () => ({
    rpc: (fn: string, args: unknown) => rpc(fn, args),
    from: (table: string) => {
      const result = table === 'list' ? listRow : table === 'authz_scheme' ? schemeRows : table === 'page' ? pageRows : entryRows;
      const q = {
        select: () => q,
        eq: () => q,
        in: () => q,
        is: () => q,
        order: () => q,
        delete: () => {
          deleting = true;
          return q;
        },
        maybeSingle: async () => result,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
          const answer = deleting ? deleteResult : result;
          deleting = false;
          return Promise.resolve(answer).then(resolve, reject);
        },
      };
      return q;
    },
  }),
}));

import { DELETE, GET, PUT } from './route';

const admin = { id: 'user_admin', role: 'admin' };
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
    currentAccount.mockReset();
    currentAccount.mockResolvedValue(admin);
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
    currentAccount.mockResolvedValue({ id: 'u' });
    expect((await get('doors')).status).toBe(404);
    currentAccount.mockResolvedValue(admin);
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

  it('PUT accepts an entry naming a live row page by its key and refuses one naming a page that is not live (P1.12 B1)', async () => {
    let res = await put('doors', { entries: [{ label: 'Monza', dest: `page:${MONZA}` }], updatedAt: STAMP });
    expect(res.status).toBe(200);
    expect((rpc.mock.calls[0] as [string, { p_entries: { dest_key: string }[] }])[1].p_entries[0].dest_key).toBe(`page:${MONZA}`);
    res = await put('doors', { entries: [{ label: 'Gone', dest: 'page:a1b2c3d4-0000-4000-8000-000000000099' }], updatedAt: STAMP });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/not a destination in the catalogue/);
  });

  it('PUT ignores an href the browser carries on an entry: the row keeps the key alone (the reviewer’s gap)', async () => {
    const res = await put('doors', { entries: [{ label: 'Monza', dest: `page:${MONZA}`, href: '/somewhere/else' }], updatedAt: STAMP });
    expect(res.status).toBe(200);
    const sent = (rpc.mock.calls[0] as [string, { p_entries: Record<string, unknown>[] }])[1].p_entries[0];
    expect(sent).toEqual({ label: 'Monza', dest_key: `page:${MONZA}`, icon: null, authz_key: null });
    expect(sent).not.toHaveProperty('href');
  });

  it('PUT rejects an authorization that is not a scheme row, and accepts one that is', async () => {
    let res = await put('doors', { entries: [{ label: 'Learn', dest: 'learn', authz: 'vip' }], updatedAt: STAMP });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('entry 1: "vip" is not an authorization scheme');
    expect(rpc).not.toHaveBeenCalled();
    res = await put('doors', { entries: [{ label: 'Learn', dest: 'learn', authz: 'signed_in' }], updatedAt: STAMP });
    expect(res.status).toBe(200);
  });

  it('PUT takes a note on an entry of a list of the operator’s own (trimmed, at most 120 characters, sent only when present) and refuses one on the shell’s lists or one that is not text (R18 PR C)', async () => {
    listRow = { data: { key: 'useful-links', role: 'generic', label: 'Useful links', updated_at: STAMP }, error: null };
    let res = await put('useful-links', { entries: [{ label: 'Calendar', dest: 'calendar', note: '  Every session, your time.  ' }, { label: 'Learn', dest: 'learn', note: '' }], updatedAt: STAMP });
    expect(res.status).toBe(200);
    const [, args] = rpc.mock.calls[0] as [string, { p_entries: unknown }];
    expect(args.p_entries).toEqual([
      { label: 'Calendar', dest_key: 'calendar', icon: null, authz_key: null, note: 'Every session, your time.' },
      { label: 'Learn', dest_key: 'learn', icon: null, authz_key: null },
    ]);
    res = await put('useful-links', { entries: [{ label: 'Calendar', dest: 'calendar', note: 'x'.repeat(121) }], updatedAt: STAMP });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('entry 1: notes are at most 120 characters');
    res = await put('useful-links', { entries: [{ label: 'Calendar', dest: 'calendar', note: 7 }], updatedAt: STAMP });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('entry 1: the note must be text');
    listRow = { data: { key: 'doors', role: 'menu', label: 'Header doors', updated_at: STAMP }, error: null };
    res = await put('doors', { entries: [{ label: 'Calendar', dest: 'calendar', note: 'A sentence.' }], updatedAt: STAMP });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('entry 1: the shell’s lists carry no note');
    expect(rpc).toHaveBeenCalledTimes(1);
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

describe('DELETE /api/admin/design/lists/[key]', () => {
  const del = (key: string, body: unknown) =>
    DELETE(
      new Request(`https://paddock-tracker.com/api/admin/design/lists/${key}`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
      params(key),
    );
  const own = { key: 'useful-links', role: 'generic', label: 'Useful links', updated_at: STAMP };

  beforeEach(() => {
    currentAccount.mockReset();
    currentAccount.mockResolvedValue(admin);
    listRow = { data: own, error: null };
    entryRows = { data: [], error: null };
    deleteResult = { data: [{ key: 'useful-links' }], error: null };
    deleting = false;
    process.env.PADDOCK_ENV = 'production';
  });
  afterEach(() => {
    delete process.env.PADDOCK_ENV;
  });

  it('refuses off production, deleting nothing', async () => {
    delete process.env.PADDOCK_ENV;
    expect((await del('useful-links', { updatedAt: STAMP })).status).toBe(403);
  });

  it('is 404 for a non-admin and for a list that does not exist, 400 without the stamp and for one of the shell’s lists', async () => {
    currentAccount.mockResolvedValue({ id: 'u' });
    expect((await del('useful-links', { updatedAt: STAMP })).status).toBe(404);
    currentAccount.mockResolvedValue(admin);
    expect((await del('useful-links', {})).status).toBe(400);
    listRow = { data: null, error: null };
    expect((await del('nope', { updatedAt: STAMP })).status).toBe(404);
    listRow = { data: { key: 'doors', role: 'menu', label: 'Navigation Menu', updated_at: STAMP }, error: null };
    const shell = await del('doors', { updatedAt: STAMP });
    expect(shell.status).toBe(400);
    expect(((await shell.json()) as { error: string }).error).toMatch(/shell/);
  });

  it('refuses, in words, to delete a list a page’s code recipe names, since the refs table does not hold it (R18 PR C)', async () => {
    listRow = { data: { key: 'f2-more', role: 'generic', label: 'More Formula 2', updated_at: STAMP }, error: null };
    const res = await del('f2-more', { updatedAt: STAMP });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toBe('A page’s recipe names this list, so the list stays. Empty its entries if it should show nothing.');
    expect(deleting).toBe(false);
  });

  it('deletes a list of the operator’s own on its stamp, and answers 409 with the current list when the stamp moved', async () => {
    const res = await del('useful-links', { updatedAt: STAMP });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, key: 'useful-links' });
    deleteResult = { data: [], error: null };
    const stale = await del('useful-links', { updatedAt: '2026-09-01T00:00:00+00:00' });
    expect(stale.status).toBe(409);
    expect(((await stale.json()) as { current: { key: string } }).current.key).toBe('useful-links');
  });

  it('answers 409 in words when the database refuses because a revision still names the list', async () => {
    deleteResult = { data: null, error: { message: 'update or delete on table "list" violates foreign key constraint', code: '23503' } };
    const res = await del('useful-links', { updatedAt: STAMP });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toMatch(/revision names this list, and revisions are kept/);
  });
});
