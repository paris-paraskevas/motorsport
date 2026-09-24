import { describe, expect, it, vi } from 'vitest';

const currentAccount = vi.fn();
vi.mock('@/lib/auth/server', () => ({ currentAccount: () => currentAccount(), accountId: async () => ((await currentAccount()) as { id?: string } | null)?.id ?? null }));

import { ANONYMOUS, currentVisitor, passes } from './authz-evaluate';

describe('currentVisitor', () => {
  it('is anonymous without a session and reads role, ladder and emails from a Clerk user', async () => {
    currentAccount.mockResolvedValueOnce(null);
    expect(await currentVisitor()).toEqual(ANONYMOUS);
    currentAccount.mockResolvedValueOnce({
      id: 'user_1',
      role: 'writer',
      email: 'W@Example.com',
    });
    expect(await currentVisitor()).toEqual({ signedIn: true, role: 'writer', author: true, emails: ['W@Example.com'] });
    currentAccount.mockResolvedValueOnce({ id: 'user_2', role: null, email: null });
    expect(await currentVisitor()).toEqual({ signedIn: true, role: null, author: false, emails: [] });
  });

  it('re-exports the rule so the server and the browser share one evaluator', () => {
    expect(passes({ key: 'public', label: 'Public', type: 'public', value: null, message: null }, ANONYMOUS)).toBe(true);
  });
});
