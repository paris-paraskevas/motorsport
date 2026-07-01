import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import { fetchUpstream } from '@/lib/fetch-upstream';
import type { RaceResult, RaceResultEntry } from '@/lib/types';

export type { RaceResult, RaceResultEntry };

// NLS (Nürburgring Langstrecken-Serie, formerly VLN) per-round overall
// winners. NLS is a club endurance series with NO season championship points
// (see lib/profile-stats.ts) — the "standings" it publishes are per-class
// tabular positions, not a driver title race — so results are emitted
// WINNERS-ONLY: one RaceResultEntry per completed round carrying the overall
// (fastest-race-time) winning crew + entrant. The ResultsTab `isWinnersOnly`
// path (single entry, status "Winner") renders these as flat rows without a
// misleading 1-row classification accordion.
//
// SOURCE — why Wikipedia, not the official VLN documents portal:
//   The authoritative results are published by VLN as per-round classification
//   PDFs at teilnehmer.vln.de (/download.php?file=onb/<date>/NLS<n>_Rennen_
//   Gesamtergebnis_offiziell.pdf — the "Offizielles Ergebnis Rennen"). Those
//   PDFs fetch fine over plain HTTP (200, application/pdf, layout-parseable
//   with pdftotext) and carry the full top-N field. BUT extracting text from a
//   PDF in the Vercel Function runtime requires a bundled JS PDF library
//   (pdfjs-dist / unpdf) that isn't in the dependency tree — adding one is a
//   heavier, separately-verified change than this parser warrants, and PDF
//   text-extraction on the serverless runtime is its own datacenter landmine.
//   The Wikipedia season page carries a "Results" table with the overall
//   winners per round (drivers + entrant), which is exactly the winners-only
//   fidelity NLS's points-free model tops out at, and parses with the cheerio
//   we already ship. The VLN portal remains the fan-facing "Source" link so
//   readers can pull the official PDF for the full field. A future upgrade to
//   full per-round classification can vendor a PDF lib and parse the
//   Gesamtergebnis PDF; the winners-only shape here is forward-compatible.

const WIKIPEDIA_SEASON_URL =
  'https://en.wikipedia.org/wiki/2026_N%C3%BCrburgring_Langstrecken-Serie';

// Fan-facing source: the official VLN documents portal (per-round official
// results/classification PDFs live under the "Offizieller Aushang" for each
// event date). Used only as the Results-tab "Source" link, not fetched.
export const NLS_SOURCE_URL = 'https://teilnehmer.vln.de/';

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
    .replace(/\[\d+\]/g, '') // Wikipedia footnote markers
    .replace(/\[[a-z]\]/gi, '') // lettered notes ([a], [b])
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Anchor-text of a cell, joining every non-empty <a> with " · " — Wikipedia
// crew cells list each driver as a separate wiki-link, preceded by a flag-icon
// link whose anchor text is empty (just an <img>). Falls back to the cell's
// stripped text when it has no links (rare, e.g. a plain-text crew).
function driversFromCell(
  $: cheerio.CheerioAPI,
  cell: cheerio.Cheerio<Element>,
): string {
  const names: string[] = [];
  cell.find('a').each((_, a) => {
    const t = cleanText($(a).text());
    // Skip flag-icon links (empty text) and country links (the flag's <a>
    // wraps a title like "Netherlands" but renders no text — its .text() is
    // empty because the anchor contains only an <img>).
    if (t) names.push(t);
  });
  if (names.length > 0) return names.join(' · ');
  return cleanText(cell.text());
}

// Entrant/team from the winner cell: strip the leading "No. NN" car number and
// any flag icon, then take the remaining link/plain text. The cell reads e.g.
// "🇳🇱 No. 99 Rowe Racing" → "Rowe Racing".
function teamFromCell(
  $: cheerio.CheerioAPI,
  cell: cheerio.Cheerio<Element>,
): string {
  // Prefer joined link text (team names are usually wiki-linked, possibly two
  // links like "Mercedes-AMG Team Verstappen Racing"), else the plain text.
  const links: string[] = [];
  cell.find('a').each((_, a) => {
    const t = cleanText($(a).text());
    if (t) links.push(t);
  });
  const raw = links.length > 0 ? links.join(' ') : cleanText(cell.text());
  // Drop a leading car number ("No. 99 ") if it survived (plain-text cells).
  return raw.replace(/^No\.\s*\d+\s*/i, '').trim();
}

// ---- Calendar table — round-label → { numericRound, name, date } --------

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

