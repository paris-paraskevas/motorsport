import type { RaceResult, RaceResultEntry } from '@/lib/types';
import { fetchDTMStandings } from '@/lib/standings/dtm';

export type { RaceResult, RaceResultEntry };

// DTM doesn't have a separate per-race classification source that's
// scrape-friendly from Vercel (the per-event pages on motorsport.com need a
// follow-up probe). What we DO have is the season-page Drivers' standings
// table's per-cell per-race breakdown — one column per round with each
// driver's points for that round. Summing those columns per driver yields
// the standings total by construction, so chart totals reconcile to the
// Standings tab without further work.
//
// This module reshapes that per-cell data into chart-ready `RaceResult[]`,
// one synthetic RaceResult per completed round. Each round's `results` is
// the list of drivers who scored, ordered by points descending. The
// position field is the rank-within-round (1-indexed); we don't have the
// actual race-finishing position because motorsport.com surfaces only
// points per cell. Per-race full classification (top-N with finish status
// + gap) is deferred to a follow-up that probes the per-event URL.

const DTM_ROUND_LABELS = [
  'Round 1',
  'Round 2',
  'Round 3',
  'Round 4',
  'Round 5',
  'Round 6',
  'Round 7',
  'Round 8',
  'Round 9',
];

export async function fetchDTMSeasonChartData(): Promise<RaceResult[]> {
  const standings = await fetchDTMStandings();
  if (!standings) return [];
  const breakdown = standings.driverRoundBreakdown;
  if (breakdown.length === 0) return [];

  const roundCount = Math.max(...breakdown.map(d => d.perRoundPoints.length));
  if (roundCount === 0) return [];

  const races: RaceResult[] = [];
  for (let roundIdx = 0; roundIdx < roundCount; roundIdx++) {
    // Collect every driver who scored a non-zero number of points this
    // round. A round with zero scorers (un-raced future column) is dropped
    // so the chart's x-axis only spans completed events.
    const scorers: Array<{ driver: string; team: string; points: number }> = [];
    for (const d of breakdown) {
      const pts = d.perRoundPoints[roundIdx] ?? 0;
      if (pts > 0) {
        scorers.push({ driver: d.driverName, team: d.team, points: pts });
      }
    }
    if (scorers.length === 0) continue;

    scorers.sort((a, b) => b.points - a.points);
    const entries: RaceResultEntry[] = scorers.map((s, i) => ({
      position: i + 1,
      driverName: s.driver,
      team: s.team,
      status: 'Scored',
      points: s.points,
    }));

    // Anchor each synthetic round at a UTC midnight derived from the
    // round index so chronological sort stays stable across SSRs. We
    // don't have authoritative dates from motorsport.com; the curated
    // rounds.json could be cross-referenced in a follow-up.
    const date = new Date(Date.UTC(2026, 3, 1 + roundIdx * 30));

    races.push({
      round: roundIdx + 1,
      raceName: DTM_ROUND_LABELS[roundIdx] ?? `Round ${roundIdx + 1}`,
      date,
      circuit: DTM_ROUND_LABELS[roundIdx] ?? `Round ${roundIdx + 1}`,
      results: entries,
    });
  }
  return races;
}
