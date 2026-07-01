import * as cheerio from 'cheerio';
import { fetchUpstream } from '@/lib/fetch-upstream';
import { withSourceSnapshot } from '@/lib/source-snapshot';
import type { DriverStanding, ConstructorStanding } from '@/lib/types';

export type { DriverStanding, ConstructorStanding };

// Wikipedia season page is the only viable SSR source for NASCAR in 2026:
// nascar.com / jayski.com / racing-reference.info all return 403 to server-side
// fetches (Cloudflare bot mitigation). Wikipedia ships the same data SSR'd
// in three wikitable blocks on the season article:
//   - Race_results table (winner per race, including Clash + Duels prefix)
//   - Drivers' championship table (position + driver + 36 race finishes + Pts. + Stages)
//   - Manufacturers' championship table (Pos / Manufacturer / Wins / Points)
const SEASON_PAGE_URL =
  'https://en.wikipedia.org/wiki/2026_NASCAR_Cup_Series';

// Driver row in the standings table emits exactly 40 cells:
//   cell[0]  = position (<th>)
//   cell[1]  = driver name (<td style="text-align:left;">)
//   cell[2..37] = 36 race-result cells (one per points-paying round)
//   cell[38] = championship points (<th>)
//   cell[39] = stage points (<td>)
// A "win" is a race-result cell whose inline background is the gold/yellow
// Wikipedia uses for first-place finishes (#FFFFBF). We count those to derive
// the wins column the standings table itself doesn't list as a numeric column.
const EXPECTED_ROW_CELLS = 40;
const POS_CELL = 0;
const DRIVER_CELL = 1;
const POINTS_CELL = 38;
const RACE_RESULT_FIRST_CELL = 2;
const RACE_RESULT_LAST_CELL = 37;
const WIN_BG_HEX = '#ffffbf';

// Sanity floor. Real Cup grids have 36-40 chartered + open drivers active each
// week; a parsed standings of <20 means we landed on a structurally-broken
// response (Wikipedia article restructure, partial render, etc.). Fail closed
// and let StandingsTab render its "temporarily unavailable" placeholder rather
// than ship a partial-and-misleading table.
const MIN_DRIVERS = 20;

// Sanity floor for manufacturers. NASCAR Cup has been a three-manufacturer
// series (Toyota, Chevrolet, Ford) since 2013 and the table reflects that.
const MIN_MANUFACTURERS = 2;

interface TeamLookup {
  byDriver: Map<string, string>;
}

function normalizeName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().toLowerCase();
}

