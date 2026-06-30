import * as cheerio from 'cheerio';
import { fetchUpstream } from '@/lib/fetch-upstream';
import type { Element } from 'domhandler';
import type { RaceResult, RaceResultEntry } from '@/lib/types';

export type { RaceResult, RaceResultEntry };

// WRC per-rally full classification. The season page at
// /wiki/2026_World_Rally_Championship carries two relevant tables:
//
//   - Calendar (h2 id="Calendar"): Round | Start date | Finish date | Rally |
//     HQ | Surface | Stages | Distance | Ref — has dates but NO winner.
//   - Season summary (h3 id="Season_summary" under
//     h2 id="Results_and_standings"): Round | Event | Winning driver |
//     Winning co-driver | Winning entrant | Winning time | Report | Ref —
//     has winner + a "Report" cell linking to the per-rally Wikipedia page
//     (e.g. /wiki/2026_Rally_de_Portugal). No date column.
//
// Per-rally articles carry a "WRC Rally1 → Classification" table with the
// full top-N including retired entries and a "Points (Total)" column that
// aggregates Event + Sunday + Power-Stage bonus points per driver. The
// 2026 WRC scoring system gives 25-17-15-12-10-8-6-4-2-0 for finishing
// positions (changed from the pre-2026 25-18-15-12-10-8-6-4-2-1 scale) plus
// Sunday top-7 (7-6-5-4-3-2-1) plus Power Stage top-5 (5-4-3-2-1) — but we
// don't compute these locally; the Total column already aggregates them.
// Reading Total is the only thing that reconciles cleanly against the
// Drivers' Championship totals on the season page.
//
// fetchWRCSeasonResults orchestrates a season-page fetch followed by N
// parallel per-rally fetches. Each per-rally fetch is fail-soft — if the
// Wikipedia article for a given round is missing or its Classification
// table is structurally unexpected, that round falls back to the
// winner-only entry from the Season summary table. Returning a thin row is
// preferred over dropping the round entirely so the calendar always lists
// every completed event.

const WIKIPEDIA_SEASON_URL =
  'https://en.wikipedia.org/wiki/2026_World_Rally_Championship';
