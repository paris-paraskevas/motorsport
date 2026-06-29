import { kv } from '@vercel/kv';

/**
 * Per-user sent-notification history. Every push that actually reaches a
 * signed-in user is appended here, so the upcoming notification-center UI can
 * show "what we sent you" without re-deriving it from the crons.
 *
 * Storage: one capped KV list per user (`paddock:push-history:${userId}`),
 * newest at the head. `recordSent` LPUSHes then LTRIMs to KEEP newest, so the
 * list never grows unbounded. Anonymous sends are NOT recorded (no stable owner
 * to scope the list to) — callers skip `userId === null`.
 *
 * Fail-soft everywhere: a history write must never break a push send, and a
 * read returns `[]` rather than throwing. No-ops when KV is unconfigured (local
 * dev / preview without a store), mirroring lib/push-store + lib/results-cache.
 */

export interface PushHistoryItem {
  kind: string;
  title: string;
  body: string;
  url: string;
  ts: number;
  seriesSlug?: string;
}

const KEY_PREFIX = 'paddock:push-history:';
// Keep the newest N per user. A bounded backlog is all the notification center
// needs; older entries age out on the next write.
const KEEP = 50;

function isKvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function key(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

/**
 * Append a sent notification to the user's capped history (newest first).
 * Best-effort: swallows KV errors and no-ops when KV is unconfigured, so a
 * history write can never fail a push fan-out.
 */
export async function recordSent(userId: string, item: PushHistoryItem): Promise<void> {
  if (!isKvConfigured()) return;
  try {
    await kv.lpush(key(userId), item);
    // Cap to the newest KEEP entries (indices 0..KEEP-1).
    await kv.ltrim(key(userId), 0, KEEP - 1);
  } catch {
    // Swallow — never let history bookkeeping break a notification send.
  }
}

/**
 * Read a user's sent-notification history, newest first. Returns at most
 * `limit` items (default 30); `[]` on miss / error / unconfigured KV.
 */
export async function listHistory(userId: string, limit = 30): Promise<PushHistoryItem[]> {
  if (!isKvConfigured()) return [];
  try {
    const items = await kv.lrange<PushHistoryItem>(key(userId), 0, limit - 1);
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}
