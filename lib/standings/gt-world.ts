import * as cheerio from 'cheerio';
import type { DriverStanding, ConstructorStanding } from '@/lib/types';

export type { DriverStanding, ConstructorStanding };

// GT World Challenge Europe — Sprint Cup + Endurance Cup + Overall.
//
// The official site at gt-world-challenge-europe.com is SSR'd HTML with a
// single big standings table per (championship × category × view) combination
// selected via two query-string filters:
//
//   filter_season_id     — site-internal season slot ID (NOT the calendar
//                          year). 2026 → 26. We hardcode the mapping here
//                          because the site has no JSON endpoint that
//                          enumerates it.
//   filter_standing_type — `${championshipId}_${categoryId}_${view}` where:
//                          championshipId: 0 (Overall), 42 (Endurance Cup),
//                                          43 (Sprint Cup)
//                          categoryId:     0 (Overall — all classes),
//                                          80 (Bronze), 81 (Gold),
//                                          82 (Silver), 83 (Pro)
//                          view:           "drivers" or "teams"
//
// The table layout is identical across every combination — the per-session
// columns differ by championship (Sprint has Q + MR per round; Endurance has
// Q1 + Q2 + R1 + R2, or 6h/12h/24h splits at Spa) but the first three
// columns are always [Pos, Name (with link), TOTAL]. Everything after that
// is per-round breakdowns we don't render in the standings tab — we only
// need the total to drive the championship-position list.
//
// Fail-closed mirrors `lib/standings/indycar.ts`: a sanity floor of MIN_ROWS
// catches structurally-broken responses (CMS rebuild, anti-bot page, etc.)
// rather than ship a partial-and-misleading table.

// SRO's site uses /standings?filter_season_id=26 for the 2026 selector. The
// map from calendar year to that internal slot is short-lived per season
// but must be kept in sync when we roll over. Last verified 2026-05-20.
const SEASON_ID_BY_YEAR: Record<number, number> = {
  2026: 26,
  2025: 25,
  2024: 24,
};

const BASE_URL = 'https://www.gt-world-challenge-europe.com/standings';

// Below ~6 rows means the season hasn't started yet OR the page format
// changed. Either way we fail closed and the tab renders the "temporarily
// unavailable" placeholder; an empty UI is worse than a clear pause.
const MIN_ROWS = 6;

export type Championship = 'overall' | 'sprint' | 'endurance';
export type Category = 'overall' | 'pro' | 'gold' | 'silver' | 'bronze';

interface BuildUrlArgs {
  season: number;
  championship: Championship;
  category: Category;
  view: 'drivers' | 'teams';
}

const CHAMPIONSHIP_ID: Record<Championship, string> = {
  overall: '0',
  endurance: '42',
  sprint: '43',
};

const CATEGORY_ID: Record<Category, string> = {
  overall: '0',
  bronze: '80',
  gold: '81',
  silver: '82',
  pro: '83',
};

export function buildStandingsUrl(args: BuildUrlArgs): string | null {
  const seasonId = SEASON_ID_BY_YEAR[args.season];
  if (seasonId == null) return null;
  const champ = CHAMPIONSHIP_ID[args.championship];
  const cat = CATEGORY_ID[args.category];
  const view = args.view;
  return `${BASE_URL}?filter_season_id=${seasonId}&filter_standing_type=${champ}_${cat}_${view}`;
}

