import type { RaceResult, RaceResultEntry } from '@/lib/types';
import { withF1LastGood } from '@/lib/f1-cache';
import { fetchUpstream } from '@/lib/fetch-upstream';

export type { RaceResult, RaceResultEntry };

const LAST_RACE_URL = 'https://api.jolpi.ca/ergast/f1/current/last/results.json';
// NO limit param games: Jolpica clamps `limit` to 100 regardless of what you
// ask for (probed 2026-06-10: ?limit=1000 returns `"limit": "100"`). A season
// of 22-car grids blows past that by round 5, silently dropping every later
// race and truncating the page-boundary race mid-field — which shipped as
// "chart stops at Canada with 12 cars" while standings (a different, smaller
// endpoint) showed all rounds. Fetch in real pages and merge.
const SEASON_RESULTS_URL = 'https://api.jolpi.ca/ergast/f1/current/results.json';
// Jolpica's sprint endpoint uses a different path AND field name: `.../sprint.json`
// returns Race objects with `SprintResults[]` instead of `Results[]`. Sprint points
// are awarded P1-P8 = 8-7-6-5-4-3-2-1. Without folding these into the season
// trend, the chart understates every sprint-eligible driver by their sprint
// haul (e.g. 2026 China + Miami sprints = 72 pts spread across the top 8).
const SEASON_SPRINTS_URL = 'https://api.jolpi.ca/ergast/f1/current/sprint.json';

const PAGE_SIZE = 100;
// 24 rounds × 22 cars = 528 race entries; sprints far fewer. 12 pages is a
// generous runaway stop, not a coverage limit.
const MAX_PAGES = 12;

interface PagedPayload extends RacePayload {
  MRData?: RacePayload['MRData'] & { total?: string };
}

