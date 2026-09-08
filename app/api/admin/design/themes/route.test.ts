import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentUser = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ currentUser: () => currentUser() }));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

// A fake `theme` table: `rows` answers the reads, `insert` records the payload
// and answers with `inserted`.
const insert = vi.fn();
let inserted: { data: unknown; error: { message: string; code?: string } | null } = { data: { updated_at: 'x' }, error: null };
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
          return { select: () => ({ single: async () => inserted }) };
        },
      };
    },
  }),
}));

import { GET, POST } from './route';

const admin = { id: 'user_admin', publicMetadata: { role: 'admin' } };
const STAMP = '2026-09-08T11:30:00.505502+00:00';
const SUNSET = {
  bg: '#1a0f1f',
  surface: '#26172d',
  surfaceElevated: '#31203a',
  border: '#4a3355',
  borderStrong: '#66477a',
  text: '#F6ECF9',
  textMuted: '#c9b3d2',
  textFaint: '#a892b2',
  accent: '#ff9f43',
};
const seeded = ['midnight', 'carbon', 'ember', 'newsprint', 'paper', 'circuit'].map(key => ({
  key,
  label: key,
  tokens: {},
  is_default: key === 'paper',
  available: true,
  base: null,
  updated_at: STAMP,
}));

function post(body: unknown) {
  return POST(
    new Request('https://paddock-tracker.com/api/admin/design/themes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

describe('/api/admin/design/themes', () => {
  beforeEach(() => {
    currentUser.mockReset();
    currentUser.mockResolvedValue(admin);
    insert.mockReset();
    revalidatePath.mockClear();
    inserted = { data: { updated_at: '2026-09-08T11:40:00.000001+00:00' }, error: null };
    rows = { data: seeded, error: null };
    process.env.PADDOCK_ENV = 'production';
  });
  afterEach(() => {
    delete process.env.PADDOCK_ENV;
  });

  it('GET is 404 for a non-admin, else every theme with its stamp', async () => {
    currentUser.mockResolvedValue({ id: 'u', publicMetadata: {} });
    expect((await GET()).status).toBe(404);
    currentUser.mockResolvedValue(admin);
    const res = await GET();
    expect(res.status).toBe(200);
    const json = (await res.json()) as { themes: { key: string; shipped: boolean; isDefault: boolean; updatedAt: string }[] };
    expect(json.themes.map(t => t.key)).toEqual(['midnight', 'carbon', 'ember', 'newsprint', 'paper', 'circuit']);
    expect(json.themes[4]).toMatchObject({ key: 'paper', shipped: true, isDefault: true, updatedAt: STAMP });
  });

  it('POST refuses non-admins (404) and previews (403), writing nothing', async () => {
    currentUser.mockResolvedValue({ id: 'u', publicMetadata: {} });
    expect((await post({ label: 'Sunset', base: 'midnight', tokens: SUNSET })).status).toBe(404);
    currentUser.mockResolvedValue(admin);
    delete process.env.PADDOCK_ENV;
    expect((await post({ label: 'Sunset', base: 'midnight', tokens: SUNSET })).status).toBe(403);
    expect(insert).not.toHaveBeenCalled();
  });

  it('POST refuses a nameless theme, a name that leaves no key, a base that is not shipped, a colour that is not #rrggbb, and a theme that fails the contrast gate', async () => {
    expect((await post({ label: '  ', base: 'midnight', tokens: SUNSET })).status).toBe(400);
    expect((await post({ label: '***', base: 'midnight', tokens: SUNSET })).status).toBe(400);
    expect((await post({ label: 'Sunset', base: 'sunset', tokens: SUNSET })).status).toBe(400);
    expect((await post({ label: 'Sunset', base: 'midnight', tokens: { ...SUNSET, accent: 'orange' } })).status).toBe(400);
    const res = await post({ label: 'Sunset', base: 'midnight', tokens: { ...SUNSET, text: '#777777', bg: '#666666' } });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string; problems: string[] };
    expect(json.error).toMatch(/contrast check/);
    expect(json.problems[0]).toMatch(/Text on the page/);
    expect(insert).not.toHaveBeenCalled();
  });

  it('POST refuses a name whose key exists (409), and never a shipped key', async () => {
    rows = { data: [...seeded, { key: 'sunset', label: 'Sunset', tokens: SUNSET, is_default: false, available: true, base: 'midnight', updated_at: STAMP }], error: null };
    expect((await post({ label: 'Sunset', base: 'midnight', tokens: SUNSET })).status).toBe(409);
    expect(insert).not.toHaveBeenCalled();
    // "Paper" becomes paper-2, so it does not collide with the shipped row.
    expect((await post({ label: 'Paper', base: 'paper', tokens: SUNSET })).status).toBe(201);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ key: 'paper-2' }));
  });

  it('POST inserts the theme with its key from the name, lower-case colours, available by default, and refreshes every page', async () => {
    const res = await post({ label: ' Sunset Orange ', base: 'midnight', tokens: SUNSET });
    expect(res.status).toBe(201);
    expect(insert).toHaveBeenCalledWith({
      application_key: 'paddock',
      key: 'sunset-orange',
      label: 'Sunset Orange',
      base: 'midnight',
      tokens: { ...SUNSET, text: '#f6ecf9' },
      available: true,
      is_default: false,
      updated_by: 'user_admin',
    });
    const json = (await res.json()) as { ok: boolean; theme: { key: string; family: string; hint: string; shipped: boolean; updatedAt: string } };
    expect(json.theme).toMatchObject({ key: 'sunset-orange', family: 'dark', hint: 'On Midnight', shipped: false, updatedAt: '2026-09-08T11:40:00.000001+00:00' });
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });
});
