import http2 from 'node:http2';
import * as cheerio from 'cheerio';
import type { RaceResult, RaceResultEntry } from '@/lib/types';

export type { RaceResult, RaceResultEntry };

// NASCAR Cup Series — full per-race classification sourced directly from
// racing-reference.info. The 2026-05-22 probe confirmed the Phase-1-locked
// finding that the site returns 200 from a real desktop browser, but a
// follow-up gotcha surfaced when wiring this up: Cloudflare's WAF on
// racing-reference 403s Node's `fetch()` (undici) and the native `https`
// module both — the WAF fingerprints the TLS handshake (cipher list / ALPN
// order), and Node's stock TLS profile is flagged as a bot. curl gets
// through; so does `node:http2`. We use the http2 client to make every
// request, which is also nice for fan-out: one TLS handshake multiplexes
// the season index + N per-race requests over a single connection.
//
// Trade-off vs. plain `fetch`: we lose Next's built-in `next: { revalidate }`
// fetch cache. The series page itself revalidates on the framework cadence,
// so upstream load is still bounded — but if request volume grows, the
// next move is wrapping `fetchHtml` with Vercel's Runtime Cache or a
// `unstable_cache` boundary.
//
// The flow is two-step:
//   1. Fetch the season-stats index page (`/season-stats/<year>/W/`) to
//      discover every per-race URL that has data ready (RR only lists races
//      after they've happened — perfect for incremental population).
//   2. Fetch each per-race page in parallel over the same http2 client,
//      parse the `table.race-results-tbl` classification grid (40-ish rows,
//      10 columns).
//
// Per-race-row columns per the probe:
//   0: Pos    1: St    2: #    3: Driver    4: Sponsor / Owner
//   5: Car (manufacturer)    6: Laps    7: Status    8: Led    9: Pts
//
// The "Sponsor / Owner" cell embeds the team name in a parenthetical
// (e.g. `"Chumba Casino   (23XI Racing)"`). Per the Phase 1 operator decision
// locked via AskUserQuestion 2026-05-20, the team field surfaces the owner
// team, not the manufacturer — sponsors rotate within a season, owners
// don't.

const ORIGIN = 'https://www.racing-reference.info';
const SEASON_PATH = '/season-stats/2026/W/';

const REQUEST_HEADERS: http2.OutgoingHttpHeaders = {
  ':method': 'GET',
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
  // Identity encoding keeps the response easy to read as a string. The
  // index + per-race pages are 180-220 KB — gzip would save bandwidth but
  // adds a zlib step; not worth it for 12-36 requests per season.
  'accept-encoding': 'identity',
};

// Sanity floors. A complete classification is ~38-41 cars; under 20 means
// we landed on a structurally-broken response, mid-edit page, or the WAF
// served a sentinel. Fail closed.
const MIN_RACES = 1;
const MIN_ENTRIES_PER_RACE = 20;

const COL_POS = 0;
const COL_CAR_NUMBER = 2;
const COL_DRIVER = 3;
const COL_SPONSOR_OWNER = 4;
const COL_STATUS = 7;
const COL_POINTS = 9;
const EXPECTED_COLUMNS = 10;

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

// "Chumba Casino   (23XI Racing)" → "23XI Racing"
// Falls back to the whole cell if no parenthetical is present (so a future
// RR layout change that drops the owner doesn't blank the team column).
function extractOwnerTeam(sponsorOwnerCell: string): string {
  const match = sponsorOwnerCell.match(/\(([^)]+)\)\s*$/);
  if (match) return match[1].trim();
  return sponsorOwnerCell.trim();
}

interface RaceLink {
  round: number;
  url: string;
}

export function parseSeasonRaceLinks(html: string): RaceLink[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const out: RaceLink[] = [];
  $('.race-number a[href*="/race-results/"]').each((_, a) => {
    const href = $(a).attr('href');
    const roundText = $(a).text().trim();
    const round = Number(roundText);
    if (!href || seen.has(href) || !Number.isFinite(round)) return;
    seen.add(href);
    out.push({ round, url: href });
  });
  return out;
}

