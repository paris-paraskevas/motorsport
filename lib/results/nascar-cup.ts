import * as cheerio from 'cheerio';
import type { RaceResult, RaceResultEntry } from '@/lib/types';

export type { RaceResult, RaceResultEntry };

// NASCAR Cup Series — full per-race classification sourced from Wikipedia's
// per-race articles. The 2026-05-22 prod regression on PR #91 showed that
// racing-reference.info — the source we'd locked-in via Phase 1 — sits
// behind a Cloudflare WAF that 403s every datacenter IP regardless of TLS
// fingerprint (the `node:http2` localhost workaround returned 200 from a
// residential IP but the Cloudflare challenge page from Vercel's `iad1`).
// Wikipedia returns 200 from any IP because they want bots indexing them,
// and per the 2026-05-22 fallback probe each per-race article carries the
// full classification with the exact column set we need:
//
//   Pos | Grid | No | Driver | Team | Manufacturer | Laps | Points
//
// Pipeline:
//   1. Fetch the season-stats page (`2026_NASCAR_Cup_Series`) — same source
//      the standings parser already uses.
//   2. Walk the schedule/results table's "Report" anchors to discover one
//      per-race article URL per completed round.
//   3. Fetch each per-race article in parallel via stock `fetch()` (no http2
//      gymnastics needed — Wikipedia has no WAF).
//   4. Parse the largest matching race-results table on each article.
//
// Trend chart: kept conditional. NASCAR's per-finish points scale stays
// constant across the regular season; Wikipedia per-race articles carry
// the same numeric points the standings parser sums to its totals. The
// chart is rendered in ResultsTab.tsx when this fetcher returns non-empty
// data — if upstream becomes patchy, the standings tab remains the
// authority.

const SEASON_URL =
  'https://en.wikipedia.org/wiki/2026_NASCAR_Cup_Series';

const FETCH_HEADERS = {
  // Wikipedia is permissive but we identify Paddock for log courtesy.
  'User-Agent':
    'PaddockTracker/1.0 (+https://paddock-tracker.com; contact: pparaskevas.dev@gmail.com)',
  Accept: 'text/html',
};

// Sanity floors. A complete classification is ~38-41 cars; under 20 means
// we landed on a structurally-broken response, mid-edit article, or the
// wrong table on disambiguation. Fail closed.
const MIN_RACES = 1;
const MIN_ENTRIES_PER_RACE = 20;

const COL_POS = 0;
const COL_GRID = 1;
const COL_CAR_NUMBER = 2;
const COL_DRIVER = 3;
const COL_TEAM = 4;
// COL_MANUFACTURER = 5 — present but not surfaced; team is the headline.
// COL_LAPS = 6 — present but not surfaced.
const COL_POINTS = 7;
const EXPECTED_COLUMNS = 8;

function cleanText(s: string): string {
  return s
    .replace(/\[[^\]]{1,15}\]/g, '')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDateFromRoundsLookup(
  round: number,
  rounds: Array<{ round: number; startDate: string; name?: string }>,
): Date | null {
  const match = rounds.find(r => r.round === round);
  if (!match) return null;
  const d = new Date(`${match.startDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

interface RaceLink {
  round: number;
  url: string;
  raceName: string;
}

// The season page's race-results table has one row per round. Each row
// includes a "Report" anchor pointing to the per-race Wikipedia article.
// We walk the wikitable rows, counting them as rounds 1..N in document
// order (the table is chronologically sorted), and pair each round to its
// Report-link href. Preseason rows (Clash, Duels) come first and are
// skipped — we anchor on rows whose first cell parses as an integer round
// number.
export function parseSeasonRaceLinks(html: string): RaceLink[] {
  const $ = cheerio.load(html);
  const out: RaceLink[] = [];
  const seen = new Set<string>();

  // Walk every wikitable looking for race-result rows. Prefer the "Schedule
  // and results" table whose rows have a round-number first cell + a
  // Report column with a per-race link. Wikipedia's exact schedule-table
  // markup varies year to year, so we use a structural test rather than
  // anchoring on a specific section heading.
  $('table.wikitable').each((_, table) => {
    $(table)
      .find('tr')
      .each((_, tr) => {
        const cells = $(tr).find('th, td').toArray();
        if (cells.length < 4) return;
        const roundText = $(cells[0]).text().replace(/\D/g, '');
        if (!roundText) return;
        const round = Number(roundText);
        if (!Number.isFinite(round) || round < 1 || round > 50) return;

        // Find a /wiki/2026_* anchor anywhere in this row whose visible
        // text is "Report" (the link Wikipedia uses for the per-race
        // article). Fall back to any /wiki/2026_* link if no Report is
        // present (some articles use a race-name link instead).
        let url: string | null = null;
        let raceName = '';
        $(tr)
          .find('a[href^="/wiki/2026_"]')
          .each((_, a) => {
            if (url) return;
            const href = $(a).attr('href');
            const text = $(a).text().trim();
            if (!href) return;
            if (text === 'Report' || (!url && /^2026_/.test(href.slice(6)))) {
              url = `https://en.wikipedia.org${href}`;
              raceName = text === 'Report' ? '' : text;
            }
          });
        if (!url) return;
        if (seen.has(url)) return;
        seen.add(url);
        out.push({ round, url, raceName });
      });
  });

  return out;
}