function buildTeamLookupFromHtml(html: string): TeamLookup {
  // Pull the Chartered_teams + Non-chartered_teams tables and build a
  // driver -> team-name map. Both tables share the same column layout:
  // Manufacturer | Team | No. | Driver | Crew chief | References.
  // Manufacturer + Team cells use rowspan; we resolve them per-row.
  const lookup: TeamLookup = { byDriver: new Map() };
  const ids = ['Chartered_teams', 'Non-chartered_teams'];
  for (const id of ids) {
    const headingIdx = html.search(new RegExp(`id="${id}"`));
    if (headingIdx < 0) continue;
    const start = html.indexOf('<table', headingIdx);
    if (start < 0) continue;
    const end = html.indexOf('</table>', start);
    if (end < 0) continue;
    const tableHtml = html.substring(start, end + 8);
    const $ = cheerio.load(tableHtml);
    const rows = $('tr').toArray();
    if (rows.length < 2) continue;

    // Find Team + Driver column indices from the header row.
    const headerCells = $(rows[0]).find('th, td').toArray();
    let teamColIdx = -1;
    let driverColIdx = -1;
    for (let i = 0; i < headerCells.length; i++) {
      const t = $(headerCells[i]).text().trim().toLowerCase();
      if (t === 'team') teamColIdx = i;
      if (t === 'driver') driverColIdx = i;
    }
    if (teamColIdx < 0 || driverColIdx < 0) continue;

    // Pending rowspan tracking: column index -> { remaining, text }.
    const pending = new Map<number, { remaining: number; text: string }>();

    for (let r = 1; r < rows.length; r++) {
      const rawCells = $(rows[r]).find('> th, > td').toArray();
      const effective: Record<number, string> = {};
      let rawIdx = 0;
      let col = 0;
      while (rawIdx < rawCells.length || pending.has(col)) {
        if (pending.has(col)) {
          const p = pending.get(col)!;
          effective[col] = p.text;
          p.remaining -= 1;
          if (p.remaining <= 0) pending.delete(col);
          col += 1;
          continue;
        }
        const cell = rawCells[rawIdx];
        if (!cell) break;
        const $cell = $(cell);
        const text = $cell
          .clone()
          .find('sup, style, .legend')
          .remove()
          .end()
          .text()
          .replace(/\[[^\]]{1,15}\]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        effective[col] = text;
        const rowspan = parseInt($cell.attr('rowspan') || '1', 10);
        if (rowspan > 1) {
          pending.set(col, { remaining: rowspan - 1, text });
        }
        col += 1;
        rawIdx += 1;
      }
      const teamName = effective[teamColIdx];
      const driverCellText = effective[driverColIdx];
      if (!teamName || !driverCellText) continue;
      // The driver cell can contain a trailing rounds-count tooltip that
      // leaks into text() as a standalone number - e.g. "Alex Bowman 32".
      // Strip a trailing isolated number to keep the name clean.
      const cleanDriver = driverCellText
        .replace(/\s+\d{1,3}\s*$/, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (cleanDriver) {
        lookup.byDriver.set(normalizeName(cleanDriver), teamName);
      }
    }
  }
  return lookup;
}

function parseDriverStandings(
  html: string,
  teamLookup: TeamLookup,
): DriverStanding[] | null {
  const headingIdx = html.search(/id="Drivers[^"]*championship"/);
  if (headingIdx < 0) return null;
  const tableStart = html.indexOf('<table', headingIdx);
  if (tableStart < 0) return null;
  const tableEnd = html.indexOf('</table>', tableStart);
  if (tableEnd < 0) return null;
  const tableHtml = html.substring(tableStart, tableEnd + 8);

  const $ = cheerio.load(tableHtml);
  const rows = $('tr').toArray();
  const drivers: DriverStanding[] = [];

  for (const row of rows) {
    const cells = $(row).find('> th, > td').toArray();
    if (cells.length !== EXPECTED_ROW_CELLS) continue;
    const positionText = $(cells[POS_CELL]).text().trim();
    if (!/^\d+$/.test(positionText)) continue;
    const position = parseInt(positionText, 10);
    const driverName = $(cells[DRIVER_CELL])
      .text()
      .replace(/\[[^\]]{1,15}\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const pointsText = $(cells[POINTS_CELL])
      .text()
      .replace(/[^\d]/g, '')
      .trim();
    if (!driverName || !pointsText) continue;
    const points = parseInt(pointsText, 10);
    if (!Number.isFinite(position) || !Number.isFinite(points)) continue;

    // Count wins from race-result cells with the win background colour.
    let wins = 0;
    for (let i = RACE_RESULT_FIRST_CELL; i <= RACE_RESULT_LAST_CELL; i++) {
      const bg = ($(cells[i]).attr('style') || '').toLowerCase();
      if (bg.includes(WIN_BG_HEX)) wins += 1;
    }

    const team =
      teamLookup.byDriver.get(normalizeName(driverName)) ?? 'Unknown team';

    drivers.push({
      position,
      driverName,
      team,
      points,
      wins,
    });
  }

  if (drivers.length < MIN_DRIVERS) return null;
  return drivers.sort((a, b) => a.position - b.position);
}

function parseManufacturerStandings(
  html: string,
): ConstructorStanding[] | null {
  const headingIdx = html.search(/id="Manufacturers[^"]*championship"/);
  if (headingIdx < 0) return null;
  const tableStart = html.indexOf('<table', headingIdx);
  if (tableStart < 0) return null;
  const tableEnd = html.indexOf('</table>', tableStart);
  if (tableEnd < 0) return null;
  const tableHtml = html.substring(tableStart, tableEnd + 8);

  const $ = cheerio.load(tableHtml);
  const rows = $('tr').toArray();
  const constructors: ConstructorStanding[] = [];

  for (const row of rows) {
    const cells = $(row).find('> th, > td').toArray();
    // Manufacturer table is 4 columns: Pos | Manufacturer | Wins | Points.
    if (cells.length !== 4) continue;
    const positionText = $(cells[0]).text().trim();
    if (!/^\d+$/.test(positionText)) continue;
    const position = parseInt(positionText, 10);
    const name = $(cells[1])
      .text()
      .replace(/\[[^\]]{1,15}\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const winsText = $(cells[2]).text().trim();
    const pointsText = $(cells[3]).text().trim();
    if (!name) continue;
    const wins = parseInt(winsText, 10);
    const points = parseInt(pointsText, 10);
    if (!Number.isFinite(position) || !Number.isFinite(points)) continue;
    constructors.push({
      position,
      name,
      points,
      wins: Number.isFinite(wins) ? wins : undefined,
    });
  }

  if (constructors.length < MIN_MANUFACTURERS) return null;
  return constructors.sort((a, b) => a.position - b.position);
}

export interface NascarCupStandings {
  drivers: DriverStanding[];
  constructors: ConstructorStanding[];
}

async function fetchNascarCupStandingsLive(): Promise<NascarCupStandings | null> {
  let html: string;
  try {
    const res = await fetchUpstream(SEASON_PAGE_URL, {
      headers: {
        // Wikipedia honors anonymous fetches but a clear UA helps logs +
        // avoids future anti-bot tightening. No API token required.
        'User-Agent':
          'PaddockTracker/1.0 (+https://paddock-tracker.com; contact: pparaskevas.dev@gmail.com)',
        Accept: 'text/html',
      },
      // Hourly revalidate - Wikipedia's NASCAR season article is typically
      // updated within hours of each race ending. One hour is fine for the
      // standings tab.
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  }

  try {
    const teamLookup = buildTeamLookupFromHtml(html);
    const drivers = parseDriverStandings(html, teamLookup);
    const constructors = parseManufacturerStandings(html);
    if (!drivers || !constructors) return null;
    return { drivers, constructors };
  } catch {
    return null;
  }
}

/**
 * Public NASCAR Cup standings fetch, wrapped in the durable `source_snapshot`
 * last-good so a Wikipedia outage / article restructure (→ null) serves the last
 * successful standings instead of blanking the page. Self-heals on the next good
 * fetch (which overwrites the snapshot).
 *
 * `NascarCupStandings` carries no `Date` fields, so the jsonb round-trip is
 * lossless and no rehydration is needed (same as `standings:dtm`). Fails soft
 * when Supabase is unconfigured (local dev): behaves exactly like
 * `fetchNascarCupStandingsLive`. Return type is unchanged.
 */
export async function fetchNascarCupStandings(): Promise<NascarCupStandings | null> {
  return withSourceSnapshot<NascarCupStandings | null>(
    'standings:nascar-cup',
    fetchNascarCupStandingsLive,
    v => v == null || v.drivers.length === 0,
  );
}