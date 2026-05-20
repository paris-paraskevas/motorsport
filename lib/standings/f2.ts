import * as cheerio from 'cheerio';
import type { DriverStanding, ConstructorStanding } from '@/lib/types';

export type { DriverStanding, ConstructorStanding };

const DRIVER_STANDINGS_URL = 'https://www.fiaformula2.com/Standings/Driver';
const TEAM_STANDINGS_URL = 'https://www.fiaformula2.com/Standings/Team';

// Sanity floors. The 2026 F2 grid is 22 entries / 11 teams; a far-smaller
// payload signals a structural failure (CMS change, bot mitigation, mid-deploy
// empty page). Fail closed and let StandingsTab render its placeholder rather
// than ship a partial-and-misleading table. The driver floor is also a
// reasonable guard against the season's two cancelled Bahrain + Jeddah rounds
// — drivers carry over but the grid count does not change.
const MIN_DRIVERS = 15;
const MIN_TEAMS = 8;

// F2 awards 25 points for a Feature Race win (no fastest-lap bonus visible in
// the standings score-wrappers) and 10 for a Sprint Race win. We count
// Feature-Race wins only, mirroring how the F1 standings expose `wins` as
// "Sunday Grand Prix wins" rather than including sprints.
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
  TeamName?: string;
  TotalPoints?: number;
  // [SR, FR] pairs per championship round. `null` slots are unraced future
  // rounds; `0` is a real zero score (driver started but scored nothing).
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
  // Extract via cheerio rather than regex — handles HTML entity decoding,
  // attribute-order changes, and varying whitespace inside the script tag.
  // Bug-magnet otherwise: the F2 payload contains nested </script> sequences
  // inside embedded race-news copy that a greedy regex would mismatch on.
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
    const team = row?.TeamName;
    if (!Number.isFinite(position) || !Number.isFinite(points)) continue;
    if (!driverName || !team) continue;
    drivers.push({
      position,
      driverName,
      driverCode: row?.TLA,
      team,
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
    const res = await fetch(url, {
      headers: {
        // The fiaformula2.com FIA-shared SSR template returns a SPA shell to
        // non-browser UAs; a stock Chromium UA produces the page with the
        // `__NEXT_DATA__` JSON payload baked in. Mirrors the IndyCar loader.
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        Accept: 'text/html',
      },
      // Hourly revalidate — F2 standings update within minutes of a Sunday
      // race finish; an hour is fine for the standings tab.
      next: { revalidate: 3600 },
    } as RequestInit);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function fetchF2Standings(): Promise<{
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
