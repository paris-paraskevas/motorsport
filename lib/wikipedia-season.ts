import * as cheerio from 'cheerio';
import type { AnyNode, Element } from 'domhandler';

const REST_BASE = 'https://en.wikipedia.org/api/rest_v1/page/html';

const TEAM_HEADERS = ['constructor', 'team', 'entrant'];
const DRIVER_HEADERS = ['driver', 'rider', 'race drivers', 'drivers'];
// Headers that look like driver/team headers superficially but are actually
// numbers, ranks, or other ancillary data. Used to reject false positives
// like "Driver no." matching "driver".
const REJECT_NUMERIC_HEADERS = ['no.', 'number', '#', 'car no.', 'car number'];

export interface TeamLineup {
  team: string;
  drivers: string[];
}

interface ColumnMap {
  team: number;
  driver: number;
}

function isNumericHeader(header: string): boolean {
  return REJECT_NUMERIC_HEADERS.some((n) => header.includes(n));
}

function findColumnIndex(headers: string[], needles: string[]): number {
  // Pass 1: prefer exact-match headers
  for (let i = 0; i < headers.length; i++) {
    const cell = headers[i];
    if (isNumericHeader(cell)) continue;
    if (needles.includes(cell)) return i;
  }
  // Pass 2: substring match, but skip numeric-flavored headers
  for (let i = 0; i < headers.length; i++) {
    const cell = headers[i];
    if (isNumericHeader(cell)) continue;
    for (const needle of needles) {
      if (cell.includes(needle)) return i;
    }
  }
  return -1;
}

function detectColumns(headerCells: string[]): ColumnMap | null {
  const lowered = headerCells.map((c) => c.trim().toLowerCase());
  const teamIdx = findColumnIndex(lowered, TEAM_HEADERS);
  const driverIdx = findColumnIndex(lowered, DRIVER_HEADERS);
  if (teamIdx === -1 || driverIdx === -1) return null;
  if (teamIdx === driverIdx) return null;
  return { team: teamIdx, driver: driverIdx };
}

function isLikelyNumericName(value: string): boolean {
  // Single car number like "10" or "43", not a real driver name.
  return /^\d{1,3}$/.test(value.trim());
}

