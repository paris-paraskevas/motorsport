import * as cheerio from 'cheerio';
import { fetchUpstream } from '@/lib/fetch-upstream';

// IMSA WeatherTech SportsCar Championship has four classes that each award
// their own drivers' / teams' / manufacturers' titles. LMP2 is privateer-only
// (every car is the spec Oreca 07 / Gibson) so there is no LMP2 manufacturers'
// championship — see the audit doc `docs/research/per-series-source-audit.md`
// §8 and the championship-rules section on the official 2026 SSR PDF.
export type ImsaClass = 'GTP' | 'LMP2' | 'GTD Pro' | 'GTD';

export const IMSA_CLASSES: readonly ImsaClass[] = [
  'GTP',
  'LMP2',
  'GTD Pro',
  'GTD',
] as const;
export const IMSA_MANUFACTURER_CLASSES: readonly ImsaClass[] = [
  'GTP',
  'GTD Pro',
  'GTD',
] as const;

export interface ImsaDriverStanding {
  position: number;
  // Multi-driver entries are common in endurance racing (a single car has 2-4
  // drivers sharing the points). Wikipedia separates names with a space; we
  // preserve them as a single space-joined string for display, matching the
  // shape the rest of the codebase uses for single-driver entries.
  driverName: string;
  points: number;
}

export interface ImsaTeamStanding {
  position: number;
  // e.g. "#7 Porsche Penske Motorsport" — Wikipedia bakes the car number into
  // the team cell. We keep the prefix intact since IMSA's own official points
  // PDFs use the same "#NN <Team>" notation.
  team: string;
  car?: string;
  points: number;
}

export interface ImsaManufacturerStanding {
  position: number;
  manufacturer: string;
  points: number;
}

export interface ImsaStandings {
  drivers: Record<ImsaClass, ImsaDriverStanding[]>;
  teams: Record<ImsaClass, ImsaTeamStanding[]>;
  // LMP2 manufacturers' championship doesn't exist; the key is omitted rather
  // than included as an empty array so consumers can iterate
  // IMSA_MANUFACTURER_CLASSES safely.
  manufacturers: Partial<Record<ImsaClass, ImsaManufacturerStanding[]>>;
}

// Sanity floor across all four drivers' standings tables. A complete IMSA
// standings page (drivers across GTP + LMP2 + GTD Pro + GTD) totals ~80
// entries — Wikipedia lists one row per *driver-line* in a car, so a 22-car
// GTD field with 2-3 drivers each produces ~50 GTD rows alone. 30 is the
// floor before we fail closed and let the StandingsTab render its placeholder
// rather than ship a misleadingly-partial table.
const MIN_TOTAL_DRIVER_ROWS = 30;

// Wikipedia is the canonical source: HTML table, no auth, ICR-license. The
// audit (§8) flagged imsa.com as a PDF distributor and Al Kamel's timing
// portal as the upstream of those PDFs — both impose heavy server-side
// dependencies (PDF parser, directory listing scrape). Wikipedia's standings
// tables refresh within ~24h of each round and have a stable schema across
// seasons.
const STANDINGS_URL =
  'https://en.wikipedia.org/wiki/2026_IMSA_SportsCar_Championship';

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  Accept: 'text/html',
};

// Map the H4 subheading text to our canonical class label. Wikipedia uses
// "Standings: Grand Touring Prototype (GTP)" etc. — we match on the trailing
// parenthetical code.
function classFromHeading(text: string): ImsaClass | null {
  if (/\(GTP\)/.test(text)) return 'GTP';
  if (/\(LMP2\)/.test(text)) return 'LMP2';
  if (/\(GTD Pro\)/.test(text)) return 'GTD Pro';
  if (/\(GTD\)/.test(text)) return 'GTD';
  return null;
}

// Find the Points column index in a wikitable header. Wikipedia's IMSA tables
// put per-round finishing position columns between Drivers/Team and Points,
// and an optional trailing MEC column. We anchor on the literal "Points"
// header to stay robust against added/removed rounds during the season.
function findPointsColumn(headerCells: string[]): number {
  return headerCells.findIndex(c => c.trim().toLowerCase() === 'points');
}

