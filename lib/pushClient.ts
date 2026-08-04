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
}

export async function unsubscribeFromPush(): Promise<void> {
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