export function parseRaceResultsHtml(html: string): RaceResultEntry[] {
  const $ = cheerio.load(html);
  const table = $('table.race-results-tbl').first();
  if (table.length === 0) return [];
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
    entries.push({
      position,
      driverName,
      driverCode: cells[COL_CAR_NUMBER] || undefined,
      team: extractOwnerTeam(cells[COL_SPONSOR_OWNER]),
      // RR uses lowercase status tokens: "running", "crash", "engine",
      // "transmission", "rear gear", etc. Preserve verbatim — the UI styles
      // it as the small right-aligned label.
      status: cells[COL_STATUS] || 'unknown',
      time: undefined,
      points: Number.isFinite(points) ? points : 0,
    });
  });
  entries.sort((a, b) => a.position - b.position);
  return entries;
}

export function buildRaceResultFromPage(
  html: string,
  round: number,
  rounds: Array<{ round: number; startDate: string; name?: string }>,
): RaceResult | null {
  const entries = parseRaceResultsHtml(html);
  if (entries.length < MIN_ENTRIES_PER_RACE) return null;
  const date = parseDateFromRoundsLookup(round, rounds);
  if (!date) return null;
  const $ = cheerio.load(html);
  const rawName = cleanText($('h1').first().text()) || `Round ${round}`;
  // RR's per-race H1 reads "2026 Daytona 500"; strip the leading year to
  // match the rest of the codebase's naming convention.
  const trimmedName = rawName.replace(/^\d{4}\s+/, '');
  return {
    round,
    raceName: trimmedName,
    date,
    // RR doesn't surface the track name as a separate cleanly-extractable
    // field — the race name is the closest "where" signal. The Calendar
    // tab carries the actual circuit-name mapping via `rounds.json`.
    circuit: trimmedName,
    results: entries,
  };
}

interface FetchOptions {
  rounds: Array<{ round: number; startDate: string; name?: string }>;
  // Test-only injection point. When provided, replaces the http2 transport
  // with a stub that returns canned bodies keyed by pathname. Production
  // calls never pass this — they hit racing-reference live via http2.
  transport?: (pathname: string) => Promise<{ status: number; body: string }>;
}

function fetchViaHttp2(
  session: http2.ClientHttp2Session,
  pathname: string,
): Promise<{ status: number; body: string }> {
  return new Promise(resolve => {
    const req = session.request({ ...REQUEST_HEADERS, ':path': pathname });
    let status = 0;
    let buf = Buffer.alloc(0);
    req.on('response', headers => {
      status = Number(headers[':status']) || 0;
    });
    req.on('data', chunk => {
      buf = Buffer.concat([buf, chunk]);
    });
    req.on('end', () => {
      resolve({ status, body: buf.toString('utf8') });
    });
    req.on('error', () => {
      resolve({ status: 0, body: '' });
    });
    req.end();
  });
}

function pathnameOf(href: string): string {
  try {
    return new URL(href).pathname;
  } catch {
    return href;
  }
}

export async function fetchNascarCupSeasonResults(
  options: FetchOptions,
): Promise<RaceResult[]> {
  // Tests inject a transport stub; production opens a real http2 client.
  // Either way the rest of the function flow is identical.
  let transport: (pathname: string) => Promise<{ status: number; body: string }>;
  let cleanup: (() => void) | undefined;
  if (options.transport) {
    transport = options.transport;
  } else {
    const session = http2.connect(ORIGIN);
    // Swallow socket-level errors so a flaky upstream connection returns []
    // rather than crashing the request handler.
    session.on('error', () => undefined);
    transport = pathname => fetchViaHttp2(session, pathname);
    cleanup = () => session.close();
  }

  try {
    const indexResp = await transport(SEASON_PATH);
    if (indexResp.status !== 200) return [];

    const links = parseSeasonRaceLinks(indexResp.body);
    if (links.length < MIN_RACES) return [];

    const settled = await Promise.all(
      links.map(async link => {
        const r = await transport(pathnameOf(link.url));
        if (r.status !== 200) return null;
        return buildRaceResultFromPage(r.body, link.round, options.rounds);
      }),
    );
    return settled
      .filter((r): r is RaceResult => r !== null)
      .sort((a, b) => a.round - b.round);
  } finally {
    cleanup?.();
  }
}
