import * as cheerio from 'cheerio';
import type { RaceResult, RaceResultEntry } from '@/lib/types';
import {
  readResultsCache,
  writeResultsCache,
  seasonCacheKey,
} from '@/lib/results-cache';

export type { RaceResult, RaceResultEntry };

// The standings page exposes BOTH SeasonRaces[] (round manifest) AND
// Standings[].RacePoints (per-driver per-round canonical points). We fetch it
// once and use it as the source of truth for round-by-round per-driver
// points, rather than recomputing from finishing position.
//
// The recompute path was wrong for red-flag-reduced races: when a session
// runs < 50% of scheduled distance the FIA awards a truncated 5-4-3-2-1 to
// top 5 only (not the standard 10-9-8-7-6-5-4-3-2-1 to top 10). Melbourne
// 2026 Sprint Race was such a case — Ugochukwu P8 scored 0 in the official
// records but our prior parser awarded 1 from the hardcoded scale, producing
// the operator-reported 25-vs-26 standings/results disagreement.
const SEASON_MANIFEST_URL = 'https://www.fiaformula3.com/Standings/Driver';
const RESULTS_URL = (raceId: number): string =>
  `https://www.fiaformula3.com/Results?raceid=${raceId}`;

// Concurrent fan-out cap. Mirrors F2.
const MAX_CONCURRENT_RACE_FETCHES = 6;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

interface NextDataSession {
  SessionShortName?: string;
}

interface NextDataSeasonRace {
  RaceId?: number;
  CircuitShortName?: string;
  Provisional?: boolean;
  RaceStartDate?: string;
  RaceEndDate?: string;
  Sessions?: NextDataSession[];
}

interface NextDataStandingRow {
  DriverID?: number;
  TLA?: string;
  RacePoints?: Array<Array<number | null>>;
}

interface NextDataStandingsRoot {
  props?: {
    pageProps?: {
      pageData?: {
        SeasonRaces?: NextDataSeasonRace[];
        Standings?: NextDataStandingRow[];
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
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      next: { revalidate: 3600 },
    } as RequestInit);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// Driver-id → per-round RacePoints lookup. Each driver's RacePoints[i] =
// [SR_points, FR_points] for the (i+1)-th championship round.
function buildDriverPointsLookup(
  standings: NextDataStandingRow[] | undefined,
): Map<number, Array<[number | null, number | null]>> {
  const map = new Map<number, Array<[number | null, number | null]>>();
  if (!Array.isArray(standings)) return map;
  for (const row of standings) {
    if (typeof row.DriverID !== 'number') continue;
    if (!Array.isArray(row.RacePoints)) continue;
    const normalized: Array<[number | null, number | null]> = row.RacePoints.map(pair => {
      if (!Array.isArray(pair)) return [null, null];
      const sr = typeof pair[0] === 'number' ? pair[0] : null;
      const fr = typeof pair[1] === 'number' ? pair[1] : null;
      return [sr, fr];
    });
    map.set(row.DriverID, normalized);
  }
  return map;
}

function buildEntry(
  row: NextDataResultRow,
  fallbackPosition: number,
  // Canonical FIA points for this driver in this session, or null when the
  // driver isn't represented in standings RacePoints (rare data gap).
  canonicalPoints: number | null,
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
    // Canonical FIA points from standings.RacePoints — already accounts for
    // pole bonus, fastest-lap bonus, and red-flag-reduced scoring.
    points: canonicalPoints ?? 0,
  };
}

function buildRaceResult(
  data: NextDataResultsRoot | null,
  sessionShortName: 'SR' | 'FR',
  driverPoints: Map<number, Array<[number | null, number | null]>>,
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

  // RoundNumber is 1-indexed on the page; RacePoints arrays are 0-indexed.
  const roundIdx = round - 1;
  const sessionIdx = sessionShortName === 'SR' ? 0 : 1;
  function pointsFor(driverId: number | undefined): number | null {
    if (typeof driverId !== 'number') return null;
    const pts = driverPoints.get(driverId)?.[roundIdx]?.[sessionIdx];
    return typeof pts === 'number' ? pts : null;
  }

  const finishers = session.Results.filter(
    r => typeof r.FinishPosition === 'number' && Number.isFinite(r.FinishPosition),
  ).sort((a, b) => (a.FinishPosition as number) - (b.FinishPosition as number));
  const nonFinishers = session.Results.filter(
    r => !(typeof r.FinishPosition === 'number' && Number.isFinite(r.FinishPosition)),
  );

  const results: RaceResultEntry[] = [];
  let fallback = finishers.length + 1;
  for (const r of finishers) {
    const entry = buildEntry(r, fallback, pointsFor(r.DriverId));
    if (entry) results.push(entry);
  }
  for (const r of nonFinishers) {
    const entry = buildEntry(r, fallback++, pointsFor(r.DriverId));
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

export async function fetchF3SeasonResults(season: number): Promise<RaceResult[]> {
  const cacheKey = seasonCacheKey('f3', season);
  const cached = await readResultsCache<RaceResult[]>(cacheKey);
  if (cached) return cached;

  const manifestHtml = await fetchHtml(SEASON_MANIFEST_URL);
  if (!manifestHtml) return [];

  const manifestData = extractNextData(manifestHtml) as NextDataStandingsRoot | null;
  const pageData = manifestData?.props?.pageProps?.pageData;
  const seasonRaces = pageData?.SeasonRaces;
  if (!Array.isArray(seasonRaces) || seasonRaces.length === 0) {
    return [];
  }

  const driverPoints = buildDriverPointsLookup(pageData?.Standings);

  const raceIds = pickResultRaceIds(seasonRaces);
  if (raceIds.length === 0) return [];

  const racePages = await mapWithLimit(
    raceIds,
    MAX_CONCURRENT_RACE_FETCHES,
    async id => {
      const html = await fetchHtml(RESULTS_URL(id));
      return html ? (extractNextData(html) as NextDataResultsRoot | null) : null;
    },
  );

  const all: RaceResult[] = [];
  for (const page of racePages) {
    const fr = buildRaceResult(page, 'FR', driverPoints);
    if (fr) all.push(fr);
    const sr = buildRaceResult(page, 'SR', driverPoints);
    if (sr) all.push(sr);
  }

  all.sort((a, b) => {
    if (a.round !== b.round) return a.round - b.round;
    const aIsFeature = a.raceName.includes('Feature');
    const bIsFeature = b.raceName.includes('Feature');
    if (aIsFeature === bIsFeature) return 0;
    return aIsFeature ? -1 : 1;
  });

  if (all.length > 0) {
    await writeResultsCache(cacheKey, all);
  }
  return all;
}