async function fetchAllPages(baseUrl: string): Promise<RawRace[]> {
  const all: RawRace[] = [];
  let offset = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetchUpstream(`${baseUrl}?limit=${PAGE_SIZE}&offset=${offset}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) break;
    const json = (await res.json()) as PagedPayload;
    const races = json?.MRData?.RaceTable?.Races;
    if (!Array.isArray(races) || races.length === 0) break;
    all.push(...races);
    const total = Number(json?.MRData?.total);
    offset += PAGE_SIZE;
    if (!Number.isFinite(total) || offset >= total) break;
  }
  return all;
}

// A page boundary can split one race across two responses (Canada arrived as
// 12 entries on page 1 + 10 on page 2). Re-assemble by round.
function mergeRacesByRound(
  races: RawRace[],
  field: 'Results' | 'SprintResults',
): RawRace[] {
  const byRound = new Map<string, RawRace>();
  for (const r of races) {
    const key = String(r?.round ?? '');
    const existing = byRound.get(key);
    if (!existing) {
      byRound.set(key, { ...r, [field]: [...(r[field] ?? [])] });
    } else {
      (existing[field] as RawResult[]).push(...(r[field] ?? []));
    }
  }
  return [...byRound.values()];
}

interface RawDriver {
  givenName?: string;
  familyName?: string;
  code?: string;
}

interface RawConstructor {
  name?: string;
}

interface RawResult {
  position?: string;
  points?: string;
  Driver?: RawDriver;
  Constructor?: RawConstructor;
  status?: string;
  Time?: { time?: string };
}

interface RawRace {
  round?: string;
  raceName?: string;
  date?: string;
  Circuit?: { circuitName?: string };
  Results?: RawResult[];
  // Same shape as Results but lives on a different field in the sprint payload.
  SprintResults?: RawResult[];
}

interface RacePayload {
  MRData?: {
    RaceTable?: {
      Races?: RawRace[];
    };
  };
}

function parseDate(date: string | undefined): Date | null {
  if (!date) return null;
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function parseEntry(raw: RawResult): RaceResultEntry | null {
  const position = Number(raw?.position);
  const points = Number(raw?.points);
  const givenName = raw?.Driver?.givenName;
  const familyName = raw?.Driver?.familyName;
  const team = raw?.Constructor?.name;
  const status = raw?.status;
  if (!Number.isFinite(position) || !Number.isFinite(points)) return null;
  if (!givenName || !familyName || !team || !status) return null;
  return {
    position,
    driverName: `${givenName} ${familyName}`,
    driverCode: raw.Driver?.code,
    team,
    status,
    time: raw.Time?.time,
    points,
  };
}

function parseRace(
  raw: RawRace,
  // Race endpoint has `Results`; sprint endpoint has `SprintResults`.
  // Same RawResult shape, different parent key. Default keeps existing
  // race-payload callers unchanged.
  resultsField: 'Results' | 'SprintResults' = 'Results',
): RaceResult | null {
  const round = Number(raw?.round);
  const raceName = raw?.raceName;
  const date = parseDate(raw?.date);
  const circuit = raw?.Circuit?.circuitName;
  const rawResults = raw?.[resultsField];
  if (!Number.isFinite(round) || !raceName || !date || !circuit) return null;
  if (!Array.isArray(rawResults) || rawResults.length === 0) return null;
  const results: RaceResultEntry[] = [];
  for (const r of rawResults) {
    const entry = parseEntry(r);
    if (!entry) return null;
    results.push(entry);
  }
  return { round, raceName, date, circuit, results };
}

async function fetchF1LastRaceLive(): Promise<RaceResult | null> {
  try {
    const res = await fetchUpstream(LAST_RACE_URL, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const json = (await res.json()) as RacePayload;
    const races = json?.MRData?.RaceTable?.Races;
    if (!Array.isArray(races) || races.length === 0) return null;
    return parseRace(races[0]);
  } catch {
    return null;
  }
}

async function fetchF1SeasonResultsLive(): Promise<RaceResult[]> {
  try {
    const races = mergeRacesByRound(await fetchAllPages(SEASON_RESULTS_URL), 'Results');
    const results: RaceResult[] = [];
    for (const r of races) {
      const parsed = parseRace(r);
      if (parsed) results.push(parsed);
    }
    return results.sort((a, b) => a.round - b.round);
  } catch {
    return [];
  }
}

async function fetchF1SeasonSprintsLive(): Promise<RaceResult[]> {
  try {
    const races = mergeRacesByRound(await fetchAllPages(SEASON_SPRINTS_URL), 'SprintResults');
    const results: RaceResult[] = [];
    for (const r of races) {
      const parsed = parseRace(r, 'SprintResults');
      if (parsed) results.push(parsed);
    }
    return results.sort((a, b) => a.round - b.round);
  } catch {
    return [];
  }
}

// Each public fetcher below is wrapped in the KV last-good read-through so a
// Jolpica outage (HTTP 521 / network error / empty payload) serves the last
// successful result instead of blanking the results page. Each self-heals on
// the next good fetch. All FAIL OPEN: with KV unconfigured (local dev) they
// behave exactly like their `*Live` body. Return types are unchanged.

export async function fetchF1LastRace(): Promise<RaceResult | null> {
  return withF1LastGood<RaceResult | null>(
    'last-race',
    fetchF1LastRaceLive,
    result => result == null,
  );
}

export async function fetchF1SeasonResults(): Promise<RaceResult[]> {
  return withF1LastGood<RaceResult[]>(
    'season-results',
    fetchF1SeasonResultsLive,
    result => result.length === 0,
  );
}

// Sprint races have their own season-trend impact (P1-P8 = 8-7-6-5-4-3-2-1
// points). Returned as standalone RaceResult[] keyed by the parent race's
// `round` so the consumer can fold sprint points into that round's running
// totals without adding extra x-axis ticks to the trend chart.
export async function fetchF1SeasonSprints(): Promise<RaceResult[]> {
  return withF1LastGood<RaceResult[]>(
    'season-sprints',
    fetchF1SeasonSprintsLive,
    result => result.length === 0,
  );
}
