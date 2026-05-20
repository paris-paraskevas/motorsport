import * as cheerio from 'cheerio';
import type { RaceResult, RaceResultEntry } from '@/lib/types';

export type { RaceResult, RaceResultEntry };

const STANDINGS_URL = 'https://www.fiaformula3.com/Standings/Driver';
const RESULTS_URL_BASE = 'https://www.fiaformula3.com/Results';

// Standard browser UA — see lib/standings/f3.ts for the rationale (the FIA F3
// Next.js site serves a trimmed shell to non-browser UAs).
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

// F3 points per finishing position. Feature Race awards 25-18-15-...-1 to the
// top 10; Sprint Race awards 15-12-10-...-1 to the top 8. Pole-position bonus
// (Feature only, +2) and fastest-lap bonus (top 10 only, +1 in both races)
// are not represented here — they require a separate data feed (qualifying
// results + sector timing). For the Results tab, position-points are
// sufficient to show "winner + podium + points-paying finishers"; the canonical
// total per driver is rendered by StandingsTab from the championship table.
const FEATURE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] as const;
const SPRINT_POINTS = [15, 12, 10, 8, 6, 4, 2, 1] as const;

// Defensive cap. F3 grids are ~30 cars; bumping to 50 leaves headroom for
// privateers / reserves without runaway parsing on a malformed page.
const MAX_ROUNDS = 50;
// Sanity floor for a real race result: F3 grids are 27–30. Anything below
// suggests scraping failure. Set high enough that a partially-parsed table
// fails closed.
const MIN_ENTRIES_PER_RACE = 10;

interface RoundDescriptor {
  raceId: number;
  // Round number is assigned by the order the headers appear on the
  // Standings/Driver page (Bahrain at raceid=1070 was cancelled and so does
  // not appear). For 2026 the surviving order is Melbourne=R1, Monaco=R2,
  // Barcelona=R3, etc. — this mirrors the official championship rounds.
  round: number;
  venue: string;
  // Local-date string from the standings header e.g. "06-08 Mar". The page
  // omits the year — callers stitch in the season.
  dateRange: string;
}

