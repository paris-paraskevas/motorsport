const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

export type PushAvailability = 'unsupported' | 'no-vapid' | 'available';

/** Browser capability ONLY — 'no-vapid' is no longer decided here. The key
 *  comes from the server at subscribe time (getVapidKey), so a build without
 *  the inlined NEXT_PUBLIC var can still subscribe; UIs derive their
 *  server-not-configured state from getServerPushStatus().vapidConfigured. */
export function getPushAvailability(): PushAvailability {
  if (typeof window === 'undefined') return 'unsupported';
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'unsupported';
  }
  return 'available';
}

export interface ServerPushStatus {
  ready: boolean;
  vapidConfigured: boolean;
  kvConfigured: boolean;
  /** The VAPID public key (public by design), or null when unconfigured. */
  publicKey?: string | null;
}

// The subscribe key: the build-time inlined var when present (zero fetches),
// else the server's copy via /api/push/status — cached for the page's life.
let vapidKeyPromise: Promise<string | null> | null = null;
function getVapidKey(): Promise<string | null> {
  if (VAPID_PUBLIC_KEY) return Promise.resolve(VAPID_PUBLIC_KEY);
  vapidKeyPromise ??= getServerPushStatus().then(s => s?.publicKey ?? null);
  return vapidKeyPromise;
}

export async function getServerPushStatus(): Promise<ServerPushStatus | null> {
  try {
    const res = await fetch('/api/push/status', { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as ServerPushStatus;
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) out[i] = rawData.charCodeAt(i);
  return out;
}

// A short, human-readable label for THIS device (browser + OS) from the UA.
// Best-effort — a legibility hint for the "Your devices" list; never trusted
// server-side beyond a length cap. Order matters (Edge/Opera/Samsung UAs also
// contain "Chrome"; Chrome contains "Safari").
function deviceLabel(): string {
  const ua = navigator.userAgent;
  let browser = 'Browser';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
  else if (/SamsungBrowser\//.test(ua)) browser = 'Samsung Internet';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua)) browser = 'Safari';
  let os = '';
  if (/Windows/.test(ua)) os = 'Windows';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Mac OS X|Macintosh/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  return os ? `${browser} on ${os}` : browser;
}

// Whether THIS device asked for notifications. Device-local because the intent
// cannot be recovered from anywhere else once a subscription lapses: a push
// subscription belongs to the SERVICE WORKER, not to the account, and every
// deploy replaces the worker wholesale (all ~218 precache entries change), so
// the browser drops it. The server record is no help either — the sender evicts
// a dead endpoint on 404/410 (lib/push.ts:71), so after the first failed send
// both sides agree the device is unsubscribed and nothing remembers that it was
// ever wanted. This flag is that memory, and restorePushSubscription acts on it.
const OPT_IN_KEY = 'paddock:push-opted-in';

function setOptedIn(on: boolean): void {
  try {
    if (on) localStorage.setItem(OPT_IN_KEY, '1');
    else localStorage.removeItem(OPT_IN_KEY);
  } catch {
    /* storage blocked (private mode, embedded webview): restore never fires,
       which is the pre-existing behaviour rather than a regression. */
  }
}

function hasOptedIn(): boolean {
  try {
    return localStorage.getItem(OPT_IN_KEY) === '1';
  } catch {
    return false;
  }
}

export async function subscribeToPush(): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(permission === 'denied' ? 'denied' : 'dismissed');
  }
  const vapidKey = await getVapidKey();
  if (!vapidKey) throw new Error('no-vapid');
  const reg = await navigator.serviceWorker.ready;
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
  });
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription, label: deviceLabel() }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || `server error (${res.status})`);
  }
  setOptedIn(true);
}

export async function unsubscribeFromPush(): Promise<void> {
  // Cleared FIRST, and unconditionally: turning notifications off is an explicit
  // choice, so it must stick even if the steps below fail. Clearing it last
  // would let a thrown unsubscribe leave the flag set, and the next page load
  // would silently turn notifications back on.
  setOptedIn(false);
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await fetch('/api/push/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  });
  await sub.unsubscribe();
}

export type PushRestoreResult = 'restored' | 'not-needed' | 'failed';

/** Put back a subscription this device asked for and the browser has since
 *  dropped. Runs on mount from components/SerwistRegister.
 *
 *  SILENT BY CONSTRUCTION: it never calls Notification.requestPermission, so it
 *  can only act where permission is ALREADY granted and no dialog can appear on
 *  load. A device that never opted in, or whose permission has been revoked,
 *  is left alone. */
export async function restorePushSubscription(): Promise<PushRestoreResult> {
  if (getPushAvailability() !== 'available') return 'not-needed';
  if (!hasOptedIn()) return 'not-needed';
  // Permission revoked or reset since opting in. A silent re-subscribe is
  // impossible without a prompt, and prompting on load is exactly the pattern
  // browsers punish, so drop the stale intent instead of retrying every load.
  if (Notification.permission !== 'granted') {
    setOptedIn(false);
    return 'not-needed';
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    if (await reg.pushManager.getSubscription()) return 'not-needed';
    const vapidKey = await getVapidKey();
    if (!vapidKey) return 'failed';
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
    });
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription, label: deviceLabel() }),
    });
    if (!res.ok) {
      // Roll the browser back so the two sides cannot disagree. /api/push/
      // subscribe is auth-protected (middleware.ts), so a signed-out visitor
      // gets 401 here. Keeping the browser subscription in that case would be
      // the worst outcome: getSubscription() would report 'subscribed', every
      // later restore would decide there was nothing to do, and the device
      // would never receive another notification while looking enabled.
      await subscription.unsubscribe().catch(() => {});
      return 'failed';
    }
    return 'restored';
  } catch {
    // Deliberately keeps the opt-in flag: a transient failure (offline, a 500)
    // should retry on the next load rather than silently give up.
    return 'failed';
  }
}

export async function getPushSubscriptionState(): Promise<'subscribed' | 'idle' | 'denied'> {
  if (Notification.permission === 'denied') return 'denied';
  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    return existing ? 'subscribed' : 'idle';
  } catch {
    return 'idle';
  }
}

/** This browser's current push endpoint (the per-device id), or null. Lets the
 *  "Your devices" list mark which row is the device you're on. */
export async function getCurrentPushEndpoint(): Promise<string | null> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub?.endpoint ?? null;
  } catch {
    return null;
  }
}
