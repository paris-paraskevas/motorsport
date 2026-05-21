import * as cheerio from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import type { RaceResult, RaceResultEntry } from '@/lib/types';

export type { RaceResult, RaceResultEntry };

// Two-stage scrape:
//   1) Fetch the season article. Parse the Race-results table to discover (a)
//      which rounds have happened, (b) the year-specific per-event Wikipedia
//      URL for each (from the "Report" column href, which uses rowspan for
//      doubleheaders so two consecutive rounds share one URL), and (c) the
//      winning driver + team as a fallback when the per-event scrape fails.
//   2) For each unique per-event URL, fetch it. Each article contains a full
//      classification table per race (1 for singleheaders, 2 for
//      doubleheaders — section structure: "Race one" / "Race two" siblings,
//      each with its own wikitable with Pos./No./Driver/Team/Laps/
//      Time-Retired/Grid/Points columns).
//
// Why both: the season-page table only carries the winner. Full classification
// + DNF rows + per-position points are only on the per-event article. F1-style
// classification is what we need for the season-trend chart to be meaningful
// and for the per-race accordion to expand into useful detail.
//
// Failure mode at each level is to fall back, not to drop the round:
//   - Per-event fetch fails / can't find a classification table → emit the
//     winners-only RaceResultEntry from the season-page row. Same shape as
//     the 0.11.0-0.11.5 parser; ResultsTab's RoundRow already handles it.
//   - Season-page fetch fails entirely → return [] → ResultsTab renders
//     "temporarily unavailable" empty state.
const SEASON_PAGE = '2025%E2%80%9326_Formula_E_World_Championship';
const WIKI_ORIGIN = 'https://en.wikipedia.org';
const WIKI_BASE = `${WIKI_ORIGIN}/wiki`;

// FE's Season 12 calendar has 17 rounds. <3 parsed = wrong table → fail closed.
const MIN_ROUNDS = 3;
// Winner points + the per-position scoring grid for FE (used to seed the
// winners-only fallback when per-event fetch fails — same value the 0.11.0+
// parser shipped).
const WINNER_POINTS = 25;

// FIA Formula E per-position scoring (top 10). Used by the motorsportweek
// fallback layer below — the motorsportweek per-event tables omit the points
// column, so we derive points from finishing position. Pole (+3) and Fastest
// Lap (+1) bonuses are NOT modelled here; that's a known ±1-3pt gap vs the
// official standings, documented in CHANGELOG. The cross-cutting chart-vs-
// standings invariant says we don't ship a trend chart against this data —
// that remains gated on a separate bonuses curation PR.
const FE_POINTS_BY_POSITION = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] as const;

// motorsportweek.com publishes the per-event Position/Drivers/Team/Gap table
// as plain WordPress `<figure class="wp-block-table"><table>` HTML, fetchable
// with a default UA and no auth. Used as the fallback source for any FE round
// whose Wikipedia per-event article is a season-summary stub (Berlin R7/R8,
// Monaco R9/R10 at the 2026-05-21 checkpoint). URL template per the Phase 1
// brief: /YYYY/MM/DD/formula-e-YYYY-{city-slug}-e-prix-race-{N}-results/
const MW_BASE = 'https://www.motorsportweek.com';

// motorsportweek uses brand-name short-forms in the Team column (e.g.
// "Citroen", "Kiro", "Lola"). Normalise to the canonical FE entry names used
// across the rest of Paddock. Identity entries are explicit so the lookup
// always succeeds; a missing key falls through to the raw string.
const MW_TEAM_ALIASES: Record<string, string> = {
  'Porsche': 'Porsche Team',
  'Jaguar': 'Jaguar Racing',
  'Nissan': 'Nissan e.Dams',
  'Mahindra': 'Mahindra Racing',
  'Andretti': 'Andretti Formula E',
  'Citroen': 'DS Penske',
  'Citroën': 'DS Penske',
  'DS Penske': 'DS Penske',
  'Envision': 'Envision Racing',
  'Kiro': 'Cupra Kiro',
  'Lola': 'LOLA YAMAHA ABT',
};

function canonicaliseMwTeam(name: string): string {
  return MW_TEAM_ALIASES[name] ?? name;
}

// Browser User-Agent — Wikipedia blocks default Node fetch UA on some
// endpoints. Same string used by lib/standings/formula-e.ts.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