interface ParsedRaceTable {
  type: 'feature' | 'sprint';
  rows: RaceResultEntry[];
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

// Lift raceids + venue + date from the Standings/Driver page header. The
// column headers carry one `/Results?raceid=NNNN` link per round in the order
// they appear in the championship. Bahrain (raceid=1070) is absent because
// the round was cancelled with F1 — so the standings page is the right
// source of truth for "rounds that count this season".
export function parseRoundsFromStandings(html: string): RoundDescriptor[] {
  const $ = cheerio.load(html);
  const rounds: RoundDescriptor[] = [];
  $('table.table-bordered thead a[href^="/Results?raceid="]').each((idx, el) => {
    if (rounds.length >= MAX_ROUNDS) return false;
    const href = $(el).attr('href') || '';
    const m = href.match(/raceid=(\d+)/);
    if (!m) return;
    const raceId = Number(m[1]);
    if (!Number.isFinite(raceId)) return;
    const venue = $(el).find('.country-name span').first().text().trim();
    const dateRange = $(el).find('.dates').first().text().trim();
    rounds.push({ raceId, round: idx + 1, venue, dateRange });
  });
  return rounds;
}

// Parse "DD-DD Mon" or "DD-DD Mont" into a Date at the END of the range
// (Sunday for a typical Fri–Sun race weekend). Season comes from the caller
// because the standings header omits the year.
function parseRoundDate(dateRange: string, season: number): Date | null {
  // Match the day-AFTER-hyphen so we capture the Sunday race day.
  const m = dateRange.match(/(\d{1,2})-(\d{1,2})\s+([A-Za-z]+)/);
  if (!m) return null;
  const day = Number(m[2]);
  const monthRaw = m[3].toLowerCase().slice(0, 3);
  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const month = months[monthRaw];
  if (month === undefined) return null;
  const date = new Date(Date.UTC(season, month, day));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

// Walk every `.collapsible` block on a /Results?raceid=NNN page and pluck
// the Feature Race + Sprint Race tables. Returns only the race tables that
// actually contain rows — sessions yet to run render the header but no
// `<table>`, in which case we skip them silently (a round in progress is
// not a parse error).
export function parseRaceTables(html: string): ParsedRaceTable[] {
  const $ = cheerio.load(html);
  const out: ParsedRaceTable[] = [];
  $('.collapsible').each((_, el) => {
    const $section = $(el);
    const heading = $section.find('.collapsible-header h2 p span').first().text().trim();
    let type: 'feature' | 'sprint' | null = null;
    if (heading === 'Feature Race') type = 'feature';
    else if (heading === 'Sprint Race') type = 'sprint';
    else return; // Skip Qualifying, Practice, and any future formats.

    const $table = $section.find('table.table-bordered').first();
    if ($table.length === 0) return; // Race hasn't been run yet.
    const points = type === 'feature' ? FEATURE_POINTS : SPRINT_POINTS;

    const entries: RaceResultEntry[] = [];
    $table.find('tbody tr').each((__, tr) => {
      const $row = $(tr);
      const positionText = $row
        .find('.driver-name-wrapper .pos')
        .first()
        .text()
        .trim();
      const driverName = $row
        .find('.driver-name .visible-desktop-up')
        .first()
        .text()
        .trim();
      const driverCode = $row
        .find('.driver-name .visible-desktop-down')
        .first()
        .text()
        .trim();
      const team = $row.find('.driver-name .team-name').first().text().trim();
      const scoreWrappers = $row.find('td .score-wrapper');
      // Race tables are: POS | LAPS | TIME | GAP | INT | KPH | BEST | LAP
      const timeText = scoreWrappers.eq(1).text().trim();
      const gapText = scoreWrappers.eq(2).text().trim();

      const position = Number(positionText);
      if (!Number.isFinite(position)) return;
      if (!driverName || !team) return;

      // Status is "Finished" by default. When TIME contains an uppercase
      // marker like "DNF", "DSQ", "DNS" or "+1 LAP", treat that as the
      // status. Drivers below the points-paying cutoff still get entries;
      // their points are simply 0.
      const looksLikeStatus = /^(DNF|DSQ|DNS|DNQ|NC)\b/i.test(timeText);
      const status = looksLikeStatus ? timeText.toUpperCase() : 'Finished';
      const time =
        status === 'Finished' && timeText && timeText !== '-' ? timeText : undefined;
      const gap = gapText && gapText !== '-' ? gapText : undefined;

      // Points by finishing position. Drivers outside the points-paying
      // cutoff (P11+ Feature, P9+ Sprint) get 0. Non-finishers always get 0.
      const pts =
        status === 'Finished' && position >= 1 && position <= points.length
          ? points[position - 1]
          : 0;

      entries.push({
        position,
        driverName,
        driverCode: driverCode || undefined,
        team,
        status,
        // Winner shows total time ("42:59.653"); P2+ are more useful with
        // the gap ("+0.693") when no other time column is set.
        time: time ?? gap,
        points: pts,
      });
    });

    if (entries.length < MIN_ENTRIES_PER_RACE) return;
    out.push({ type, rows: entries.sort((a, b) => a.position - b.position) });
  });
  return out;
}

// Fetch one round and produce up to two RaceResult entries (Feature, Sprint).
export async function fetchF3Round(
  round: RoundDescriptor,
  season: number,
): Promise<RaceResult[]> {
  const html = await fetchHtml(`${RESULTS_URL_BASE}?raceid=${round.raceId}`);
  if (!html) return [];
  const tables = parseRaceTables(html);
  if (tables.length === 0) return [];

  const date = parseRoundDate(round.dateRange, season);
  if (!date) return [];

  const out: RaceResult[] = [];
  for (const t of tables) {
    out.push({
      round: round.round,
      // The Results tab renders one row per race; including the race type in
      // the name lets readers distinguish the two without a separate column.
      raceName: `${round.venue} ${t.type === 'feature' ? 'Feature Race' : 'Sprint Race'}`,
      date,
      circuit: round.venue,
      results: t.rows,
    });
  }
  return out;
}

export async function fetchF3SeasonResults(season: number): Promise<RaceResult[]> {
  const standingsHtml = await fetchHtml(STANDINGS_URL);
  if (!standingsHtml) return [];
  const rounds = parseRoundsFromStandings(standingsHtml);
  if (rounds.length === 0) return [];

  // Sequential fetch keeps us under any rate-limit the FIA site enforces and
  // avoids slamming it with ~10 parallel requests on every page render. The
  // hourly revalidate means this only runs once per hour per process.
  const all: RaceResult[] = [];
  for (const round of rounds) {
    const races = await fetchF3Round(round, season);
    for (const r of races) all.push(r);
  }
  return all;
}
