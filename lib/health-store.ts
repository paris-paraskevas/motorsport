import { kv } from './kv';
import { logSourceError } from '@/lib/fetch-upstream';
import type { HealthResult, HealthStatus, HealthSummary } from '@/lib/health-core';
import type {
  SessionHealthResult,
  SessionHealthStatus,
  SessionHealthSummary,
  ThinRound,
} from '@/lib/sessions-health';

/**
 * Durable store for the 6-hourly health report.
 *
 * WHY THIS EXISTS. `/api/cron/health` runs every live standings and results
 * parser plus the session-schedule grader, returns the verdict to the cron, and
 * then throws it away — nothing has ever persisted it. So there is no way to
 * render site health anywhere without re-running fifteen series of network
 * fan-out at request time, behind a 30s-per-check timeout. That page would be
 * slow when it worked and blank when it did not.
 *
 * The cron writes here instead, and readers get one KV round trip. The report
 * carries its own `checkedAt`, so a consumer states the age ("checked 41
 * minutes ago") rather than implying the numbers are live — which is what an
 * operational dashboard is supposed to say anyway.
 *
 * DELIBERATELY NOT STORED: per-source freshness. `getSourceHealth()`
 * (lib/source-snapshot.ts) is a single indexed query over `source_snapshot`,
 * and it answers a DIFFERENT question — how old the data a reader is being
 * served actually is. The Worker runs DATA_SOURCE=db, so readers get snapshots
 * written by the warm job from clean egress IPs, never these parsers. Freezing
 * that into a 6-hourly report would make a cheap live truth stale for no
 * reason. Parser health is stored; reader-facing freshness is read live.
 *
 * IMPORTS ARE TYPE-ONLY ON PURPOSE. `lib/results-health.ts` pulls in every
 * results parser and `lib/sessions-health.ts` pulls the content layer; a
 * consumer that only wants to READ the last report must not drag either into
 * its bundle. The caller passes the summaries it already computed.
 */

/** Single key — there is one current report, not a series of them. */
export const HEALTH_REPORT_KEY = 'paddock:health:report';

/**
 * 30 days, not the 6-hour cron interval.
 *
 * A TTL at the cadence means one failed run empties the key and the consumer
 * shows nothing, which is strictly worse than showing a stale report with an
 * honest age — an old `checkedAt` is itself the signal that the cron has
 * stopped. The long TTL only stops a permanently abandoned key living forever.
 */
const TTL_SECONDS = 30 * 24 * 60 * 60;

/** Per-check detail as stored. Mirrors what the cron response has always
 *  returned, so the stored shape and the endpoint's body cannot drift. */
export interface HealthCheckDetail {
  slug: string;
  label: string;
  status: HealthStatus;
  rows: number;
  min: number;
  ms: number;
  error?: string;
}

export interface SessionCheckDetail {
  slug: string;
  label: string;
  status: SessionHealthStatus;
  completedRounds: number;
  median: number;
  thin: ThinRound[];
  ms: number;
  error?: string;
}

export interface HealthReport {
  ok: boolean;
  /** ISO timestamp of the run. Consumers derive the report's age from this. */
  checkedAt: string;
  down: number;
  standings: HealthSummary & { checks: HealthCheckDetail[] };
  results: HealthSummary & { checks: HealthCheckDetail[] };
  sessions: SessionHealthSummary & { checks: SessionCheckDetail[] };
}

/** `error` is omitted rather than set to undefined so the stored JSON stays
 *  identical to what the endpoint has always emitted. */
function detail(r: HealthResult): HealthCheckDetail {
  return {
    slug: r.slug,
    label: r.label,
    status: r.status,
    rows: r.rows,
    min: r.min,
    ms: r.ms,
    ...(r.error ? { error: r.error } : {}),
  };
}

function sessionDetail(r: SessionHealthResult): SessionCheckDetail {
  return {
    slug: r.slug,
    label: r.label,
    status: r.status,
    completedRounds: r.completedRounds,
    median: r.median,
    thin: r.thin,
    ms: r.ms,
    ...(r.error ? { error: r.error } : {}),
  };
}

/**
 * Assemble the report from checks the caller has already run and summarised.
 *
 * `down` counts a thin/empty weekend schedule alongside the row-count failures,
 * because an incomplete timetable is the failure the row counts cannot see —
 * the same total the endpoint has always used to decide its 503.
 *
 * `now` is injectable for the same reason `runSessionsHealth` takes it: so a
 * test can assert an exact timestamp without faking the clock.
 */
export function buildHealthReport(
  standings: { summary: HealthSummary; checks: HealthResult[] },
  results: { summary: HealthSummary; checks: HealthResult[] },
  sessions: { summary: SessionHealthSummary; checks: SessionHealthResult[] },
  now: Date = new Date(),
): HealthReport {
  const down = standings.summary.down + results.summary.down + sessions.summary.flagged;
  return {
    ok: down === 0,
    checkedAt: now.toISOString(),
    down,
    standings: { ...standings.summary, checks: standings.checks.map(detail) },
    results: { ...results.summary, checks: results.checks.map(detail) },
    sessions: { ...sessions.summary, checks: sessions.checks.map(sessionDetail) },
  };
}

function isKvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

/**
 * Persist the report. Fail-soft by contract: the cron's own response — the
 * thing an uptime check reads — must not turn red because the store is down.
 */
export async function writeHealthReport(report: HealthReport): Promise<void> {
  if (!isKvConfigured()) return;
  try {
    await kv.set(HEALTH_REPORT_KEY, report, { ex: TTL_SECONDS });
  } catch (err) {
    logSourceError('health-store:write', err);
  }
}

/**
 * The last stored report, or null when there has never been one / KV is
 * unreachable. Null is a real state a consumer must render (no run yet), not
 * an error to throw on.
 */
export async function readHealthReport(): Promise<HealthReport | null> {
  if (!isKvConfigured()) return null;
  try {
    return (await kv.get<HealthReport>(HEALTH_REPORT_KEY)) ?? null;
  } catch (err) {
    logSourceError('health-store:read', err);
    return null;
  }
}