// Known-wrong team-name aliases on Wikipedia. The 5-source rule (see
// feedback-paddock-search-for-missing-data) verified DS Penske is Stellantis's
// FE team — "Citroën Racing" appears on the season-page winning-team column
// AND in some per-event classification tables (e.g. 2026 Mexico City: Cassidy
// listed as Citroën Racing, but Cassidy drives for DS Penske per fiaformulae.com).
// Wikipedia's FE community is inconsistent — some articles spell out brand,
// some entrant. Applying a single canonical mapping in code (not a curated
// JSON) keeps the data right without an ops loop for every edit war.
//
// Sources (per 5-source verification, 2026-05-20):
//   - fiaformulae.com Cassidy team page lists "DS Penske"
//   - motorsportweek.com 2026 Mexico City race report lists "DS Penske"
//   - the-race.com 2025-26 grid preview lists "DS Penske"
//   - autosport.com FE driver lineup lists "DS Penske"
//   - andrettiglobal.com / dspenske.com (team-of-record) "DS Penske"
const TEAM_ALIASES: Record<string, string> = {
  'Citroën Racing': 'DS Penske',
  Citroën: 'DS Penske',
  Citroen: 'DS Penske',
  'Citroen Racing': 'DS Penske',
};

function canonicaliseTeam(name: string): string {
  return TEAM_ALIASES[name] ?? name;
}

const BRACKET_ANNOTATION_RE = /\[[^\]]{1,15}\]/g;

