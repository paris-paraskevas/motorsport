import * as cheerio from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import type { RaceResult, RaceResultEntry } from '@/lib/types';

export type { RaceResult, RaceResultEntry };

// Wikipedia REST HTML — same source the standings scraper uses. See
// lib/standings/formula-e.ts for the rationale (fiaformulae.com is a JS-only
// SPA and results.fiaformulae.com is access-restricted, so Wikipedia's
// already-edited race-results table is the most reliable public source).
const SEASON_PAGE = '2025%E2%80%9326_Formula_E_World_Championship';
const REST_BASE = 'https://en.wikipedia.org/api/rest_v1/page/html';

// FE's Season 12 calendar has 17 rounds. <3 rounds parsed = we landed on the
// wrong table (a 2-row summary, the points-scheme table, etc.) → fail closed.
const MIN_ROUNDS = 3;
// Standard FE winner points (P1 in a race). The drivers' season-trend chart
// uses RaceResultEntry.points; we attribute the canonical race-winner value
// here. Lower-finishing positions are not emitted (only the winner row
// per race), so the chart will plot winners only.
const WINNER_POINTS = 25;

const BRACKET_ANNOTATION_RE = /\[[^\]]{1,15}\]/g;

function cellText($: cheerio.CheerioAPI, el: AnyNode): string {
  // Same defensive cleanup as lib/wikipedia-season.ts. Without this, .text()
  // pulls inline CSS rules for .legend and footnote markers into the cell.
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

interface RaceColumnMap {
  round: number;
  ePrix: number;
  winningDriver: number;
  winningTeam: number;
  // Optional date column — Wikipedia's race results table can list either a
  // dedicated date column or weave the date into the venue text.
  date?: number;
}

function detectRaceColumns(headerCells: string[]): RaceColumnMap | null {
  const round = findHeaderIndex(headerCells, {
    exact: ['round', 'rnd', 'rd', 'rd.', '#'],
  });
  // Race-name column — Wikipedia uses "E-Prix" (with hyphen). Allow the
  // hyphenless variant + "race" + "grand prix" defensively.
  const ePrix = findHeaderIndex(headerCells, {
    exact: ['e-prix', 'eprix', 'race', 'grand prix'],
    contains: ['e-prix', 'eprix'],
  });
  // Winner columns. Wikipedia's headers are literally "Winning driver" and
  // "Winning team"; sometimes "Winner" alone. We accept "constructor" /
  // "team" / "manufacturer" defensively for the team column.
  const winningDriver = findHeaderIndex(headerCells, {
    exact: ['winning driver', 'winner'],
    contains: ['winning driver', 'winner'],
  });
  const winningTeam = findHeaderIndex(headerCells, {
    exact: ['winning team', 'winning constructor'],
    contains: ['winning team', 'winning constructor', 'winning manufacturer'],
  });
  const date = findHeaderIndex(headerCells, {
    exact: ['date'],
    contains: ['date'],
  });

  if (round === -1 || ePrix === -1 || winningDriver === -1 || winningTeam === -1) {
    return null;
  }
  if (
    round === ePrix ||
    round === winningDriver ||
    round === winningTeam ||
    ePrix === winningDriver ||
    ePrix === winningTeam ||
    winningDriver === winningTeam
  ) {
    return null;
  }
  return {
    round,
    ePrix,
    winningDriver,
    winningTeam,
    date: date === -1 ? undefined : date,
  };
}

function parseRound(raw: string): number | null {
  const m = raw.match(/(\d+)/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 1 || n > 99) return null;
  return n;
}

// Wikipedia formats dates as "6 December 2025", "10 January 2026", "13 February 2026", etc.
const MONTHS: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
};

