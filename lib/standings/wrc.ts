import * as cheerio from 'cheerio';
import { fetchUpstream } from '@/lib/fetch-upstream';
import type { Element } from 'domhandler';
import type { DriverStanding, ConstructorStanding } from '@/lib/types';

export type { DriverStanding, ConstructorStanding };

// WRC.com bot-blocks unauthenticated requests with a 403, so Wikipedia is the
// primary source; wrc.com is only used as a best-effort first attempt (Vercel's
// outbound IPs sometimes whitelist past Akamai but the agent's tools do not).
//
// The Wikipedia URL has the rendered HTML the cheerio scraper needs:
// it contains three `wikitable` blocks for Drivers / Co-Drivers / Manufacturers
// in the WRC1 (top class) tier. WRC2 / WRC3 / Junior live on separate pages
// and are deferred to a Phase 2 PR.
const WIKIPEDIA_URL = 'https://en.wikipedia.org/wiki/2026_World_Rally_Championship';
const WRC_LIVE_URL = 'https://www.wrc.com/en/championship/standings/';

// Realistic top-class field — Rally1 has only a handful of full-season entries.
// The 2026 grid runs Toyota (3 crews), Hyundai (3 crews), and M-Sport Ford
// (2 crews) → ~8 regulars + occasional one-off entries. Fail closed below 5;
// real grids never dip that low, so <5 means the source page restructured.
const MIN_DRIVERS = 5;
const MIN_MANUFACTURERS = 2;

/** Co-driver standing — uses the same shape as DriverStanding but the team
 *  column is the manufacturer/team they share with their driver. */
export interface CoDriverStanding {
  position: number;
  coDriverName: string;
  team: string;
  points: number;
}

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

