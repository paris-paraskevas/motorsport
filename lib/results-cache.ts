import { kv } from '@vercel/kv';
import type { RaceResult } from '@/lib/types';

/**
 * KV cache layer for the F2 / F3 season-results fan-out.
 *
 * Both parsers do an N+1 fetch (manifest page → one page per round). With 10-14
 * rounds this is 2-3 seconds on every page render — `next: { revalidate: 3600 }`
 * dedupes within a single Next.js process but does not help cross-render on
 * different instances or after ISR rebuilds. KV gives us a shared 3-hour window
 * so completed rounds stop being re-parsed every render.
 *
 * The shape generic lets F2 cache its `{ feature, sprint }` payload while F3
 * caches its flat `RaceResult[]`. Both contain `Date` objects inside, which
 * JSON-serialize to ISO strings and need rehydration on read.
 */

// 3 hours. Completed rounds never change; in-flight rounds get fresh data on
// the next cache miss after expiry. Mirrors `lib/weather.ts`.
const TTL_SECONDS = 3 * 60 * 60;

function isKvConfigured(): boolean {
  return Boolean(
    process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
  );
}

/** RaceResult on read from JSON has `date` as an ISO string. Re-hydrate. */
function reviveRaceResult<T extends RaceResult>(r: T): T {
  if (r && r.date && !(r.date instanceof Date)) {
    return { ...r, date: new Date(r.date as unknown as string) };
  }
  return r;
}

/**
 * Recursively re-hydrates `Date` fields inside any cache payload that contains
 * `RaceResult[]` (flat list, or nested under arbitrary keys for the F2 shape).
 */
function reviveDates<T>(payload: T): T {
  if (Array.isArray(payload)) {
    return payload.map(item => {
      if (item && typeof item === 'object' && 'round' in item && 'date' in item) {
        return reviveRaceResult(item as unknown as RaceResult);
      }
      return item;
    }) as unknown as T;
  }
  if (payload && typeof payload === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
      out[k] = reviveDates(v);
    }
    return out as T;
  }
  return payload;
}

/**
 * Read `key` from KV, hydrate Date fields, return null on miss / error.
 *
 * Errors are swallowed deliberately: a KV outage should never break the
 * results tab. Caller will fall through to the upstream fetch.
 */
export async function readResultsCache<T>(key: string): Promise<T | null> {
  if (!isKvConfigured()) return null;
  try {
    const raw = await kv.get<T>(key);
    if (raw == null) return null;
    return reviveDates(raw);
  } catch {
    return null;
  }
}

/**
 * Write `payload` to KV under `key` with a 3-hour TTL. Failure is non-fatal:
 * the caller still has fresh data in hand from the upstream fetch.
 */
export async function writeResultsCache<T>(key: string, payload: T): Promise<void> {
  if (!isKvConfigured()) return;
  try {
    await kv.set(key, payload, { ex: TTL_SECONDS });
  } catch {
    // Swallow — KV write failure should not affect the page render.
  }
}

/** Cache-key builder. Series-scoped + season-scoped so rolling over years is safe. */
export function seasonCacheKey(
  series: 'f2' | 'f3' | 'wec' | 'f3-sessions',
  season: number,
): string {
  return `paddock:results:${series}:season:${season}`;
}
