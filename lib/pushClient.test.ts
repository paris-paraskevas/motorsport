import { describe, it, expect, vi, afterEach } from 'vitest';

// restorePushSubscription is the fix for "notifications switch themselves off":
// a push subscription belongs to the service worker, every deploy replaces the
// worker, so the browser drops the subscription and nothing used to put it back.
// These cases pin the branches that decide whether it acts, and — the one that
// matters most — the rollback when the server refuses the restored subscription.
//
// Modules are re-imported per test because pushClient caches the VAPID key in a
// module-level promise; a shared instance would leak one test's key into the next.

const VAPID = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
const OPT_IN_KEY = 'paddock:push-opted-in';

interface BrowserOpts {
  optedIn?: boolean;
  permission?: string;
  /** What pushManager.getSubscription() resolves to. */
  existing?: unknown;
  /** Status for POST /api/push/subscribe. 401 = signed out, the real case. */
  subscribeStatus?: number;
  /** Make pushManager.subscribe reject, standing in for a push-service outage. */
  subscribeThrows?: boolean;
}

function stubBrowser(opts: BrowserOpts = {}) {
  const store: Record<string, string> = {};
  if (opts.optedIn) store[OPT_IN_KEY] = '1';

  const unsubscribe = vi.fn(async () => true);
  const created = { endpoint: 'https://push.example/abc', unsubscribe };
  const subscribe = opts.subscribeThrows
    ? vi.fn(async () => {
        throw new Error('push service unavailable');
      })
    : vi.fn(async () => created);
  const getSubscription = vi.fn(async () => opts.existing ?? null);

  const fetchMock = vi.fn(async () => ({
    ok: (opts.subscribeStatus ?? 200) < 400,
    status: opts.subscribeStatus ?? 200,
    json: async () => ({}),
  }));

  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
  });
  vi.stubGlobal('window', { PushManager: function () {} });
  vi.stubGlobal('navigator', {
    userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0',
    serviceWorker: { ready: Promise.resolve({ pushManager: { subscribe, getSubscription } }) },
  });
  vi.stubGlobal('Notification', { permission: opts.permission ?? 'granted' });
  vi.stubGlobal('fetch', fetchMock);

  return { store, subscribe, getSubscription, unsubscribe, fetchMock };
}

