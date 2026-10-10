import { describe, it, expect, vi, beforeAll } from 'vitest';
import { isSubscriptionOwner, type StoredSubscription } from './push-store';

const webpush = vi.hoisted(() => ({ setVapidDetails: vi.fn(), sendNotification: vi.fn() }));
vi.mock('web-push', () => ({ default: webpush }));
import { sendPushTo } from './push';

// O6: only a failure the push service or the network may not repeat is worth a retry.
describe('sendPushTo failure kinds', () => {
  const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc123def456', keys: { p256dh: 'p', auth: 'a' } };
  const failWith = (statusCode?: number) =>
    webpush.sendNotification.mockRejectedValueOnce(statusCode === undefined ? new Error('network down') : Object.assign(new Error('push'), { statusCode }));
  beforeAll(() => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'public';
    process.env.VAPID_PRIVATE_KEY = 'private';
    process.env.VAPID_SUBJECT = 'mailto:test@example.invalid';
  });

  it('a 403 or a 400 is neither gone nor transient, so it is not retried', async () => {
    failWith(403);
    expect(await sendPushTo(sub, { title: 't', body: 'b' })).toEqual({ ok: false, gone: false, transient: false, status: 403 });
    failWith(400);
    expect(await sendPushTo(sub, { title: 't', body: 'b' })).toEqual({ ok: false, gone: false, transient: false, status: 400 });
  });

  it('a 5xx, a 429 or a network error is transient', async () => {
    failWith(503);
    expect(await sendPushTo(sub, { title: 't', body: 'b' })).toMatchObject({ ok: false, gone: false, transient: true });
    failWith(429);
    expect(await sendPushTo(sub, { title: 't', body: 'b' })).toMatchObject({ ok: false, gone: false, transient: true });
    failWith(undefined);
    expect(await sendPushTo(sub, { title: 't', body: 'b' })).toMatchObject({ ok: false, gone: false, transient: true });
  });

  it('a 404 or a 410 is gone and not transient', async () => {
    failWith(410);
    expect(await sendPushTo(sub, { title: 't', body: 'b' })).toEqual({ ok: false, gone: true, transient: false, status: 410 });
    failWith(404);
    expect(await sendPushTo(sub, { title: 't', body: 'b' })).toMatchObject({ ok: false, gone: true, transient: false });
  });

  it('a delivered push is ok', async () => {
    webpush.sendNotification.mockResolvedValueOnce({ statusCode: 201 });
    expect(await sendPushTo(sub, { title: 't', body: 'b' })).toEqual({ ok: true });
  });

  it('an endpoint off the allowlist is gone, not transient, and never sent', async () => {
    webpush.sendNotification.mockClear();
    expect(await sendPushTo({ ...sub, endpoint: 'https://push.example.invalid/abc' }, { title: 't', body: 'b' })).toEqual({ ok: false, gone: true, transient: false });
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });
});

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
