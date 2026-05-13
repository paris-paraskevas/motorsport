import type { RaceResult, RaceResultEntry, RaceSummary } from '@/lib/types';

export type { RaceResult, RaceResultEntry, RaceSummary };

const LAST_RACE_URL = 'https://api.jolpi.ca/ergast/f1/current/last/results.json';
const SEASON_RACES_URL = 'https://api.jolpi.ca/ergast/f1/current/results.json?limit=1000';

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

function parseRace(raw: RawRace): RaceResult | null {
  const round = Number(raw?.round);
  const raceName = raw?.raceName;
  const date = parseDate(raw?.date);
  const circuit = raw?.Circuit?.circuitName;
  const rawResults = raw?.Results;
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

function parseSummary(raw: RawRace): RaceSummary | null {
  const round = Number(raw?.round);
  const raceName = raw?.raceName;
  const date = parseDate(raw?.date);
  if (!Number.isFinite(round) || !raceName || !date) return null;
  const winnerRaw = raw?.Results?.find(r => r?.position === '1');
  let winner: string | undefined;
  let winnerTeam: string | undefined;
  if (winnerRaw?.Driver?.givenName && winnerRaw?.Driver?.familyName) {
    winner = `${winnerRaw.Driver.givenName} ${winnerRaw.Driver.familyName}`;
  }
  if (winnerRaw?.Constructor?.name) {
    winnerTeam = winnerRaw.Constructor.name;
  }
  return { round, raceName, date, winner, winnerTeam };
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

export async function fetchF1SeasonRaces(): Promise<RaceSummary[]> {
  try {
    const res = await fetch(SEASON_RACES_URL, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const json = (await res.json()) as RacePayload;
    const races = json?.MRData?.RaceTable?.Races;
    if (!Array.isArray(races)) return [];
    const summaries: RaceSummary[] = [];
    for (const r of races) {
      const summary = parseSummary(r);
      if (summary) summaries.push(summary);
    }
    return summaries;
  } catch {
    return [];
  }
}