// Parse a Wikipedia date cell like "14 March" or "18–19 April" → UTC midnight
// of the (start) day. NLS rounds are single-day, but ranges are handled
// defensively. Returns null on an unparseable cell.
export function parseNlsDate(dateText: string, season: number): Date | null {
  const lowered = cleanText(dateText).toLowerCase().replace(/[–—−]/g, '-');
  // "18-19 april" or "18 april" → take the first day + the (only) month.
  let m = lowered.match(/(\d{1,2})\s*(?:-\s*\d{1,2})?\s+([a-z]+)/);
  if (m) return buildDate(m[1], m[2], season);
  // "april 18-19"
  m = lowered.match(/([a-z]+)\s+(\d{1,2})/);
  if (m) return buildDate(m[2], m[1], season);
  return null;
}

function buildDate(dayStr: string, monthName: string, season: number): Date | null {
  const day = Number(dayStr);
  const month = MONTHS[monthName];
  if (month == null || !Number.isFinite(day)) return null;
  const d = new Date(Date.UTC(season, month, day));
  return Number.isNaN(d.getTime()) ? null : d;
}

// Walk from a heading to the first wikitable after it. Wikipedia (2024+) wraps
// headings in <div class="mw-heading">, so the semantic next-sibling is the
// wrapper's sibling. Stops at the next h2/h3 so a missing table can't grab an
// unrelated downstream one.
function findFirstTableAfter(
  $: cheerio.CheerioAPI,
  headingIdPatterns: RegExp[],
): cheerio.Cheerio<Element> | null {
  for (const pat of headingIdPatterns) {
    let found: cheerio.Cheerio<Element> | null = null;
    $('h2, h3').each((_, headingEl) => {
      if (found) return;
      const heading = $(headingEl);
      const id =
        heading.attr('id') ?? heading.find('[id]').first().attr('id') ?? '';
      if (!pat.test(id)) return;
      const parent = heading.parent();
      const startEl = parent.hasClass('mw-heading') ? parent : heading;
      let cursor = startEl.next();
      while (cursor.length > 0) {
        if (cursor.is('h2, h3')) break;
        if (cursor.hasClass('mw-heading')) {
          if (cursor.find('h2, h3').first().length > 0) break;
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

export interface NlsCalendarRow {
  round: number; // numeric championship round (rounds.json aligns to this)
  label: string; // event label used as the Results-table row key ("NLS1", "24H-Q1")
  raceName: string;
  date: Date;
}

// The Calendar table columns: Round | Rnd. (label) | Race | Length | Circuit |
// Date. Header-index lookup is unreliable here for two reasons: Wikipedia
// merges the "Round"/"Rnd." header cells (leaking a <style> block into the
// first <th>'s text), and "Circuit" carries rowspan=N so only the first data
// row has it — shifting every subsequent row's Date column left by one. The
// layout is instead read POSITIONALLY, which is stable across all rows:
//   - the first two <th> of a data row are [numeric round, event label]
//   - the first <td> is the race name
//   - the LAST cell is the date
// The header row (numeric-less first <th>, no <td>) and the trailing "Source:"
// row (single <th>, no numeric) are excluded by requiring a positive-integer
// first <th> AND at least one <td>.
export function parseNlsCalendar(html: string, season: number): NlsCalendarRow[] {
  try {
    const $ = cheerio.load(html);
    const table = findFirstTableAfter($, [/^Calendar$/i, /Calendar/i]);
    if (!table) return [];

    const out: NlsCalendarRow[] = [];
    table.find('tr').each((_, tr) => {
      const $tr = $(tr);
      const ths = $tr.children('th');
      const tds = $tr.children('td');
      const cells = $tr.children('th, td');
      if (ths.length < 2 || tds.length === 0) return;

      const round = Number(cleanText($(ths[0]).text()).replace(/[^\d]/g, ''));
      if (!Number.isFinite(round) || round < 1) return;

      const label = cleanText($(ths[1]).text());
      const raceName = cleanText($(tds[0]).text());
      const date = parseNlsDate($(cells[cells.length - 1]).text(), season);
      if (!label || !raceName || !date) return;

      out.push({ round, label, raceName, date });
    });
    return out;
  } catch {
    return [];
  }
}

// ---- Results table — round-label → overall winner -----------------------

export interface NlsWinnerRow {
  label: string; // "NLS2", "24H-Q2"
  raceName: string;
  winnerDrivers: string; // " · "-joined crew, or "" if cancelled/upcoming
  winnerTeam: string;
}

// The Results table is two-rows-per-round via rowspan=2 on the label <th> and
// race <td>. Cheerio does NOT expand rowspans, so the DOM is:
//   main row: [label(th, rowspan2), race(td, rowspan2), poleTeam(td),
//              winnerTeam(td), report(td)]  — 5 cells
//   sub  row: [poleDrivers(td), winnerDrivers(td)]                — 2 cells
// A cancelled/abandoned round is a single row: [label(th), race(td),
// note(td, colspan)] with no sub-row. We pair each main row (identified by a
// leading <th> carrying a non-numeric event label) with its following 2-cell
// sub-row, reading the WINNER (not pole) columns.
export function parseNlsSeasonResults(html: string): NlsWinnerRow[] {
  try {
    const $ = cheerio.load(html);
    const table = findFirstTableAfter($, [/^Results$/i, /Results/i]);
    if (!table) return [];

    const rows = table.find('tr').toArray();
    const out: NlsWinnerRow[] = [];

    for (let i = 0; i < rows.length; i++) {
      const $row = $(rows[i]);
      const cells = $row.children('th, td');
      const firstTh = $row.children('th').first();
      // A "main" round row begins with a <th> whose text is an event label
      // (e.g. "NLS2", "24H-Q2") — not the header row's "Round"/"Rnd." and not
      // a numeric-only cell.
      if (firstTh.length === 0) continue;
      const label = cleanText(firstTh.text());
      if (!label || /^round$/i.test(label) || /^rnd/i.test(label)) continue;
      if (!/[A-Za-z]/.test(label)) continue; // numeric-only → not a label row

      const raceName = cells.length > 1 ? cleanText($(cells[1]).text()) : '';

      // Cancelled/abandoned rounds: the note lives in a colspanned cell and
      // there's no winner-team column / no sub-row. Detect by cell count (the
      // full winner row has >= 5 cells: label, race, poleTeam, winnerTeam,
      // report). Anything less is a no-winner round — emit empty winner.
      if (cells.length < 4) {
        out.push({ label, raceName, winnerDrivers: '', winnerTeam: '' });
        continue;
      }

      // Winner team is the cell before the trailing "report" cell — i.e. the
      // second-to-last cell of the main row (index cells.length - 2). Pole is
      // the cell before that. (Report is always the last cell.)
      const winnerTeamCell = $(cells[cells.length - 2]);
      const winnerTeam = teamFromCell($, winnerTeamCell);

      // Winner drivers come from the *next* row's last cell (sub-row:
      // [poleDrivers, winnerDrivers]).
      let winnerDrivers = '';
      const $next = i + 1 < rows.length ? $(rows[i + 1]) : null;
      if ($next) {
        const nextHasTh = $next.children('th').length > 0;
        const nextCells = $next.children('td');
        // The sub-row has NO <th> (its label/race are rowspanned from above)
        // and exactly the pole/winner driver cells.
        if (!nextHasTh && nextCells.length >= 1) {
          winnerDrivers = driversFromCell($, $(nextCells[nextCells.length - 1]));
          i++; // consume the sub-row
        }
      }

      out.push({ label, raceName, winnerDrivers, winnerTeam });
    }
    return out;
  } catch {
    return [];
  }
}

// ---- Orchestration ------------------------------------------------------

// Build winners-only RaceResult[] for the season. One entry per round that has
// an overall winner; cancelled/upcoming rounds are dropped (no winner to
// show). Round numbers come from the Calendar (matched by event label) so they
// align with content/series/nls/rounds.json and the weekend-page links.
//
// points=0 for every entry: NLS awards no season championship points, so a
// non-zero value would be a fabrication (and profile-stats.ts already returns
// null form for the series). The winners-only flat row doesn't render points.
export async function fetchNlsSeasonResults(
  season = 2026,
): Promise<RaceResult[]> {
  const html = await fetchHtml(WIKIPEDIA_SEASON_URL);
  if (!html) return [];

  const calendar = parseNlsCalendar(html, season);
  const winners = parseNlsSeasonResults(html);
  if (calendar.length === 0 || winners.length === 0) return [];

  const calByLabel = new Map<string, NlsCalendarRow>();
  for (const c of calendar) calByLabel.set(c.label, c);

  const races: RaceResult[] = [];
  for (const w of winners) {
    // No overall winner (cancelled / abandoned / not yet run) → skip.
    if (!w.winnerDrivers && !w.winnerTeam) continue;
    const cal = calByLabel.get(w.label);
    if (!cal) continue; // unmatched label — can't place it on a round/date

    const entry: RaceResultEntry = {
      position: 1,
      driverName: w.winnerDrivers || w.winnerTeam,
      team: w.winnerTeam || 'Unknown',
      status: 'Winner',
      points: 0,
    };
    races.push({
      round: cal.round,
      raceName: cal.raceName || w.raceName || w.label,
      date: cal.date,
      circuit: 'Nürburgring Nordschleife',
      results: [entry],
    });
  }

  return races.sort((a, b) => a.round - b.round);
}
