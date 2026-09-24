import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentAccount = vi.fn();
vi.mock('@/lib/auth/server', () => ({ currentAccount: () => currentAccount(), accountId: async () => ((await currentAccount()) as { id?: string } | null)?.id ?? null }));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

// A fake `application` table: `rows` answers the reads; `update` records its
// payload and filters and answers with `touched`.
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
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(rows).then(resolve, reject),
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
import { DEFAULT_DEFINITION } from '@/lib/design/application-defaults';

const admin = { id: 'user_admin', role: 'admin' };
const STAMP = '2026-09-08T15:30:00.505502+00:00';
const row = { key: 'paddock', name: 'Paddock Tracker', alias: 'paddock', availability: 'available', home_path: '/', description: null, wordmark: null, tagline: null, date_chip: true, install_prompt: true, favicon_asset_id: null, updated_at: STAMP };
const put = (body: unknown) =>
  PUT(new Request('https://paddock-tracker.com/api/admin/design/application', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));

describe('/api/admin/design/application', () => {
  beforeEach(() => {
    currentAccount.mockReset();
    currentAccount.mockResolvedValue(admin);
    update.mockReset();
    filters.mockReset();
    revalidatePath.mockClear();
    touched = [{ updated_at: '2026-09-08T15:40:00.000001+00:00' }];
    rows = { data: [row], error: null };
    process.env.PADDOCK_ENV = 'production';
  });
  afterEach(() => {
    delete process.env.PADDOCK_ENV;
  });

  it('GET is 404 for a non-admin and hands an admin the definition with its stamp', async () => {
    currentAccount.mockResolvedValue({ id: 'u' });
    expect((await GET()).status).toBe(404);
    currentAccount.mockResolvedValue(admin);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ definition: DEFAULT_DEFINITION, updatedAt: STAMP });
  });

  it('PUT is 404 for a non-admin and 403 off production, before anything is written', async () => {
    currentAccount.mockResolvedValue({ id: 'u' });
    expect((await put({ definition: DEFAULT_DEFINITION, updatedAt: STAMP })).status).toBe(404);
    currentAccount.mockResolvedValue(admin);
    delete process.env.PADDOCK_ENV;
    expect((await put({ definition: DEFAULT_DEFINITION, updatedAt: STAMP })).status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it('refuses a missing stamp, a definition that is not one, and every problem, before the database', async () => {
    expect((await put({ definition: DEFAULT_DEFINITION })).status).toBe(400);
    expect((await put({ definition: 'big', updatedAt: STAMP })).status).toBe(400);
    const res = await put({ definition: { ...DEFAULT_DEFINITION, name: ' ', availability: 'closed' }, updatedAt: STAMP });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { problems: string[] }).problems).toEqual(['the application needs a name', 'availability must be available or maintenance']);
    expect(update).not.toHaveBeenCalled();
  });

  it('writes the columns as one conditional update on the stamp, never the alias or the home path, and nudges the layout', async () => {
    const res = await put({ definition: { ...DEFAULT_DEFINITION, wordmark: 'Paddock', dateChip: false, availability: 'maintenance', alias: 'hacked', homePath: '/elsewhere' }, updatedAt: STAMP });
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ name: 'Paddock Tracker', availability: 'maintenance', description: null, wordmark: 'Paddock', tagline: null, date_chip: false, install_prompt: true, favicon_asset_id: null, updated_by: 'user_admin' });
    expect(filters.mock.calls).toEqual([
      ['key', 'paddock'],
      ['updated_at', STAMP],
    ]);
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
    const json = (await res.json()) as { definition: { wordmark: string; alias: string }; updatedAt: string };
    expect(json.definition.wordmark).toBe('Paddock');
    expect(json.updatedAt).toBe('2026-09-08T15:40:00.000001+00:00');
  });

  it('answers 409 with what is stored now when no row matched the stamp', async () => {
    touched = [];
    rows = { data: [{ ...row, wordmark: 'Elsewhere', updated_at: '2026-09-08T15:35:00+00:00' }], error: null };
    const res = await put({ definition: { ...DEFAULT_DEFINITION, wordmark: 'Paddock' }, updatedAt: STAMP });
    expect(res.status).toBe(409);
    const json = (await res.json()) as { current: { definition: { wordmark: string }; updatedAt: string } };
    expect(json.current.definition.wordmark).toBe('Elsewhere');
    expect(json.current.updatedAt).toBe('2026-09-08T15:35:00+00:00');
  });
});
