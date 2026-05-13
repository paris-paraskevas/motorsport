import * as cheerio from 'cheerio';
import type { AnyNode, Element } from 'domhandler';

const REST_BASE = 'https://en.wikipedia.org/api/rest_v1/page/html';

const TEAM_HEADERS = ['constructor', 'team', 'entrant'];
const DRIVER_HEADERS = ['driver', 'rider', 'race drivers', 'drivers'];

export interface TeamLineup {
  team: string;
  drivers: string[];
}

interface ColumnMap {
  team: number;
  driver: number;
}

function findColumnIndex(headers: string[], needles: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const cell = headers[i];
    for (const needle of needles) {
      if (cell.includes(needle)) {
        return i;
      }
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

    const drivers = extractDrivers($, driverCell);
    for (const d of drivers) {
      if (currentEntry && !currentEntry.drivers.includes(d)) {
        currentEntry.drivers.push(d);
      }
    }
  }
  if (currentEntry && currentEntry.drivers.length > 0) {
    lineup.push(currentEntry);
  }

  return lineup.length > 0 ? lineup : null;
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