// Pull the first integer out of a cell (used for both position and points).
// Wikipedia totals are rendered as bold integers in the last cell, but may
// contain whitespace, footnote markers, or thin-space separators.
function extractInt(text: string): number | null {
  const m = text.replace(/,/g, '').match(/-?\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

// Clean a Wikipedia name cell: drop flag icon text (e.g. "GBR" / country
// abbreviation appears as the flagicon's title/alt), drop any [1]-style
// footnote markers, collapse whitespace.
function cleanName(text: string): string {
  return text
    .replace(/\[\d+\]/g, '')
    .replace(/ /g, ' ') // nbsp → space
    .replace(/\s+/g, ' ')
    .trim();
}

// Wikipedia's `wikitable` standings have one <tr> per crew/manufacturer plus
// 1-2 header rows. The Drivers' / Co-Drivers' tables use the same shape:
//
//   <tr>
//     <th>1</th>                        ← position (sometimes <td>)
//     <td><span class="flagicon">…</span>
//         <a href="/wiki/Elfyn_Evans">Elfyn Evans</a></td>
//     <td style="background:#X">…</td>  ← 14 per-round cells
//     …
//     <th>123</th>                       ← total (sometimes <td>)
//   </tr>
//
// We only need first column (position) + second column (name) + last column
// (points). The 14 round cells are skipped — points are denormalized into
// the total, which is what users care about.
function parseStandingsTable<T>(
  $: cheerio.CheerioAPI,
  table: cheerio.Cheerio<Element>,
  build: (position: number, name: string, points: number) => T | null,
): T[] {
  const rows: T[] = [];
  // Use a CSS selector that picks up <tr> children of either <tbody> or the
  // <table> directly — Wikipedia's parser is inconsistent about whether the
  // tbody wrapper is emitted.
  const trs = table.find('tr');
  trs.each((_, tr) => {
    const cells = $(tr).children('th, td');
    if (cells.length < 3) return;

    const positionText = $(cells[0]).text().trim();
    const position = Number(positionText.replace(/[^\d]/g, ''));
    if (!Number.isFinite(position) || position < 1) return;

    const nameCell = $(cells[1]);
    // Wikipedia's name cell often contains TWO <a> tags: the flagicon link
    // (whose text is just whitespace around an <img>) and the driver /
    // manufacturer page link. Pick the first <a> whose text has actual
    // content; fall back to the cell's full text if none.
    let linkText = '';
    nameCell.find('a').each((_, a) => {
      if (linkText) return;
      const t = $(a).text().trim();
      if (t) linkText = t;
    });
    const name = cleanName(linkText || nameCell.text());
    if (!name) return;

    const pointsText = $(cells[cells.length - 1]).text();
    const points = extractInt(pointsText);
    if (points == null) return;

    const built = build(position, name, points);
    if (built) rows.push(built);
  });
  return rows;
}

// Locate the standings table immediately after a heading whose anchor id
// matches one of the regex patterns. Wikipedia's section anchors live on
// the heading element itself (Parsoid output) or on a wrapping
// <span class="mw-headline" id="…"> inside the heading (legacy output).
// We walk forward in document order until we hit the next wikitable.
function findTableAfterHeading(
  $: cheerio.CheerioAPI,
  headingIdPatterns: RegExp[],
): cheerio.Cheerio<Element> | null {
  for (const pat of headingIdPatterns) {
    let found: cheerio.Cheerio<Element> | null = null;
    $('h2, h3').each((_, headingEl) => {
      if (found) return;
      const heading = $(headingEl);
      const id =
        heading.attr('id') ??
        heading.find('[id]').first().attr('id') ??
        '';
      if (!pat.test(id)) return;

      // Wikipedia (2024+) wraps headings in <div class="mw-heading"> so the
      // semantic "next sibling" is the div's sibling, not the h3's sibling.
      // Walking heading.next() directly returns the .mw-editsection chrome
      // inside the wrapper and the loop exits with nothing — which is what
      // caused the 0.11.9 WRC parser to fail closed on production Wikipedia
      // even though local synthetic fixtures (without the wrapper) passed.
      const parent = heading.parent();
      const startEl = parent.hasClass('mw-heading') ? parent : heading;
      let cursor = startEl.next();
      while (cursor.length > 0) {
        // Stop at the next heading of the same or higher level so a missing
        // table doesn't accidentally pick up an unrelated downstream one.
        // Handle both the bare-heading and the mw-heading-wrapped forms.
        if (cursor.is('h2') || (heading.is('h3') && cursor.is('h3'))) break;
        if (cursor.hasClass('mw-heading')) {
          const innerH = cursor.find('h2, h3').first();
          if (innerH.length > 0) {
            const innerLevel = (innerH.get(0) as { tagName?: string }).tagName?.toLowerCase();
            if (innerLevel === 'h2' || (heading.is('h3') && innerLevel === 'h3')) break;
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

export interface WRCStandings {
  drivers: DriverStanding[];
  coDrivers: CoDriverStanding[];
  manufacturers: ConstructorStanding[];
}

// Drivers' rows on Wikipedia don't carry the constructor name in the same
// table — the manufacturers' table is the source for team-level totals — so
// per-driver `team` is left as an empty string. The DriversTable renderer
// tolerates an empty team without breaking layout.
export function parseStandingsFromHtml(html: string): WRCStandings | null {
  try {
    const $ = cheerio.load(html);

    const driversTable = findTableAfterHeading($, [
      /Drivers'?_World_Championship/i,
      /World_Rally_Championship_for_Drivers/i,
      /^Drivers'?_Championship$/i,
    ]);
    const coDriversTable = findTableAfterHeading($, [
      /Co-?Drivers'?_World_Championship/i,
      /World_Rally_Championship_for_Co-?Drivers/i,
      /^Co-?Drivers'?_Championship$/i,
    ]);
    const manufacturersTable = findTableAfterHeading($, [
      /Manufacturers'?_Championship/i,
      /World_Rally_Championship_for_Manufacturers/i,
    ]);

    if (!driversTable || !coDriversTable || !manufacturersTable) return null;

    const drivers = parseStandingsTable<DriverStanding>(
      $,
      driversTable,
      (position, name, points) => ({
        position,
        driverName: name,
        team: '',
        points,
      }),
    );

    const coDrivers = parseStandingsTable<CoDriverStanding>(
      $,
      coDriversTable,
      (position, name, points) => ({
        position,
        coDriverName: name,
        team: '',
        points,
      }),
    );

    const manufacturers = parseStandingsTable<ConstructorStanding>(
      $,
      manufacturersTable,
      (position, name, points) => ({
        position,
        name,
        points,
      }),
    );

    if (drivers.length < MIN_DRIVERS) return null;
    if (coDrivers.length < MIN_DRIVERS) return null;
    if (manufacturers.length < MIN_MANUFACTURERS) return null;

    return {
      drivers: drivers.sort((a, b) => a.position - b.position),
      coDrivers: coDrivers.sort((a, b) => a.position - b.position),
      manufacturers: manufacturers.sort((a, b) => a.position - b.position),
    };
  } catch {
    return null;
  }
}

export async function fetchWRCStandings(): Promise<WRCStandings | null> {
  // wrc.com is the user-facing source but bot-blocks the agent fetcher with
  // 403. Production Vercel fetches may also be 403'd by the upstream WAF;
  // we attempt it first (cheap) and fall back to Wikipedia, which has a
  // stable wikitable structure and is publicly reachable. wrc.com's HTML
  // structure is not confirmed against a real fetch — if it is also a
  // JS-rendered SPA, parseStandingsFromHtml returns null (no wikitable
  // anchors → no tables found) and we route to Wikipedia without any wrong
  // data leaking.
  const wrcHtml = await fetchHtml(WRC_LIVE_URL);
  if (wrcHtml) {
    const parsed = parseStandingsFromHtml(wrcHtml);
    if (parsed) return parsed;
  }

  const wikiHtml = await fetchHtml(WIKIPEDIA_URL);
  if (!wikiHtml) return null;
  return parseStandingsFromHtml(wikiHtml);
}