// Walk DOM linearly, collecting every heading + wikitable in order, then
// group by section. Mirrors how the source page is laid out: H2
// "Championship standings" → H3 "Drivers' Championships" / "Teams'
// Championships" / "Manufacturers' Championships" → H4 per class → one table.
function collectStandingsTables(
  $: cheerio.CheerioAPI,
): Array<{
  section: 'drivers' | 'teams' | 'manufacturers';
  cls: ImsaClass;
  // The Cheerio.Element type is loose across versions; we expose the wrapped
  // selection rather than the raw element so downstream code can $-traverse
  // it directly.
  table: ReturnType<cheerio.CheerioAPI>;
}> {
  const out: Array<{
    section: 'drivers' | 'teams' | 'manufacturers';
    cls: ImsaClass;
    table: ReturnType<cheerio.CheerioAPI>;
  }> = [];
  let lastH3 = '';
  let lastH4 = '';
  let inChampionshipStandings = false;

  $('h2, h3, h4, table.wikitable').each((_, el) => {
    const $el = $(el);
    const tag = (el as { tagName?: string }).tagName?.toLowerCase?.() ?? '';

    if (tag === 'h2') {
      const text = $el.text().replace(/\[edit\]/g, '').trim();
      inChampionshipStandings = /championship standings/i.test(text);
      lastH3 = '';
      lastH4 = '';
      return;
    }
    if (!inChampionshipStandings) return;
    if (tag === 'h3') {
      lastH3 = $el.text().replace(/\[edit\]/g, '').trim();
      lastH4 = '';
      return;
    }
    if (tag === 'h4') {
      lastH4 = $el.text().replace(/\[edit\]/g, '').trim();
      return;
    }
    // It's a wikitable
    let section: 'drivers' | 'teams' | 'manufacturers' | null = null;
    if (/drivers'? championship/i.test(lastH3)) section = 'drivers';
    else if (/teams'? championship/i.test(lastH3)) section = 'teams';
    else if (/manufacturers'? championship/i.test(lastH3)) section = 'manufacturers';
    if (!section) return;
    const cls = classFromHeading(lastH4);
    if (!cls) return;
    out.push({ section, cls, table: $el });
  });

  return out;
}

function parsePoints(raw: string): number {
  // Wikipedia sometimes wraps points in italics for in-progress totals;
  // .text() already strips the tags. Strip thousands separators just in case.
  return Number(raw.replace(/[,\s]/g, ''));
}

function parseDriverRow(
  cells: string[],
  pointsCol: number,
): ImsaDriverStanding | null {
  if (pointsCol < 2) return null;
  const position = Number(cells[0]);
  const driverName = cells[1];
  const points = parsePoints(cells[pointsCol] ?? '');
  if (!Number.isFinite(position) || !Number.isFinite(points) || !driverName) {
    return null;
  }
  return { position, driverName, points };
}

function parseTeamRow(
  cells: string[],
  pointsCol: number,
): ImsaTeamStanding | null {
  if (pointsCol < 3) return null;
  const position = Number(cells[0]);
  const team = cells[1];
  const car = cells[2] || undefined;
  const points = parsePoints(cells[pointsCol] ?? '');
  if (!Number.isFinite(position) || !Number.isFinite(points) || !team) {
    return null;
  }
  return { position, team, car, points };
}

function parseManufacturerRow(
  cells: string[],
  pointsCol: number,
): ImsaManufacturerStanding | null {
  if (pointsCol < 2) return null;
  const position = Number(cells[0]);
  const manufacturer = cells[1];
  const points = parsePoints(cells[pointsCol] ?? '');
  if (!Number.isFinite(position) || !Number.isFinite(points) || !manufacturer) {
    return null;
  }
  return { position, manufacturer, points };
}

function readTable(
  $: cheerio.CheerioAPI,
  table: ReturnType<cheerio.CheerioAPI>,
): { header: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let header: string[] = [];
  table.find('tr').each((idx, tr) => {
    const cells: string[] = [];
    $(tr)
      .find('th, td')
      .each((_, cell) => {
        cells.push($(cell).text().replace(/\s+/g, ' ').trim());
      });
    if (idx === 0) header = cells;
    else rows.push(cells);
  });
  return { header, rows };
}

export async function fetchImsaStandings(): Promise<ImsaStandings | null> {
  let html: string;
  try {
    const res = await fetchUpstream(STANDINGS_URL, {
      headers: FETCH_HEADERS,
      // Hourly revalidate matches the IndyCar loader; Wikipedia updates
      // within ~24h of each round, an hour is more than fine.
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  }

  try {
    const $ = cheerio.load(html);
    const tables = collectStandingsTables($);

    const drivers: Partial<Record<ImsaClass, ImsaDriverStanding[]>> = {};
    const teams: Partial<Record<ImsaClass, ImsaTeamStanding[]>> = {};
    const manufacturers: Partial<Record<ImsaClass, ImsaManufacturerStanding[]>> = {};

    for (const { section, cls, table } of tables) {
      const { header, rows } = readTable($, table);
      const pointsCol = findPointsColumn(header);
      if (pointsCol < 0) continue;

      if (section === 'drivers') {
        const parsed: ImsaDriverStanding[] = [];
        for (const r of rows) {
          const entry = parseDriverRow(r, pointsCol);
          if (entry) parsed.push(entry);
        }
        if (parsed.length > 0) {
          parsed.sort((a, b) => a.position - b.position);
          drivers[cls] = parsed;
        }
      } else if (section === 'teams') {
        const parsed: ImsaTeamStanding[] = [];
        for (const r of rows) {
          const entry = parseTeamRow(r, pointsCol);
          if (entry) parsed.push(entry);
        }
        if (parsed.length > 0) {
          parsed.sort((a, b) => a.position - b.position);
          teams[cls] = parsed;
        }
      } else {
        const parsed: ImsaManufacturerStanding[] = [];
        for (const r of rows) {
          const entry = parseManufacturerRow(r, pointsCol);
          if (entry) parsed.push(entry);
        }
        if (parsed.length > 0) {
          parsed.sort((a, b) => a.position - b.position);
          manufacturers[cls] = parsed;
        }
      }
    }

    // Fail closed unless every class populated. Missing a class = upstream
    // page mid-edit, partial table, or structural change; better to render
    // the placeholder than ship a misleadingly-incomplete view.
    const driverCounts = IMSA_CLASSES.map(c => drivers[c]?.length ?? 0);
    if (driverCounts.some(n => n === 0)) return null;
    const totalDriverRows = driverCounts.reduce((a, b) => a + b, 0);
    if (totalDriverRows < MIN_TOTAL_DRIVER_ROWS) return null;

    for (const c of IMSA_CLASSES) {
      if (!teams[c] || teams[c]!.length === 0) return null;
    }
    for (const c of IMSA_MANUFACTURER_CLASSES) {
      if (!manufacturers[c] || manufacturers[c]!.length === 0) return null;
    }

    return {
      drivers: drivers as Record<ImsaClass, ImsaDriverStanding[]>,
      teams: teams as Record<ImsaClass, ImsaTeamStanding[]>,
      manufacturers,
    };
  } catch {
    return null;
  }
}
