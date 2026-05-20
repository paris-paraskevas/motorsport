import * as cheerio from 'cheerio';
import type { RaceResult, RaceResultEntry } from '@/lib/types';

export type { RaceResult, RaceResultEntry };

// nascar.com / jayski.com / racing-reference.info all 403 server-side fetches
// (Cloudflare bot mitigation), so Wikipedia's 2026 NASCAR Cup Series season
// article is the only viable SSR source. The Race_results table on that page
// lists every race in calendar order with: race number (rounds only), race
// name, pole position, most laps led, fastest lap, winning driver, winning
// manufacturer, and a Report link. We use that as a "winner per round" feed
// — Phase 1 ships one entry per round, position 1 = winner, with the
// manufacturer surfaced as team. Full per-driver finish positions per race
// are not in this table (they'd require scraping each per-race Wikipedia
// subpage) and are explicitly out of scope for Phase 1.
const SEASON_PAGE_URL =
  'https://en.wikipedia.org/wiki/2026_NASCAR_Cup_Series';

// Sanity floor: the Race_results table has 36 points rounds + 3 preseason
// blocks (Clash + Duel 1 + Duel 2). A parse that returns fewer than 1 race
// means we landed on a structurally-broken response or the season hasn't
// started yet. The minimum we accept for a "results render" is 1 round.
const MIN_RACES = 1;

// Wikipedia race-results row uses 8 cells in a full row, or 6/4 cells for
// rowspan-continuation rows (preseason). The columns are stable since the
// season-template was introduced years ago.
//   col[0]  = race number (<th>) - sometimes empty for preseason
//   col[1]  = race name (<td>)
//   col[2]  = pole position driver
//   col[3]  = most laps led driver
//   col[4]  = fastest lap driver
//   col[5]  = winning driver
//   col[6]  = winning manufacturer
//   col[7]  = report link
const FULL_ROW_CELLS = 8;
const COL_RACE_NUMBER = 0;
const COL_RACE_NAME = 1;
const COL_WINNER = 5;
const COL_MANUFACTURER = 6;

function cleanText(s: string): string {
  return s
    .replace(/\[[^\]]{1,15}\]/g, '')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDateFromRoundsLookup(
  round: number,
  rounds: Array<{ round: number; startDate: string; name?: string }>,
): Date | null {
  const match = rounds.find((r) => r.round === round);
  if (!match) return null;
  const d = new Date(`${match.startDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function parseRaceTable(
  html: string,
  rounds: Array<{ round: number; startDate: string; name?: string }>,
): RaceResult[] {
  const headingIdx = html.search(/id="Race_results"/);
  if (headingIdx < 0) return [];
  const tableStart = html.indexOf('<table', headingIdx);
  if (tableStart < 0) return [];
  const tableEnd = html.indexOf('</table>', tableStart);
  if (tableEnd < 0) return [];
  const tableHtml = html.substring(tableStart, tableEnd + 8);

  const $ = cheerio.load(tableHtml);
  const rows = $('tr').toArray();
  if (rows.length < 2) return [];

  const races: RaceResult[] = [];

  // Wikipedia's Race_results table also includes the Clash + 2 Duels above
  // round 1. Those preseason rows have an empty/non-numeric col[0]; we skip
  // them. A row only contributes a points round if col[0] parses as an int.
  for (const row of rows) {
    const cells = $(row).find('> th, > td').toArray();
    if (cells.length !== FULL_ROW_CELLS) continue;

    const numberText = $(cells[COL_RACE_NUMBER]).text().replace(/[^\d]/g, '');
    if (!numberText) continue;
    const round = parseInt(numberText, 10);
    if (!Number.isFinite(round)) continue;

    const raceName = cleanText($(cells[COL_RACE_NAME]).text());
    const winner = cleanText($(cells[COL_WINNER]).text());
    const manufacturer = cleanText($(cells[COL_MANUFACTURER]).text());
    if (!raceName || !winner) continue;

    const date = parseDateFromRoundsLookup(round, rounds);
    if (!date) continue;

    const entry: RaceResultEntry = {
      position: 1,
      driverName: winner,
      // Wikipedia's manufacturer is the closest team analog available in the
      // summary table. The race-detail subpages are not parsed in Phase 1.
      team: manufacturer || 'Unknown',
      status: 'Winner',
      // No headline time-of-win is published in the Race_results summary
      // (only fastest-lap driver is listed, not the lap time). Leave undefined.
      time: undefined,
      // The 2026 NASCAR Cup Series points-to-winner is a stage-aware total
      // that varies per race; without per-race detail we surface 0 as a
      // sentinel rather than a fake value. Override via results-overrides
      // when accuracy matters.
      points: 0,
    };

    // The Race_results summary only reports the winner; no other finishers
    // are listed in this table. Phase 2 can parse the per-race subpages.
    const result: RaceResult = {
      round,
      raceName: raceName.replace(/^\d+\s*/, '').trim() || raceName,
      date,
      // The summary table doesn't carry circuit names explicitly; the race
      // name is paddock's closest "where" signal here (e.g. "Daytona 500",
      // "Coca-Cola 600"). The Calendar tab carries the real circuit-name
      // mapping via rounds.json.
      circuit: raceName,
      results: [entry],
    };
    races.push(result);
  }

  return races;
}

interface FetchOptions {
  rounds: Array<{ round: number; startDate: string; name?: string }>;
}

export async function fetchNascarCupSeasonResults(
  options: FetchOptions,
): Promise<RaceResult[]> {
  let html: string;
  try {
    const res = await fetch(SEASON_PAGE_URL, {
      headers: {
        'User-Agent':
          'PaddockTracker/1.0 (+https://paddock-tracker.com; contact: pparaskevas.dev@gmail.com)',
        Accept: 'text/html',
      },
      next: { revalidate: 3600 },
    } as RequestInit);
    if (!res.ok) return [];
    html = await res.text();
  } catch {
    return [];
  }

  try {
    const races = parseRaceTable(html, options.rounds);
    if (races.length < MIN_RACES) return [];
    return races.sort((a, b) => a.round - b.round);
  } catch {
    return [];
  }
}

// Exposed only for tests; the production code path goes through
// fetchNascarCupSeasonResults().
export const __internal = { parseRaceTable };