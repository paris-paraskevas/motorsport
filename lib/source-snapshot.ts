import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { logSourceError } from '@/lib/fetch-upstream';
import type { RaceResult } from '@/lib/types';

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

/**
 * DB-as-single-source-of-truth mode (`DATA_SOURCE=db`, set on the Cloudflare
 * Worker only).
 *
 * The community data APIs (jolpi.ca, FOM, Pulselive, motorsport.com, Wikipedia,
 * fiawec) rate-limit or block Cloudflare's shared egress IPs. Before this flag
 * the request path still *tried* them on every render, so a colo that wasn't
 * blocked returned PARTIAL data which then overwrote the good last-good cache —
 * data was non-deterministic (prod 2026-07-27: the F1 season chart stopped at
 * round 5 while the season was at round 11).
 *
 * In this mode the render path is a READER, never a writer:
 *   - a present snapshot is served as-is and the upstream fetch never runs;
 *   - a MISSING slot still falls through to the fetcher (so a surface the warm
 *     cron hasn't covered yet isn't blank) but its result is NEVER persisted.
 * `scripts/warm-live-data.mts` — run from a clean IP by the warm-live-data
 * GitHub Action, without this flag — is the only writer.
 */
export function isDbReadOnly(): boolean {
  return process.env.DATA_SOURCE === 'db';
}

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

/**
 * Read the last-good payload stored under `key`, or null on miss / error /
 * unconfigured. Exported so callers that already own a hotter cache tier (e.g.
 * `lib/f1-cache.ts`'s KV last-good) can layer this durable Postgres backstop
 * *beneath* it without going through `withSourceSnapshot`. Payloads round-trip
 * through jsonb, so any `Date` fields come back as ISO strings — rehydrate on
 * the caller side.
 */
export async function readSnapshot<T>(key: string): Promise<T | null> {
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

/**
 * Persist `payload` as the last-good snapshot for `key` (upsert). Fail-soft:
 * a Supabase outage is logged, never thrown. Exported alongside `readSnapshot`
 * for the layered-backstop use described above.
 */
export async function writeSnapshot<T>(key: string, payload: T): Promise<void> {
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
  if (isDbReadOnly()) {
    const stored = await readSnapshot<T>(key);
    if (stored !== null) return stored;
    // Unseeded slot: serve whatever the fetcher manages (better than blank) but
    // never write it — only the clean-IP warm cron may seed the DB. Logged so a
    // permanently unseeded surface is visible instead of silently degrading.
    logSourceError(`db-only:snapshot-miss:${key}`, 'no stored payload');
    try {
      return await fetcher();
    } catch {
      return undefined as unknown as T;
    }
  }
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

/**
 * `withSourceSnapshot` specialised for the season-results parsers, whose payload
 * is `RaceResult[]`. Two reasons this exists rather than each parser calling the
 * generic form: (1) jsonb round-trips `date` to an ISO string and every results
 * surface formats that field, so the read path MUST rehydrate it; (2) the
 * empty-and-fail-soft contract (`[]`, never undefined) is identical for all of
 * them. Nested `RaceResultEntry` rows carry no dates.
 */
export async function withRaceResultsSnapshot(
  key: string,
  fetcher: () => Promise<RaceResult[]>,
): Promise<RaceResult[]> {
  const rows = await withSourceSnapshot<RaceResult[]>(
    key,
    fetcher,
    v => v == null || v.length === 0,
  );
  return reviveRaceDates(rows);
}

/** ISO string → `Date` on every row's `date`; tolerates a null/undefined list. */
export function reviveRaceDates(rows: RaceResult[] | null | undefined): RaceResult[] {
  if (!Array.isArray(rows)) return [];
  return rows.map(r =>
    r?.date instanceof Date ? r : { ...r, date: new Date(r?.date as unknown as string) },
  );
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
