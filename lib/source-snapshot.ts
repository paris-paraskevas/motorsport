import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { logSourceError } from '@/lib/fetch-upstream';

// Durable last-good cache + health record for upstream feeds, in Postgres
// (the `source_snapshot` table). The DB-as-fallback the operator asked for:
// every successful fetch is persisted, and on a later upstream failure/empty we
// serve the last-good payload instead of blanking. The table doubles as a health
// record (fetched_at / ok per source) — see GET /api/cron/health.
//
// FAIL-SOFT: if Supabase isn't configured it just runs the fetcher (behaves as if
// uncached) and never throws into the caller — mirrors lib/results-cache.ts.
//
// Reads happen on ISR/cached pages (~once per revalidation), so the eu-west-1
// round-trip is amortised; Vercel KV stays the per-request tier for hot betting
// reads. `betDb()` is the shared server-side Supabase client (named for betting
// but used by every server table — threads, and now this).
//
// NOTE on Dates: jsonb round-trips Date fields to ISO strings. This helper stays
// type-agnostic and returns the payload as stored; callers whose payload contains
// Date objects (e.g. news `pubDate`) must rehydrate them after a last-good read.

const STALE_AFTER_MINUTES = 24 * 60; // a source unrefreshed for >24h is flagged in health

export interface SourceHealth {
  key: string;
  fetchedAt: string | null;
  ok: boolean;
  ageMinutes: number | null;
  httpStatus: number | null;
  stale: boolean;
}

function defaultIsEmpty(v: unknown): boolean {
  return v == null || (Array.isArray(v) && v.length === 0);
}

async function readSnapshot<T>(key: string): Promise<T | null> {
  if (!isBettingConfigured()) return null;
  try {
    const { data, error } = await betDb()
      .from('source_snapshot')
      .select('payload')
      .eq('source_key', key)
      .maybeSingle();
    if (error || !data) return null;
    return (data.payload as T) ?? null;
  } catch (err) {
    // Fail-soft (mirrors lib/results-cache.ts): a Supabase outage must not break
    // the render. Log so a persistent last-good read failure is visible.
    logSourceError(`source-snapshot:read:${key}`, err);
    return null;
  }
}

async function writeSnapshot<T>(key: string, payload: T): Promise<void> {
  if (!isBettingConfigured()) return;
  try {
    await betDb()
      .from('source_snapshot')
      .upsert(
        {
          source_key: key,
          payload: payload as unknown as object,
          fetched_at: new Date().toISOString(),
          ok: true,
          http_status: 200,
          error: null,
        },
        { onConflict: 'source_key' },
      );
  } catch (err) {
    // Non-fatal: the caller already has fresh data in hand. Log so a persistent
    // last-good write failure surfaces instead of degrading the fallback silently.
    logSourceError(`source-snapshot:write:${key}`, err);
  }
}

/**
 * Run `fetcher`; on a non-empty success, persist the payload to `source_snapshot`
 * and return it; on a thrown error or empty result, return the last-good snapshot
 * if one exists (durable fallback), else the (empty) fetched value. `isEmpty`
 * decides what counts as a non-result worth falling back from (default:
 * null/undefined/empty-array).
 */
export async function withSourceSnapshot<T>(
  key: string,
  fetcher: () => Promise<T>,
  isEmpty: (v: T) => boolean = defaultIsEmpty,
): Promise<T> {
  let fresh: T;
  try {
    fresh = await fetcher();
  } catch {
    fresh = undefined as unknown as T;
  }
  if (!isEmpty(fresh)) {
    // Awaited (not fire-and-forget): a floating write isn't guaranteed to flush
    // before a server render / serverless invocation ends. writeSnapshot is
    // fail-soft, so awaiting it never throws; the latency lands only on a
    // cache-miss render, not on cached serves.
    await writeSnapshot(key, fresh);
    return fresh;
  }
  const lastGood = await readSnapshot<T>(key);
  return lastGood !== null ? lastGood : fresh;
}

/** Per-source freshness for the health endpoint, newest first. */
export async function getSourceHealth(): Promise<SourceHealth[]> {
  if (!isBettingConfigured()) return [];
  try {
    const { data, error } = await betDb()
      .from('source_snapshot')
      .select('source_key, fetched_at, ok, http_status')
      .order('fetched_at', { ascending: false });
    if (error || !data) return [];
    const now = Date.now();
    return data.map(r => {
      const fetchedAt = (r.fetched_at as string | null) ?? null;
      const ageMinutes = fetchedAt ? Math.round((now - Date.parse(fetchedAt)) / 60000) : null;
      return {
        key: r.source_key as string,
        fetchedAt,
        ok: Boolean(r.ok),
        ageMinutes,
        httpStatus: (r.http_status as number | null) ?? null,
        stale: ageMinutes != null && ageMinutes > STALE_AFTER_MINUTES,
      };
    });
  } catch {
    return [];
  }
}
