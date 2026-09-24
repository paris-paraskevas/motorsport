import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentAccount = vi.fn();
vi.mock('@/lib/auth/server', () => ({ currentAccount: () => currentAccount(), accountId: async () => ((await currentAccount()) as { id?: string } | null)?.id ?? null }));

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

const admin = { id: 'user_admin', role: 'admin' };
const STAMP = '2026-09-08T07:25:42.505502+00:00';

function put(key: string, body: unknown) {
  return PUT(
    new Request(`https://paddock-tracker.com/api/admin/design/text/${key}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ key }) },
  );
}

describe('PUT /api/admin/design/text/[key]', () => {
  beforeEach(() => {
    currentAccount.mockReset();
    currentAccount.mockResolvedValue(admin);
    update.mockReset();
    filters.mockReset();
    revalidatePath.mockClear();
    updated = [{ updated_at: '2026-09-08T08:00:00.000001+00:00' }];
    rows = { data: [{ key: 'footer.site', text: 'Site', where_shown: 'Footer', updated_at: STAMP }], error: null };
    process.env.PADDOCK_ENV = 'production';
  });
  afterEach(() => {
    delete process.env.PADDOCK_ENV;
  });

  it('is 404 for a non-admin and for a key outside the catalogue', async () => {
    currentAccount.mockResolvedValue({ id: 'u' });
    expect((await put('footer.site', { text: 'x', updatedAt: STAMP })).status).toBe(404);
    currentAccount.mockResolvedValue(admin);
    expect((await put('not.a.key', { text: 'x', updatedAt: STAMP })).status).toBe(404);
    expect(update).not.toHaveBeenCalled();
  });

  it('refuses off production, writing nothing', async () => {
    delete process.env.PADDOCK_ENV;
    expect((await put('footer.site', { text: 'x', updatedAt: STAMP })).status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects empty text, text over the cap, and a missing stamp, before the database', async () => {
    expect((await put('footer.site', { text: '   ', updatedAt: STAMP })).status).toBe(400);
    expect((await put('footer.site', { text: 'x'.repeat(501), updatedAt: STAMP })).status).toBe(400);
    expect((await put('footer.site', { text: 'Around the site' })).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('updates the one row whose stamp still matches, trims the text, and refreshes every page', async () => {
    const res = await put('footer.site', { text: '  Around the site ', updatedAt: STAMP });
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ text: 'Around the site', updated_by: 'user_admin' });
    expect(filters.mock.calls).toEqual([
      ['application_key', 'paddock'],
      ['key', 'footer.site'],
      ['updated_at', STAMP],
    ]);
    const json = (await res.json()) as { ok: boolean; updatedAt: string };
    expect(json.ok).toBe(true);
    expect(json.updatedAt).toBe('2026-09-08T08:00:00.000001+00:00');
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });

  it('answers 409 with the current messages when no row matched the stamp', async () => {
    updated = [];
    const res = await put('footer.site', { text: 'Around the site', updatedAt: 'old' });
    expect(res.status).toBe(409);
    const json = (await res.json()) as { current: { key: string; updatedAt: string | null }[] | null };
    expect(json.current?.find(r => r.key === 'footer.site')?.updatedAt).toBe(STAMP);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