interface RaceTableCandidate {
  table: ReturnType<cheerio.CheerioAPI>;
  rowCount: number;
}

// Per-race article structure: one or more wikitables; the race-results
// table has the canonical header row `Pos | Grid | No | Driver | Team |
// Manufacturer | Laps | Points`. The Daytona 500 article has THREE
// matching tables (two Duels + the main race) — we pick the one with the
// most rows since the 500 has 41 entries vs. the Duels' ~24 each. For
// most other races there's exactly one matching table.
function findRaceResultsTable(
  $: cheerio.CheerioAPI,
): ReturnType<cheerio.CheerioAPI> | null {
  let best: RaceTableCandidate | null = null;
  $('table.wikitable').each((_, t) => {
    const headerCells = $(t).find('tr').first().find('th, td');
    const header = headerCells
      .map((_, c) => $(c).text().trim().toLowerCase())
      .get()
      .join('|');
    if (
      !header.includes('pos') ||
      !header.includes('driver') ||
      !header.includes('manufacturer') ||
      !header.includes('points') ||
      !header.includes('laps')
    ) {
      return;
    }
    const rowCount = $(t).find('tr').length;
    if (!best || rowCount > best.rowCount) {
      best = { table: $(t), rowCount };
    }
  });
  return best ? (best as RaceTableCandidate).table : null;
}

export function parseRaceResultsHtml(html: string): RaceResultEntry[] {
  const $ = cheerio.load(html);
  const table = findRaceResultsTable($);
  if (!table) return [];

  const entries: RaceResultEntry[] = [];
  table.find('tr').each((idx, tr) => {
    if (idx === 0) return; // header
    const cells: string[] = [];
    $(tr)
      .find('td, th')
      .each((_, td) => {
        cells.push(cleanText($(td).text()));
      });
    if (cells.length !== EXPECTED_COLUMNS) return;
    const position = Number(cells[COL_POS]);
    if (!Number.isFinite(position)) return;
    const driverName = cells[COL_DRIVER];
    if (!driverName) return;
    const points = Number(cells[COL_POINTS]);
    void cells[COL_GRID];
    entries.push({
      position,
      driverName,
      driverCode: cells[COL_CAR_NUMBER] || undefined,
      team: cells[COL_TEAM],
      // Wikipedia per-race tables don't surface a "Status" column on the
      // headline classification — finishers are positioned by laps
      // completed and DNFs by reverse retirement order. We surface a flat
      // "Classified" for everyone; the UI's status column already falls
      // back to a sensible label when status is generic.
      status: 'Classified',
      time: undefined,
      points: Number.isFinite(points) ? points : 0,
    });
  });
  entries.sort((a, b) => a.position - b.position);
  return entries;
}

export function buildRaceResultFromPage(
  html: string,
  link: RaceLink,
  rounds: Array<{ round: number; startDate: string; name?: string }>,
): RaceResult | null {
  const entries = parseRaceResultsHtml(html);
  if (entries.length < MIN_ENTRIES_PER_RACE) return null;
  const date = parseDateFromRoundsLookup(link.round, rounds);
  if (!date) return null;
  const $ = cheerio.load(html);
  const rawName = cleanText($('h1').first().text()) || link.raceName || `Round ${link.round}`;
  // Per-race article H1 reads "2026 Daytona 500"; strip the leading year.
  const trimmedName = rawName.replace(/^\d{4}\s+/, '');
  return {
    round: link.round,
    raceName: trimmedName,
    date,
    circuit: trimmedName,
    results: entries,
  };
}

interface FetchOptions {
  rounds: Array<{ round: number; startDate: string; name?: string }>;
  // Test-only injection point. Production calls never pass this.
  fetchImpl?: (url: string) => Promise<{ status: number; body: string }>;
}

async function defaultFetch(url: string): Promise<{ status: number; body: string }> {
  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      next: { revalidate: 3600 },
    } as RequestInit);
    if (!res.ok) return { status: res.status, body: '' };
    const body = await res.text();
    return { status: res.status, body };
  } catch {
    return { status: 0, body: '' };
  }
}

export async function fetchNascarCupSeasonResults(
  options: FetchOptions,
): Promise<RaceResult[]> {
  const fetcher = options.fetchImpl ?? defaultFetch;

  const seasonResp = await fetcher(SEASON_URL);
  if (seasonResp.status !== 200) return [];

  const links = parseSeasonRaceLinks(seasonResp.body);
  if (links.length < MIN_RACES) return [];

  const settled = await Promise.all(
    links.map(async link => {
      const r = await fetcher(link.url);
      if (r.status !== 200) return null;
      return buildRaceResultFromPage(r.body, link, options.rounds);
    }),
  );
  return settled
    .filter((r): r is RaceResult => r !== null)
    .sort((a, b) => a.round - b.round);
}
