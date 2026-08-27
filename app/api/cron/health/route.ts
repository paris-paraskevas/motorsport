import { NextResponse } from 'next/server';
import { authorizeCronRequest, cronAuthFailureResponse } from '@/lib/cron-auth';
import { runStandingsHealth } from '@/lib/standings-health';
import { runResultsHealth } from '@/lib/results-health';
import { runSessionsHealth, summarizeSessions } from '@/lib/sessions-health';
import { summarize } from '@/lib/health-core';
import { getSourceHealth } from '@/lib/source-snapshot';
import { buildHealthReport, writeHealthReport } from '@/lib/health-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Runs every live standings AND results parser against its source, plus the
// session-schedule grader. Returns 503 when any source is DOWN so the cron — and
// any uptime check — alerts; the body lists per-series detail.
//
// WHAT THIS MEASURES, precisely, because the previous comment here said it
// reflected "what users actually get" and on Cloudflare that is not true: the
// Worker runs DATA_SOURCE=db, so a reader is served snapshots written by
// `scripts/warm-live-data.mts` from GitHub Actions on clean egress IPs. These
// checks run from the WORKER, which many upstreams reject on datacenter IPs. So
// this grades PARSER health over the Worker's network; reader-facing freshness
// is the separate `sources` block, read live from `source_snapshot`.
//
// The verdict is also PERSISTED (0.334.70) rather than discarded, so the console
// can render site health from one KV read instead of re-running this fan-out at
// request time. The response body is unchanged — only a write was added.
export async function GET(req: Request) {
  const auth = authorizeCronRequest(req);
  if (auth !== 'ok') return cronAuthFailureResponse(auth);

  try {
    const [standings, results, sessions, sources] = await Promise.all([
      runStandingsHealth(),
      runResultsHealth(),
      runSessionsHealth(),
      getSourceHealth(),
    ]);
    // A thin/empty weekend schedule counts toward "down" too, so the 6-hourly
    // cron alerts on incomplete session data — the failure the row-count checks
    // can't see. That total lives in buildHealthReport now, so the stored report
    // and this response can never disagree about whether the site is healthy.
    const report = buildHealthReport(
      { summary: summarize(standings), checks: standings },
      { summary: summarize(results), checks: results },
      { summary: summarizeSessions(sessions), checks: sessions },
    );

    // Awaited, not fire-and-forget: the Worker can be torn down the moment the
    // response is returned. Fail-soft inside, so a KV outage cannot turn a
    // healthy check red.
    await writeHealthReport(report);

    return NextResponse.json(
      {
        ...report,
        sources, // durable last-good freshness per upstream feed (source_snapshot)
      },
      { status: report.down > 0 ? 503 : 200 },
    );
  } catch (err) {
    console.error('GET /api/cron/health failed:', err);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