function parseDate(raw: string): Date | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  // "6 December 2025" / "6 Dec 2025"
  const m1 = lower.match(/\b(\d{1,2})\s+([a-z]+)\s+(\d{4})\b/);
  if (m1) {
    const day = Number(m1[1]);
    const month = MONTHS[m1[2]];
    const year = Number(m1[3]);
    if (Number.isFinite(day) && month != null && Number.isFinite(year)) {
      const d = new Date(Date.UTC(year, month, day));
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  // "December 6, 2025"
  const m2 = lower.match(/\b([a-z]+)\s+(\d{1,2}),\s+(\d{4})\b/);
  if (m2) {
    const month = MONTHS[m2[1]];
    const day = Number(m2[2]);
    const year = Number(m2[3]);
    if (Number.isFinite(day) && month != null && Number.isFinite(year)) {
      const d = new Date(Date.UTC(year, month, day));
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  // ISO-ish "2025-12-06"
  const m3 = raw.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m3) {
    const d = new Date(`${m3[1]}-${m3[2]}-${m3[3]}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function rowCells($: cheerio.CheerioAPI, row: Element): Element[] {
  return $(row).find('> td, > th').toArray() as Element[];
}

function rowText(
  $: cheerio.CheerioAPI,
  row: Element,
  colIdx: number,
): string {
  const cells = rowCells($, row);
  const cell = cells[colIdx];
  if (!cell) return '';
  return cellText($, cell);
}

interface FoundTable {
  table: Element;
  columns: RaceColumnMap;
  dataRows: Element[];
}

function findRaceTable(
  $: cheerio.CheerioAPI,
  tables: Element[],
): FoundTable | null {
  for (const table of tables) {
    const allRows = $(table)
      .find('> tbody > tr, > tr')
      .toArray() as Element[];
    if (allRows.length < 2) continue;
    for (let i = 0; i < Math.min(3, allRows.length); i++) {
      const cells = rowCells($, allRows[i]);
      if (cells.length === 0) continue;
      const headers = cells.map((c) => cellText($, c));
      const columns = detectRaceColumns(headers);
      if (!columns) continue;
      const dataRows = allRows.slice(i + 1);
      if (dataRows.length < MIN_ROUNDS) continue;
      return { table, columns, dataRows };
    }
  }
  return null;
}

function parseRaces(html: string): RaceResult[] {
  let $: cheerio.CheerioAPI;
  try {
    $ = cheerio.load(html);
  } catch {
    return [];
  }
  const tables = $('table').toArray() as Element[];
  const found = findRaceTable($, tables);
  if (!found) return [];

  const { columns, dataRows } = found;
  const races: RaceResult[] = [];

  // FE's race-results table can include rows for not-yet-run rounds, where
  // the Winning driver / Winning team cells are empty (or contain a Wikipedia
  // "—" / "TBD" marker). Skip those — fail closed at the row level so the
  // tab shows the rounds that DO have results.
  for (const row of dataRows) {
    const roundRaw = rowText($, row, columns.round);
    const round = parseRound(roundRaw);
    if (round == null) continue;

    const ePrix = rowText($, row, columns.ePrix);
    const driverRaw = rowText($, row, columns.winningDriver);
    const teamRaw = rowText($, row, columns.winningTeam);
    if (!ePrix || !driverRaw || !teamRaw) continue;

    // Skip clearly-empty cells (Wikipedia uses em-dash "—" or "TBA" for
    // future rounds).
    if (
      driverRaw === '—' ||
      driverRaw === '–' ||
      driverRaw === '-' ||
      /^tb[adc]$/i.test(driverRaw) ||
      teamRaw === '—' ||
      teamRaw === '–' ||
      teamRaw === '-' ||
      /^tb[adc]$/i.test(teamRaw)
    ) {
      continue;
    }

    // Driver / team name cleanup — strip parenthesised country annotations.
    const driverName = driverRaw
      .replace(/\([^)]{0,80}\)/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const team = teamRaw
      .replace(/\([^)]{0,80}\)/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!driverName || !team) continue;

    // Date is best-effort. When the Wikipedia table omits a date column the
    // ePrix cell sometimes carries the venue + date inline; otherwise we
    // fall back to epoch-zero only after the row is otherwise valid. We use
    // Jan 1 of the FE season-end calendar year as a safe placeholder so the
    // date is never NaN — ResultsTab tolerates this because the user-visible
    // date label is derived from this Date via formatDate(date).
    let date: Date | null = null;
    if (columns.date != null) {
      const dateRaw = rowText($, row, columns.date);
      date = parseDate(dateRaw);
    }
    if (!date) {
      // Try the ePrix cell next — Wikipedia sometimes embeds the date there.
      date = parseDate(ePrix);
    }
    if (!date) {
      // Skip the row rather than emit a misleading date. The Results tab
      // strictly shows the date label; an empty/wrong date is worse than
      // dropping the row.
      continue;
    }

    // Raw "São Paulo ePrix" → use as both race name and "circuit" — Wikipedia
    // doesn't expose the venue separately and the FE circuit name often
    // matches the ePrix label.
    const raceName = ePrix
      .replace(/\([^)]{0,80}\)/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const circuit = raceName;

    const entry: RaceResultEntry = {
      position: 1,
      driverName,
      team,
      status: 'Race winner',
      points: WINNER_POINTS,
    };

    races.push({
      round,
      raceName,
      date,
      circuit,
      results: [entry],
    });
  }

  // Resort by round; defensive — Wikipedia tables are usually ordered.
  return races.sort((a, b) => a.round - b.round);
}

export async function fetchFormulaESeasonResults(): Promise<RaceResult[]> {
  // Empty array is the failure mode — matches lib/results/f1.ts contract so
  // ResultsTab dispatch can render its "temporarily unavailable" placeholder
  // without further branching.
  let html: string;
  try {
    const res = await fetch(`${REST_BASE}/${SEASON_PAGE}`, {
      headers: { Accept: 'text/html' },
      // Hourly revalidate — Wikipedia editors update the race-results
      // table within a few hours of each E-Prix finish.
      next: { revalidate: 3600 },
    } as RequestInit);
    if (!res.ok) return [];
    html = await res.text();
  } catch {
    return [];
  }

  const races = parseRaces(html);
  if (races.length < MIN_ROUNDS) return [];
  return races;
}
