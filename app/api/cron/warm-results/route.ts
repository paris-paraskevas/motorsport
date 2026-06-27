import { NextResponse } from 'next/server';
import { authorizeCronRequest, cronAuthFailureResponse } from '@/lib/cron-auth';
import { HOME_RESULTS_SLUGS, fetchLatestPodium } from '@/lib/home-results';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Pre-warms the home "just missed" podium KV (paddock:home:podium:*) so the
// /api/just-missed request path never hits upstream cold — that cold fan-out has
// historically taken ~14s (six season parsers at once, WEC's slow CMS chain the
// worst). Force-refreshes every supported series' latest-podium cache on a timer
// (~30 min, well inside the 3h results-cache TTL), so a visitor always reads warm
// KV. Cron-auth'd + fail-closed (lib/cron-auth); scheduled by
// .github/workflows/warm-results.yml. Best-effort: a series with no finished race
// yet (or a transient fetch failure) is reported as `empty`, never fatal.
export async function GET(req: Request) {
  const auth = authorizeCronRequest(req);
  if (auth !== 'ok') return cronAuthFailureResponse(auth);

  const outcomes = await Promise.all(
    HOME_RESULTS_SLUGS.map(async slug => {
      try {
        const r = await fetchLatestPodium(slug, { force: true });
        return { slug, warmed: r != null };
      } catch {
        return { slug, warmed: false };
      }
    }),
  );

  return NextResponse.json({
    ok: true,
    warmedAt: new Date().toISOString(),
    warmed: outcomes.filter(o => o.warmed).map(o => o.slug),
    empty: outcomes.filter(o => !o.warmed).map(o => o.slug),
  });
}
