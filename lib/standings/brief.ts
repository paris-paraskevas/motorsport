import { kv } from '@vercel/kv';
import type { DriverStanding } from '@/lib/types';
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
// fetcher is a scrape, so briefs are KV-cached per series (standings move on
// the order of once a race weekend).

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

function kvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
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

/** A KV-cached drivers'-championship brief for one eligible series, or null
 *  (ineligible series, a failed/empty fetch). Never throws. */
export async function fetchStandingsBrief(slug: string, season: number): Promise<StandingsBrief | null> {
  if (!ELIGIBLE.has(slug)) return null;

  const cacheKey = `paddock:home:standings-brief:${slug}`;
  if (kvConfigured()) {
    try {
      const cached = await kv.get<StandingsBrief>(cacheKey);
      if (cached) return cached;
    } catch {
      /* cache miss / KV hiccup → fetch live */
    }
  }

  let drivers: DriverStanding[] | null = null;
  try {
    drivers = await fetchDrivers(slug, season);
  } catch {
    drivers = null;
  }
  if (!drivers || drivers.length === 0) return null;

  const sorted = [...drivers].sort((a, b) => a.position - b.position);
  const leader = sorted[0];
  const second = sorted[1];
  const brief: StandingsBrief = {
    slug,
    leader: { name: leader.driverName, points: leader.points },
    gapToSecond: second ? leader.points - second.points : null,
    // Up to 10 so the snapshot widget's `rows` setting (max 10) has data; the client slices down.
    top: sorted.slice(0, 10).map(d => ({ position: d.position, name: d.driverName, points: d.points })),
  };

  if (kvConfigured()) {
    try {
      await kv.set(cacheKey, brief, { ex: 3600 });
    } catch {
      /* best-effort cache */
    }
  }
  return brief;
}