function cellText($: cheerio.CheerioAPI, el: AnyNode): string {
  // Strip <style>, footnote markers <sup>, .legend swatches. Same defensive
  // cleanup as lib/standings/formula-e.ts; without it cellText() pulls inline
  // CSS rules and footnote chrome into the field.
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
  if (opts.exact?.some(e => lower === e)) return true;
  if (opts.contains?.some(c => lower.includes(c))) return true;
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

function getColspan($: cheerio.CheerioAPI, el: Element): number {
  const raw = $(el).attr('colspan');
  if (!raw) return 1;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function logicalToDataIdx(colspans: number[], logicalIdx: number): number {
  let dataIdx = 0;
  for (let i = 0; i < logicalIdx; i++) {
    dataIdx += colspans[i] ?? 1;
  }
  return dataIdx;
}

function parseRound(raw: string): number | null {
  const m = raw.match(/(\d+)/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 1 || n > 99) return null;
  return n;
}

// Wikipedia formats dates as "6 December 2025", "10 January 2026", etc.
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

// ---------------------------------------------------------------------------
// Season-page parsing: discover per-event URLs + winners-only fallback data.
// ---------------------------------------------------------------------------

interface SeasonRow {
  round: number;
  ePrix: string;
  date: Date;
  winningDriver: string;
  winningTeam: string;
  // Year-specific per-event article URL (e.g. /wiki/2025_S%C3%A3o_Paulo_ePrix).
  // null when Wikipedia hasn't yet linked the Report cell — that round still
  // emits a winners-only fallback entry.
  eventUrl: string | null;
}

interface RaceColumnMap {
  round: number;
  ePrix: number;
  winningDriver: number;
  winningTeam: number;
  // Report column carries the per-event hyperlink. Optional because Wikipedia
  // occasionally omits the column on very old archives.
  report?: number;
}

function detectRaceColumns(headerCells: string[]): RaceColumnMap | null {
  const round = findHeaderIndex(headerCells, {
    exact: ['round', 'rnd', 'rd', 'rd.', '#'],
  });
  const ePrix = findHeaderIndex(headerCells, {
    exact: ['e-prix', 'eprix', 'race', 'grand prix'],
    contains: ['e-prix', 'eprix'],
  });
  const winningDriver = findHeaderIndex(headerCells, {
    exact: ['winning driver', 'winner'],
    contains: ['winning driver', 'winner'],
  });
  const winningTeam = findHeaderIndex(headerCells, {
    exact: ['winning team', 'winning constructor'],
    contains: ['winning team', 'winning constructor', 'winning manufacturer'],
  });
  const report = findHeaderIndex(headerCells, {
    exact: ['report'],
    contains: ['report'],
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
    report: report === -1 ? undefined : report,
  };
}

interface SeasonRaceTable {
  table: Element;
  columns: RaceColumnMap;
  rows: Element[];
  colspans: number[];
}

function findSeasonRaceTable(
  $: cheerio.CheerioAPI,
  tables: Element[],
): SeasonRaceTable | null {
  for (const table of tables) {
    const allRows = $(table)
      .find('> tbody > tr, > tr')
      .toArray() as Element[];
    if (allRows.length < 2) continue;
    for (let i = 0; i < Math.min(3, allRows.length); i++) {
      const cells = rowCells($, allRows[i]);
      if (cells.length === 0) continue;
      const headers = cells.map(c => cellText($, c));
      const columns = detectRaceColumns(headers);
      if (!columns) continue;
      const dataRows = allRows.slice(i + 1);
      if (dataRows.length < MIN_ROUNDS) continue;
      const colspans = cells.map(c => getColspan($, c));
      return { table, columns, rows: dataRows, colspans };
    }
  }
  return null;
}

// Calendar table: maps round → date when the Race-results table has no Date
// column. 0.11.3 behaviour preserved.
function buildRoundToDateMap(
  $: cheerio.CheerioAPI,
  tables: Element[],
): Map<number, Date> {
  const map = new Map<number, Date>();
  for (const table of tables) {
    const allRows = $(table).find('> tbody > tr, > tr').toArray() as Element[];
    if (allRows.length < 2) continue;
    for (let i = 0; i < Math.min(3, allRows.length); i++) {
      const cells = $(allRows[i]).find('> th, > td').toArray() as Element[];
      if (cells.length === 0) continue;
      const headers = cells.map(c => cellText($, c));
      const roundIdx = findHeaderIndex(headers, {
        exact: ['round', 'rnd', 'rd', 'rd.', '#'],
      });
      const dateIdx = findHeaderIndex(headers, {
        exact: ['date'],
        contains: ['date'],
      });
      if (roundIdx === -1 || dateIdx === -1 || roundIdx === dateIdx) continue;
      const colspans = cells.map(c => getColspan($, c));
      const roundDataIdx = logicalToDataIdx(colspans, roundIdx);
      const dateDataIdx = logicalToDataIdx(colspans, dateIdx);
      for (const row of allRows.slice(i + 1)) {
        const rowCellsArr = $(row).find('> th, > td').toArray() as Element[];
        const roundRaw = rowText($, row, roundDataIdx);
        const round = parseRound(roundRaw);
        if (round == null) continue;
        // Doubleheader children on FE's Calendar table look like
        // `<tr><th>5</th><td>14 February 2026</td></tr>` because the E-Prix /
        // Country / Circuit cells above carry rowspan="2" and are physically
        // absent from this row. Reading at dataIdx=4 returns '' so date parses
        // to null and the round inherits the season-placeholder Jan 1 — that's
        // what put R5 Jeddah, R8 Berlin, R10 Monaco all at "1 Jan 2026" on
        // production. Fallback: scan ALL cells right-to-left for the first
        // parseable date. The date is canonically the last meaningful cell on
        // both parent rows (full-width, date at end) and child rows (2-cell,
        // date at index 1). Try the expected slot first to preserve the
        // happy path.
        let dateRaw = rowText($, row, dateDataIdx);
        let date = parseDate(dateRaw);
        if (!date) {
          for (let k = rowCellsArr.length - 1; k >= 0; k--) {
            const candidate = cellText($, rowCellsArr[k]);
            const parsed = parseDate(candidate);
            if (parsed) {
              date = parsed;
              dateRaw = candidate;
              break;
            }
          }
        }
        if (!date) continue;
        if (!map.has(round)) map.set(round, date);
      }
      if (map.size > 0) return map;
    }
  }
  return map;
}

function parseSeasonRows(html: string): SeasonRow[] {
  let $: cheerio.CheerioAPI;
  try {
    $ = cheerio.load(html);
  } catch {
    return [];
  }
  const tables = $('table').toArray() as Element[];
  const found = findSeasonRaceTable($, tables);
  if (!found) return [];

  const roundToDate = buildRoundToDateMap($, tables);
  const seasonEndYearMatch = SEASON_PAGE.match(/%E2%80%93(\d{2})/);
  const placeholderDate = seasonEndYearMatch
    ? new Date(`20${seasonEndYearMatch[1]}-01-01T00:00:00Z`)
    : new Date(`${new Date().getFullYear()}-01-01T00:00:00Z`);

  const { columns, rows, colspans } = found;
  const out: SeasonRow[] = [];

  const roundDataIdx = logicalToDataIdx(colspans, columns.round);
  const ePrixDataIdx = logicalToDataIdx(colspans, columns.ePrix);
  const driverDataIdx = logicalToDataIdx(colspans, columns.winningDriver);
  const teamDataIdx = logicalToDataIdx(colspans, columns.winningTeam);
  const reportDataIdx =
    columns.report != null ? logicalToDataIdx(colspans, columns.report) : null;

  // Doubleheader rowspan tracking. Wikipedia rowspans the E-Prix and Report
  // cells across the two race rows of a doubleheader weekend. Cheerio's
  // ".find('> td, > th')" returns ONLY the cells physically present in <tr>;
  // the second-race row of a doubleheader has fewer cells. Once the parent
  // row is read, we cache its E-Prix label + Report URL keyed by remaining
  // rowspan count and apply them to the rowspan-children that follow.
  let inheritedEPrix: { label: string; url: string | null; remaining: number } | null = null;

  // Track last seen non-empty E-Prix and URL for fallback. Defensive — the
  // rowspan model above is the authoritative path; this is a backstop in case
  // the rowspan attribute is missing from a row that needs to inherit anyway.
  let lastEPrixLabel = '';
  let lastEventUrl: string | null = null;

  for (const row of rows) {
    const cells = rowCells($, row);
    const roundRaw = rowText($, row, roundDataIdx);
    const round = parseRound(roundRaw);
    if (round == null) continue;

    // Decide if this row is the parent of a rowspan block (cells.length is
    // the "full" header colspan sum) or a rowspan child (fewer cells). The
    // expected cell count when ALL cells are physically present equals the
    // sum of header colspans.
    const expectedFull = colspans.reduce((a, b) => a + b, 0);

    let ePrixLabel: string;
    let eventUrl: string | null;

    if (cells.length >= expectedFull) {
      // Parent row — has its own E-Prix and Report cells. Read both, then
      // determine if the row is rowspanned to inherit-into.
      ePrixLabel = rowText($, row, ePrixDataIdx);
      const ePrixCell = cells[ePrixDataIdx];
      const reportCell = reportDataIdx != null ? cells[reportDataIdx] : null;
      const reportRowspan = reportCell ? parseInt($(reportCell).attr('rowspan') || '1', 10) : 1;
      const ePrixRowspan = ePrixCell ? parseInt($(ePrixCell).attr('rowspan') || '1', 10) : 1;
      const inheritCount = Math.max(reportRowspan, ePrixRowspan) - 1;

      eventUrl = reportCell ? extractEventUrl($, reportCell) : null;

      if (inheritCount > 0) {
        inheritedEPrix = {
          label: ePrixLabel,
          url: eventUrl,
          remaining: inheritCount,
        };
      } else {
        inheritedEPrix = null;
      }
      lastEPrixLabel = ePrixLabel;
      lastEventUrl = eventUrl;
    } else if (inheritedEPrix && inheritedEPrix.remaining > 0) {
      // Rowspan child — inherit. Round / driver / team are still in this row
      // but offset because the E-Prix / Report cells are absent. The simplest
      // model: parse driver/team from the row directly (their data-indices
      // were the same as parent because they aren't rowspanned), but the cell
      // count is short by one or two cells, so the data index for driver/team
      // SHIFTS depending on the parent's E-Prix and Report columns being
      // physically present or not. Recompute by header columns: in the child
      // row, the missing logical columns are the rowspanned ones. We assume
      // the child row's cell order matches the header order MINUS the
      // rowspanned cells (E-Prix and possibly Report). So the data index of
      // "winning driver" in a child row = original logical index minus the
      // number of rowspanned columns positioned BEFORE it.
      ePrixLabel = inheritedEPrix.label;
      eventUrl = inheritedEPrix.url;
      inheritedEPrix.remaining -= 1;
      if (inheritedEPrix.remaining === 0) {
        inheritedEPrix = null;
      }
    } else {
      // Best-effort fallback when rowspan tracking lost sync.
      ePrixLabel = lastEPrixLabel;
      eventUrl = lastEventUrl;
    }

    // In the rowspan-child case the driver/team indices SHIFT — the
    // physically-present cells are: round, [no E-Prix], [pole/fastest/winners
    // ... no Report]. We compute the shift based on logical positions of the
    // rowspanned columns relative to driver/team.
    let driverIdx = driverDataIdx;
    let teamIdx = teamDataIdx;
    if (cells.length < expectedFull) {
      const ePrixLogicalDataIdx = ePrixDataIdx;
      const reportLogicalDataIdx = reportDataIdx;
      // Each rowspanned-and-absent logical cell BEFORE driver/team shrinks
      // the index by its colspan (1 in FE's case).
      let shift = 0;
      if (ePrixLogicalDataIdx < driverDataIdx) shift += 1;
      if (reportLogicalDataIdx != null && reportLogicalDataIdx < driverDataIdx)
        shift += 1;
      driverIdx = driverDataIdx - shift;

      shift = 0;
      if (ePrixLogicalDataIdx < teamDataIdx) shift += 1;
      if (reportLogicalDataIdx != null && reportLogicalDataIdx < teamDataIdx)
        shift += 1;
      teamIdx = teamDataIdx - shift;
    }

    const driverRaw = rowText($, row, driverIdx);
    const teamRaw = rowText($, row, teamIdx);

    if (!ePrixLabel || !driverRaw || !teamRaw) continue;
    if (
      driverRaw === '—' || driverRaw === '–' || driverRaw === '-' ||
      /^tb[adc]$/i.test(driverRaw) ||
      teamRaw === '—' || teamRaw === '–' || teamRaw === '-' ||
      /^tb[adc]$/i.test(teamRaw)
    ) {
      continue;
    }

    const driverName = driverRaw
      .replace(/\([^)]{0,80}\)/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const team = canonicaliseTeam(
      teamRaw.replace(/\([^)]{0,80}\)/g, '').replace(/\s+/g, ' ').trim(),
    );
    if (!driverName || !team) continue;

    // Date resolution: Race-results table has no Date column on FE, so use
    // the Calendar-table-derived map. Each round in a doubleheader has its
    // own row in the Calendar table → its own date.
    const date = roundToDate.get(round) ?? placeholderDate;

    const raceName = ePrixLabel
      .replace(/\([^)]{0,80}\)/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    out.push({
      round,
      ePrix: raceName.toLowerCase().endsWith('eprix') ||
             raceName.toLowerCase().endsWith('e-prix') ||
             /eprix$/i.test(raceName.replace(/\s+/g, ''))
        ? raceName
        : `${raceName} ePrix`,
      date,
      winningDriver: driverName,
      winningTeam: team,
      eventUrl,
    });
  }

  return out.sort((a, b) => a.round - b.round);
}

function extractEventUrl(
  $: cheerio.CheerioAPI,
  cell: Element,
): string | null {
  const anchor = $(cell).find('a[href]').first();
  if (anchor.length === 0) return null;
  const href = anchor.attr('href');
  if (!href) return null;
  // The Report column href is always a relative path (/wiki/...). Reject any
  // external links defensively.
  if (href.startsWith('http')) return href;
  if (href.startsWith('/wiki/')) return `${WIKI_ORIGIN}${href}`;
  return null;
}

// ---------------------------------------------------------------------------
// Per-event article parsing: full race classification per race.
// ---------------------------------------------------------------------------

interface ClassificationColumnMap {
  pos: number;
  driver: number;
  team: number;
  status: number;  // "Time/Retired" column
  points: number;
  number?: number; // Optional "No." (car number) column
  laps?: number;
  grid?: number;
}

function detectClassificationColumns(
  headerCells: string[],
): ClassificationColumnMap | null {
  const pos = findHeaderIndex(headerCells, {
    exact: ['pos', 'pos.', 'position'],
  });
  const driver = findHeaderIndex(headerCells, {
    exact: ['driver'],
  });
  const team = findHeaderIndex(headerCells, {
    exact: ['team', 'constructor', 'entrant'],
  });
  const status = findHeaderIndex(headerCells, {
    exact: ['time/retired', 'time / retired'],
    contains: ['time/retired', 'time / retired'],
  });
  const points = findHeaderIndex(headerCells, {
    exact: ['pts', 'points'],
  });
  const number = findHeaderIndex(headerCells, { exact: ['no', 'no.'] });
  const laps = findHeaderIndex(headerCells, { exact: ['laps'] });
  const grid = findHeaderIndex(headerCells, { exact: ['grid'] });

  if (pos === -1 || driver === -1 || team === -1 || status === -1 || points === -1) {
    return null;
  }
  // All five must be distinct.
  const required = [pos, driver, team, status, points];
  for (let i = 0; i < required.length; i++) {
    for (let j = i + 1; j < required.length; j++) {
      if (required[i] === required[j]) return null;
    }
  }
  return {
    pos,
    driver,
    team,
    status,
    points,
    number: number === -1 ? undefined : number,
    laps: laps === -1 ? undefined : laps,
    grid: grid === -1 ? undefined : grid,
  };
}

// Position cell can be a number ("1", "12") or a string label ("DNF", "DSQ",
// "NC", "Ret"). We carry the literal label downstream; ResultsTab's RoundRow
// displays it in the position column as-is.
interface ParsedPos {
  position: number;
  // Status label when the position is non-numeric — used to surface "DNF" /
  // "DSQ" / etc. in the status field for the row.
  label?: string;
}

function parseClassificationPosition(raw: string): ParsedPos | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const numMatch = trimmed.match(/^(\d+)/);
  if (numMatch) {
    const n = Number(numMatch[1]);
    if (Number.isFinite(n) && n >= 1 && n <= 99) return { position: n };
    return null;
  }
  // Non-numeric labels: DNF / DSQ / DNS / DNQ / NC / Ret / etc. Lower-case
  // compare so 0.11.4-style "Dnf" still matches.
  const upper = trimmed.toUpperCase();
  if (/^(DNF|DSQ|DNS|DNQ|NC|RET|EX)$/.test(upper)) {
    return { position: 100, label: upper };
  }
  return null;
}

// Points cell can be "25", "18+12" (18 race points + 1 footnote ref, NOT
// fastest-lap bonus — Wikipedia inlines footnote markers <sup>[1]</sup> which
// cellText strips, but the bracket annotation regex doesn't catch the bare
// "+1" / "+2" superscript that follows). Strip trailing footnote-number
// patterns ("+12", "+3", "+25" — typically single-digit) and keep only the
// leading race-points integer.
//
// Specifically the source HTML for a Fastest-Lap bonus row looks like
// "18<sup>[a]</sup>" — cellText strips the <sup>, leaving "18". But for the
// Wikipedia "real" pattern "12+3" (P4 + FL bonus + footnote), what comes out
// of cellText is something like "12+31" because the trailing "1" is a
// footnote ref number whose surrounding [] gets stripped by the bracket
// regex. We can't distinguish "12+31" (P4 12pts + FL bonus 3pts + footnote 1)
// from "12+31" (P4 12pts + 31pts somehow). So we conservatively keep the FIRST
// number on the LEFT of "+" (race points), and add at most ONE digit after
// "+" only if it's a known FE FL bonus value (1, 2, 3, 4) — Wikipedia
// expresses FE Fastest Lap bonus as a literal 1pt (was 1; 2026 unchanged).
//
// Conservative approach: take the leading integer only. Match it as race
// points. Any FL bonus the upstream attempted to encode will be ignored.
// This is the safe fail-mode — better to under-attribute by 1pt than to
// over-attribute by a stray footnote digit.
function parseClassificationPoints(raw: string): number {
  if (!raw) return 0;
  const m = raw.match(/^(\d+)/);
  if (!m) return 0;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 0 || n > 100) return 0;
  return n;
}

