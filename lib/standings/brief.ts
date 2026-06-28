import type { DriverStanding } from '@/lib/types';
import { loadStandingsOverrides } from '@/lib/series-content';
import { applyDriverOverrides } from './overrides';
import { fetchF1Standings } from './f1';
import { fetchF2Standings } from './f2';
import { fetchF3Standings } from './f3';
import { fetchIndyCarStandings } from './indycar';
import { fetchFormulaEStandings } from './formula-e';
import { fetchMotoGPStandings } from './motogp';
import { fetchNascarCupStandings } from './nascar-cup';
import { fetchWsbkStandings } from './wsbk';
import { fetchWRCStandings } from './wrc';
import { fetchDTMStandings } from './dtm';

// A compact "who's leading / top of the table" view of a series' DRIVERS'
// championship, for the home championship-leader + standings-snapshot widgets.
// Only the single-driver-championship series are eligible — the multi-class
// ones (WEC / IMSA / GT-World) have no single leader (per-class titles), so
// they're excluded here and keep their full Standings tab. Each underlying
// fetcher carries its own cache (revalidate / KV last-good) and the
// /api/home/standings route edge-caches the response — so the brief reads the
// SAME cached source the Standings tab does. (It previously kept its own 1h
// per-brief KV snapshot, which drifted out of sync with the tab — the bug this
// removes.)

export interface StandingsBrief {
  slug: string;
  /** P1 driver (or rider / crew) of the drivers' championship. */
  leader: { name: string; points: number };
  /** Points lead over P2, or null when there's no second row. */
  gapToSecond: number | null;
  /** Top five of the drivers' table. */
  top: { position: number; name: string; points: number }[];
}

export const ELIGIBLE_STANDINGS_SLUGS = [
  'f1',
  'f2',
  'f3',
  'indycar',
  'formula-e',
  'motogp',
  'nascar-cup',
  'wsbk',
  'wrc',
  'dtm',
] as const;

const ELIGIBLE = new Set<string>(ELIGIBLE_STANDINGS_SLUGS);

export function isEligibleStandingsSeries(slug: string): boolean {
  return ELIGIBLE.has(slug);
}

// Dispatch to the same current-standings fetcher the Standings tab uses; return
// just the drivers' table. season is only needed by the two fetchers that take it.
async function fetchDrivers(slug: string, season: number): Promise<DriverStanding[] | null> {
  switch (slug) {
    case 'f1':
      return (await fetchF1Standings())?.drivers ?? null;
    case 'f2':
      return (await fetchF2Standings())?.drivers ?? null;
    case 'f3':
      return (await fetchF3Standings())?.drivers ?? null;
    case 'indycar':
      return (await fetchIndyCarStandings())?.drivers ?? null;
    case 'formula-e':
      return (await fetchFormulaEStandings())?.drivers ?? null;
    case 'motogp':
      return (await fetchMotoGPStandings(season))?.drivers ?? null;
    case 'nascar-cup':
      return (await fetchNascarCupStandings())?.drivers ?? null;
    case 'wsbk':
      return (await fetchWsbkStandings(season))?.drivers ?? null;
    case 'wrc':
      return (await fetchWRCStandings())?.drivers ?? null;
    case 'dtm':
      return (await fetchDTMStandings())?.drivers ?? null;
    default:
      return null;
  }
}

/** A drivers'-championship brief for one eligible series, or null (ineligible
 *  series, a failed/empty fetch). Derives directly from the same cached fetcher
 *  the Standings tab uses — no separate per-brief snapshot — so the home widget
 *  can't drift out of sync with the tab. Never throws. */
export async function fetchStandingsBrief(slug: string, season: number): Promise<StandingsBrief | null> {
  if (!ELIGIBLE.has(slug)) return null;

  let drivers: DriverStanding[] | null = null;
  try {
    drivers = await fetchDrivers(slug, season);
  } catch {
    drivers = null;
  }
  if (!drivers || drivers.length === 0) return null;

  // Apply the SAME curated overrides the Standings tab does, so the home
  // championship-leader + standings-snapshot widgets can't drift from the tab if
  // a `standings-overrides.json` is ever added (no-op for every series today).
  // applyDriverOverrides re-sorts by position; the explicit sort below stays for
  // the no-override path.
  const overrides = await loadStandingsOverrides(slug).catch(() => null);
  const patched = applyDriverOverrides(drivers, overrides?.drivers);

  const sorted = [...patched].sort((a, b) => a.position - b.position);
  const leader = sorted[0];
  const second = sorted[1];
  return {
    slug,
    leader: { name: leader.driverName, points: leader.points },
    gapToSecond: second ? leader.points - second.points : null,
    // Up to 10 so the snapshot widget's `rows` setting (max 10) has data; the client slices down.
    top: sorted.slice(0, 10).map(d => ({ position: d.position, name: d.driverName, points: d.points })),
  };
}
