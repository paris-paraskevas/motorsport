import { kv } from '@vercel/kv';
import type { RaceResult } from '@/lib/types';

/**
 * KV "last-good" read-through for the F1 standings + results parsers.
 *
 * Both pull ONLY from the Jolpica API (`api.jolpi.ca`). When Jolpica has an
 * origin outage (observed 2026-06: HTTP 521 on every endpoint) the parsers
 * fail-soft to null / [] and the standings + results pages render blank. This
 * layer persists the last successful, non-empty payload to KV so a transient
 * Jolpica outage never blanks the page; the parsers self-heal on the next
 * successful fetch (which overwrites the cached value).
 *
 * Contract is identical to `lib/results-cache.ts`: it FAILS OPEN. KV env is
 * absent in local dev, so if `KV_REST_API_URL` / `KV_REST_API_TOKEN` are
 * missing — or KV throws — every helper behaves as if uncached (read → null,
 * write → no-op). Callers fall back to exactly today's null / [] behaviour.
 *
 * F1 payloads (`RaceResult`) carry `Date` objects, which JSON-serialise to ISO
 * strings in KV and need rehydration on read — reused from results-cache.
 */

// 21 days. Long enough to ride out a multi-day-to-multi-week Jolpica outage
// without blanking the page (the task floor is 14-30 days). Each successful
// fetch rewrites the value with a fresh TTL, so steady-state this is just a
// rolling backstop, never user-visible staleness.
const LAST_GOOD_TTL_SECONDS = 21 * 24 * 60 * 60;

/** Stored envelope: the payload plus the wall-clock time it was cached. */
export interface LastGood<T> {
  data: T;
  cachedAt: string; // ISO timestamp
}

function isKvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

/** RaceResult on read from JSON has `date` as an ISO string. Re-hydrate. */
function reviveRaceResult<T extends RaceResult>(r: T): T {
  if (r && r.date && !(r.date instanceof Date)) {
    return { ...r, date: new Date(r.date as unknown as string) };
  }
  return r;
}

/**
 * Recursively re-hydrates `Date` fields inside any cached payload that contains
 * `RaceResult` objects (a flat `RaceResult[]`, or nested under arbitrary keys
 * such as the standings `{ drivers, constructors }` shape — which carry no
 * Dates and pass through untouched). Mirrors `lib/results-cache.ts`.
 */
function reviveDates<T>(payload: T): T {
  if (Array.isArray(payload)) {
    return payload.map(item => {
      if (item && typeof item === 'object' && 'round' in item && 'date' in item) {
        return reviveRaceResult(item as unknown as RaceResult);
      }
      return reviveDates(item);
    }) as unknown as T;
  }
  // A single RaceResult (the `fetchF1LastRace` slot caches one, not an array).
  if (payload && typeof payload === 'object' && 'round' in payload && 'date' in payload) {
    return reviveRaceResult(payload as unknown as RaceResult) as unknown as T;
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

/** Stable, namespaced key per last-good slot. */
export function f1LastGoodKey(name: string): string {
  return `paddock:f1-lastgood:${name}`;
}

/**
 * Read the last-good payload for `name` from KV, hydrating Date fields.
 * Returns null on miss / error / unconfigured — callers fall through to their
 * existing null / [] failure value.
 */
export async function readF1LastGood<T>(name: string): Promise<T | null> {
  if (!isKvConfigured()) return null;
  try {
    const raw = await kv.get<LastGood<T>>(f1LastGoodKey(name));
    if (raw == null || raw.data == null) return null;
    return reviveDates(raw.data);
  } catch {
    return null;
  }
}

/**
 * Write `data` as the last-good payload for `name`, stamped with the current
 * time and a long TTL. Non-fatal on failure: the caller already holds fresh
 * data from the upstream fetch.
 */
export async function writeF1LastGood<T>(name: string, data: T): Promise<void> {
  if (!isKvConfigured()) return;
  try {
    const envelope: LastGood<T> = { data, cachedAt: new Date().toISOString() };
    await kv.set(f1LastGoodKey(name), envelope, { ex: LAST_GOOD_TTL_SECONDS });
  } catch {
    // Swallow — a KV write failure must not affect the page render.
  }
}

/**
 * Read-through wrapper. Runs `fetcher`; if it yields a non-empty result, writes
 * it to the `name` last-good slot and returns it. If it yields the empty
 * sentinel (`isEmpty(result)` true — i.e. today's null / [] failure path),
 * serves the last-good value from KV instead, falling back to the fresh-but-
 * empty result when no last-good exists.
 *
 * FAILS OPEN throughout: with KV unconfigured, the reads/writes are no-ops and
 * this returns exactly what `fetcher` returned.
 */
export async function withF1LastGood<T>(
  name: string,
  fetcher: () => Promise<T>,
  isEmpty: (result: T) => boolean,
): Promise<T> {
  const fresh = await fetcher();
  if (!isEmpty(fresh)) {
    await writeF1LastGood(name, fresh);
    return fresh;
  }
  const cached = await readF1LastGood<T>(name);
  return cached ?? fresh;
}