interface ClassificationTable {
  columns: ClassificationColumnMap;
  rows: Element[];
}

function findClassificationTables(
  $: cheerio.CheerioAPI,
): ClassificationTable[] {
  const tables = $('table.wikitable').toArray() as Element[];
  const out: ClassificationTable[] = [];
  for (const table of tables) {
    const allRows = $(table).find('> tbody > tr, > tr').toArray() as Element[];
    if (allRows.length < 5) continue;
    // Try first 2 rows as header (most articles use row 0).
    for (let i = 0; i < Math.min(2, allRows.length); i++) {
      const cells = rowCells($, allRows[i]);
      if (cells.length === 0) continue;
      const headers = cells.map(c => cellText($, c));
      const columns = detectClassificationColumns(headers);
      if (!columns) continue;
      const dataRows = allRows.slice(i + 1);
      // Must have at least 10 rows of data — even partially-classified FE
      // races have ~18+ rows. <10 typically means we matched a footnote
      // table that happens to share column names.
      if (dataRows.length < 10) continue;
      out.push({ columns, rows: dataRows });
      break;
    }
  }
  return out;
}

function parseClassification(
  $: cheerio.CheerioAPI,
  table: ClassificationTable,
): RaceResultEntry[] {
  const { columns, rows } = table;
  // Header is logical — the per-event classification table has no colspans
  // (verified live HTML pull, all cells colspan="1"). So dataIdx === logical.
  // But the trailing "Source: [n]" row has colspan="8" on a single <th>; the
  // row-cell-count check below filters it.
  const entries: RaceResultEntry[] = [];
  // Use a generous required-cell-count: must have at least max(needed) + 1
  // cells. Drives skip the Source footer row (1 cell, colspan=8).
  const minRequired = 1 + Math.max(
    columns.pos,
    columns.driver,
    columns.team,
    columns.status,
    columns.points,
  );
  for (const row of rows) {
    const cells = rowCells($, row);
    if (cells.length < minRequired) continue;
    const posRaw = rowText($, row, columns.pos);
    const driverRaw = rowText($, row, columns.driver);
    const teamRaw = rowText($, row, columns.team);
    const statusRaw = rowText($, row, columns.status);
    const pointsRaw = rowText($, row, columns.points);

    const parsedPos = parseClassificationPosition(posRaw);
    if (!parsedPos) continue;
    if (!driverRaw || !teamRaw) continue;

    const driverName = driverRaw.replace(/\s+/g, ' ').trim();
    const team = canonicaliseTeam(teamRaw.replace(/\s+/g, ' ').trim());
    if (!driverName || !team) continue;

    const points = parseClassificationPoints(pointsRaw);
    // "Time/Retired" — for finishers this is something like "59:23.013" or
    // "+1.876"; for DNFs it's "Collision damage" / "Spun out" / etc. Either
    // is useful and goes into either the time field or the status field
    // depending on whether the position was numeric (finisher) or label
    // (DNF). Keep both in the entry — RaceResultEntry has both fields.
    const isFinisher = !parsedPos.label;
    const status = isFinisher
      ? 'Finished'
      : parsedPos.label === 'DNF'
        ? statusRaw || 'Retired'
        : parsedPos.label || statusRaw || 'Retired';
    const time = isFinisher ? statusRaw || undefined : undefined;

    entries.push({
      position: parsedPos.position,
      driverName,
      team,
      status,
      time,
      points,
    });
  }
  // Sort by position so DNFs (position=100) drop to the bottom.
  return entries.sort((a, b) => a.position - b.position);
}

