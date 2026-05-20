import * as cheerio from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import type { DriverStanding, ConstructorStanding } from '@/lib/types';

export type { DriverStanding, ConstructorStanding };

// Wikipedia's REST HTML for the current Formula E season (Season 12 =
// 2025-26). FE numbers its seasons across calendar years and the season runs
// Dec → Aug, so the article title is the canonical season identifier.
//
// Primary upstream choice:
//   fiaformulae.com is a JS-rendered SPA — `fetch` returns a nav-only shell
//   without driver/team standings in the static HTML. results.fiaformulae.com
//   is access-restricted. No public JSON API is documented (per-series source
//   audit, 2026-05-16). Wikipedia's article tracks every E-Prix within hours
//   of the race finish and exposes both the Drivers' and Teams' Championship
//   tables as `wikitable` HTML — parseable with cheerio.
//
// Failure mode: when fewer than MIN_DRIVERS rows parse cleanly we fail closed
// and let StandingsTab render its "temporarily unavailable" empty state. We do
// NOT ship a partial table.
const SEASON_PAGE = '2025%E2%80%9326_Formula_E_World_Championship';
// Use the standard /wiki/ URL — matches the pattern used by lib/standings/
// nascar-cup.ts and lib/standings/wrc.ts (both verified working in prod).
// Wikipedia's REST API at /api/rest_v1/page/html returns Parsoid-wrapped HTML
// whose section-element nesting confuses the column-detection heuristics
// here, causing both parseDrivers and parseTeams to silently return null →
// the "temporarily unavailable" empty state in production despite the data
// being live. Standard wiki HTML is what other scrapers consume.
const WIKI_BASE = 'https://en.wikipedia.org/wiki';

// FE grids are 22 drivers across 11 teams. <12 means we landed on the wrong
// table (entries list, points-system explanation, etc.) — fail closed.
const MIN_DRIVERS = 12;
// FE has 11 teams; require at least 6 to clear a "summary" table.
const MIN_TEAMS = 6;

const BRACKET_ANNOTATION_RE = /\[[^\]]{1,15}\]/g;

