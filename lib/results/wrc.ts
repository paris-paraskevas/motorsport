import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import type { RaceResult, RaceResultEntry } from '@/lib/types';

export type { RaceResult, RaceResultEntry };

// wrc.com bot-blocks unauthenticated requests, so the rally calendar +
// winners list is sourced from Wikipedia. The 2026 season article includes
// a "Calendar" or "Results" table listing one row per rally with date,
// venue, and winning crew. We only surface completed rallies (those with a
// winner). Per-rally top-10 classification + stage-win + Power-Stage bonus
// would require either per-rally Wikipedia pages or wrc.com — both
// intentionally out of scope for the v1 results parser. Each RaceResult
// returned here carries just the winning crew so the ResultsTab can
// render an honest "Round N — winner: X (Y)" list.
const WIKIPEDIA_URL = 'https://en.wikipedia.org/wiki/2026_World_Rally_Championship';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
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

function cleanText(text: string): string {
  return text
    .replace(/\[\d+\]/g, '')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Parse a date like "22–25 January", "22 January – 25 January", or
// "January 22–25" in the season's year. We anchor to mid-rally (the start
// date) since that's what the UI uses to sort and render. Returns the
// canonical Date for the rally's first day at UTC midnight. Year is passed
// in to handle rallies that span late December → early January (none in
// 2026 but defensive).
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

function parseRallyDate(dateText: string, season: number): Date | null {
  const lowered = dateText.toLowerCase().replace(/[–—−]/g, '-');
  // Try "22-25 january" or "22 - 25 january"
  let m = lowered.match(/(\d{1,2})\s*-\s*\d{1,2}\s+([a-z]+)/);
  if (m) {
    const day = Number(m[1]);
    const month = MONTHS[m[2]];
    if (month != null && Number.isFinite(day)) {
      const d = new Date(Date.UTC(season, month, day));
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  // Try "january 22-25"
  m = lowered.match(/([a-z]+)\s+(\d{1,2})\s*-\s*\d{1,2}/);
  if (m) {
    const day = Number(m[2]);
    const month = MONTHS[m[1]];
    if (month != null && Number.isFinite(day)) {
      const d = new Date(Date.UTC(season, month, day));
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  // Try "22 january - 25 january" (cross-month rallies)
  m = lowered.match(/(\d{1,2})\s+([a-z]+)\s*-\s*\d{1,2}\s+[a-z]+/);
  if (m) {
    const day = Number(m[1]);
    const month = MONTHS[m[2]];
    if (month != null && Number.isFinite(day)) {
      const d = new Date(Date.UTC(season, month, day));
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  // Try single date "22 january"
  m = lowered.match(/(\d{1,2})\s+([a-z]+)/);
  if (m) {
    const day = Number(m[1]);
    const month = MONTHS[m[2]];
    if (month != null && Number.isFinite(day)) {
      const d = new Date(Date.UTC(season, month, day));
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return null;
}

// Wikipedia's calendar/results section lists one <tr> per rally on the season
// article. The structure varies year-to-year; in 2026 the table has columns:
//   1. Round (Th number)
//   2. Rally / Event name (link)
//   3. Surface (Tarmac / Gravel / Snow / Mixed)
//   4. Date range
//   5. Service park / Headquarters
//   6. Stages / km
//   7. Rally winner (driver name)
//   8. Co-driver
//   9. Manufacturer / Team
//
// Some columns may merge across years (e.g. "Rally" + "Round" combined),
// so we identify the table by heading rather than column count. Empty
// winner cells indicate an upcoming rally — those rows are skipped.
function findCalendarTable(
  $: cheerio.CheerioAPI,
): cheerio.Cheerio<Element> | null {
  // Candidate headings in priority order. Wikipedia 2026+ splits the page
  // into a "Calendar" section (round + start/finish dates + surface, NO
  // winner column) and a "Results and standings" → "Season summary" section
  // whose first wikitable has Round + Event + Winning driver + Co-driver +
  // Entrant + Time + Report. The 0.11.9 / 0.11.10 parser matched the
  // Calendar table first, failed buildColumnMap because no winning-driver
  // column, and returned [] — production rendered "Results temporarily
  // unavailable". This patch swaps priority so Results_and_standings is
  // tried first AND adds a winner-header requirement on the candidate
  // confirmation so the bare-Calendar table (no winner column) is rejected
  // even if a future restructure routes us into it.
  const headingPatterns = [
    /^Results_and_standings$/i,
    /Season_summary/i,
    /^Results$/i,
    /^Calendar$/i,
    /Season_calendar/i,
    /Calendar/i,
    /Results_and_standings/i,
    /Results/i,
  ];
  for (const pat of headingPatterns) {
    let found: cheerio.Cheerio<Element> | null = null;
    $('h2, h3').each((_, headingEl) => {
      if (found) return;
      const heading = $(headingEl);
      const id =
        heading.attr('id') ??
        heading.find('[id]').first().attr('id') ??
        '';
      if (!pat.test(id)) return;

      // Wikipedia (2024+) wraps headings in <div class="mw-heading"> — walk
      // siblings of the wrapper so `next()` reaches the section content
      // instead of the .mw-editsection chrome. Same fix that ships in
      // lib/standings/wrc.ts findTableAfterHeading.
      const parent = heading.parent();
      const startEl = parent.hasClass('mw-heading') ? parent : heading;
      let cursor = startEl.next();
      while (cursor.length > 0) {
        if (cursor.is('h2')) break;
        if (cursor.hasClass('mw-heading')) {
          const innerH = cursor.find('h2').first();
          if (innerH.length > 0) break;
        }
        if (cursor.is('table.wikitable')) {
          // Confirm it's a results table — round column + winner column.
          // Slice(0, 9) covers the typical 8-column results-table header
          // (Round / Event / Winning driver / Co-driver / Entrant / Time /
          // Report / Ref) with one column of headroom.
          const headerText = cursor.find('th').slice(0, 9).text().toLowerCase();
          if (
            headerText.includes('round') &&
            (headerText.includes('winning') ||
              headerText.includes('winner') ||
              headerText.includes('driver'))
          ) {
            found = cursor;
            return;
          }
        }
        const inner = cursor.find('table.wikitable').first();
        if (inner.length > 0) {
          const headerText = inner.find('th').slice(0, 9).text().toLowerCase();
          if (
            headerText.includes('round') &&
            (headerText.includes('winning') ||
              headerText.includes('winner') ||
              headerText.includes('driver'))
          ) {
            found = inner;
            return;
          }
        }
        cursor = cursor.next();
      }
    });
    if (found) return found;
  }
  return null;
}

// Find the column index of each meaningful column by header label. Header
// rows are <tr> with all <th> children; we read the first such row.
interface ColumnMap {
  round: number;
  rally: number;
  date: number;
  winner: number;
  coDriver: number;
  team: number;
}

function buildColumnMap(
  $: cheerio.CheerioAPI,
  table: cheerio.Cheerio<Element>,
): ColumnMap | null {
  let map: ColumnMap | null = null;
  table.find('tr').each((_, tr) => {
    if (map) return;
    const cells = $(tr).children('th, td');
    // A header row has all <th> children.
    const ths = $(tr).children('th');
    if (ths.length === 0 || ths.length < cells.length / 2) return;
    const labels = cells.toArray().map(c => $(c).text().toLowerCase().replace(/\s+/g, ' ').trim());
    const indexOf = (...keywords: string[]): number => {
      for (let i = 0; i < labels.length; i++) {
        for (const kw of keywords) {
          if (labels[i].includes(kw)) return i;
        }
      }
      return -1;
    };
    const round = indexOf('rnd', 'round', 'no.', '#');
    const rally = indexOf('rally', 'event');
    const date = indexOf('date');
    // "Winning driver" / "Winner" / "Winning crew". Co-driver column usually
    // adjacent. Manufacturer is the last meaningful column.
    const winner = indexOf('winning driver', 'winner', 'driver');
    let coDriver = indexOf('co-driver', 'codriver', 'co driver');
    if (coDriver === winner) coDriver = -1;
    const team = indexOf('manufacturer', 'team', 'constructor');
    if (round === -1 || rally === -1 || date === -1 || winner === -1) return;
    map = { round, rally, date, winner, coDriver, team: team === -1 ? winner : team };
  });
  return map;
}

export function parseSeasonResultsFromHtml(
  html: string,
  season: number,
): RaceResult[] {
  try {
    const $ = cheerio.load(html);
    const table = findCalendarTable($);
    if (!table) return [];
    const cols = buildColumnMap($, table);
    if (!cols) return [];

    const races: RaceResult[] = [];
    table.find('tr').each((_, tr) => {
      const cells = $(tr).children('th, td');
      if (cells.length < 4) return;
      // Skip header rows (all <th>).
      const ths = $(tr).children('th');
      if (ths.length === cells.length) return;

      const roundText = $(cells[cols.round]).text().trim();
      const round = Number(roundText.replace(/[^\d]/g, ''));
      if (!Number.isFinite(round) || round < 1) return;

      const firstLinkText = (cell: cheerio.Cheerio<Element>): string => {
        let t = '';
        cell.find('a').each((_, a) => {
          if (t) return;
          const candidate = $(a).text().trim();
          if (candidate) t = candidate;
        });
        return t;
      };

      const rallyNameCell = $(cells[cols.rally]);
      const rallyName = cleanText(firstLinkText(rallyNameCell) || rallyNameCell.text());
      if (!rallyName) return;

      const dateText = $(cells[cols.date]).text();
      const date = parseRallyDate(dateText, season);
      if (!date) return;

      // Upcoming rallies have empty winner / co-driver cells. Skip them.
      const winnerCell = $(cells[cols.winner]);
      const winnerName = cleanText(firstLinkText(winnerCell) || winnerCell.text());
      if (!winnerName || winnerName === '—' || winnerName === '-') return;

      const coDriverCell = cols.coDriver >= 0 ? $(cells[cols.coDriver]) : null;
      const coDriverName = coDriverCell
        ? cleanText(firstLinkText(coDriverCell) || coDriverCell.text())
        : '';

      const teamCell = $(cells[cols.team]);
      const team = cleanText(firstLinkText(teamCell) || teamCell.text());

      const winnerEntry: RaceResultEntry = {
        position: 1,
        driverName: coDriverName
          ? `${winnerName} / ${coDriverName}`
          : winnerName,
        team: team || 'Unknown',
        status: 'Winner',
        points: 25,
      };

      races.push({
        round,
        raceName: rallyName,
        date,
        circuit: rallyName, // venue isn't stable across years; use rally name
        results: [winnerEntry],
      });
    });

    // De-dup by round (Wikipedia sometimes has sub-rows for stage detail).
    const byRound = new Map<number, RaceResult>();
    for (const r of races) {
      if (!byRound.has(r.round)) byRound.set(r.round, r);
    }
    return Array.from(byRound.values()).sort((a, b) => a.round - b.round);
  } catch {
    return [];
  }
}

export async function fetchWRCSeasonResults(season = 2026): Promise<RaceResult[]> {
  const html = await fetchHtml(WIKIPEDIA_URL);
  if (!html) return [];
  return parseSeasonResultsFromHtml(html, season);
}
