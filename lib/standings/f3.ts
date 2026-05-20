import * as cheerio from 'cheerio';
import type { DriverStanding, ConstructorStanding } from '@/lib/types';

export type { DriverStanding, ConstructorStanding };

const DRIVERS_URL = 'https://www.fiaformula3.com/Standings/Driver';
const TEAMS_URL = 'https://www.fiaformula3.com/Standings/Team';

// FIA F3 grids run ~30 drivers + ~10 teams. Anything substantially below the
// expected size signals a structurally-broken response (CMS change, bot wall,
// SSR fallback shell) and we fail closed rather than ship a misleading partial
// table. Floor for drivers chosen well above the 18 drivers required to start
// a Sprint Race, well below the 30-car grid.
const MIN_DRIVERS = 10;
const MIN_TEAMS = 6;

// Standard browser UA. The FIA Formula 3 (Next.js) site occasionally serves a
// trimmed SPA shell to non-browser User-Agents; a Chromium UA returns the SSR
// HTML with the standings tables baked in.
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
      // Hourly revalidate matches IndyCar and is in line with how often FIA F3
      // updates standings (within an hour of each race finish).
      next: { revalidate: 3600 },
    } as RequestInit);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// The driver standings table on fiaformula3.com uses an abbreviated driver
// label ("U. Ugochukwu") in `.visible-desktop-up` and a 3-letter code ("UGO")
// in `.visible-desktop-down`. The page never serves a full name — we honour
// what the upstream shows. The team column does not exist on this page; the
// team standings page is parsed separately.
function parseDrivers(html: string): DriverStanding[] | null {
  const $ = cheerio.load(html);
  const rows = $('table.table-bordered tbody tr');
  if (rows.length === 0) return null;

  const drivers: DriverStanding[] = [];
  rows.each((_, el) => {
    const $row = $(el);
    const positionText = $row.find('.driver-name-wrapper .pos').first().text().trim();
    const driverName = $row
      .find('.driver-name .visible-desktop-up')
      .first()
      .text()
      .trim();
    const driverCode = $row
      .find('.driver-name .visible-desktop-down')
      .first()
      .text()
      .trim();
    const pointsText = $row.find('.total-points').first().text().trim();

    const position = Number(positionText);
    const points = Number(pointsText);
    if (!Number.isFinite(position) || !Number.isFinite(points)) return;
    if (!driverName) return;

    drivers.push({
      position,
      driverName,
      driverCode: driverCode || undefined,
      // The upstream driver standings table omits the team column entirely.
      // Empty string is the honest representation; the StandingsTab is free
      // to elide it. We deliberately do not cross-reference the team page
      // here — that ordering is fragile and we'd silently mislabel rookies
      // mid-season.
      team: '',
      points,
    });
  });

  if (drivers.length < MIN_DRIVERS) return null;
  return drivers.sort((a, b) => a.position - b.position);
}

function parseTeams(html: string): ConstructorStanding[] | null {
  const $ = cheerio.load(html);
  const rows = $('table.table-bordered tbody tr');
  if (rows.length === 0) return null;

  const teams: ConstructorStanding[] = [];
  rows.each((_, el) => {
    const $row = $(el);
    const positionText = $row.find('.driver-name-wrapper .pos').first().text().trim();
    const name = $row
      .find('.driver-name .visible-desktop-up')
      .first()
      .text()
      .trim();
    const pointsText = $row.find('.total-points').first().text().trim();

    const position = Number(positionText);
    const points = Number(pointsText);
    if (!Number.isFinite(position) || !Number.isFinite(points)) return;
    if (!name) return;

    teams.push({ position, name, points });
  });

  if (teams.length < MIN_TEAMS) return null;
  return teams.sort((a, b) => a.position - b.position);
}

export async function fetchF3Standings(): Promise<{
  drivers: DriverStanding[];
  constructors: ConstructorStanding[];
} | null> {
  const [driverHtml, teamHtml] = await Promise.all([
    fetchHtml(DRIVERS_URL),
    fetchHtml(TEAMS_URL),
  ]);
  if (!driverHtml || !teamHtml) return null;

  const drivers = parseDrivers(driverHtml);
  const constructors = parseTeams(teamHtml);
  if (!drivers || !constructors) return null;
  return { drivers, constructors };
}
