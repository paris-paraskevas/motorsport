import { afterEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
vi.mock('@/lib/betting/client', () => ({ betDb: () => ({ rpc: (...args: unknown[]) => rpc(...(args as [])) }) }));

import { accountById, accountCount, accountFromDirectory, accountsByIds, adminAccountIds, latestAccounts } from './directory';

// The account seam's directory over the three service-role functions (PA A3): bylines, the admin list, the accounts card.
const row = (over: Record<string, unknown> = {}) => ({ id: 'user_1', name: 'Alex Driver', username: 'alexd', image: 'https://x/avatars/k.png', email: 'alex@example.com', role: 'admin', donor: true, ...over });
const answer = (data: unknown) => rpc.mockResolvedValueOnce({ data, error: null });

describe('the account directory over Supabase Auth (PA A3)', () => {
  afterEach(() => rpc.mockReset());

  it('reads an account by its app id through account_directory, and answers null for an id nobody holds', async () => {
    answer([row()]);
    expect(await accountById('user_1')).toEqual({ id: 'user_1', email: 'alex@example.com', name: 'Alex Driver', username: 'alexd', imageUrl: 'https://x/avatars/k.png', role: 'admin', donor: true });
    expect(rpc).toHaveBeenCalledWith('account_directory', { p_ids: ['user_1'] });
    answer([]);
    expect(await accountById('user_9')).toBeNull();
    expect(accountFromDirectory(row({ name: null, image: null, role: null, donor: null }))).toMatchObject({ name: null, imageUrl: null, role: null, donor: false });
    expect(await accountsByIds([])).toEqual(new Map());
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('the newest accounts come from account_stats in its order, each with its creation time, filled from the directory; the count from the same function', async () => {
    answer({ total: 18, newest: [{ id: 'b', role: null, created_at: '2026-09-24T22:24:03.000Z' }, { id: 'user_1', role: 'admin', created_at: '2026-01-02T00:00:00.000Z' }, { id: 'gone', role: null, created_at: '2025-01-01T00:00:00.000Z' }] });
    answer([row(), row({ id: 'b', name: 'Bo', role: null, donor: false })]);
    const latest = await latestAccounts(3);
    expect(latest.map(a => [a.id, a.name, a.createdAt])).toEqual([['b', 'Bo', Date.parse('2026-09-24T22:24:03.000Z')], ['user_1', 'Alex Driver', Date.parse('2026-01-02T00:00:00.000Z')]]);
    expect(rpc).toHaveBeenNthCalledWith(1, 'account_stats', undefined);
    expect(rpc).toHaveBeenNthCalledWith(2, 'account_directory', { p_ids: ['b', 'user_1', 'gone'] });
    answer({ total: 18, newest: [{ id: 'b', role: null, created_at: '2026-09-24T22:24:03.000Z' }] });
    expect(await accountCount()).toBe(18);
    answer(null);
    expect(await accountCount()).toBe(0);
  });

  it('the admins are the app ids account_admins answers, as scalars or as one-key rows; a failed read throws with the function’s name', async () => {
    answer(['user_1', 'user_2']);
    expect(await adminAccountIds()).toEqual(new Set(['user_1', 'user_2']));
    answer([{ account_admins: 'user_3' }]);
    expect(await adminAccountIds()).toEqual(new Set(['user_3']));
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'permission denied for function account_admins' } });
    await expect(adminAccountIds()).rejects.toThrow('account_admins failed: permission denied for function account_admins');
  });
});