// ---------------------------------------------------------------------------
// motorsportweek.com fallback for Wikipedia stub rounds.
// ---------------------------------------------------------------------------

// Build the motorsportweek.com URL for a given race day + E-Prix name. The
// city slug is derived from the E-Prix name (strip " ePrix" suffix, ASCII-
// fold diacritics, lowercase, hyphenate spaces).
//
// raceN selects between the doubleheader's two race posts (1 or 2). Caller
// passes 1 for singleheaders and the first race of a doubleheader, 2 for the
// second race. The date passed in is the race day for that specific round
// (the per-round Calendar-table date already returns the right Saturday vs
// Sunday for doubleheaders — see buildRoundToDateMap above).
function buildMwUrl(date: Date, ePrixName: string, raceN: 1 | 2): string | null {
  if (!date || Number.isNaN(date.getTime())) return null;
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');

  const slug = ePrixName
    // Drop trailing " ePrix" / "e-prix" — case-insensitive.
    .replace(/\s+e[-\s]?prix\s*$/i, '')
    // Fold common diacritics. Cyrillic / CJK aren't in scope (no FE round
    // with those venue names).
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    // Replace any whitespace run (and stray ASCII punctuation) with a single
    // hyphen. Defensive: motorsportweek slugs are kebab-case lowercase.
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (!slug) return null;

  return `${MW_BASE}/${yyyy}/${mm}/${dd}/formula-e-${yyyy}-${slug}-e-prix-race-${raceN}-results/`;
}

