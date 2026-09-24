import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentAccount = vi.fn();
vi.mock('@/lib/auth/server', () => ({ currentAccount: () => currentAccount(), accountId: async () => ((await currentAccount()) as { id?: string } | null)?.id ?? null }));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

vi.mock('@/lib/series', () => ({
  listSeriesSlugs: async () => ['f1', 'f2', 'motogp', 'wec', 'indycar', 'nascar-cup'],
}));

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

const admin = { id: 'user_admin', role: 'admin' };
const STAMP = '2026-09-08T09:40:12.505502+00:00';

function put(key: string, body: unknown) {
  return PUT(
    new Request(`https://paddock-tracker.com/api/admin/design/settings/${key}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ key }) },
  );
}

describe('PUT /api/admin/design/settings/[key]', () => {
  beforeEach(() => {
    currentAccount.mockReset();
    currentAccount.mockResolvedValue(admin);
    update.mockReset();
    filters.mockReset();
    revalidatePath.mockClear();
    updated = [{ updated_at: '2026-09-08T10:00:00.000001+00:00' }];
    rows = {
      data: [{ key: 'home.major_series', value: '["motogp","wec","indycar","nascar-cup"]', description: 'Boxes.', updated_at: STAMP }],
      error: null,
    };
    process.env.PADDOCK_ENV = 'production';
  });
  afterEach(() => {
    delete process.env.PADDOCK_ENV;
  });

  it('is 404 for a non-admin and for a key outside the catalogue', async () => {
    currentAccount.mockResolvedValue({ id: 'u' });
    expect((await put('home.lead_series', { value: 'motogp', updatedAt: STAMP })).status).toBe(404);
    currentAccount.mockResolvedValue(admin);
    expect((await put('home.nothing', { value: 7, updatedAt: STAMP })).status).toBe(404);
    expect(update).not.toHaveBeenCalled();
  });

  it('refuses off production, writing nothing', async () => {
    delete process.env.PADDOCK_ENV;
    expect((await put('home.lead_series', { value: 'motogp', updatedAt: STAMP })).status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it('refuses a value outside its rule, and a missing stamp, before the database, naming the rule', async () => {
    expect((await put('home.lead_series', { value: 'motogp' })).status).toBe(400);
    expect((await put('home.major_series', { value: 'not json', updatedAt: STAMP })).status).toBe(400);
    expect((await put('region.button.label', { value: 'x'.repeat(41), updatedAt: STAMP })).status).toBe(400);
    expect((await put('region.button.label', { value: 7, updatedAt: STAMP })).status).toBe(400);
    expect((await put('home.lead_series', { value: 'dtm', updatedAt: STAMP })).status).toBe(400);
    const res = await put('home.major_series', { value: ['wec', 'no-such-series'], updatedAt: STAMP });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe(
      'Home: featured series must be up to 6 of the site’s championships',
    );
    expect((await put('announcement.active_id', { value: 'v9.9', updatedAt: STAMP })).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('updates the one row whose stamp still matches, stores json as text, and refreshes every page', async () => {
    const res = await put('home.major_series', { value: ['wec', 'motogp', 'wec'], updatedAt: STAMP });
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ value: '["wec","motogp"]', updated_by: 'user_admin' });
    expect(filters.mock.calls).toEqual([
      ['application_key', 'paddock'],
      ['key', 'home.major_series'],
      ['updated_at', STAMP],
    ]);
    const json = (await res.json()) as { ok: boolean; value: string[]; updatedAt: string };
    expect(json.ok).toBe(true);
    expect(json.value).toEqual(['wec', 'motogp']);
    expect(json.updatedAt).toBe('2026-09-08T10:00:00.000001+00:00');
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });

  it('stores a text as it is, and an empty announcement as an empty string', async () => {
    expect((await put('region.button.label', { value: 'Open', updatedAt: STAMP })).status).toBe(200);
    expect(update).toHaveBeenLastCalledWith({ value: 'Open', updated_by: 'user_admin' });
    expect((await put('announcement.active_id', { value: '', updatedAt: STAMP })).status).toBe(200);
    expect(update).toHaveBeenLastCalledWith({ value: '', updated_by: 'user_admin' });
  });

  it('answers 409 with the current settings when no row matched the stamp', async () => {
    updated = [];
    const res = await put('home.major_series', { value: ['wec'], updatedAt: 'old' });
    expect(res.status).toBe(409);
    const json = (await res.json()) as { current: { key: string; value: unknown; updatedAt: string | null }[] | null };
    const majors = json.current?.find(r => r.key === 'home.major_series');
    expect(majors?.updatedAt).toBe(STAMP);
    expect(majors?.value).toEqual(['motogp', 'wec', 'indycar', 'nascar-cup']);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
