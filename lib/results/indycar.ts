import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import type {
  RaceResult,
  RaceResultEntry,
  CuratedDriversFile,
} from '@/lib/types';

export type { RaceResult, RaceResultEntry };

// indycar.com/Results is SPA-rendered (the lowercase /standings is SPA;
// /Standings with capital S is SSR — used by lib/standings/indycar.ts).
// `/Results` has no SSR equivalent, so per-race classification comes from
// Wikipedia's 2026 season article. The Driver_standings table there carries
// one row per driver with one cell per round encoding finish position +
// flags (pole / led laps / fastest lap / DNS / Wth / EX / DNQ).
//
// Output is intentionally minimal: position + driver + team + status +
// computed points. Car number / lap count / elapsed time live only on
// indycar.com (SPA) and would require Playwright to surface; defer to a
// future enrichment session.
const WIKIPEDIA_URL = 'https://en.wikipedia.org/wiki/2026_IndyCar_Series';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

// Sanity floors. The 2026 IndyCar field is 27 cars; <10 finishers in a race
// signals a structurally-broken parse, and <4 races parsed means the table
// itself didn't load. Both fail closed.
const MIN_RACES = 1;
const MIN_FINISHERS_PER_RACE = 10;

// 2026 IndyCar points scale. Positions 1-25 get the explicit values; 26+
// get 5 (flat tail). Plus bonuses:
//   +1 pole position (except Indy 500, which has separate qualifying points)
//   +1 led at least one lap
//   +2 most laps led
const INDYCAR_POINTS_BY_POSITION = [
  50, 40, 35, 32, 30, 28, 26, 24, 22, 20, // 1-10
  19, 18, 17, 16, 15, 14, 13, 12, 11, 10, // 11-20
  9, 8, 7, 6, 5,                            // 21-25
] as const;
const POINTS_TAIL_26_AND_DOWN = 5;
const POINTS_POLE = 1;
const POINTS_LED_LAPS = 1;

// 2026 IndyCar schedule keyed by Wikipedia abbreviation. Race name + date.
// MIL is a doubleheader: MIL1 = Saturday race, MIL2 = Sunday race; they
// share rounds.json round 15+16 respectively. Dates align to rounds.json
// startDate at session checkpoint. If the Wikipedia table later adds /
// removes a column (e.g. MOH cancelled mid-season), the corresponding
// race in this map yields a placeholder dated June 30; the parser still
// emits a valid RaceResult but the date is editorially weak.
const INDYCAR_2026_SCHEDULE: Record<string, { name: string; date: string }> = {
  STP: { name: 'Firestone Grand Prix of St. Petersburg', date: '2026-03-01' },
  PHX: { name: 'Good Ranchers 250 (Phoenix Raceway)', date: '2026-03-07' },
  ARL: { name: 'Java House Grand Prix of Arlington', date: '2026-03-15' },
  BAR: { name: "Children's of Alabama Indy Grand Prix", date: '2026-03-29' },
  LBH: { name: 'Acura Grand Prix of Long Beach', date: '2026-04-19' },
  IGP: { name: 'Sonsio Grand Prix at the Brickyard', date: '2026-05-09' },
  INDY: { name: '110th Indianapolis 500', date: '2026-05-24' },
  DET: { name: 'Chevrolet Detroit Grand Prix', date: '2026-05-31' },
  GTW: { name: 'Bommarito Automotive Group 500 (Gateway)', date: '2026-06-07' },
  ROA: { name: 'XPEL Grand Prix at Road America', date: '2026-06-21' },
  MOH: { name: 'Honda Indy 200 at Mid-Ohio', date: '2026-07-05' },
  NSS: { name: 'Music City Grand Prix (Nashville Superspeedway)', date: '2026-07-19' },
  POR: { name: 'OnlyBulls Grand Prix of Portland', date: '2026-08-09' },
  MRK: { name: 'Ontario Honda Dealers Indy at Markham', date: '2026-08-16' },
  'D.C.': { name: 'Freedom 250 Grand Prix of Washington, D.C.', date: '2026-08-23' },
  MIL1: { name: 'Snap-on Makers and Fixers 250 (Milwaukee Mile Race 1)', date: '2026-08-29' },
  MIL2: { name: 'Snap-on Milwaukee Mile 250 (Race 2)', date: '2026-08-30' },
  LAG: { name: 'WeatherTech Raceway Laguna Seca (Season Finale)', date: '2026-09-06' },
};

