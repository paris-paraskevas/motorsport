import webpush, { type PushSubscription } from 'web-push';

let configured = false;

function configure() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    throw new Error('Missing VAPID env vars (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT)');
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export interface PushAction {
  action: string;
  title: string;
  icon?: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  /** Hex colour for the notification chrome on Chromium/Android. */
  color?: string;
  /** Optional hero image URL displayed below the body. */
  image?: string;
  /** Action buttons rendered under the notification (Chrome/Edge/Android). */
  actions?: PushAction[];
  /** Opaque per-notification data attached for the click handler. */
  data?: Record<string, string>;
  /** When true, suppress the system notification sound (badge/banner stay). */
  silent?: boolean;
}

/**
 * Send a push notification to a subscription. Returns true on success.
 * Swallows expired / invalid endpoint errors (caller can detect via return false).
 */
export async function sendPushTo(
  subscription: PushSubscription,
  payload: PushPayload,
): Promise<{ ok: true } | { ok: false; gone: boolean; status?: number }> {
  configure();
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { ok: true };
  } catch (err: unknown) {
    const e = err as { statusCode?: number };
    // 404 or 410 = endpoint dead, caller should evict.
    const gone = e?.statusCode === 404 || e?.statusCode === 410;
    return { ok: false, gone, status: e?.statusCode };
  }
}

export function publicKey(): string {
  const k = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!k) throw new Error('Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY');
  return k;
}