function cellText($: cheerio.CheerioAPI, el: AnyNode): string {
  // Clone + strip the same junk that lib/wikipedia-season.ts strips — inline
  // <style> blocks for `.legend` decoration, footnote refs, and legend spans.
  // Without this, cheerio's .text() pulls CSS rules and rookie/markers into
  // the cell. Same defensive pattern as the season-lineup scraper.
  const $el = $(el).clone();
  $el.find('style, sup, .legend, .legend-color, .legend-text').remove();
  return $el
    .text()
    .replace(BRACKET_ANNOTATION_RE, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface HeaderMatchOptions {
  exact?: string[];
  contains?: string[];
}

function matchesHeader(header: string, opts: HeaderMatchOptions): boolean {
  const lower = header.trim().toLowerCase();
  if (opts.exact?.some((e) => lower === e)) return true;
  if (opts.contains?.some((c) => lower.includes(c))) return true;
  return false;
}

function findHeaderIndex(
  headers: string[],
  opts: HeaderMatchOptions,
): number {
  for (let i = 0; i < headers.length; i++) {
    if (matchesHeader(headers[i], opts)) return i;
  }
  return -1;
}

interface DriverColumnMap {
  pos: number;
  driver: number;
  points: number;
  team?: number;
}

interface TeamColumnMap {
  pos: number;
  team: number;
  points: number;
}

function detectDriverColumns(headerCells: string[]): DriverColumnMap | null {
  const pos = findHeaderIndex(headerCells, {
    exact: ['pos', 'pos.', 'position', 'rank'],
  });
  const driver = findHeaderIndex(headerCells, {
    exact: ['driver', 'rider'],
  });
  // Points is "Pts" on FE; allow "points" too.
  const points = findHeaderIndex(headerCells, {
    exact: ['pts', 'points', 'total'],
  });
  // Team column is OPTIONAL — Wikipedia's Drivers' Championship sometimes
  // omits the team column and embeds team info elsewhere. When present it's
  // usually labelled "Team", "Constructor", or "Entrant".
  const teamRaw = findHeaderIndex(headerCells, {
    exact: ['team', 'constructor', 'entrant'],
  });
  if (pos === -1 || driver === -1 || points === -1) return null;
  // pos / driver / points must be distinct columns.
  if (pos === driver || pos === points || driver === points) return null;
  const team = teamRaw === -1 ? undefined : teamRaw;
  return { pos, driver, points, team };
}

function detectTeamColumns(headerCells: string[]): TeamColumnMap | null {
  const pos = findHeaderIndex(headerCells, {
    exact: ['pos', 'pos.', 'position', 'rank'],
  });
  const team = findHeaderIndex(headerCells, {
    exact: ['team', 'constructor', 'entrant', 'manufacturer'],
  });
  const points = findHeaderIndex(headerCells, {
    exact: ['pts', 'points', 'total'],
  });
  if (pos === -1 || team === -1 || points === -1) return null;
  if (pos === team || pos === points || team === points) return null;
  return { pos, team, points };
}

function parsePosition(raw: string): number | null {
  // Wikipedia uses "1", "2", ..., sometimes with a footnote which cellText
  // strips. Reject anything that doesn't parse as a positive integer.
  const m = raw.match(/^(\d+)/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 1 || n > 99) return null;
  return n;
}

function parsePoints(raw: string): number | null {
  // FE totals are integers (no half-points). Strip any non-digit clutter.
  const m = raw.match(/(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function rowText(
  $: cheerio.CheerioAPI,
  row: Element,
  colIdx: number,
): string {
  const cells = $(row).find('> td, > th').toArray() as Element[];
  const cell = cells[colIdx];
  if (!cell) return '';
  return cellText($, cell);
}

/**
 * Find the first <table> within `tables` whose header row matches the given
 * column shape. Returns the matched table + the resolved column map +
 * the rows that follow the matched header.
 */
function findTable<T>(
  $: cheerio.CheerioAPI,
  tables: Element[],
  detect: (headers: string[]) => T | null,
  minDataRows: number,
): { table: Element; columns: T; dataRows: Element[] } | null {
  for (const table of tables) {
    const allRows = $(table)
      .find('> tbody > tr, > tr')
      .toArray() as Element[];
    if (allRows.length < 2) continue;
    // Look at the first 3 rows as candidate header rows (Wikipedia's
    // standings tables sometimes have a top-of-table caption row before the
    // real header). Take the first row whose columns detect cleanly.
    for (let i = 0; i < Math.min(3, allRows.length); i++) {
      const cells = $(allRows[i])
        .find('> th, > td')
        .toArray() as Element[];
      if (cells.length === 0) continue;
      const headers = cells.map((c) => cellText($, c));
      const columns = detect(headers);
      if (!columns) continue;
      const dataRows = allRows.slice(i + 1);
      if (dataRows.length < minDataRows) continue;
      return { table, columns, dataRows };
    }
  }
  return null;
}

function parseDrivers(html: string): DriverStanding[] | null {
  let $: cheerio.CheerioAPI;
  try {
    $ = cheerio.load(html);
  } catch {
    return null;
  }
  const tables = $('table').toArray() as Element[];

  const found = findTable(
    $,
    tables,
    detectDriverColumns,
    MIN_DRIVERS,
  );
  if (!found) return null;

  const { columns, dataRows } = found;
  const drivers: DriverStanding[] = [];

  // Track the most recently-seen non-empty team cell so rowspan'd team cells
  // carry through. Wikipedia's FE Drivers' Championship sometimes omits the
  // team column outright; in that case we fall back to "Unknown" and rely on
  // the StandingsTab override layer for any curator-side patching.
  let lastTeam = '';
  for (const row of dataRows) {
    const posRaw = rowText($, row, columns.pos);
    const driverRaw = rowText($, row, columns.driver);
    const pointsRaw = rowText($, row, columns.points);

    const position = parsePosition(posRaw);
    const points = parsePoints(pointsRaw);
    if (position == null || points == null) continue;
    if (!driverRaw) continue;

    // Driver name cleanup: strip parenthesised country / footnote notes.
    const driverName = driverRaw
      .replace(/\([^)]{0,80}\)/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!driverName) continue;

    let team = '';
    if (columns.team != null) {
      const teamRaw = rowText($, row, columns.team);
      if (teamRaw) {
        team = teamRaw;
        lastTeam = teamRaw;
      } else {
        team = lastTeam;
      }
    }

    drivers.push({
      position,
      driverName,
      team: team || 'Unknown',
      points,
    });
  }

  if (drivers.length < MIN_DRIVERS) return null;
  // Wikipedia sometimes emits driver rows out of order (rowspan group
  // ordering quirks). Resort by position to keep the rendered table sane.
  return drivers.sort((a, b) => a.position - b.position);
}

function parseTeams(html: string): ConstructorStanding[] | null {
  let $: cheerio.CheerioAPI;
  try {
    $ = cheerio.load(html);
  } catch {
    return null;
  }
  const tables = $('table').toArray() as Element[];

  const found = findTable($, tables, detectTeamColumns, MIN_TEAMS);
  if (!found) return null;

  const { columns, dataRows } = found;
  const teams: ConstructorStanding[] = [];
  const seen = new Set<string>();

  for (const row of dataRows) {
    const posRaw = rowText($, row, columns.pos);
    const teamRaw = rowText($, row, columns.team);
    const pointsRaw = rowText($, row, columns.points);

    const position = parsePosition(posRaw);
    const points = parsePoints(pointsRaw);
    if (position == null || points == null) continue;
    if (!teamRaw) continue;

    const name = teamRaw.replace(/\s+/g, ' ').trim();
    if (!name) continue;
    // Teams' Championship rows can rowspan if a team has multiple drivers in
    // the same parent table. Dedupe by position + name.
    const key = `${position}::${name}`;
    if (seen.has(key)) continue;
    seen.add(key);

    teams.push({ position, name, points });
  }

  if (teams.length < MIN_TEAMS) return null;
  return teams.sort((a, b) => a.position - b.position);
}

export async function fetchFormulaEStandings(): Promise<{
  drivers: DriverStanding[];
  constructors: ConstructorStanding[];
} | null> {
  let html: string;
  try {
    const res = await fetch(`${WIKI_BASE}/${SEASON_PAGE}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        Accept: 'text/html',
      },
      // Hourly revalidate — Wikipedia editors tend to update the standings
      // tables within a few hours of each E-Prix finish.
      next: { revalidate: 3600 },
    } as RequestInit);
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  }

  const drivers = parseDrivers(html);
  const constructors = parseTeams(html);
  // Fail closed: both halves must parse cleanly. A partial table would be
  // misleading on a tab labelled "Standings".
  if (!drivers || !constructors) return null;
  return { drivers, constructors };
}
