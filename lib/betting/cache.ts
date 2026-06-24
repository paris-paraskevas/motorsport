import { kv } from '@vercel/kv';

// Server-only. A thin KV read-through for the hot betting *display* reads — open
// markets (identical for every viewer) and per-league win-rate leaderboards.
// Mirrors the fail-open contract of `lib/results-cache.ts`: a KV outage or
// missing config must never break a render — every op swallows its error and
// the caller falls through to a fresh Supabase read.
//
// SAFE to cache here: display-only reads (odds snapshots, win-rate standings).
// NEVER cache balance or settlement-path reads — those feed atomic SQL guards
// (`place_bet`, `settle_market`) and must always be fresh.

function isKvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

/** Read `key` from KV; null on miss / outage / unconfigured (caller refetches). */
export async function readBetCache<T>(key: string): Promise<T | null> {
  if (!isKvConfigured()) return null;
  try {
    return (await kv.get<T>(key)) ?? null;
  } catch {
    return null;
  }
}

/** Write `value` under `key` with a TTL. Non-fatal on failure. */
export async function writeBetCache<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  if (!isKvConfigured()) return;
  try {
    await kv.set(key, value, { ex: ttlSeconds });
  } catch {
    // Non-fatal: the caller already has fresh data in hand.
  }
}

/** Drop `key` so the next read rebuilds. Used by the write paths below. */
export async function bustBetCache(key: string): Promise<void> {
  if (!isKvConfigured()) return;
  try {
    await kv.del(key);
  } catch {
    // Non-fatal.
  }
}

// Open markets are global (same for every viewer) → one shared key. The list
// only changes when the open-markets cron adds one or a market locks, and
// createMarket / settleMarket bust this key, so the short TTL is just a backstop.
export const OPEN_MARKETS_KEY = 'paddock:bet:open-markets';
export const OPEN_MARKETS_TTL = 60;

// Per-league win-rate standings, unfiltered by minPlaced (the filter is applied
// after read so one entry serves every caller). Busted on membership / profile /
// settlement changes; the TTL backstops the cron-side league settlement path.
export const leaderboardKey = (leagueId: string) => `paddock:bet:leaderboard:${leagueId}`;
export const LEADERBOARD_TTL = 120;
