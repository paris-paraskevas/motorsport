import * as cheerio from 'cheerio';
import type { RaceResult, RaceResultEntry } from '@/lib/types';
import {
  readResultsCache,
  writeResultsCache,
  seasonCacheKey,
} from '@/lib/results-cache';

export type { RaceResult, RaceResultEntry };

// The driver standings page also carries the SeasonRaces array (raceId +
// round number + dates + circuit short-name), so we use it as the season
// manifest rather than scraping the calendar page separately.
const SEASON_MANIFEST_URL = 'https://www.fiaformula2.com/Standings/Driver';
const RESULTS_URL = (raceId: number): string =>
  `https://www.fiaformula2.com/Results?raceid=${raceId}`;

// F2 official points tables.
// Sprint Race: top 8 score; pole position is a separate session not on the
// SR results table, so we don't try to credit it.
// Feature Race: top 10 score; fastest lap inside the top 10 earns +1 but the
// results table does not flag fastest lap. We deliberately omit FL/pole
// bonuses to keep this fail-closed and deterministic — small mismatches
// versus standings totals are absorbed via results-overrides.json when an
// operator chooses to curate them. Source:
// https://en.wikipedia.org/wiki/FIA_Formula_2_Championship
const SPRINT_POINTS = [10, 8, 6, 5, 4, 3, 2, 1];
const FEATURE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

// Concurrent fan-out cap when fetching per-round result pages. Each race page
// is ~200 KB; even with 14 rounds the parallel volume is modest, but the
// origin (FIA-shared SSR template) has been observed to throttle bursts.
const MAX_CONCURRENT_RACE_FETCHES = 6;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

interface NextDataSession {
  SessionShortName?: string;
}

interface NextDataSeasonRace {
  RaceId?: number;
  CircuitShortName?: string;
  CountryFlagImagePath?: string;
  Provisional?: boolean;
  RaceStartDate?: string;
  RaceEndDate?: string;
  Sessions?: NextDataSession[];
}

interface NextDataStandingsRoot {
  props?: {
    pageProps?: {
      pageData?: {
        SeasonRaces?: NextDataSeasonRace[];
      };
    };
  };
}

interface NextDataResultRow {
  DriverId?: number;
  FinishPosition?: number | null;
  DriverForename?: string;
  DriverSurname?: string;
  TLA?: string;
  DriverDisplayName?: string;
  TeamName?: string;
  TimeOrFinishReason?: string | null;
  Gap?: string | null;
  ResultStatus?: string | null;
  DisplayFinishPosition?: string | null;
}

interface NextDataSessionResult {
  SessionShortName?: string;
  SessionType?: string;
  HideSessionResult?: boolean;
  SessionResultsAvailable?: boolean;
  Results?: NextDataResultRow[];
}

interface NextDataResultsRoot {
  props?: {
    pageProps?: {
      pageData?: {
        RaceId?: number;
        RoundNumber?: number;
        RaceStartDate?: string;
        RaceEndDate?: string;
        CountryName?: string;
        CircuitInformation?: { CircuitName?: string; CircuitShortName?: string };
        SessionResults?: NextDataSessionResult[];
      };
    };
  };
}