interface RoundColumn {
  abbreviation: string; // STP, PHX, ..., MIL1, MIL2, LAG
  raceName: string;
  date: Date;
  columnIdx: number; // 0-based among data columns
  isIndy500: boolean;
}

interface ParsedCell {
  position: number | null;
  status: 'Finished' | 'DNS' | 'Wth' | 'EX' | 'DNQ' | 'Did not appear';
  pole: boolean;
  ledLaps: boolean;
  fastestLap: boolean;
  preRacePoleOnly: boolean; // <b>P</b> with no digit — race not yet run
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
      next: { revalidate: 3600 },
    } as RequestInit);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// Walk siblings of the Driver_standings heading to find the per-driver
// wikitable. Handles Wikipedia's 2024+ <div class="mw-heading"> wrapper
// (same fix that ships in lib/standings/wrc.ts findTableAfterHeading).
function findDriverStandingsTable(
  $: cheerio.CheerioAPI,
): cheerio.Cheerio<Element> | null {
  let found: cheerio.Cheerio<Element> | null = null;
  $('h2, h3, h4').each((_, headingEl) => {
    if (found) return;
    const heading = $(headingEl);
    const id =
      heading.attr('id') ??
      heading.find('[id]').first().attr('id') ??
      '';
    if (id !== 'Driver_standings') return;
    const parent = heading.parent();
    const startEl = parent.hasClass('mw-heading') ? parent : heading;
    let cursor = startEl.next();
    while (cursor.length > 0) {
      if (cursor.is('h2, h3, h4')) break;
      if (cursor.hasClass('mw-heading')) break;
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
  return found;
}

// Parse the header row to extract round columns + their data-column indices.
// Header structure: [Pos, Driver, STP, PHX, ARL, BAR, LBH, IGP, INDY, DET,
// GTW, ROA, MOH, NSS, POR, MRK, D.C., MIL (colspan=2), LAG, Pts]. The MIL
// colspan=2 turns into two physical data cells in driver rows; we expand
// it here so the per-driver cell iteration aligns 1:1 with rounds.
function parseHeaderRow(
  $: cheerio.CheerioAPI,
  table: cheerio.Cheerio<Element>,
): RoundColumn[] | null {
  const headerRow = table.find('tr').first();
  if (headerRow.length === 0) return null;
  const cells = headerRow.children('th, td').toArray();

  // Skip leading non-race columns (Pos + Driver). Stop at the first
  // trailing non-race column (Pts).
  const rounds: RoundColumn[] = [];
  let dataColIdx = 0;
  for (const c of cells) {
    const $cell = $(c);
    const text = $cell.text().replace(/\s+/g, ' ').trim();
    const colspan = Number($cell.attr('colspan') ?? '1') || 1;
    // Skip Pos / Driver / Pts. Round abbreviations are all-caps 2-5 chars
    // (D.C. has dots; MIL has colspan=2). Pts is "Pts" (3 chars but mixed
    // case via the heading template).
    if (/^Pos$/i.test(text) || /^Driver$/i.test(text) || /^Pts$/i.test(text)) {
      continue;
    }
    // Must look like a race abbreviation: 2-6 upper-case chars + optional dots.
    if (!/^[A-Z][A-Z.]{1,5}$/.test(text)) {
      // Trailing column we don't care about — stop processing race columns.
      // (Defensive: handles future columns like "Pos+/-" or unexpected splits.)
      if (rounds.length > 0) break;
      continue;
    }
    const link = $cell.find('a').first();
    const linkHref = link.attr('href') ?? '';
    const isIndy500 = /Indianapolis_500/i.test(linkHref) || text === 'INDY';

    if (colspan === 1) {
      const schedule = INDYCAR_2026_SCHEDULE[text];
      rounds.push({
        abbreviation: text,
        raceName: schedule?.name ?? `2026 IndyCar Round ${rounds.length + 1}`,
        date: scheduleDate(schedule?.date),
        columnIdx: dataColIdx,
        isIndy500,
      });
      dataColIdx += 1;
    } else {
      // MIL doubleheader: emit two virtual rounds sharing the abbreviation
      // base, suffixed 1/2 for INDYCAR_2026_SCHEDULE lookup.
      for (let r = 1; r <= colspan; r++) {
        const key = `${text}${r}`;
        const schedule = INDYCAR_2026_SCHEDULE[key];
        rounds.push({
          abbreviation: key,
          raceName:
            schedule?.name ?? `${text} Race ${r}`,
          date: scheduleDate(schedule?.date),
          columnIdx: dataColIdx,
          isIndy500: false,
        });
        dataColIdx += 1;
      }
    }
  }
  return rounds.length > 0 ? rounds : null;
}

function scheduleDate(iso: string | undefined): Date {
  if (iso) {
    const d = new Date(`${iso}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  // Fallback — June 30 is a defensible mid-season placeholder so the row
  // still renders. Logged in CHANGELOG as a known-weak-date condition.
  return new Date(Date.UTC(2026, 5, 30));
}

// Decode a single per-round cell. The structure is one of:
//   • <td>17</td>                              → finished P17
//   • <td>1<sup>L</sup></td>                   → finished P1 + led laps
//   • <td>1<sup>L</sup>*</td> (or trailing *)  → P1 + led laps + fastest lap
//   • <td><b>1</b><sup>L</sup>*</td>           → P1 + pole + led laps + fastest lap
//   • <td><i><b>5</b></i><sup>L</sup></td>     → P5 + pole + fastest race lap + led laps
//   • <td><b>P</b></td>                        → pole-only (race not yet run)
//   • <td>DNS</td>, <td>Wth</td>, <td>EX</td>, <td>DNQ</td>
//   • <td></td>                                → empty (race not yet run or driver absent)
function parseCell(html: string, text: string): ParsedCell {
  // Wikipedia decorates Indy 500 cells with superscript qualifying-points
  // numerals — `1<sup>12</sup>` is "won from pole, 12 shootout points" — and
  // plain textContent flattens that into "112". That shipped as the 2026
  // Indy 500 rendering with its top-12 qualifiers missing and P5 displayed
  // as the winner (validation 2026-06-11). Strip EVERY <sup> span before
  // extracting the number; the flag markers (<sup>L</sup>, </sup>*) are
  // still read from the raw html below.
  const cleanText = html
    .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  void text;
  const empty: ParsedCell = {
    position: null,
    status: 'Did not appear',
    pole: false,
    ledLaps: false,
    fastestLap: false,
    preRacePoleOnly: false,
  };

  if (cleanText === '') return empty;

  // Status codes — letters only, no digits.
  if (/^(DNS|Wth|EX|DNQ)$/i.test(cleanText)) {
    return { ...empty, status: cleanText.toUpperCase() as ParsedCell['status'] };
  }

  // Pole-only marker: a single "P" wrapped in <b> with no digit. Indy 500's
  // pre-race pole sitter shows this until the race runs.
  if (/^P$/.test(cleanText)) {
    return { ...empty, pole: true, preRacePoleOnly: true };
  }

  // Numeric finish position. Extract leading digits.
  const m = cleanText.match(/^(\d{1,3})/);
  if (!m) return empty;
  const position = Number(m[1]);
  if (!Number.isFinite(position) || position < 1) return empty;

  // Look at the raw cell HTML for flag markers — text-only inspection loses
  // the <b>/<i> wrappers that distinguish pole vs fastest race lap.
  const lowered = html.toLowerCase();
  const pole = /<b\b[^>]*>\s*\d+/.test(lowered);
  const fastestLapItalic = /<i\b[^>]*>\s*(?:<b\b[^>]*>)?\s*\d+/.test(lowered);
  const ledLaps = /<sup\b[^>]*>\s*l\s*<\/sup>/i.test(html);
  // Trailing asterisk = fastest lap. Either bare `*` after digit, or after
  // </sup> tag.
  const trailingAsterisk = /\*\s*$/.test(cleanText) || /<\/sup>\s*\*/.test(html);

  return {
    position,
    status: 'Finished',
    pole,
    ledLaps,
    fastestLap: fastestLapItalic || trailingAsterisk,
    preRacePoleOnly: false,
  };
}

function computePoints(cell: ParsedCell, isIndy500: boolean): number {
  if (cell.status !== 'Finished' || cell.position == null) return 0;
  const pos = cell.position;
  let base = 0;
  if (pos >= 1 && pos <= INDYCAR_POINTS_BY_POSITION.length) {
    base = INDYCAR_POINTS_BY_POSITION[pos - 1];
  } else if (pos > INDYCAR_POINTS_BY_POSITION.length) {
    base = POINTS_TAIL_26_AND_DOWN;
  }
  // Indy 500 awards pole points via the Fast-12 qualifying knockout, not the
  // +1 from this scale — skip pole bonus there to avoid double-counting.
  const poleBonus = cell.pole && !isIndy500 ? POINTS_POLE : 0;
  const ledBonus = cell.ledLaps ? POINTS_LED_LAPS : 0;
  // "Most laps led" is a +2 bonus separate from "led at least one lap" (+1).
  // Wikipedia's table doesn't expose which finisher led the most laps — that
  // would require a per-race fetch. Defer; document the gap in CHANGELOG.
  return base + poleBonus + ledBonus;
}

function buildTeamLookup(
  drivers: CuratedDriversFile | null | undefined,
): Map<string, string> {
  const map = new Map<string, string>();
  if (!drivers?.teams) return map;
  for (const team of drivers.teams) {
    for (const d of team.drivers) {
      if (d.name) map.set(d.name.toLowerCase(), team.name);
    }
  }
  return map;
}

function teamFor(
  driverName: string,
  lookup: Map<string, string>,
): string {
  return lookup.get(driverName.toLowerCase()) ?? '';
}

export function parseSeasonResultsFromHtml(
  html: string,
  drivers?: CuratedDriversFile | null,
): RaceResult[] {
  try {
    const $ = cheerio.load(html);
    const table = findDriverStandingsTable($);
    if (!table) return [];

    const rounds = parseHeaderRow($, table);
    if (!rounds) return [];

    const teamLookup = buildTeamLookup(drivers);

    // Per-round entry buckets, keyed by columnIdx.
    const byColumn = new Map<number, RaceResultEntry[]>();
    for (const r of rounds) byColumn.set(r.columnIdx, []);

    // Driver rows. Skip the header row (first <tr>).
    const rows = table.find('tr').slice(1).toArray();
    for (const tr of rows) {
      const $tr = $(tr);
      const cells = $tr.children('th, td').toArray();
      if (cells.length < 4) continue;

      // First cell: position (in standings; we don't use this beyond row
      // validity). Second cell: driver name.
      const driverCell = $(cells[1]);
      const driverName = driverCell.find('a').first().text().trim()
        || driverCell.text().replace(/\s+/g, ' ').trim();
      if (!driverName) continue;

      const team = teamFor(driverName, teamLookup);

      // Per-round cells are at indices 2..(2+rounds.length-1). Last cell is
      // Pts (skipped). The header MIL colspan=2 expansion already aligned
      // rounds.length to the data-cell count.
      for (let i = 0; i < rounds.length; i++) {
        const cellIdx = 2 + i;
        if (cellIdx >= cells.length - 1) break; // Don't read the Pts column.
        const $cell = $(cells[cellIdx]);
        const cellHtml = $cell.html() ?? '';
        const cellText = $cell.text();
        const parsed = parseCell(cellHtml, cellText);

        // Skip empty / pre-race / "did not appear" cells. Pole-only with no
        // race result is also dropped — race hasn't happened yet.
        if (parsed.status === 'Did not appear') continue;
        if (parsed.preRacePoleOnly) continue;
        if (parsed.status === 'Finished' && parsed.position == null) continue;

        const round = rounds[i];
        const entry: RaceResultEntry = {
          position: parsed.position ?? 0,
          driverName,
          team,
          status: parsed.status === 'Finished' ? 'Finished' : parsed.status,
          points: computePoints(parsed, round.isIndy500),
        };
        byColumn.get(round.columnIdx)!.push(entry);
      }
    }

    // Compose RaceResults per round. Skip rounds with too few finishers
    // (race hasn't run yet, or parse drift).
    const races: RaceResult[] = [];
    for (const round of rounds) {
      const entries = byColumn.get(round.columnIdx) ?? [];
      const finishers = entries.filter(e => e.status === 'Finished');
      if (finishers.length < MIN_FINISHERS_PER_RACE) continue;

      // Sort by position ascending; non-finishers go to the bottom in their
      // original order (status codes don't carry a meaningful position).
      const sorted = entries.slice().sort((a, b) => {
        const aFin = a.status === 'Finished' ? 0 : 1;
        const bFin = b.status === 'Finished' ? 0 : 1;
        if (aFin !== bFin) return aFin - bFin;
        return a.position - b.position;
      });

      races.push({
        round: round.columnIdx + 1, // 1-indexed for human display
        raceName: round.raceName,
        date: round.date,
        circuit: round.raceName,
        results: sorted,
      });
    }
    return races.length >= MIN_RACES ? races : [];
  } catch {
    return [];
  }
}

export async function fetchIndyCarSeasonResults(opts: {
  drivers?: CuratedDriversFile | null;
}): Promise<RaceResult[]> {
  const html = await fetchHtml(WIKIPEDIA_URL);
  if (!html) return [];
  return parseSeasonResultsFromHtml(html, opts.drivers ?? null);
}