// Parse a motorsportweek per-event results post. The page is a WordPress
// article with a single `<figure class="wp-block-table"><table class="has-
// fixed-layout">` carrying the Position / Drivers / Team / Gap columns. The
// table includes lapped runners ("1 Lap" in the Gap column) and excludes
// DNFs — those are documented in prose only. We surface whatever the table
// holds; DNF rows on rounds with mechanical DNFs will need a results-
// overrides curation pass to backfill.
export function parseMotorsportweekClassification(html: string): RaceResultEntry[] {
  let $: cheerio.CheerioAPI;
  try {
    $ = cheerio.load(html);
  } catch {
    return [];
  }
  const table = $('figure.wp-block-table table').first();
  if (table.length === 0) return [];
  const rows = table.find('tbody tr').toArray() as Element[];
  if (rows.length < 5) return [];

  const entries: RaceResultEntry[] = [];
  for (const tr of rows) {
    const cells = $(tr).find('td').toArray() as Element[];
    if (cells.length < 4) continue;

    const posRaw = $(cells[0]).text().replace(/\s+/g, ' ').trim();
    const driverRaw = $(cells[1]).text().replace(/\s+/g, ' ').trim();
    const teamRaw = $(cells[2]).text().replace(/\s+/g, ' ').trim();
    const gapRaw = $(cells[3]).text().replace(/\s+/g, ' ').trim();
    if (!driverRaw || !teamRaw) continue;

    const posNum = parseInt(posRaw, 10);
    if (!Number.isFinite(posNum) || posNum < 1) continue;

    const team = canonicaliseMwTeam(teamRaw);
    const points =
      posNum >= 1 && posNum <= FE_POINTS_BY_POSITION.length
        ? FE_POINTS_BY_POSITION[posNum - 1]
        : 0;

    entries.push({
      position: posNum,
      driverName: driverRaw,
      team,
      status: 'Finished',
      // motorsportweek's "Gap" column is the leader's race time for P1
      // (empty in some posts), `+0.798` style float for others, and `1 Lap`
      // for lapped runners. Preserve as-is.
      time: gapRaw || undefined,
      points,
    });
  }
  return entries.sort((a, b) => a.position - b.position);
}

