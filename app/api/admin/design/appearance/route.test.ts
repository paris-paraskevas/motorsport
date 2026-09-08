import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentUser = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ currentUser: () => currentUser() }));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

// A fake `application` table: `rows` answers the reads; `update` records its
// payload and filters and answers with `touched` (the rows the conditional
// statement reached).
const update = vi.fn();
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
      };
    },
  }),
}));

import { GET, PUT } from './route';
import { SHIPPED_APPEARANCE } from '@/lib/design/appearance-defaults';

const admin = { id: 'user_admin', publicMetadata: { role: 'admin' } };
const STAMP = '2026-09-08T15:30:00.505502+00:00';
const AIRY = {
  faces: { sans: 'source-sans-3', serif: 'literata', mono: 'jetbrains-mono', condensed: 'roboto-condensed' },
  baseSize: 17,
  leading: 1.6,
  density: 0.3,
  radius: 0,
  motion: 'calm',
};

const put = (body: unknown) =>
  PUT(
    new Request('https://paddock-tracker.com/api/admin/design/appearance', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );

describe('/api/admin/design/appearance', () => {
  beforeEach(() => {
    currentUser.mockReset();
    currentUser.mockResolvedValue(admin);
    update.mockReset();
    filters.mockReset();
    revalidatePath.mockClear();
    touched = [{ updated_at: '2026-09-08T15:40:00.000001+00:00' }];
    rows = { data: [{ ui: {}, updated_at: STAMP }], error: null };
    process.env.PADDOCK_ENV = 'production';
  });
  afterEach(() => {
    delete process.env.PADDOCK_ENV;
  });

  it('GET is 404 for a non-admin and hands an admin the stored document with its stamp', async () => {
    currentUser.mockResolvedValue({ id: 'u', publicMetadata: {} });
    expect((await GET()).status).toBe(404);
    currentUser.mockResolvedValue(admin);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ appearance: SHIPPED_APPEARANCE, updatedAt: STAMP });
  });

  it('PUT is 404 for a non-admin and 403 off production, before anything is written', async () => {
    currentUser.mockResolvedValue({ id: 'u', publicMetadata: {} });
    expect((await put({ appearance: AIRY, updatedAt: STAMP })).status).toBe(404);
    currentUser.mockResolvedValue(admin);
    delete process.env.PADDOCK_ENV;
    expect((await put({ appearance: AIRY, updatedAt: STAMP })).status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it('refuses a missing stamp, a document that is not one, and every gate problem, before the database', async () => {
    expect((await put({ appearance: AIRY })).status).toBe(400);
    expect((await put({ appearance: 'big', updatedAt: STAMP })).status).toBe(400);
    const res = await put({ appearance: { ...AIRY, baseSize: 30, motion: 'fast' }, updatedAt: STAMP });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { problems: string[] };
    expect(json.problems).toEqual(['Base size must be 14 to 20 px', 'Motion must be calm, normal or none']);
    expect(update).not.toHaveBeenCalled();
  });

  it('writes the parsed document as one conditional update on the stamp, and nudges the layout', async () => {
    const res = await put({ appearance: { ...AIRY, density: '0.30' }, updatedAt: STAMP });
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ ui: AIRY, updated_by: 'user_admin' });
    expect(filters.mock.calls).toEqual([
      ['key', 'paddock'],
      ['updated_at', STAMP],
    ]);
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
    const json = (await res.json()) as { ok: boolean; appearance: unknown; updatedAt: string };
    expect(json.appearance).toEqual(AIRY);
    expect(json.updatedAt).toBe('2026-09-08T15:40:00.000001+00:00');
  });

  it('answers 409 with what is stored now when no row matched the stamp', async () => {
    touched = [];
    rows = { data: [{ ui: AIRY, updated_at: '2026-09-08T15:35:00+00:00' }], error: null };
    const res = await put({ appearance: { ...AIRY, baseSize: 18 }, updatedAt: STAMP });
    expect(res.status).toBe(409);
    const json = (await res.json()) as { current: { appearance: { baseSize: number }; updatedAt: string } };
    expect(json.current.appearance.baseSize).toBe(17);
    expect(json.current.updatedAt).toBe('2026-09-08T15:35:00+00:00');
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
