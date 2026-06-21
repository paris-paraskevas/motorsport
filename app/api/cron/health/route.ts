import { NextResponse } from 'next/server';
import { authorizeCronRequest, cronAuthFailureResponse } from '@/lib/cron-auth';
import { runStandingsHealth } from '@/lib/standings-health';
import { runResultsHealth } from '@/lib/results-health';
import { summarize, type HealthResult } from '@/lib/health-core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const detail = (r: HealthResult) => ({
  slug: r.slug, label: r.label, status: r.status, rows: r.rows, min: r.min, ms: r.ms,
  ...(r.error ? { error: r.error } : {}),
});

// Runs every live standings AND results parser against its source from the
// production environment (so the result reflects what users actually get, not a
// CI runner's network). Returns 503 when any source is DOWN so the GitHub
// Actions cron — and any uptime check — alerts; the body lists per-series detail.
export async function GET(req: Request) {
  const auth = authorizeCronRequest(req);
  if (auth !== 'ok') return cronAuthFailureResponse(auth);

  try {
    const [standings, results] = await Promise.all([runStandingsHealth(), runResultsHealth()]);
    const sSum = summarize(standings);
    const rSum = summarize(results);
    const down = sSum.down + rSum.down;

    return NextResponse.json(
      {
        ok: down === 0,
        checkedAt: new Date().toISOString(),
        down,
        standings: { ...sSum, checks: standings.map(detail) },
        results: { ...rSum, checks: results.map(detail) },
      },
      { status: down > 0 ? 503 : 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