async function fetchMwClassification(
  date: Date,
  ePrixName: string,
  raceN: 1 | 2,
): Promise<RaceResultEntry[] | null> {
  const url = buildMwUrl(date, ePrixName, raceN);
  if (!url) return null;
  const html = await fetchHtml(url);
  if (!html) return null;
  const entries = parseMotorsportweekClassification(html);
  return entries.length > 0 ? entries : null;
}

// ---------------------------------------------------------------------------
// Per-event fetch.
// ---------------------------------------------------------------------------

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html',
      },
      next: { revalidate: 3600 },
    } as RequestInit);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function winnersOnlyEntry(row: SeasonRow): RaceResultEntry {
  return {
    position: 1,
    driverName: row.winningDriver,
    team: row.winningTeam,
    status: 'Race winner',
    points: WINNER_POINTS,
  };
}

// Fetch one per-event article and split it into 1 or 2 classifications based
// on the table count. Returns RaceResult[] indexed by the doubleheader sub-
// race position (0 = first, 1 = second).
async function fetchEventClassifications(
  url: string,
): Promise<RaceResultEntry[][]> {
  const html = await fetchHtml(url);
  if (!html) return [];
  let $: cheerio.CheerioAPI;
  try {
    $ = cheerio.load(html);
  } catch {
    return [];
  }
  const tables = findClassificationTables($);
  if (tables.length === 0) return [];
  return tables.map(t => parseClassification($, t));
}

// ---------------------------------------------------------------------------
// Top-level entry point.
// ---------------------------------------------------------------------------

