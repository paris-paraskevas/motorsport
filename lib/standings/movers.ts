import { buildSeasonTrendData, type SeasonTrendData } from '@/lib/season-trend';
import { fetchF1SeasonResults, fetchF1SeasonSprints } from '@/lib/results/f1';
import { fetchF3SeasonResults } from '@/lib/results/f3';
import { fetchMotoGPSeasonResults } from '@/lib/results/motogp';

// Round-over-round championship "movers" for the home standings-movers widget:
// how each driver's rank changed between the last completed round and the one
// before it. Derived from the SAME per-round results the Standings-tab trend
// chart uses (buildSeasonTrendData), so a mover reconciles with the chart — no
// new data layer, no stored history.
//
// v1 eligibility is the set where a single season-results fetch reconciles to
// the standings table without per-series points-model handling: F1 (races +
// sprint extras, exactly as the tab builds it), F3, MotoGP (its RaceResult[]
// already folds sprint+GP since the 0.152.2 pickScoringRace fix). F2 and the
// rest are deferred — F2's championship folds sprint/pole/FL points that need
// their own reconciliation before a rank here would be trustworthy.

export const MOVERS_ELIGIBLE_SLUGS = ['f1', 'f3', 'motogp'] as const;
const ELIGIBLE = new Set<string>(MOVERS_ELIGIBLE_SLUGS);

export function isEligibleMoversSeries(slug: string): boolean {
  return ELIGIBLE.has(slug);
}

export interface Mover {
  name: string;
  /** Championship rank after the latest round (1-based, by cumulative points). */
  rank: number;
  points: number;
  /** Rank change vs the previous round: +N climbed, -N dropped, 0 held, null
   *  when there's no previous round to compare (season opener). */
  delta: number | null;
}

export interface SeriesMovers {
  slug: string;
  /** Latest round's race name (context for "after {round}"). */
  latestRound: string;
  /** Every ranked driver, best rank first. The client picks the top climbers /
   *  fallers to show. */
  movers: Mover[];
}

/** Rank drivers by cumulative points in a trend snapshot (desc). Ties keep a
 *  stable order; points-rank is the trend's own basis (it has no tiebreakers,
 *  same as the chart), so a tie can differ from the official position — fine for
 *  a movers read-out. */
function rankBySnapshot(names: string[], snapshot: Record<string, unknown>): Map<string, number> {
  const sorted = [...names].sort(
    (a, b) => (Number(snapshot[b]) || 0) - (Number(snapshot[a]) || 0),
  );
  const rank = new Map<string, number>();
  sorted.forEach((n, i) => rank.set(n, i + 1));
  return rank;
}

/** Pure: rank deltas between the last two rounds of a trend. Empty when the
 *  trend has no rounds; `delta: null` for every driver when there's only one. */
export function computeMovers(trend: SeasonTrendData): Mover[] {
  const points = trend.data;
  if (points.length === 0) return [];
  const last = points[points.length - 1];
  const prev = points.length >= 2 ? points[points.length - 2] : null;
  const names = trend.drivers.map(d => d.name);

  const nowRank = rankBySnapshot(names, last);
  const prevRank = prev ? rankBySnapshot(names, prev) : null;

  return names
    .map(name => ({
      name,
      rank: nowRank.get(name)!,
      points: Number(last[name]) || 0,
      delta: prevRank ? prevRank.get(name)! - nowRank.get(name)! : null,
    }))
    .sort((a, b) => a.rank - b.rank);
}

/** Per-series RaceResult[] for the movers trend — mirrors how the Standings tab
 *  constructs each eligible series' chart. null for an ineligible slug. */
async function fetchSeriesTrend(slug: string, season: number): Promise<SeasonTrendData | null> {
  if (!ELIGIBLE.has(slug)) return null;
  if (slug === 'f1') {
    const [races, sprints] = await Promise.all([fetchF1SeasonResults(), fetchF1SeasonSprints()]);
    if (races.length === 0) return null;
    return buildSeasonTrendData(races, sprints);
  }
  if (slug === 'f3') {
    const races = await fetchF3SeasonResults(season);
    return races.length > 0 ? buildSeasonTrendData(races) : null;
  }
  if (slug === 'motogp') {
    const races = await fetchMotoGPSeasonResults(season);
    return races.length > 0 ? buildSeasonTrendData(races) : null;
  }
  return null;
}

/** Movers for one eligible series, or null (ineligible / failed / empty /
 *  fewer than two rounds so nothing has moved yet). Never throws. */
export async function fetchSeriesMovers(slug: string, season: number): Promise<SeriesMovers | null> {
  let trend: SeasonTrendData | null = null;
  try {
    trend = await fetchSeriesTrend(slug, season);
  } catch {
    trend = null;
  }
  if (!trend || trend.data.length < 2) return null; // need 2 rounds for a delta
  const movers = computeMovers(trend);
  if (movers.length === 0) return null;
  return {
    slug,
    latestRound: trend.data[trend.data.length - 1].raceName,
    movers,
  };
}
