import type { RaceResult, RaceResultEntry } from '@/lib/types';

export type { RaceResult, RaceResultEntry };

const LAST_RACE_URL = 'https://api.jolpi.ca/ergast/f1/current/last/results.json';
const SEASON_RESULTS_URL = 'https://api.jolpi.ca/ergast/f1/current/results.json?limit=1000';
// Jolpica's sprint endpoint uses a different path AND field name: `.../sprint.json`
// returns Race objects with `SprintResults[]` instead of `Results[]`. Sprint points
// are awarded P1-P8 = 8-7-6-5-4-3-2-1. Without folding these into the season
// trend, the chart understates every sprint-eligible driver by their sprint
// haul (e.g. 2026 China + Miami sprints = 72 pts spread across the top 8).
const SEASON_SPRINTS_URL = 'https://api.jolpi.ca/ergast/f1/current/sprint.json?limit=1000';

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

export async function fetchF1LastRace(): Promise<RaceResult | null> {
  try {
    const res = await fetch(LAST_RACE_URL, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const json = (await res.json()) as RacePayload;
    const races = json?.MRData?.RaceTable?.Races;
    if (!Array.isArray(races) || races.length === 0) return null;
    return parseRace(races[0]);
  } catch {
    return null;
  }
}

export async function fetchF1SeasonResults(): Promise<RaceResult[]> {
  try {
    const res = await fetch(SEASON_RESULTS_URL, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const json = (await res.json()) as RacePayload;
    const races = json?.MRData?.RaceTable?.Races;
    if (!Array.isArray(races)) return [];
    const results: RaceResult[] = [];
    for (const r of races) {
      const parsed = parseRace(r);
      if (parsed) results.push(parsed);
    }
    return results;
  } catch {
    return [];
  }
}

// Sprint races have their own season-trend impact (P1-P8 = 8-7-6-5-4-3-2-1
// points). Returned as standalone RaceResult[] keyed by the parent race's
// `round` so the consumer can fold sprint points into that round's running
// totals without adding extra x-axis ticks to the trend chart.
export async function fetchF1SeasonSprints(): Promise<RaceResult[]> {
  try {
    const res = await fetch(SEASON_SPRINTS_URL, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const json = (await res.json()) as RacePayload;
    const races = json?.MRData?.RaceTable?.Races;
    if (!Array.isArray(races)) return [];
    const results: RaceResult[] = [];
    for (const r of races) {
      const parsed = parseRace(r, 'SprintResults');
      if (parsed) results.push(parsed);
    }
    return results;
  } catch {
    return [];
  }
}
