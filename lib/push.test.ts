import { describe, it, expect } from 'vitest';
import { isSubscriptionOwner, type StoredSubscription } from './push-store';

function makeSub(userId: string | null): StoredSubscription {
  return {
    subscription: {
      endpoint: 'https://example.invalid/push/abc',
      keys: { p256dh: 'p', auth: 'a' },
    },
    userId,
    createdAt: 0,
  };
}

describe('isSubscriptionOwner', () => {
  it('allows when caller userId matches subscription userId', () => {
    expect(isSubscriptionOwner(makeSub('user_123'), 'user_123')).toBe(true);
  });

  it('rejects when caller userId differs from subscription userId', () => {
    expect(isSubscriptionOwner(makeSub('user_123'), 'user_456')).toBe(false);
  });

  it('allows when both subscription and caller are anonymous (null)', () => {
    expect(isSubscriptionOwner(makeSub(null), null)).toBe(true);
  });

  it('rejects when subscription is anonymous but caller is signed in', () => {
    expect(isSubscriptionOwner(makeSub(null), 'user_123')).toBe(false);
  });

  it('rejects when subscription is signed-in but caller is anonymous', () => {
    expect(isSubscriptionOwner(makeSub('user_123'), null)).toBe(false);
  });

  it('rejects when subscription is missing', () => {
    expect(isSubscriptionOwner(null, 'user_123')).toBe(false);
    expect(isSubscriptionOwner(null, null)).toBe(false);
  });
});
