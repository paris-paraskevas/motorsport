import webpush, { type PushSubscription } from 'web-push';
import { isAllowedPushEndpoint } from './push-hosts';

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
  // Final sink guard: never POST to an endpoint outside the Web Push allowlist,
  // even if a caller assembled the subscription without going through
  // listSubscriptions (which already filters). Report it as `gone` so callers
  // evict the junk row via their existing gone-handling path.
  let endpointUrl: URL | null = null;
  try {
    endpointUrl = new URL(subscription.endpoint);
  } catch {
    endpointUrl = null;
  }
  if (!endpointUrl || !isAllowedPushEndpoint(endpointUrl)) {
    const tail = subscription.endpoint.slice(-12);
    console.warn(`push send skipped: off-allowlist endpoint …${tail}`);
    return { ok: false, gone: true };
  }
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { ok: true };
  } catch (err: unknown) {
    const e = err as { statusCode?: number };
    // 404 or 410 = endpoint dead, caller should evict.
    const gone = e?.statusCode === 404 || e?.statusCode === 410;
    // Surface real (non-gone) failures in the cron logs — a push-service 5xx or
    // network blip is invisible otherwise, since we stay fail-soft. Compact: the
    // status plus the endpoint tail (enough to spot a provider-wide outage vs a
    // one-off). `gone` evictions are routine churn, so they stay quiet.
    if (!gone) {
      const tail = subscription.endpoint.slice(-12);
      console.error(`push send failed status=${e?.statusCode ?? 'unknown'} endpoint=…${tail}`);
    }
    return { ok: false, gone, status: e?.statusCode };
  }
}

export function publicKey(): string {
  const k = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!k) throw new Error('Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY');
  return k;
}

/**
 * True when all three VAPID env vars are present. Crons check this up front so
 * a missing key returns a clear `{ ok:false, reason }` instead of throwing from
 * `configure()` deep inside the send loop (which the route would surface as a
 * generic 500, masking the real cause).
 */
export function isPushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}