function cellText($: cheerio.CheerioAPI, el: AnyNode): string {
  return $(el)
    .text()
    .replace(/\[\d+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Split a driver cell that may contain multiple driver names separated by
 * <br> tags. We replace <br> with a newline, then split on newline.
 */
function extractDrivers($: cheerio.CheerioAPI, el: Element): string[] {
  const $cell = $(el).clone();
  $cell.find('br').replaceWith('\n');
  $cell.find('sup').remove(); // strip footnote refs etc.
  const raw = $cell
    .text()
    .replace(/\[\d+\]/g, '')
    .replace(/ /g, ' ');
  return raw
    .split(/\n+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length > 0);
}

/**
 * Walk a table's rows and resolve rowspan so each row exposes a consistent
 * set of effective cells at every column index. Returns an array of rows
 * where rows[r].get(c) gives the cell occupying column c at row r.
 */
function resolveRowspans(
  $: cheerio.CheerioAPI,
  rows: Element[],
): Array<Map<number, Element>> {
  const result: Array<Map<number, Element>> = [];
  // pending: column index -> { remainingRows, cellEl }
  const pending = new Map<number, { remaining: number; cellEl: Element }>();

  for (const row of rows) {
    const effective = new Map<number, Element>();
    const rawCells = $(row).find('> th, > td').toArray() as Element[];
    let rawIdx = 0;
    let col = 0;

    // Place cells, skipping columns already occupied by an ongoing rowspan.
    while (rawIdx < rawCells.length || pending.has(col)) {
      if (pending.has(col)) {
        const p = pending.get(col)!;
        effective.set(col, p.cellEl);
        p.remaining -= 1;
        if (p.remaining <= 0) pending.delete(col);
        col += 1;
        continue;
      }
      const cell = rawCells[rawIdx];
      if (!cell) break;
      effective.set(col, cell);

      const rowspanAttr = $(cell).attr('rowspan');
      const rowspan = rowspanAttr ? parseInt(rowspanAttr, 10) : 1;
      if (rowspan > 1) {
        pending.set(col, { remaining: rowspan - 1, cellEl: cell });
      }
      const colspanAttr = $(cell).attr('colspan');
      const colspan = colspanAttr ? parseInt(colspanAttr, 10) : 1;
      // For colspan > 1, treat additional columns as occupied by same cell.
      for (let k = 1; k < colspan; k++) {
        effective.set(col + k, cell);
      }
      col += Math.max(1, colspan);
      rawIdx += 1;
    }

    result.push(effective);
  }
  return result;
}

function parseTable(
  $: cheerio.CheerioAPI,
  table: Element,
): TeamLineup[] | null {
  const $table = $(table);
  const allRows = $table.find('> tbody > tr, > tr').toArray() as Element[];
  if (allRows.length < 2) return null;

  // Try header rows starting from row 0; some tables have multi-row headers.
  let headerRowIdx = -1;
  let cols: ColumnMap | null = null;
  for (let i = 0; i < Math.min(3, allRows.length); i++) {
    const headerCells = $(allRows[i])
      .find('> th, > td')
      .toArray()
      .map((el) => cellText($, el));
    if (headerCells.length === 0) continue;
    const detected = detectColumns(headerCells);
    if (detected) {
      headerRowIdx = i;
      cols = detected;
      break;
    }
  }
  if (!cols || headerRowIdx === -1) return null;

  const dataRows = allRows.slice(headerRowIdx + 1);
  const resolved = resolveRowspans($, dataRows);

  // Group consecutive rows by their effective team cell. Multi-row tables
  // repeat the team via rowspan, so the same Element reference recurs.
  const lineup: TeamLineup[] = [];
  let currentTeamEl: Element | null = null;
  let currentEntry: TeamLineup | null = null;

  for (const row of resolved) {
    const teamCell = row.get(cols.team);
    const driverCell = row.get(cols.driver);
    if (!teamCell || !driverCell) continue;

    const teamName = cellText($, teamCell);
    if (!teamName) continue;

    if (teamCell !== currentTeamEl) {
      // Flush previous if any
      if (currentEntry && currentEntry.drivers.length > 0) {
        lineup.push(currentEntry);
      }
      currentEntry = { team: teamName, drivers: [] };
      currentTeamEl = teamCell;
    }

    const drivers = extractDrivers($, driverCell).filter(d => !isLikelyNumericName(d));
    for (const d of drivers) {
      if (currentEntry && !currentEntry.drivers.includes(d)) {
        currentEntry.drivers.push(d);
      }
    }
  }
  if (currentEntry && currentEntry.drivers.length > 0) {
    lineup.push(currentEntry);
  }

  // Final sanity check: if we ended up with mostly empty driver lists
  // (because the matched column was actually a car-number column whose
  // values we filtered out), discard this table.
  const meaningful = lineup.filter(e => e.drivers.length > 0);
  if (meaningful.length < Math.max(2, lineup.length / 2)) return null;

  // Reject entries whose "team" name is actually a column-header leak
  // ("No.", "Source", "Driver", "Chassis", "Round", etc.) or otherwise
  // implausible (too short, contains ':' as in "Source:").
  const credible = meaningful.filter(e => isCredibleTeamName(e.team));

  // A real season lineup has at least four teams. Anything smaller is
  // almost certainly a 2-row stats table the scraper landed on by mistake.
  if (credible.length < 4) return null;

  return credible;
}

const JUNK_TEAM_PATTERN =
  /^(no\.?|source|driver|drivers|rider|riders|chassis|engine|tyre|tyres|tire|tires|round|pos\.?|position|rank|car no\.?|car number|points|total)$/i;

function isCredibleTeamName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length <= 3) return false;
  if (trimmed.includes(':')) return false;
  if (JUNK_TEAM_PATTERN.test(trimmed)) return false;
  return true;
}

export async function fetchSeasonLineup(
  seasonPage: string,
): Promise<TeamLineup[]> {
  if (!seasonPage) return [];
  const url = `${REST_BASE}/${encodeURIComponent(seasonPage)}`;
  let html: string;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'text/html' },
      next: { revalidate: 86400 },
    } as RequestInit);
    if (!res.ok) return [];
    html = await res.text();
  } catch {
    return [];
  }

  try {
    const $ = cheerio.load(html);
    const tables = $('table').toArray() as Element[];

    for (const table of tables) {
      const parsed = parseTable($, table);
      if (parsed && parsed.length > 0) return parsed;
    }
  } catch {
    return [];
  }

  return [];
}
