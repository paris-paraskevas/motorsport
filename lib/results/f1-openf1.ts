import type { ConstructorStanding, DriverStanding, RaceResult, RaceResultEntry } from '@/lib/types';
import { fetchUpstream } from '@/lib/fetch-upstream';
import { fetchOpenF1, OF1_REVALIDATE } from '@/lib/openf1/client';
import { formatSeconds } from '@/lib/results/openf1';

// OpenF1 as F1's backup (B5). jolpi.ca stays the first source; a race or sprint that has run AFTER jolpi.ca's latest
// round is taken from OpenF1 (the FIA timing feed, published within about an hour of the flag) and marked
// provisional, until jolpi.ca has the round and takes over by itself. On 11 October 2026 jolpi.ca still ended at
// round 16 two hours after Singapore's race, while OpenF1 had the full classification.
//
// Runs where the loader fetches upstream (lib/results/f1.ts and lib/standings/f1.ts `*Live`), never in the Worker's
// read-only mode. Nothing here runs when jolpi.ca did not answer: an outage keeps the last-good path, so OpenF1 can
// never stand in for a whole season.

const SCHEDULE_URL = 'https://api.jolpi.ca/ergast/f1/current.json';
/** A session matches the schedule slot that starts within this of it (OpenF1 and jolpi.ca both speak UTC). */
const MATCH_MS = 3 * 3600 * 1000;

type Kind = 'race' | 'sprint';

interface ScheduleRace {
  round?: string;
  raceName?: string;
  date?: string;
  time?: string;
  Circuit?: { circuitName?: string };
  Sprint?: { date?: string; time?: string };
}

interface Slot {
  kind: Kind;
  round: number;
  raceName: string;
  circuit: string;
  day: string;
  startsAt: number;
}

interface OF1Session {
  session_key: number;
  session_name: string;
  date_start: string;
  date_end: string;
}

interface OF1Result {
  position: number | null;
  driver_number: number;
  dnf?: boolean;
  dns?: boolean;
  dsq?: boolean;
  duration?: number | Array<number | null> | null;
  gap_to_leader?: number | string | Array<number | null> | null;
  points?: number;
}

interface OF1Driver {
  driver_number: number;
  full_name?: string;
  name_acronym?: string;
  team_name?: string;
}

export interface OpenF1Gap {
  races: RaceResult[];
  sprints: RaceResult[];
}

const NONE: OpenF1Gap = { races: [], sprints: [] };

/** The schedule's races and sprints, with their start in UTC. */
export function scheduleSlots(races: readonly ScheduleRace[]): Slot[] {
  const out: Slot[] = [];
  for (const r of races) {
    const round = Number(r.round);
    if (!Number.isFinite(round) || !r.raceName || !r.date) continue;
    const circuit = r.Circuit?.circuitName ?? '';
    const at = (day: string, time?: string) => Date.parse(`${day}T${time ?? '00:00:00Z'}`);
    out.push({ kind: 'race', round, raceName: r.raceName, circuit, day: r.date, startsAt: at(r.date, r.time) });
    if (r.Sprint?.date) out.push({ kind: 'sprint', round, raceName: r.raceName, circuit, day: r.Sprint.date, startsAt: at(r.Sprint.date, r.Sprint.time) });
  }
  return out.filter(s => Number.isFinite(s.startsAt));
}

/** jolpi.ca's answer, by kind: a kind left out is not looked for, and an empty answer (an outage, or no sprint run
 *  yet) asks nothing of OpenF1 for that kind. */
export interface JolpiSeason {
  races?: readonly RaceResult[];
  sprints?: readonly RaceResult[];
}

/** The slots that have run after jolpi.ca's latest round of their kind and that jolpi.ca does not carry. */
export function missingSlots(slots: readonly Slot[], jolpi: JolpiSeason, now: number): Slot[] {
  return slots.filter(s => {
    const list = s.kind === 'race' ? jolpi.races : jolpi.sprints;
    if (!list || list.length === 0 || s.startsAt >= now) return false;
    return s.round > Math.max(...list.map(r => r.round));
  });
}

