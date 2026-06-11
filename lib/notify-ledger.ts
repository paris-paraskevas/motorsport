import { kv } from '@vercel/kv';

// Dedupe ledger for the notify cron. One key per (session, notification kind);
// the cron fires every 15 min and each send window is 15 min wide, so without
// this a late/early tick could double-send (and a redeploy mid-window would).
// KV-less environments no-op as "never notified" — harmless locally, and in
// prod the subscriptions themselves live in KV, so the cron exits before any
// send if KV is down.

export type NotifyKind = 't30' | 't10' | 'res';

const KEY_PREFIX = 'paddock:notified:';
// Sessions are one-shot events — 48h covers any cron retry horizon. Results
// keys live longer because the results check has an 8h lookback window.
const TTL_SECONDS: Record<NotifyKind, number> = {
  t30: 48 * 3600,
  t10: 48 * 3600,
  res: 7 * 24 * 3600,
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