function extractNextData(html: string): unknown | null {
  try {
    const $ = cheerio.load(html);
    const raw = $('script#__NEXT_DATA__').first().html();
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function parseDate(date: string | undefined | null): Date | null {
  if (!date) return null;
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
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

function pointsFor(table: number[], finishPosition: number | null | undefined): number {
  if (typeof finishPosition !== 'number' || !Number.isFinite(finishPosition)) return 0;
  if (finishPosition < 1 || finishPosition > table.length) return 0;
  return table[finishPosition - 1] ?? 0;
}

// Build a RaceResultEntry from a SessionResults row. Status semantics:
//   - finishers get ResultStatus null → mark as "Finished"
//   - DNF / DNS / NC / DSQ rows have ResultStatus = "Ret"/"DNS"/... and
//     FinishPosition = null; we prefer the DisplayFinishPosition string
//     ("DNF", "DNS", "DSQ", "NC") for the status field since that matches
//     what the page renders.
function buildEntry(
  row: NextDataResultRow,
  fallbackPosition: number,
  pointsTable: number[],
): RaceResultEntry | null {
  const driverName =
    row.DriverForename && row.DriverSurname
      ? `${row.DriverForename} ${row.DriverSurname}`
      : row.DriverDisplayName;
  const team = row.TeamName;
  if (!driverName || !team) return null;

  const numericPos =
    typeof row.FinishPosition === 'number' && Number.isFinite(row.FinishPosition)
      ? row.FinishPosition
      : null;

  // Non-finishers don't have a numeric finish position; we synthesize one
  // (driver list order) so the table can render them at the bottom in source
  // order. They contribute zero points.
  const position = numericPos ?? fallbackPosition;
  const status =
    row.ResultStatus && row.DisplayFinishPosition
      ? row.DisplayFinishPosition
      : row.ResultStatus
        ? row.ResultStatus
        : 'Finished';

  const time = row.TimeOrFinishReason ?? row.Gap ?? undefined;

  return {
    position,
    driverName,
    driverCode: row.TLA,
    team,
    status,
    time: typeof time === 'string' ? time : undefined,
    points: numericPos != null ? pointsFor(pointsTable, numericPos) : 0,
  };
}

function buildRaceResult(
  data: NextDataResultsRoot | null,
  sessionShortName: 'SR' | 'FR',
  pointsTable: number[],
): RaceResult | null {
  const pd = data?.props?.pageProps?.pageData;
  if (!pd) return null;
  const session = pd.SessionResults?.find(s => s?.SessionShortName === sessionShortName);
  if (!session || !session.Results || session.Results.length === 0) return null;
  if (session.HideSessionResult || session.SessionResultsAvailable === false) return null;

  const round = Number(pd.RoundNumber);
  if (!Number.isFinite(round)) return null;

  const date = parseDate(pd.RaceEndDate ?? pd.RaceStartDate);
  if (!date) return null;

  const circuit =
    pd.CircuitInformation?.CircuitName ?? pd.CircuitInformation?.CircuitShortName;
  if (!circuit) return null;

  const countryName = pd.CountryName ?? pd.CircuitInformation?.CircuitShortName ?? 'Round';
  const raceTypeLabel = sessionShortName === 'FR' ? 'Feature Race' : 'Sprint Race';
  const raceName = `${countryName} ${raceTypeLabel}`;

  const results: RaceResultEntry[] = [];
  // First pass: classify finishers (numeric FinishPosition); sort by ascending.
  const finishers = session.Results.filter(
    r => typeof r.FinishPosition === 'number' && Number.isFinite(r.FinishPosition),
  ).sort((a, b) => (a.FinishPosition as number) - (b.FinishPosition as number));
  const nonFinishers = session.Results.filter(
    r => !(typeof r.FinishPosition === 'number' && Number.isFinite(r.FinishPosition)),
  );

  let fallback = finishers.length + 1;
  for (const r of finishers) {
    const entry = buildEntry(r, fallback, pointsTable);
    if (entry) results.push(entry);
  }
  for (const r of nonFinishers) {
    const entry = buildEntry(r, fallback++, pointsTable);
    if (entry) results.push(entry);
  }

  if (results.length === 0) return null;
  return { round, raceName, date, circuit, results };
}

async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  }
  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(limit, items.length); i++) workers.push(worker());
  await Promise.all(workers);
  return out;
}

function pickResultRaceIds(seasonRaces: NextDataSeasonRace[]): number[] {
  const out: number[] = [];
  for (const r of seasonRaces) {
    if (typeof r.RaceId !== 'number') continue;
    if (r.Provisional === true) continue;
    const hasResultSession = r.Sessions?.some(s =>
      s?.SessionShortName === 'SR' || s?.SessionShortName === 'FR',
    );
    if (!hasResultSession) continue;
    out.push(r.RaceId);
  }
  return out;
}

export interface F2SeasonResults {
  feature: RaceResult[];
  sprint: RaceResult[];
}

export async function fetchF2SeasonResults(season?: number): Promise<F2SeasonResults> {
  // Cache layer. Only consulted when a season is supplied — without it the
  // cache key is ambiguous across years. The ResultsTab dispatch always passes
  // `series.meta.season`, so production hits this path; legacy callers that
  // omit it (none today, but the parameter was historically optional) fall
  // through to the uncached fan-out.
  if (typeof season === 'number') {
    const key = seasonCacheKey('f2', season);
    const cached = await readResultsCache<F2SeasonResults>(key);
    if (cached) return cached;
  }

  const manifestHtml = await fetchHtml(SEASON_MANIFEST_URL);
  if (!manifestHtml) return { feature: [], sprint: [] };

  const manifestData = extractNextData(manifestHtml) as NextDataStandingsRoot | null;
  const seasonRaces = manifestData?.props?.pageProps?.pageData?.SeasonRaces;
  if (!Array.isArray(seasonRaces) || seasonRaces.length === 0) {
    return { feature: [], sprint: [] };
  }

  const raceIds = pickResultRaceIds(seasonRaces);
  if (raceIds.length === 0) return { feature: [], sprint: [] };

  const racePages = await mapWithLimit(
    raceIds,
    MAX_CONCURRENT_RACE_FETCHES,
    async id => {
      const html = await fetchHtml(RESULTS_URL(id));
      return html ? (extractNextData(html) as NextDataResultsRoot | null) : null;
    },
  );

  const feature: RaceResult[] = [];
  const sprint: RaceResult[] = [];
  for (const page of racePages) {
    const fr = buildRaceResult(page, 'FR', FEATURE_POINTS);
    if (fr) feature.push(fr);
    const sr = buildRaceResult(page, 'SR', SPRINT_POINTS);
    if (sr) sprint.push(sr);
  }

  feature.sort((a, b) => a.round - b.round);
  sprint.sort((a, b) => a.round - b.round);

  const out: F2SeasonResults = { feature, sprint };
  if (typeof season === 'number' && (feature.length > 0 || sprint.length > 0)) {
    // Only cache non-empty results — caching an empty payload would freeze the
    // "temporarily unavailable" UI for 3h when upstream had a transient blip.
    await writeResultsCache(seasonCacheKey('f2', season), out);
  }
  return out;
}
