import * as cheerio from 'cheerio';
import { fetchUpstream } from '@/lib/fetch-upstream';
import type { DriverStanding, ConstructorStanding } from '@/lib/types';

export type { DriverStanding, ConstructorStanding };

const DRIVER_STANDINGS_URL = 'https://www.fiaformula3.com/Standings/Driver';
const TEAM_STANDINGS_URL = 'https://www.fiaformula3.com/Standings/Team';

// FIA F3 grids are ~30 drivers + ~10 teams. Anything substantially below
// signals a structurally-broken response (CMS change, bot wall, SSR fallback
// shell) and we fail closed.
const MIN_DRIVERS = 10;
const MIN_TEAMS = 6;

// Feature Race win awards 25 points. Mirrors F2 standings — "wins" counts
// Feature-Race wins only (consistent with F1's "Grand Prix wins" semantic).
const FR_WIN_POINTS = 25;

interface NextDataStandingRow {
  Position?: number;
  CarNumber?: number;
  DriverID?: number;
  TeamID?: number;
  TLA?: string;
  DisplayName?: string;
  FullName?: string;
  CountryCode?: string;
  TeamName?: string | null;
  TotalPoints?: number;
  // [SR, FR] pairs per round. null slot = round not yet raced; numeric 0 =
  // started but did not score, or red-flag-reduced scoring placed the driver
  // outside the points-paying band.
  RacePoints?: Array<Array<number | null>>;
}

interface NextDataStandingsPage {
  props?: {
    pageProps?: {
      pageData?: {
        Standings?: NextDataStandingRow[];
      };
    };
  };
}

function extractNextData(html: string): unknown | null {
  try {
    const $ = cheerio.load(html);
    const raw = $('script#__NEXT_DATA__').first().html();
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function countFeatureWins(racePoints: Array<Array<number | null>> | undefined): number {
  if (!Array.isArray(racePoints)) return 0;
  let wins = 0;
  for (const pair of racePoints) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    if (pair[1] === FR_WIN_POINTS) wins += 1;
  }
  return wins;
}

function parseDrivers(html: string): DriverStanding[] | null {
  const data = extractNextData(html) as NextDataStandingsPage | null;
  const list = data?.props?.pageProps?.pageData?.Standings;
  if (!Array.isArray(list)) return null;

  const drivers: DriverStanding[] = [];
  for (const row of list) {
    const position = Number(row?.Position);
    const points = Number(row?.TotalPoints);
    const driverName = row?.FullName ?? row?.DisplayName;
    if (!Number.isFinite(position) || !Number.isFinite(points)) continue;
    if (!driverName) continue;
    drivers.push({
      position,
      driverName,
      driverCode: row?.TLA,
      // F3 __NEXT_DATA__ exposes TeamName per driver where the rendered HTML
      // table omitted it — migration win on top of the red-flag scoring fix.
      // Two MX reserves (CAR, RIV) carry TeamName=null in the live payload;
      // surface them as an empty string so the row renders without a team
      // label rather than dropping the row entirely.
      team: row?.TeamName ?? '',
      points,
      wins: countFeatureWins(row?.RacePoints),
    });
  }

  if (drivers.length < MIN_DRIVERS) return null;
  return drivers.sort((a, b) => a.position - b.position);
}

function parseConstructors(html: string): ConstructorStanding[] | null {
  const data = extractNextData(html) as NextDataStandingsPage | null;
  const list = data?.props?.pageProps?.pageData?.Standings;
  if (!Array.isArray(list)) return null;

  const constructors: ConstructorStanding[] = [];
  for (const row of list) {
    const position = Number(row?.Position);
    const points = Number(row?.TotalPoints);
    const name = row?.FullName ?? row?.DisplayName;
    if (!Number.isFinite(position) || !Number.isFinite(points)) continue;
    if (!name) continue;
    constructors.push({
      position,
      name,
      points,
      wins: countFeatureWins(row?.RacePoints),
    });
  }

  if (constructors.length < MIN_TEAMS) return null;
  return constructors.sort((a, b) => a.position - b.position);
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetchUpstream(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        Accept: 'text/html',
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function fetchF3Standings(): Promise<{
  drivers: DriverStanding[];
  constructors: ConstructorStanding[];
} | null> {
  const [driverHtml, teamHtml] = await Promise.all([
    fetchHtml(DRIVER_STANDINGS_URL),
    fetchHtml(TEAM_STANDINGS_URL),
  ]);
  if (!driverHtml || !teamHtml) return null;

  const drivers = parseDrivers(driverHtml);
  const constructors = parseConstructors(teamHtml);
  if (!drivers || !constructors) return null;

  return { drivers, constructors };
}