async function loadClient() {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', VAPID);
  return import('./pushClient');
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('restorePushSubscription', () => {
  it('does nothing for a device that never opted in', async () => {
    const m = stubBrowser({ optedIn: false });
    const { restorePushSubscription } = await loadClient();

    expect(await restorePushSubscription()).toBe('not-needed');
    expect(m.subscribe).not.toHaveBeenCalled();
    expect(m.fetchMock).not.toHaveBeenCalled();
  });

  it('does nothing, and forgets the intent, when permission was revoked', async () => {
    const m = stubBrowser({ optedIn: true, permission: 'denied' });
    const { restorePushSubscription } = await loadClient();

    expect(await restorePushSubscription()).toBe('not-needed');
    expect(m.subscribe).not.toHaveBeenCalled();
    // Cleared so it stops retrying on every single page load.
    expect(m.store[OPT_IN_KEY]).toBeUndefined();
  });

  it('never prompts: a default (unasked) permission is left alone', async () => {
    const m = stubBrowser({ optedIn: true, permission: 'default' });
    const { restorePushSubscription } = await loadClient();

    expect(await restorePushSubscription()).toBe('not-needed');
    expect(m.subscribe).not.toHaveBeenCalled();
  });

  it('does nothing when the browser still holds a subscription', async () => {
    const m = stubBrowser({ optedIn: true, existing: { endpoint: 'https://push.example/live' } });
    const { restorePushSubscription } = await loadClient();

    expect(await restorePushSubscription()).toBe('not-needed');
    expect(m.subscribe).not.toHaveBeenCalled();
  });

  it('re-subscribes and registers with the server when the browser dropped it', async () => {
    const m = stubBrowser({ optedIn: true, existing: null });
    const { restorePushSubscription } = await loadClient();

    expect(await restorePushSubscription()).toBe('restored');
    expect(m.subscribe).toHaveBeenCalledOnce();
    const [url, init] = m.fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/push/subscribe');
    expect(JSON.parse(String(init.body))).toMatchObject({
      subscription: { endpoint: 'https://push.example/abc' },
    });
    // Still opted in, and NOT rolled back.
    expect(m.store[OPT_IN_KEY]).toBe('1');
    expect(m.unsubscribe).not.toHaveBeenCalled();
  });

  it('rolls the browser back when the server refuses (signed out → 401)', async () => {
    const m = stubBrowser({ optedIn: true, existing: null, subscribeStatus: 401 });
    const { restorePushSubscription } = await loadClient();

    expect(await restorePushSubscription()).toBe('failed');
    // THE POINT OF THIS TEST. Without the rollback the browser would hold a
    // subscription the server has never heard of, getSubscription() would report
    // 'subscribed' forever after, and the device would look enabled while
    // receiving nothing.
    expect(m.unsubscribe).toHaveBeenCalledOnce();
    // Intent survives, so it retries once the user signs in.
    expect(m.store[OPT_IN_KEY]).toBe('1');
  });

  it('keeps the intent when subscribing throws, so a transient failure retries', async () => {
    const m = stubBrowser({ optedIn: true, existing: null, subscribeThrows: true });
    const { restorePushSubscription } = await loadClient();

    expect(await restorePushSubscription()).toBe('failed');
    expect(m.store[OPT_IN_KEY]).toBe('1');
  });

  // N1: the five subscriptions of May to July were made under a key the server no longer signs with,
  // and the browser still holds them, so the dropped-subscription path above never fires for them.
  const keyBytes = (b64url: string) => {
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64url.length % 4)) % 4);
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
  };
  const OLD_KEY = 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM';

  it('replaces a subscription made under an older key, even without the opt-in flag', async () => {
    const oldUnsubscribe = vi.fn(async () => true);
    const m = stubBrowser({
      optedIn: false,
      existing: { endpoint: 'https://push.example/old', options: { applicationServerKey: keyBytes(OLD_KEY) }, unsubscribe: oldUnsubscribe },
    });
    const { restorePushSubscription } = await loadClient();

    expect(await restorePushSubscription()).toBe('restored');
    const calls = m.fetchMock.mock.calls as unknown as [string, RequestInit][];
    expect(calls.map(([url]) => url)).toEqual(['/api/push/unsubscribe', '/api/push/subscribe']);
    expect(JSON.parse(String(calls[0][1].body))).toEqual({ endpoint: 'https://push.example/old' });
    expect(oldUnsubscribe).toHaveBeenCalledOnce();
    expect(m.subscribe).toHaveBeenCalledOnce();
    expect(m.store[OPT_IN_KEY]).toBe('1');
  });

  it('keeps a subscription made under the current key', async () => {
    const m = stubBrowser({
      optedIn: true,
      existing: { endpoint: 'https://push.example/live', options: { applicationServerKey: keyBytes(VAPID) }, unsubscribe: vi.fn() },
    });
    const { restorePushSubscription } = await loadClient();

    expect(await restorePushSubscription()).toBe('not-needed');
    expect(m.subscribe).not.toHaveBeenCalled();
    expect(m.fetchMock).not.toHaveBeenCalled();
  });
});

describe('opt-in bookkeeping', () => {
  it('subscribeToPush records the intent only after the server accepts', async () => {
    const m = stubBrowser({ optedIn: false, existing: null });
    vi.stubGlobal('Notification', {
      permission: 'granted',
      requestPermission: async () => 'granted',
    });
    const { subscribeToPush } = await loadClient();

    await subscribeToPush();
    expect(m.store[OPT_IN_KEY]).toBe('1');
  });

  it('subscribeToPush does NOT record the intent when the server rejects', async () => {
    const m = stubBrowser({ optedIn: false, existing: null, subscribeStatus: 500 });
    vi.stubGlobal('Notification', {
      permission: 'granted',
      requestPermission: async () => 'granted',
    });
    const { subscribeToPush } = await loadClient();

    await expect(subscribeToPush()).rejects.toThrow();
    expect(m.store[OPT_IN_KEY]).toBeUndefined();
  });

  it('unsubscribeFromPush forgets the intent even if the rest of it throws', async () => {
    const m = stubBrowser({ optedIn: true });
    vi.stubGlobal('navigator', {
      userAgent: 'test',
      serviceWorker: { ready: Promise.reject(new Error('no worker')) },
    });
    const { unsubscribeFromPush } = await loadClient();

    await expect(unsubscribeFromPush()).rejects.toThrow();
    // Turning notifications OFF is an explicit choice and must stick, or the
    // next load would silently switch them back on.
    expect(m.store[OPT_IN_KEY]).toBeUndefined();
  });
});
