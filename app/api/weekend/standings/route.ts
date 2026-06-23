import { NextResponse } from 'next/server';
import { loadSeries } from '@/lib/series';
import { loadSnapshotSource } from '@/components/weekend/WeekendStandingsSnapshot';
import { buildStandingsAtRound } from '@/lib/season-trend';
import type { RaceResult } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Point-in-time standings for the weekend page's Sessions tab, served on demand
// (client-fetched when the tab is opened) so the weekend page render no longer
// fans out the season-results fetchers. Mirrors WeekendStandingsSnapshot's exact
// gating (pointsExact + winners-only) and returns serialisable data; CDN-cached
// like the page (s-maxage=300).

// A winners-only race would silently undercount everyone in a cumulative table.
function hasWinnersOnly(races: RaceResult[]): boolean {
  return races.some(r => r.results.length === 1 && /^(race\s+)?winner$/i.test(r.results[0].status));
}
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'official site';
  }
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const slug = sp.get('series') ?? '';
  const round = Number(sp.get('round'));
  const isPast = sp.get('isPast') === '1';
  if (!slug || !Number.isInteger(round) || round < 1) {
    return NextResponse.json({ mode: 'none' }, { status: 400 });
  }
  let series;
  try {
    series = await loadSeries(slug);
  } catch {
    return NextResponse.json({ mode: 'none' }, { status: 404 });
  }

  const label = isPast ? `As of round ${round}` : `Going into round ${round}`;
  const linkout = () =>
    series.meta.officialStandingsUrl
      ? { mode: 'linkout' as const, label, url: series.meta.officialStandingsUrl, host: hostOf(series.meta.officialStandingsUrl) }
      : { mode: 'none' as const };

  let body: Record<string, unknown> = { mode: 'none' };
  const source = await loadSnapshotSource(series);
  if (source && source.races.length > 0 && source.pointsExact) {
    const throughRound = isPast ? round : round - 1;
    if (throughRound >= 1) {
      const counted = source.races.filter(r => r.round <= throughRound);
      if (hasWinnersOnly(counted)) {
        body = linkout();
      } else {
        const snap = buildStandingsAtRound(source.races, throughRound, source.extras);
        if (snap.drivers.length > 0) {
          const countedLabel =
            snap.throughRound === throughRound ? label : `${label} · counted through round ${snap.throughRound}`;
          body = {
            mode: 'table',
            label: countedLabel,
            showTeams: source.showTeams,
            drivers: snap.drivers,
            constructors: snap.constructors,
          };
        }
      }
    }
  } else {
    body = linkout();
  }

  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
}
