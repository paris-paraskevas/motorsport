import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentUser = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ currentUser: () => currentUser() }));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

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
const STAMP = '2026-09-08T07:25:42.505502+00:00';

function put(key: string, body: unknown) {
  return PUT(
    new Request(`https://paddock-tracker.com/api/admin/design/build-options/${key}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ key }) },
  );
}

describe('PUT /api/admin/design/build-options/[key]', () => {
  beforeEach(() => {
    currentUser.mockReset();
    currentUser.mockResolvedValue(admin);
    update.mockReset();
    filters.mockReset();
    revalidatePath.mockClear();
    updated = [{ updated_at: '2026-09-08T08:00:00.000001+00:00' }];
    rows = { data: [{ key: 'weather', label: 'Weather', status: 'include', updated_at: STAMP }], error: null };
    process.env.PADDOCK_ENV = 'production';
  });
  afterEach(() => {
    delete process.env.PADDOCK_ENV;
  });

  it('is 404 for a non-admin and for a key outside the catalogue', async () => {
    currentUser.mockResolvedValue({ id: 'u', publicMetadata: {} });
    expect((await put('weather', { status: 'exclude', updatedAt: STAMP })).status).toBe(404);
    currentUser.mockResolvedValue(admin);
    expect((await put('not_a_key', { status: 'exclude', updatedAt: STAMP })).status).toBe(404);
    expect(update).not.toHaveBeenCalled();
  });

  it('refuses off production, writing nothing', async () => {
    delete process.env.PADDOCK_ENV;
    expect((await put('weather', { status: 'exclude', updatedAt: STAMP })).status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects a status that is not include or exclude, and a missing stamp, before the database', async () => {
    expect((await put('weather', { status: 'off', updatedAt: STAMP })).status).toBe(400);
    expect((await put('weather', { status: true, updatedAt: STAMP })).status).toBe(400);
    expect((await put('weather', { status: 'exclude' })).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('updates the one row whose stamp still matches and marks the weekend pages for a fresh render', async () => {
    const res = await put('weather', { status: 'exclude', updatedAt: STAMP });
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ status: 'exclude', updated_by: 'user_admin' });
    expect(filters.mock.calls).toEqual([
      ['application_key', 'paddock'],
      ['key', 'weather'],
      ['updated_at', STAMP],
    ]);
    const json = (await res.json()) as { ok: boolean; status: string; updatedAt: string };
    expect(json.ok).toBe(true);
    expect(json.status).toBe('exclude');
    expect(json.updatedAt).toBe('2026-09-08T08:00:00.000001+00:00');
    expect(revalidatePath).toHaveBeenCalledWith('/series/[slug]/weekend/[round]', 'page');
  });

  it('leaves the page cache alone for an option whose page renders on every request', async () => {
    rows = { data: [{ key: 'ghost_lap_3d', label: 'Ghost lap 3D', status: 'include', updated_at: STAMP }], error: null };
    const res = await put('ghost_lap_3d', { status: 'exclude', updatedAt: STAMP });
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ status: 'exclude', updated_by: 'user_admin' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('answers 409 with the current options when no row matched the stamp', async () => {
    updated = [];
    const res = await put('weather', { status: 'exclude', updatedAt: 'old' });
    expect(res.status).toBe(409);
    const json = (await res.json()) as { current: { key: string; status: string; updatedAt: string | null }[] | null };
    const weather = json.current?.find(r => r.key === 'weather');
    expect(weather?.updatedAt).toBe(STAMP);
    expect(weather?.status).toBe('include');
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
