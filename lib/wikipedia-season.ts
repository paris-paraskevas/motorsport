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

// Strip any bracketed annotation up to 15 chars: [1], [a], [N 1],
// [lower-alpha 2], [note 3], etc. Wikipedia uses several footnote
// styles beyond the numeric one our original regex covered.
const BRACKET_ANNOTATION_RE = /\[[^\]]{1,15}\]/g;

function cellText($: cheerio.CheerioAPI, el: AnyNode): string {
  // Clone + strip Wikipedia's inline <style> blocks and .legend decoration
  // spans before text extraction. Without this, cheerio's .text() pulls the
  // CSS rules (".mw-parser-output .legend{page-break-inside:avoid;...}") into
  // the cell string — visible on Drivers tabs for any series using the live
  // Wikipedia scrape fallback.
  const $el = $(el).clone();
  $el.find('style, .legend, .legend-color, .legend-text').remove();
  return $el
    .text()
    .replace(BRACKET_ANNOTATION_RE, '')
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
  // Strip footnote refs (<sup>), inline <style> blocks Wikipedia embeds for
  // .legend decoration, and the .legend spans themselves — these include
  // <span class="legend-text">R</span> rookie markers that would otherwise
  // appear as a stray "R" between driver names on the IndyCar Drivers tab.
  $cell.find('sup, style, .legend').remove();
  const raw = $cell
    .text()
    .replace(BRACKET_ANNOTATION_RE, '')
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

/**
 * Build a flat list of header names per actual column index, accounting
 * for colspan in row 0. When row 0 has multi-column headers (e.g. F1's
 * "Race drivers" spanning 3 sub-columns: No., Driver name, Rounds),
 * row 1 contains the sub-headers that fill the gap columns in order.
 */
function flattenHeaderRows(
  $: cheerio.CheerioAPI,
  row0: Element,
  row1: Element | null,
): string[] {
  const out: string[] = [];
  const row0Cells = $(row0).find('> th, > td').toArray() as Element[];
  let col = 0;
  for (const cell of row0Cells) {
    const text = cellText($, cell);
    const colspan = parseInt($(cell).attr('colspan') || '1', 10);
    if (colspan === 1) {
      out[col] = text;
    } else {
      // Multi-col parent header (e.g. "Race drivers"). Leave all spanned
      // positions empty so row 1's sub-headers can fill them in order.
      for (let i = 0; i < colspan; i++) out[col + i] = '';
    }
    col += colspan;
  }
  if (row1) {
    const row1Cells = $(row1).find('> th, > td').toArray() as Element[];
    let row1Idx = 0;
    for (let c = 0; c < out.length; c++) {
      if (out[c] === '' && row1Idx < row1Cells.length) {
        out[c] = cellText($, row1Cells[row1Idx]);
        row1Idx++;
      }
    }
  }
  return out;
}

function rowHasMultiCol($: cheerio.CheerioAPI, row: Element): boolean {
  const cells = $(row).find('> th, > td').toArray() as Element[];
  return cells.some(c => parseInt($(c).attr('colspan') || '1', 10) > 1);
}

function parseTable(
  $: cheerio.CheerioAPI,
  table: Element,
): TeamLineup[] | null {
  const $table = $(table);
  const allRows = $table.find('> tbody > tr, > tr').toArray() as Element[];
  if (allRows.length < 2) return null;

  // Try header rows starting from row 0; some tables have multi-row headers.
  // If a row has any cell with colspan > 1, the next row likely contains
  // sub-headers for the spanned columns — flatten both into one logical
  // header list before column detection.
  let lastHeaderRowIdx = -1;
  let cols: ColumnMap | null = null;
  for (let i = 0; i < Math.min(3, allRows.length); i++) {
    const row0 = allRows[i];
    const row0Cells = $(row0).find('> th, > td').toArray() as Element[];
    if (row0Cells.length === 0) continue;

    const hasMultiCol = rowHasMultiCol($, row0);
    const row1 = hasMultiCol && i + 1 < allRows.length ? allRows[i + 1] : null;
    const headerCells = flattenHeaderRows($, row0, row1);

    const detected = detectColumns(headerCells);
    if (detected) {
      lastHeaderRowIdx = row1 ? i + 1 : i;
      cols = detected;
      break;
    }
  }
  if (!cols || lastHeaderRowIdx === -1) return null;

  const dataRows = allRows.slice(lastHeaderRowIdx + 1);
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

  // Merge entries whose team name matches — the season table sometimes
  // uses one row per driver (no rowspan), so the same team appears on
  // multiple rows. Without this we'd render "Mercedes" four times in a row.
  const merged: TeamLineup[] = [];
  for (const entry of credible) {
    const existing = merged.find(m => m.team === entry.team);
    if (existing) {
      for (const d of entry.drivers) {
        if (!existing.drivers.includes(d)) existing.drivers.push(d);
      }
    } else {
      merged.push({ team: entry.team, drivers: [...entry.drivers] });
    }
  }

  // A real season lineup has at least four UNIQUE teams. Anything smaller
  // is almost certainly a 2-row stats table the scraper landed on by mistake.
  if (merged.length < 4) return null;

  return merged;
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