// The header row uses plain <td> cells (NOT <th>) and starts with "POS" /
// "TEAM" / "TOTAL" or "POS" / "DRIVER" / "TOTAL". We skip rows whose first
// cell text is not a finite integer — this drops the header row AND any
// section-break rows that may slip in.
export function parseStandingsHtml<T>(
  html: string,
  rowMapper: (cells: string[], anchorText: string | null) => T | null,
): T[] | null {
  try {
    const $ = cheerio.load(html);
    // The site renders exactly one big standings table per page. Picking
    // the first one is intentional and verified.
    const table = $('table').first();
    if (table.length === 0) return null;
    const out: T[] = [];
    table.find('tbody tr').each((_, el) => {
      const cells = $(el)
        .find('td')
        .map((__, td) => $(td).text().trim())
        .get();
      if (cells.length < 3) return;
      const posText = cells[0];
      // Drop the header row and anything not numeric.
      if (!/^\d+$/.test(posText)) return;
      // The name cell contains <a>name</a>; cheerio's text() gives the
      // inner text but we keep an explicit getter so a future CMS change
      // that moves the team/driver name into a child element still works.
      const anchorText =
        $(el).find('td').eq(1).find('a').first().text().trim() || null;
      const mapped = rowMapper(cells, anchorText);
      if (mapped) out.push(mapped);
    });
    if (out.length < MIN_ROWS) return null;
    return out;
  } catch {
    return null;
  }
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        // Match the indycar.com loader pattern: some CMS layers return a
        // SPA shell to non-browser UAs.
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        Accept: 'text/html',
      },
      // Hourly revalidate. GTWCE updates each event's points within an
      // hour of the chequered flag.
      next: { revalidate: 3600 },
    } as RequestInit);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchStandingsTable<T>(
  args: BuildUrlArgs,
  mapper: (cells: string[], anchorText: string | null) => T | null,
): Promise<T[] | null> {
  const url = buildStandingsUrl(args);
  if (!url) return null;
  const html = await fetchHtml(url);
  if (!html) return null;
  return parseStandingsHtml<T>(html, mapper);
}

function mapDriverRow(
  cells: string[],
  anchorText: string | null,
): DriverStanding | null {
  const position = Number(cells[0]);
  const points = Number(cells[2]);
  // Anchor text is preferred (clean name); fall back to raw cell text if
  // the link element ever disappears.
  const driverName = (anchorText ?? cells[1]).trim();
  if (!Number.isFinite(position) || !Number.isFinite(points) || !driverName) {
    return null;
  }
  return {
    position,
    driverName,
    // GTWCE driver standings page has no team column — drivers race for a
    // car (a team can field multiple cars across classes), and the
    // official standings table omits team affiliation on the driver view.
    // Leave it blank rather than guessing.
    team: '',
    points,
  };
}

function mapTeamRow(
  cells: string[],
  anchorText: string | null,
): ConstructorStanding | null {
  const position = Number(cells[0]);
  const points = Number(cells[2]);
  const name = (anchorText ?? cells[1]).trim();
  if (!Number.isFinite(position) || !Number.isFinite(points) || !name) {
    return null;
  }
  return { position, name, points };
}

export interface GtWorldStandingsSection {
  championship: Championship;
  drivers: DriverStanding[];
  teams: ConstructorStanding[];
}

export interface GtWorldStandings {
  season: number;
  overall: GtWorldStandingsSection;
  sprint: GtWorldStandingsSection;
  endurance: GtWorldStandingsSection;
}

// Fetch all 6 tables (3 championships × {drivers, teams}) in parallel.
// Each section fails closed individually — if a single sub-fetch fails we
// drop that championship's data but still return the others. The caller
// decides how to render partial state. We return null only if EVERY
// drivers table failed (likely network outage / CMS rebuild), which
// mirrors the F1 loader contract: null → render the "temporarily
// unavailable" placeholder.
export async function fetchGtWorldStandings(
  season: number = 2026,
): Promise<GtWorldStandings | null> {
  const championships: Championship[] = ['overall', 'sprint', 'endurance'];
  const results = await Promise.all(
    championships.map(async champ => {
      const [drivers, teams] = await Promise.all([
        fetchStandingsTable<DriverStanding>(
          {
            season,
            championship: champ,
            category: 'overall',
            view: 'drivers',
          },
          mapDriverRow,
        ),
        fetchStandingsTable<ConstructorStanding>(
          {
            season,
            championship: champ,
            category: 'overall',
            view: 'teams',
          },
          mapTeamRow,
        ),
      ]);
      return {
        championship: champ,
        drivers: drivers ?? [],
        teams: teams ?? [],
      } satisfies GtWorldStandingsSection;
    }),
  );
  const overall = results.find(r => r.championship === 'overall')!;
  const sprint = results.find(r => r.championship === 'sprint')!;
  const endurance = results.find(r => r.championship === 'endurance')!;
  // Fail-closed: if every drivers table came back empty we have nothing
  // to render. Empty teams alone is acceptable (could legitimately be
  // early-season before any rounds run).
  if (
    overall.drivers.length === 0 &&
    sprint.drivers.length === 0 &&
    endurance.drivers.length === 0
  ) {
    return null;
  }
  return { season, overall, sprint, endurance };
}
