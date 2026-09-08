import { describe, expect, it, vi } from 'vitest';

const currentUser = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ currentUser: () => currentUser() }));

import { ANONYMOUS, currentVisitor, passes } from './authz-evaluate';

describe('currentVisitor', () => {
  it('is anonymous without a session and reads role, ladder and emails from a Clerk user', async () => {
    currentUser.mockResolvedValueOnce(null);
    expect(await currentVisitor()).toEqual(ANONYMOUS);
    currentUser.mockResolvedValueOnce({
      id: 'user_1',
      publicMetadata: { role: 'writer' },
      emailAddresses: [{ emailAddress: 'W@Example.com' }],
    });
    expect(await currentVisitor()).toEqual({ signedIn: true, role: 'writer', author: true, emails: ['W@Example.com'] });
    currentUser.mockResolvedValueOnce({ id: 'user_2', publicMetadata: {}, emailAddresses: [] });
    expect(await currentVisitor()).toEqual({ signedIn: true, role: null, author: false, emails: [] });
  });

  it('re-exports the rule so the server and the browser share one evaluator', () => {
    expect(passes({ key: 'public', label: 'Public', type: 'public', value: null, message: null }, ANONYMOUS)).toBe(true);
  });
});
