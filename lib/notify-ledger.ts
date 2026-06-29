import { kv } from '@vercel/kv';

// Dedupe ledger for the notify cron. One key per (session, notification kind);
// the cron fires every 15 min and each send window is 15 min wide, so without
// this a late/early tick could double-send (and a redeploy mid-window would).
// KV-less environments no-op as "never notified" — harmless locally, and in
// prod the subscriptions themselves live in KV, so the cron exits before any
// send if KV is down.

export type NotifyKind =
  | 't30'
  | 't10'
  | 'res'
  | 'analysis'
  | 'bet-lock'
  | 'bet-settled'
  | 'blog-draft'
  | 'blog-publish';

const KEY_PREFIX = 'paddock:notified:';
// Sessions are one-shot events — 48h covers any cron retry horizon. Results
// keys live longer because the results check has an 8h lookback window.
// Betting keys are dedup'd per `series:round` (not per session uid): bet-lock
// fires once in the ~24h-out window (48h TTL covers the 2h window + retries);
// bet-settled is "once ever per round" so its TTL must outlive any re-query of
// the same settled round (30d — far longer than the settled-market scan window).
const TTL_SECONDS: Record<NotifyKind, number> = {
  t30: 48 * 3600,
  t10: 48 * 3600,
  res: 7 * 24 * 3600,
  // F1 "analysis ready" (Qualifying Decoder / Race Story): one-shot per session,
  // immutable once sent. 7d (like results) outlives the 30-90min send window and
  // any cron-retry horizon so an overlapping tick can't re-nudge the same session.
  analysis: 7 * 24 * 3600,
  'bet-lock': 48 * 3600,
  'bet-settled': 30 * 24 * 3600,
  // Blog: the draft-ready ping is one-shot (48h covers any retry horizon); the
  // publish announce is once-ever per post (30d, like bet-settled) so an
  // overlapping cron tick can't double-announce the same post.
  'blog-draft': 48 * 3600,
  'blog-publish': 30 * 24 * 3600,
};

function isKvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function key(kind: NotifyKind, uid: string): string {
  return `${KEY_PREFIX}${kind}:${uid}`;
}

export async function wasNotified(kind: NotifyKind, uid: string): Promise<boolean> {
  if (!isKvConfigured()) return false;
  const v = await kv.get(key(kind, uid));
  return v !== null && v !== undefined;
}

export async function markNotified(kind: NotifyKind, uid: string): Promise<void> {
  if (!isKvConfigured()) return;
  await kv.set(key(kind, uid), Date.now(), { ex: TTL_SECONDS[kind] });
}

/**
 * Delete the ledger key so the NEXT cron tick re-evaluates this notification.
 * Used only for transient-total-failure recovery: a notification is marked
 * BEFORE its send fan-out (so a mid-loop crash can't double-spam), but if a
 * completed loop reached ZERO subscribers because every send threw a real
 * (non-gone) error, the mark is undone here so the next tick retries.
 * No-op when KV is unconfigured.
 */
export async function unmarkNotified(kind: NotifyKind, uid: string): Promise<void> {
  if (!isKvConfigured()) return;
  await kv.del(key(kind, uid));
}

/**
 * Decide whether a just-marked notification should be UN-marked so the next
 * cron tick retries it. Pure (KV-free) so the policy is unit-testable.
 *
 * Retry only on a *transient total failure*: the fan-out completed, reached
 * zero subscribers successfully (`sent === 0`), AND at least one send failed
 * with a real, non-gone error (`errored > 0`) — i.e. a push-service 5xx /
 * network blip that a later tick may recover from.
 *
 * We deliberately DON'T retry when the only non-sends were dead-subscription
 * evictions (`gone` → already removed; resending is pointless) or pref/mute
 * skips or simply "no subscribers" (`errored === 0`): those are terminal, not
 * transient, so leaving the mark in place is correct and avoids an endless
 * re-fanout of a notification nobody can receive.
 *
 * Trade-off: because unmark runs only AFTER a completed loop with zero
 * successes, a crash partway through the loop still leaves the mark set — so
 * the next tick can never re-spam the subscribers who already got it. The cost
 * is at most one missed notification on a true mid-loop crash; the benefit is
 * recovery from a transient total outage.
 */
export function shouldRetryAfterTotalFailure(counts: {
  sent: number;
  errored: number;
}): boolean {
  return counts.sent === 0 && counts.errored > 0;
}