export async function fetchFormulaESeasonResults(): Promise<RaceResult[]> {
  const seasonHtml = await fetchHtml(`${WIKI_BASE}/${SEASON_PAGE}`);
  if (!seasonHtml) return [];
  const seasonRows = parseSeasonRows(seasonHtml);
  if (seasonRows.length < MIN_ROUNDS) return [];

  // Group rows by their per-event URL. Doubleheaders: two consecutive rounds
  // share a URL, and the article has two classification tables (Race one,
  // Race two). The first table maps to the parent (lower-round) row, the
  // second to the rowspan-child (higher-round) row.
  //
  // Singleheaders: each round has its own URL and the article has one table.
  //
  // Rows where eventUrl is null fall back to a winners-only entry.
  const byUrl = new Map<string, SeasonRow[]>();
  for (const row of seasonRows) {
    if (!row.eventUrl) continue;
    const bucket = byUrl.get(row.eventUrl) ?? [];
    bucket.push(row);
    byUrl.set(row.eventUrl, bucket);
  }
  for (const bucket of byUrl.values()) {
    bucket.sort((a, b) => a.round - b.round);
  }

  // Fetch all unique URLs in parallel; per-event fetch failure → winners-only
  // fallback for each row in that bucket.
  const urls = [...byUrl.keys()];
  const fetched = await Promise.all(urls.map(u => fetchEventClassifications(u)));

  // Build a per-row results map.
  const resultsByRound = new Map<number, RaceResultEntry[]>();

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const bucket = byUrl.get(url)!;
    const classifications = fetched[i];

    if (classifications.length === 0) {
      // Article missing or unparseable → winners-only fallback per round.
      for (const row of bucket) {
        resultsByRound.set(row.round, [winnersOnlyEntry(row)]);
      }
      continue;
    }
    if (classifications.length === 1 && bucket.length === 1) {
      // Single-race article + single round.
      resultsByRound.set(bucket[0].round, classifications[0]);
      continue;
    }
    if (classifications.length >= 2 && bucket.length === 2) {
      // Doubleheader article — first classification → lower round, second →
      // higher round. Matches the H3:Race-one / H3:Race-two structure
      // confirmed against past doubleheader articles.
      resultsByRound.set(bucket[0].round, classifications[0]);
      resultsByRound.set(bucket[1].round, classifications[1]);
      continue;
    }
    if (classifications.length === 1 && bucket.length === 2) {
      // Doubleheader article with only the first race written up so far.
      // First round gets the classification; second falls back to winners-only.
      resultsByRound.set(bucket[0].round, classifications[0]);
      resultsByRound.set(bucket[1].round, [winnersOnlyEntry(bucket[1])]);
      continue;
    }
    // Fallback: zip what we can.
    for (let k = 0; k < bucket.length; k++) {
      const cls = classifications[k];
      if (cls && cls.length > 0) {
        resultsByRound.set(bucket[k].round, cls);
      } else {
        resultsByRound.set(bucket[k].round, [winnersOnlyEntry(bucket[k])]);
      }
    }
  }

  // Rows without eventUrl: winners-only fallback only.
  for (const row of seasonRows) {
    if (!resultsByRound.has(row.round)) {
      resultsByRound.set(row.round, [winnersOnlyEntry(row)]);
    }
  }

  // motorsportweek.com fallback layer — fires for any round still sitting
  // at the winners-only fallback (Wikipedia per-event article was a stub or
  // missing entirely). Runs in parallel for the affected rounds; success
  // replaces the 1-row winners-only entry with full classification.
  const winnersOnlyRows: SeasonRow[] = [];
  for (const row of seasonRows) {
    const current = resultsByRound.get(row.round);
    if (current && current.length === 1 && current[0].status === 'Race winner') {
      winnersOnlyRows.push(row);
    }
  }
  if (winnersOnlyRows.length > 0) {
    // raceN: 1 for singleheader / first-of-doubleheader; 2 for second-of-
    // doubleheader. Compute by inspecting the per-URL bucket the row sits in.
    const raceNFor = (row: SeasonRow): 1 | 2 => {
      if (!row.eventUrl) return 1;
      const bucket = byUrl.get(row.eventUrl);
      if (!bucket || bucket.length < 2) return 1;
      return row.round === bucket[bucket.length - 1].round ? 2 : 1;
    };
    const mwResults = await Promise.all(
      winnersOnlyRows.map(row => fetchMwClassification(row.date, row.ePrix, raceNFor(row))),
    );
    for (let i = 0; i < winnersOnlyRows.length; i++) {
      const mw = mwResults[i];
      if (mw && mw.length > 0) {
        resultsByRound.set(winnersOnlyRows[i].round, mw);
      }
    }
  }

  const races: RaceResult[] = seasonRows.map(row => ({
    round: row.round,
    raceName: row.ePrix,
    date: row.date,
    circuit: row.ePrix,
    results: resultsByRound.get(row.round) ?? [winnersOnlyEntry(row)],
  }));

  return races.sort((a, b) => a.round - b.round);
}
