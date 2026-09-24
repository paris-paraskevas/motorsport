import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentAccount = vi.fn();
vi.mock('@/lib/auth/server', () => ({ currentAccount: () => currentAccount(), accountId: async () => ((await currentAccount()) as { id?: string } | null)?.id ?? null }));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

// A fake `theme` table: `rows` answers the reads; `update` and `remove` record
// their payload and filters and answer with `touched` (the rows the conditional
// statement reached).
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
const STAMP = '2026-09-08T11:30:00.505502+00:00';
const SUNSET = {
  bg: '#1a0f1f',
  surface: '#26172d',
  surfaceElevated: '#31203a',
  border: '#4a3355',
  borderStrong: '#66477a',
  text: '#f6ecf9',
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
const sunset = { key: 'sunset', label: 'Sunset', tokens: SUNSET, is_default: false, available: true, base: 'midnight', updated_at: STAMP };

const params = (key: string) => ({ params: Promise.resolve({ key }) });
const call = (method: 'PUT' | 'DELETE', key: string, body: unknown) => {
  const req = new Request(`https://paddock-tracker.com/api/admin/design/themes/${key}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return method === 'PUT' ? PUT(req, params(key)) : DELETE(req, params(key));
};

describe('/api/admin/design/themes/[key]', () => {
  beforeEach(() => {
    currentAccount.mockReset();
    currentAccount.mockResolvedValue(admin);
    update.mockReset();
    remove.mockReset();
    filters.mockReset();
    revalidatePath.mockClear();
    touched = [{ updated_at: '2026-09-08T11:40:00.000001+00:00', key: 'sunset' }];
    rows = { data: [...seeded, sunset], error: null };
    process.env.PADDOCK_ENV = 'production';
  });
  afterEach(() => {
    delete process.env.PADDOCK_ENV;
  });

  it('is 404 for a non-admin, a key that is not a key, and a theme that does not exist; 403 off production', async () => {
    currentAccount.mockResolvedValue({ id: 'u' });
    expect((await call('PUT', 'sunset', { available: false, updatedAt: STAMP })).status).toBe(404);
    currentAccount.mockResolvedValue(admin);
    expect((await call('PUT', 'Not A Key', { available: false, updatedAt: STAMP })).status).toBe(404);
    expect((await call('PUT', 'nope', { available: false, updatedAt: STAMP })).status).toBe(404);
    delete process.env.PADDOCK_ENV;
    expect((await call('PUT', 'sunset', { available: false, updatedAt: STAMP })).status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it('a shipped theme offers only its availability, and the default may not be hidden', async () => {
    expect((await call('PUT', 'carbon', { label: 'Graphite', updatedAt: STAMP })).status).toBe(400);
    expect((await call('PUT', 'paper', { available: false, updatedAt: STAMP })).status).toBe(400);
    expect((await call('PUT', 'carbon', { updatedAt: STAMP })).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
    const res = await call('PUT', 'carbon', { available: false, updatedAt: STAMP });
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ available: false, updated_by: 'user_admin' });
    expect(filters.mock.calls).toEqual([
      ['application_key', 'paddock'],
      ['key', 'carbon'],
      ['updated_at', STAMP],
    ]);
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });

  it('a custom theme takes a name, a base and colours through the contrast gate', async () => {
    expect((await call('PUT', 'sunset', { tokens: { ...SUNSET, text: '#777777', bg: '#666666' }, updatedAt: STAMP })).status).toBe(400);
    expect((await call('PUT', 'sunset', { base: 'nope', updatedAt: STAMP })).status).toBe(400);
    expect((await call('PUT', 'sunset', { label: ' ', updatedAt: STAMP })).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
    const res = await call('PUT', 'sunset', { label: ' Dusk ', base: 'carbon', tokens: { ...SUNSET, accent: '#FFB400' }, available: false, updatedAt: STAMP });
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      label: 'Dusk',
      base: 'carbon',
      tokens: { ...SUNSET, accent: '#ffb400' },
      available: false,
      updated_by: 'user_admin',
    });
    const json = (await res.json()) as { ok: boolean; updatedAt: string };
    expect(json.updatedAt).toBe('2026-09-08T11:40:00.000001+00:00');
  });

  it('answers 409 with the current themes when no row matched the stamp', async () => {
    touched = [];
    const res = await call('PUT', 'sunset', { available: false, updatedAt: 'old' });
    expect(res.status).toBe(409);
    const json = (await res.json()) as { current: { key: string }[] | null };
    expect(json.current?.map(t => t.key)).toContain('sunset');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('DELETE refuses a shipped theme and the default, deletes a custom theme on its stamp, and answers 409 when it moved', async () => {
    expect((await call('DELETE', 'carbon', { updatedAt: STAMP })).status).toBe(400);
    rows = { data: [...seeded.map(r => ({ ...r, is_default: false })), { ...sunset, is_default: true }], error: null };
    expect((await call('DELETE', 'sunset', { updatedAt: STAMP })).status).toBe(400);
    expect(remove).not.toHaveBeenCalled();
    rows = { data: [...seeded, sunset], error: null };
    const res = await call('DELETE', 'sunset', { updatedAt: STAMP });
    expect(res.status).toBe(200);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(filters.mock.calls).toEqual([
      ['application_key', 'paddock'],
      ['key', 'sunset'],
      ['updated_at', STAMP],
    ]);
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
    touched = [];
    expect((await call('DELETE', 'sunset', { updatedAt: 'old' })).status).toBe(409);
  });
});