const WIKIPEDIA_ORIGIN = 'https://en.wikipedia.org';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetchUpstream(url, {
      headers: {
        'User-Agent': BROWSER_UA,
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

function cleanText(text: string): string {
  return text
    .replace(/\[\d+\]/g, '')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Pull the first <a>'s anchor text out of a cell, falling back to the
// cell's stripped text. Wikipedia cells often carry a flag-icon link
// alongside the meaningful link; the flag-icon's anchor text is empty
// (just an img inside) so the first link with content is the right one.
function firstLinkOrText(
  $: cheerio.CheerioAPI,
  cell: cheerio.Cheerio<Element>,
): string {
  let linkText = '';
  cell.find('a').each((_, a) => {
    if (linkText) return;
    const t = $(a).text().trim();
    if (t) linkText = t;
  });
  return cleanText(linkText || cell.text());
}

// ---- Calendar table — round → date map ----------------------------------

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

// Parse a single Wikipedia date cell like "22 January" or "22–25 January".
// Used for both the Calendar table's "Start date" column and any legacy
// single-cell "Date" column the page might revert to. Returns UTC midnight
// of the start day, since downstream UI sorts and renders on day-only.
export function parseRallyDate(
  dateText: string,
  season: number,
): Date | null {
  const lowered = dateText.toLowerCase().replace(/[–—−]/g, '-');
  // "22-25 january"
  let m = lowered.match(/(\d{1,2})\s*-\s*\d{1,2}\s+([a-z]+)/);
  if (m) return buildDate(m[1], m[2], season);
  // "january 22-25"
  m = lowered.match(/([a-z]+)\s+(\d{1,2})\s*-\s*\d{1,2}/);
  if (m) return buildDate(m[2], m[1], season);
  // "22 january - 25 january"
  m = lowered.match(/(\d{1,2})\s+([a-z]+)\s*-\s*\d{1,2}\s+[a-z]+/);
  if (m) return buildDate(m[1], m[2], season);
  // "22 january"
  m = lowered.match(/(\d{1,2})\s+([a-z]+)/);
  if (m) return buildDate(m[1], m[2], season);
  return null;
}

function buildDate(dayStr: string, monthName: string, season: number): Date | null {
  const day = Number(dayStr);
  const month = MONTHS[monthName];
  if (month == null || !Number.isFinite(day)) return null;
  const d = new Date(Date.UTC(season, month, day));
  return Number.isNaN(d.getTime()) ? null : d;
}

// Walk forward from a heading until we hit the next heading or a wikitable.
// Wikipedia (2024+) wraps headings in <div class="mw-heading"> so the
// semantic next-sibling is the wrapper's sibling, not the heading's. Stop
// at headings of equal-or-higher level so a missing table doesn't grab an
// unrelated downstream one.
function findFirstTableAfter(
  $: cheerio.CheerioAPI,
  headingIdPatterns: RegExp[],
): cheerio.Cheerio<Element> | null {
  for (const pat of headingIdPatterns) {
    let found: cheerio.Cheerio<Element> | null = null;
    $('h2, h3, h4').each((_, headingEl) => {
      if (found) return;
      const heading = $(headingEl);
      const id =
        heading.attr('id') ??
        heading.find('[id]').first().attr('id') ??
        '';
      if (!pat.test(id)) return;

      const parent = heading.parent();
      const startEl = parent.hasClass('mw-heading') ? parent : heading;
      const headingLevel = (heading.get(0) as { tagName?: string }).tagName?.toLowerCase() ?? 'h3';
      let cursor = startEl.next();
      while (cursor.length > 0) {
        const stopLevels = (() => {
          if (headingLevel === 'h2') return ['h2'];
          if (headingLevel === 'h3') return ['h2', 'h3'];
          return ['h2', 'h3', 'h4'];
        })();
        if (stopLevels.some(l => cursor.is(l))) break;
        if (cursor.hasClass('mw-heading')) {
          const innerH = cursor.find('h2, h3, h4').first();
          if (innerH.length > 0) {
            const innerLevel = (innerH.get(0) as { tagName?: string }).tagName?.toLowerCase();
            if (innerLevel && stopLevels.includes(innerLevel)) break;
          }
        }
        if (cursor.is('table.wikitable')) {
          found = cursor;
          return;
        }
        const inner = cursor.find('table.wikitable').first();
        if (inner.length > 0) {
          found = inner;
          return;
        }
        cursor = cursor.next();
      }
    });
    if (found) return found;
  }
  return null;
}

// Header-aware column lookup. Returns -1 if no header matches.
function findColIndex(headers: string[], ...keywords: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase();
    if (keywords.some(k => h.includes(k))) return i;
  }
  return -1;
}

function tableHeaderLabels(
  $: cheerio.CheerioAPI,
  table: cheerio.Cheerio<Element>,
): string[] | null {
  let labels: string[] | null = null;
  table.find('tr').each((_, tr) => {
    if (labels) return;
    const ths = $(tr).children('th');
    const cells = $(tr).children('th, td');
    if (ths.length === 0 || ths.length < cells.length / 2) return;
    labels = cells
      .toArray()
      .map(c => $(c).text().replace(/\s+/g, ' ').trim());
  });
  return labels;
}

interface CalendarRow {
  round: number;
  rallyName: string;
  date: Date;
}

export function parseCalendarFromHtml(
  html: string,
  season: number,
): CalendarRow[] {
  try {
    const $ = cheerio.load(html);
    const table = findFirstTableAfter($, [
      /^Calendar$/i,
      /Calendar/i,
    ]);
    if (!table) return [];
    const headers = tableHeaderLabels($, table);
    if (!headers) return [];
    const roundCol = findColIndex(headers, 'round', 'rnd');
    // Prefer "Start date"; fall back to a single "Date" column for older
    // Wikipedia layouts.
    let dateCol = findColIndex(headers, 'start date');
    if (dateCol < 0) dateCol = findColIndex(headers, 'date');
    const rallyCol = findColIndex(headers, 'rally', 'event');
    if (roundCol < 0 || dateCol < 0 || rallyCol < 0) return [];

    const out: CalendarRow[] = [];
    table.find('tr').each((_, tr) => {
      const cells = $(tr).children('th, td');
      if (cells.length <= Math.max(roundCol, dateCol, rallyCol)) return;
      // Skip header rows (all <th>).
      const ths = $(tr).children('th');
      if (ths.length === cells.length) return;

      const roundText = $(cells[roundCol]).text().trim();
      const round = Number(roundText.replace(/[^\d]/g, ''));
      if (!Number.isFinite(round) || round < 1) return;

      const dateText = $(cells[dateCol]).text();
      const date = parseRallyDate(dateText, season);
      if (!date) return;

      const rallyName = firstLinkOrText($, $(cells[rallyCol]));
      if (!rallyName) return;

      out.push({ round, rallyName, date });
    });
    return out;
  } catch {
    return [];
  }
}

// ---- Season summary table — round → winner + per-rally URL --------------

export interface SeasonSummaryRow {
  round: number;
  rallyName: string;
  winnerName: string | null;
  coDriverName: string;
  team: string;
  perRallyUrl: string | null;
}

export function parseSeasonSummaryFromHtml(html: string): SeasonSummaryRow[] {
  try {
    const $ = cheerio.load(html);
    const table = findFirstTableAfter($, [
      /^Season_summary$/i,
      /Season_summary/i,
    ]);
    if (!table) return [];
    const headers = tableHeaderLabels($, table);
    if (!headers) return [];
    const roundCol = findColIndex(headers, 'round');
    const eventCol = findColIndex(headers, 'event', 'rally');
    const winnerCol = findColIndex(headers, 'winning driver', 'winner');
    const coDriverCol = findColIndex(headers, 'winning co-driver', 'co-driver');
    const teamCol = findColIndex(headers, 'winning entrant', 'entrant', 'team', 'manufacturer');
    const reportCol = findColIndex(headers, 'report');
    if (roundCol < 0 || eventCol < 0 || winnerCol < 0) return [];

    const out: SeasonSummaryRow[] = [];
    table.find('tr').each((_, tr) => {
      const cells = $(tr).children('th, td');
      if (cells.length <= Math.max(roundCol, eventCol, winnerCol)) return;
      const ths = $(tr).children('th');
      if (ths.length === cells.length) return;

      const roundText = $(cells[roundCol]).text().trim();
      const round = Number(roundText.replace(/[^\d]/g, ''));
      if (!Number.isFinite(round) || round < 1) return;

      const rallyName = firstLinkOrText($, $(cells[eventCol]));
      if (!rallyName) return;

      // Empty winner cell = rally hasn't run. Still surface the row (with
      // null winner + URL) so the caller can decide whether to drop it.
      const winnerCellText = cells.length > winnerCol
        ? $(cells[winnerCol]).text().trim()
        : '';
      const winnerName = winnerCellText
        ? firstLinkOrText($, $(cells[winnerCol]))
        : null;

      const coDriverName =
        coDriverCol >= 0 && cells.length > coDriverCol
          ? firstLinkOrText($, $(cells[coDriverCol]))
          : '';
      const team =
        teamCol >= 0 && cells.length > teamCol
          ? firstLinkOrText($, $(cells[teamCol]))
          : '';

      let perRallyUrl: string | null = null;
      if (reportCol >= 0 && cells.length > reportCol) {
        const link = $(cells[reportCol]).find('a').first();
        const href = link.attr('href');
        if (href && href.startsWith('/wiki/')) {
          perRallyUrl = `${WIKIPEDIA_ORIGIN}${href}`;
        }
      }

      out.push({ round, rallyName, winnerName, coDriverName, team, perRallyUrl });
    });
    return out;
  } catch {
    return [];
  }
}

// ---- Per-rally classification -------------------------------------------

// Pull the WRC Rally1 → Classification table from a per-rally article and
// emit one RaceResultEntry per row. Handles two row shapes:
//
//   - Classified: <th>{class_pos}</th><th>{overall_pos}</th><td>{No}</td>
//                 <td>{Driver}</td><td>{Co}</td><td>{Entrant}</td>
//                 <td>{Car}</td><td>{Time}</td><td>{Diff}</td>
//                 <td>{Event pts}</td><td>{Sunday pts}</td>
//                 <td>{Stage pts}</td><td>{Total}</td>
//   - Retired:    <th colspan="2">Retired SS{n}</th><td>{No}</td>
//                 <td>{Driver}</td><td>{Co}</td><td>{Entrant}</td>
//                 <td>{Car}</td><td colspan="2">{Reason}</td>
//                 <td>{Event}</td><td>{Sunday}</td><td>{Stage}</td>
//                 <td>{Total}</td>
//
// The colspan=2 on the first <th> for retired rows is the discriminator
// (well-formed Wikipedia HTML guarantees this). We surface retired entries
// with status="Retired SS{n}", points=0, and a synthetic position after
// the last classified row so result-table sorting is well-defined.
export function parseRallyClassificationFromHtml(
  html: string,
): RaceResultEntry[] {
  try {
    const $ = cheerio.load(html);
    const table = findFirstTableAfter($, [/^WRC_Rally1$/i, /WRC_Rally1/i]);
    if (!table) return [];

    const classified: RaceResultEntry[] = [];
    const retired: RaceResultEntry[] = [];

    table.find('tr').each((_, tr) => {
      const cells = $(tr).children('th, td');
      if (cells.length < 6) return;
      // Skip the two header rows (all <th> children).
      const ths = $(tr).children('th');
      if (ths.length === cells.length) return;

      const firstCell = $(cells[0]);
      const colspan = firstCell.attr('colspan');
      const firstText = firstCell.text().trim();
      const isRetired =
        firstCell.is('th') && colspan === '2' && /retired|dsq|disqualified/i.test(firstText);

      // Driver / co-driver / entrant / car shift by one cell index depending
      // on whether the position column is single (retired, colspan=2) or
      // double (classified, two <th>).
      const offset = isRetired ? 1 : 2;
      const noCell = cells[offset];
      const driverCell = cells[offset + 1];
      const coDriverCell = cells[offset + 2];
      const entrantCell = cells[offset + 3];
      const _carCell = cells[offset + 4]; // car (unused — driverName carries the brand-neutral identity)
      void _carCell;
      // Total points is always the LAST cell in the row.
      const totalCell = cells[cells.length - 1];

      if (!driverCell || !entrantCell) return;
      const driverName = firstLinkOrText($, $(driverCell));
      if (!driverName) return;
      const team = firstLinkOrText($, $(entrantCell));
      const coDriverName = coDriverCell
        ? firstLinkOrText($, $(coDriverCell))
        : '';

      // Total cell often holds the value in <b>; cheerio.text() captures
      // both wrapped and unwrapped variants.
      const totalText = $(totalCell).text().trim();
      const points = (() => {
        const m = totalText.match(/-?\d+/);
        return m ? Number(m[0]) : 0;
      })();

      // Status text — "Retired SS17" verbatim for retired, "+1:23.4" or
      // "Finished" for classified. We surface the time-difference column
      // for classified rows when present; this maps to RaceResultEntry.time.
      const diffOrTimeCellIdx = isRetired ? offset + 5 : offset + 6;
      const diffText = cells[diffOrTimeCellIdx]
        ? $(cells[diffOrTimeCellIdx]).text().trim()
        : '';

      const carNumberText = noCell ? $(noCell).text().trim() : '';

      if (isRetired) {
        retired.push({
          position: 0, // patched after classified count is known
          driverName,
          driverCode: carNumberText || undefined,
          team,
          status: firstText, // "Retired SS17" etc.
          points,
        });
      } else {
        // The first <th> is OVERALL position (across all classes — Rally1
        // + Rally2 + Rally3 + Junior on the same stages); the second <th>
        // is CLASS position (Rally1-only). Use class position because this
        // table is the Rally1 Classification — a Rally1 driver who hit
        // trouble might finish P42 overall but P8 in class, and fans
        // expect the class number.
        const classPosCell = $(cells[1]);
        const posText = classPosCell.text().trim();
        const position = Number(posText.replace(/[^\d]/g, ''));
        if (!Number.isFinite(position) || position < 1) return;
        classified.push({
          position,
          driverName,
          driverCode: carNumberText || undefined,
          team,
          status: 'Finished',
          time: diffText || undefined,
          points,
        });
        // Co-driver name isn't surfaced separately on the rendered row UI
        // today (the existing ResultsTab schema is driver-only), but we
        // could thread it through driverCode or a future co-driver field.
        // Leaving it parsed here so callers can decide what to do.
        void coDriverName;
      }
    });

    // Assign retired rows synthetic positions after the last classified.
    let nextPos = classified.length + 1;
    for (const r of retired) {
      r.position = nextPos++;
    }

    return [...classified.sort((a, b) => a.position - b.position), ...retired];
  } catch {
    return [];
  }
}

// ---- Legacy: winners-only parser (used as fallback) ---------------------

// Build a single winner RaceResult from a Season summary row. Used when a
// per-rally page fetch fails — better to surface "Round 3, winner: X" than
// to drop the round entirely.
function buildWinnerOnlyRace(
  row: SeasonSummaryRow,
  date: Date,
): RaceResult | null {
  if (!row.winnerName) return null;
  const entry: RaceResultEntry = {
    position: 1,
    driverName: row.coDriverName
      ? `${row.winnerName} / ${row.coDriverName}`
      : row.winnerName,
    team: row.team || 'Unknown',
    status: 'Winner',
    points: 25,
  };
  return {
    round: row.round,
    raceName: row.rallyName,
    date,
    circuit: row.rallyName,
    results: [entry],
  };
}

// ---- Legacy export — winners-only from the season page ------------------

// Kept for backwards compatibility with anything that imports it. Returns
// winners-only entries derived from the Calendar + Season summary tables.
// Production no longer relies on this; fetchWRCSeasonResults below is the
// canonical entry point.
export function parseSeasonResultsFromHtml(
  html: string,
  season: number,
): RaceResult[] {
  const calendar = parseCalendarFromHtml(html, season);
  const summary = parseSeasonSummaryFromHtml(html);
  if (calendar.length === 0 || summary.length === 0) return [];

  const dateByRound = new Map<number, Date>();
  for (const c of calendar) dateByRound.set(c.round, c.date);

  const out: RaceResult[] = [];
  for (const row of summary) {
    const date = dateByRound.get(row.round);
    if (!date) continue;
    const race = buildWinnerOnlyRace(row, date);
    if (race) out.push(race);
  }
  return out.sort((a, b) => a.round - b.round);
}

// ---- Season-page championship breakdown — chart data source ------------

// The season page also carries a "FIA World Rally Championship for Drivers"
// table where every (driver × rally) cell holds an `<span class="sfrac">`
// wrapping the rally position AND the sub-total decomposition
// ("event + Sunday + Power-Stage", e.g. "17+4+5"). Summing the sub-totals
// per cell across rallies yields exactly the standings total — verified
// against all 29 scoring drivers at the 2026-05-22 fixture snapshot.
//
// We use THIS table (not the per-rally articles) as the source for the
// trend chart because the per-rally articles and the championship table
// occasionally disagree by ±3-6 points for marginal drivers (Wikipedia
// editors sometimes recompute one but not the other). The championship
// table reconciles by construction, which is the cross-series invariant.
//
// Returned shape: one synthetic RaceResult per completed round, where
// `results` is the list of drivers who scored that round, ordered by
// position. Each RaceResultEntry carries driverName + points + position;
// fields the chart doesn't need (team, status, time) are left as
// placeholders. Callers should NOT render this in the per-rally accordion;
// use fetchWRCSeasonResults for that.

const RALLY_HEADER_SLUGS = ['MON','SWE','KEN','CRO','ESP','POR','JPN','GRE','EST','FIN','PAR','CHL','ITA','SAU'];

function sumSubTotals(cell: cheerio.Cheerio<Element>, $: cheerio.CheerioAPI): number {
  // Find the innermost <span> that contains "+" — that's the sub-totals
  // leaf (e.g. "17+4+5"). Outer spans wrap position + sub-totals together
  // and would double-count the position digit if read as text.
  let subTotals = '';
  cell.find('span').each((_, s) => {
    const $s = $(s);
    if ($s.find('span').length > 0) return;
    const t = $s.text().trim();
    if (t.includes('+') && !subTotals) subTotals = t;
  });
  if (!subTotals) return 0;
  return subTotals
    .split('+')
    .reduce((acc, n) => acc + (Number(n.trim()) || 0), 0);
}

function readPositionDigit(
  cell: cheerio.Cheerio<Element>,
  $: cheerio.CheerioAPI,
): number | null {
  // Position-leaf: innermost <span> whose text is a bare integer (no "+").
  // The CSS class on the wrapper is .sfrac; the layout puts position in the
  // second display-block child span. Walk leaves to find the integer one.
  let posText = '';
  cell.find('span').each((_, s) => {
    if (posText) return;
    const $s = $(s);
    if ($s.find('span').length > 0) return;
    const t = $s.text().trim();
    if (/^\d+$/.test(t)) posText = t;
  });
  if (!posText) return null;
  const n = Number(posText);
  return Number.isFinite(n) ? n : null;
}

interface RallyHeaderInfo {
  round: number;
  rallyName: string;
}

function parseRallyHeaderColumns(
  $: cheerio.CheerioAPI,
  table: cheerio.Cheerio<Element>,
  calendarByRound: Map<number, CalendarRow>,
): RallyHeaderInfo[] {
  // The header row is the table's first <tr>. Skip Pos + Driver and pull
  // each rally column header. Map header position (1-indexed within the
  // rally columns) to round number using the Calendar.
  const result: RallyHeaderInfo[] = [];
  const headerRow = table.find('tr').first();
  const headers = headerRow.children('th, td').toArray();
  // Header cells layout: [Pos, Driver, MON, SWE, ..., SAU, Points]
  // We want indices 2 .. headers.length - 2.
  for (let i = 2; i < headers.length - 1; i++) {
    const colIdx = i - 2; // 0..13
    const round = colIdx + 1; // rally columns map 1:1 to round numbers
    const cal = calendarByRound.get(round);
    const headerLabel = $(headers[i]).text().trim().slice(0, 3);
    void RALLY_HEADER_SLUGS;
    void headerLabel;
    result.push({
      round,
      rallyName: cal?.rallyName ?? `Round ${round}`,
    });
  }
  return result;
}

export function parseSeasonChartPointsFromHtml(
  html: string,
  season: number,
): RaceResult[] {
  try {
    const $ = cheerio.load(html);
    const table = findFirstTableAfter($, [
      /^FIA_World_Rally_Championship_for_Drivers$/i,
      /World_Rally_Championship_for_Drivers/i,
    ]);
    if (!table) return [];

    const calendar = parseCalendarFromHtml(html, season);
    const calendarByRound = new Map<number, CalendarRow>();
    for (const c of calendar) calendarByRound.set(c.round, c);

    const headerInfos = parseRallyHeaderColumns($, table, calendarByRound);
    if (headerInfos.length === 0) return [];

    // Each non-header row is a driver. Position cell (th) → driver cell (td)
    // → rally cells (td×N) → total (th). Identify rows by: first cell is
    // <th> with a parseable integer position.
    interface DriverRow {
      driverName: string;
      perRound: Map<number, { position: number | null; points: number }>;
    }
    const driverRows: DriverRow[] = [];
    table.find('tr').each((_, tr) => {
      const cells = $(tr).children('th, td');
      if (cells.length < 4) return;
      const posCell = $(cells[0]);
      if (!posCell.is('th')) return;
      const posNum = Number(posCell.text().trim());
      if (!Number.isFinite(posNum) || posNum < 1) return;
      const nameCell = $(cells[1]);
      const driverName = firstLinkOrText($, nameCell);
      if (!driverName) return;

      const perRound = new Map<number, { position: number | null; points: number }>();
      // Rally cells start at index 2 and end at cells.length - 2.
      for (let j = 2; j < cells.length - 1; j++) {
        const colIdx = j - 2;
        const info = headerInfos[colIdx];
        if (!info) continue;
        const cell = $(cells[j]);
        const points = sumSubTotals(cell, $);
        const position = readPositionDigit(cell, $);
        if (points > 0 || position !== null) {
          perRound.set(info.round, { position, points });
        }
      }
      driverRows.push({ driverName, perRound });
    });

    // Build one synthetic RaceResult per round that has at least one
    // scoring driver. Order entries by position; fall back to descending
    // points if positions are missing.
    const races: RaceResult[] = [];
    for (const info of headerInfos) {
      const cal = calendarByRound.get(info.round);
      if (!cal) continue;
      const entries: RaceResultEntry[] = [];
      for (const d of driverRows) {
        const cell = d.perRound.get(info.round);
        if (!cell) continue;
        if (cell.points === 0 && cell.position === null) continue;
        entries.push({
          position: cell.position ?? 99,
          driverName: d.driverName,
          team: '',
          status: cell.points > 0 ? 'Finished' : 'Did not score',
          points: cell.points,
        });
      }
      if (entries.length === 0) continue;
      entries.sort((a, b) => a.position - b.position);
      races.push({
        round: info.round,
        raceName: cal.rallyName,
        date: cal.date,
        circuit: cal.rallyName,
        results: entries,
      });
    }
    return races;
  } catch {
    return [];
  }
}

export async function fetchWRCSeasonChartPoints(
  season = 2026,
): Promise<RaceResult[]> {
  const seasonHtml = await fetchHtml(WIKIPEDIA_SEASON_URL);
  if (!seasonHtml) return [];
  return parseSeasonChartPointsFromHtml(seasonHtml, season);
}

// ---- Orchestration ------------------------------------------------------

export async function fetchWRCSeasonResults(
  season = 2026,
): Promise<RaceResult[]> {
  const seasonHtml = await fetchHtml(WIKIPEDIA_SEASON_URL);
  if (!seasonHtml) return [];

  const calendar = parseCalendarFromHtml(seasonHtml, season);
  const summary = parseSeasonSummaryFromHtml(seasonHtml);
  if (calendar.length === 0 || summary.length === 0) return [];

  const dateByRound = new Map<number, Date>();
  for (const c of calendar) dateByRound.set(c.round, c.date);

  // Fan-out per-rally fetches for completed rounds only.
  const completed = summary.filter(
    r => r.winnerName !== null && r.perRallyUrl !== null,
  );

  const races = await Promise.all(
    completed.map(async row => {
      const date = dateByRound.get(row.round);
      if (!date) return null;

      // Per-rally page may 404 (article not yet written), be unreachable,
      // or have unexpected structure. Each failure mode degrades to a
      // winner-only row rather than dropping the round.
      const rallyHtml = row.perRallyUrl
        ? await fetchHtml(row.perRallyUrl)
        : null;
      if (rallyHtml) {
        const entries = parseRallyClassificationFromHtml(rallyHtml);
        if (entries.length > 0) {
          return {
            round: row.round,
            raceName: row.rallyName,
            date,
            circuit: row.rallyName,
            results: entries,
          } satisfies RaceResult;
        }
      }
      return buildWinnerOnlyRace(row, date);
    }),
  );

  return races
    .filter((r): r is RaceResult => r !== null)
    .sort((a, b) => a.round - b.round);
}