const titleCase = (name: string) => name.replace(/\b([A-ZÀ-Ý])([A-ZÀ-Ý'-]+)\b/g, (_, a: string, b: string) => a + b.toLowerCase());

/** Each driver's name and team as jolpi.ca writes them, by three-letter code, from the latest race they appear in. */
export function identities(races: readonly RaceResult[]): Map<string, { driverName: string; team: string }> {
  const out = new Map<string, { driverName: string; team: string }>();
  for (const race of [...races].sort((a, b) => a.round - b.round)) {
    for (const e of race.results) if (e.driverCode) out.set(e.driverCode, { driverName: e.driverName, team: e.team });
  }
  return out;
}

function statusOf(r: OF1Result): string {
  if (r.dsq) return 'Disqualified';
  if (r.dns) return 'Did not start';
  if (r.dnf) return 'Retired';
  const laps = typeof r.gap_to_leader === 'string' ? /\+?(\d+)\s*LAP/i.exec(r.gap_to_leader) : null;
  if (laps) return `+${laps[1]} Lap${laps[1] === '1' ? '' : 's'}`;
  return 'Finished';
}

/** One OpenF1 session as a jolpi.ca-shaped RaceResult: classified rows first, then the rest in OpenF1's order. */
export function toRaceResult(
  slot: Slot,
  results: readonly OF1Result[],
  drivers: readonly OF1Driver[],
  known: Map<string, { driverName: string; team: string }>,
): RaceResult | null {
  if (results.length === 0) return null;
  const byNumber = new Map(drivers.map(d => [d.driver_number, d]));
  const sorted = [...results].sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
  const entries: RaceResultEntry[] = [];
  for (const [i, r] of sorted.entries()) {
    const d = byNumber.get(r.driver_number);
    const code = d?.name_acronym;
    const who = code ? known.get(code) : undefined;
    const driverName = who?.driverName ?? (d?.full_name ? titleCase(d.full_name) : null);
    const team = who?.team ?? d?.team_name;
    // A row without a name or a team cannot be keyed by the tables or the trend chart: the session is not used.
    if (!driverName || !team) return null;
    const entry: RaceResultEntry = { position: i + 1, driverName, team, status: statusOf(r), points: r.points ?? 0 };
    if (code) entry.driverCode = code;
    if (i === 0 && typeof r.duration === 'number') entry.time = formatSeconds(r.duration);
    else if (typeof r.gap_to_leader === 'number' && r.gap_to_leader > 0 && entry.status === 'Finished') entry.time = `+${r.gap_to_leader.toFixed(3)}`;
    entries.push(entry);
  }
  return { round: slot.round, raceName: slot.raceName, date: new Date(`${slot.day}T00:00:00Z`), circuit: slot.circuit, results: entries, provisional: true };
}

async function fetchSchedule(): Promise<ScheduleRace[]> {
  try {
    const res = await fetchUpstream(SCHEDULE_URL, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const json = (await res.json()) as { MRData?: { RaceTable?: { Races?: ScheduleRace[] } } };
    return json?.MRData?.RaceTable?.Races ?? [];
  } catch {
    return [];
  }
}

// One log line per filled session and process: the loader's four F1 fetchers may each find the same one.
const logged = new Set<string>();

async function readGap(jolpi: JolpiSeason): Promise<OpenF1Gap> {
  if (!jolpi.races?.length && !jolpi.sprints?.length) return NONE;
  const missing = missingSlots(scheduleSlots(await fetchSchedule()), jolpi, Date.now());
  if (missing.length === 0) return NONE;
  const year = new Date(missing[0].startsAt).getUTCFullYear();
  const sessions = await fetchOpenF1<OF1Session>('sessions', { year }, { revalidate: OF1_REVALIDATE.short });
  const known = identities([...(jolpi.races ?? []), ...(jolpi.sprints ?? [])]);
  const gap: OpenF1Gap = { races: [], sprints: [] };
  for (const slot of missing) {
    const name = slot.kind === 'race' ? 'Race' : 'Sprint';
    const session = sessions.find(
      s => s.session_name === name && Math.abs(Date.parse(s.date_start) - slot.startsAt) < MATCH_MS && Date.parse(s.date_end) < Date.now(),
    );
    if (!session) continue;
    const [results, drivers] = await Promise.all([
      fetchOpenF1<OF1Result>('session_result', { session_key: session.session_key }, { revalidate: OF1_REVALIDATE.short }),
      fetchOpenF1<OF1Driver>('drivers', { session_key: session.session_key }, { revalidate: OF1_REVALIDATE.short }),
    ]);
    const result = toRaceResult(slot, results, drivers, known);
    if (!result) continue;
    (slot.kind === 'race' ? gap.races : gap.sprints).push(result);
    const line = `[f1] OpenF1 filled round ${slot.round} ${name.toLowerCase()} (${slot.raceName}): jolpi.ca does not have it yet`;
    if (!logged.has(line)) {
      logged.add(line);
      console.error(line);
    }
  }
  return gap;
}

/** The races and sprints OpenF1 has that jolpi.ca does not yet, after jolpi.ca's latest round of each kind. Empty on
 *  any failure. */
export function openF1Gap(jolpi: JolpiSeason): Promise<OpenF1Gap> {
  return readGap(jolpi).catch(() => NONE);
}

/** Countback for a tie on points: more wins, then more seconds, and so on, over the Grands Prix only. */
function countback(name: string, races: readonly RaceResult[], by: (e: RaceResultEntry) => string): number[] {
  const tally = Array.from({ length: 30 }, () => 0);
  for (const race of races) for (const e of race.results) if (by(e) === name && e.position <= 30) tally[e.position - 1]++;
  return tally;
}

function rank<T extends { points: number; position: number }>(rows: T[], key: (r: T) => string, races: readonly RaceResult[], by: (e: RaceResultEntry) => string): T[] {
  const sorted = [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const ca = countback(key(a), races, by);
    const cb = countback(key(b), races, by);
    for (let i = 0; i < ca.length; i++) if (ca[i] !== cb[i]) return cb[i] - ca[i];
    return a.position - b.position;
  });
  return sorted.map((r, i) => ({ ...r, position: i + 1 }));
}

/** jolpi.ca's tables with OpenF1's added sessions: their points, an added race's win, re-ranked with countback. */
export function withAddedSessions(
  standings: { drivers: DriverStanding[]; constructors: ConstructorStanding[] },
  gap: OpenF1Gap,
  jolpiRaces: readonly RaceResult[],
): { drivers: DriverStanding[]; constructors: ConstructorStanding[] } {
  if (gap.races.length === 0 && gap.sprints.length === 0) return standings;
  const drivers = new Map(standings.drivers.map(d => [d.driverName, { ...d }]));
  const constructors = new Map(standings.constructors.map(c => [c.name, { ...c }]));
  for (const session of [...gap.races, ...gap.sprints]) {
    const isRace = gap.races.includes(session);
    for (const e of session.results) {
      const d = drivers.get(e.driverName) ?? { position: 99, driverName: e.driverName, driverCode: e.driverCode, team: e.team, points: 0, wins: 0 };
      d.points += e.points;
      if (isRace && e.position === 1) d.wins = (d.wins ?? 0) + 1;
      drivers.set(e.driverName, d);
      const c = constructors.get(e.team) ?? { position: 99, name: e.team, points: 0, wins: 0 };
      c.points += e.points;
      if (isRace && e.position === 1) c.wins = (c.wins ?? 0) + 1;
      constructors.set(e.team, c);
    }
  }
  const races = [...jolpiRaces, ...gap.races];
  return {
    drivers: rank([...drivers.values()], d => d.driverName, races, e => e.driverName),
    constructors: rank([...constructors.values()], c => c.name, races, e => e.team),
  };
}
