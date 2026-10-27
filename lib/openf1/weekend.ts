// What Formula 1's weekend pages show from OpenF1 (slot O19), reduced from its raw rows so the publisher can keep it
// on the paddock-data branch: the weather measured through a session, the marks race control left (a late start, a
// red flag), each driver's tyres in a race or sprint, and a circuit's map drawn from a pole lap. Pure and
// synchronous: the publisher (scripts/wp-publish.mts) fetches, these reduce, so each is tested on saved rows.

import type { BestLap } from './laps';
import { buildTrackPath } from './track';
import type { OF1Location, OF1RaceControl, OF1Stint, OF1Weather } from './types';

/** Low, middle and high readings, whole degrees or percent. */
export type Spread = [number, number, number];

export interface SessionWeather {
  air: Spread;
  /** null when the track sensor read nothing (it reads 0 then). */
  track: Spread | null;
  /** Low and high, percent; null with no reading. */
  humidity: [number, number] | null;
  /** Rain was recorded at least once within the session's window. */
  rain: boolean;
}

/** Laps run behind the safety car or under the virtual one, first to last, both whole laps of the race. */
export interface NeutralSpan {
  kind: 'SC' | 'VSC';
  from: number;
  to: number;
}

export interface SessionMarks {
  /** The session started late: when it was planned to, and when it did (race control's new time, or its start). */
  late?: { planned: string; started: string };
  /** Each red flag: the lap it came on (races and sprints), and whether the session started again after it. */
  red?: { lap: number | null; restarted: boolean }[];
  /** A race's safety car and virtual safety car laps (O28's lap chart), [] when it had none; a race read before O28
   *  lacks the key and is asked again. */
  neutral?: NeutralSpan[];
  /** When a car's visit to the pit lane was no stop (O28): a red flag's tyre changes, from the flag to the restart, and
   *  race control sending the whole field through the pit lane, from its message to three minutes on (ISO). */
  lanes?: LaneWindow[];
}

export interface LaneWindow {
  kind: 'red' | 'through';
  from: string;
  to: string;
}

/** One driver's tyres: car number, then [compound, first lap, last lap] for each stint in order. */
export type DriverStints = [number, [string, number, number][]];

export interface SessionExtras {
  /** OpenF1's session_key, so a page can name its source. */
  key: number;
  weather?: SessionWeather;
  marks?: SessionMarks;
  stints?: DriverStints[];
  /** When it was last fetched (ISO). */
  at: string;
  /** While a part is missing, when to ask again (ISO): within an hour while the session is less than a day over (the
   *  first ask can land in OpenF1's paid live window when a session runs late), a day after that. */
  next?: string;
}

/** season → round → the session's label as the results name it ("Practice 1", "Race"). */
export type SessionsStore = Record<string, Record<string, Record<string, SessionExtras>>>;

export interface CircuitMap {
  year: number;
  /** OpenF1's session_key of the qualifying the lap came from. */
  session: number;
  /** The car number of the lap's driver. */
  driver: number;
  /** The lap and its three sectors, in seconds. */
  lap: number;
  sectors: [number, number, number];
  /** The drawing's box: x right, y down, as buildTrackPath lays it out. */
  w: number;
  h: number;
  points: [number, number][];
  /** The points where sector 2 and sector 3 begin. */
  split: [number, number];
  /** A redraw from a newer pole lap failed: not tried again before this (ISO); the map stays as it is. */
  next?: string;
}

/** A map that could not be drawn: when to try again (ISO), so one bad lap does not take a turn every run. */
export interface MapMiss {
  miss: string;
  next: string;
}

/** circuits.json key → the map drawn from its latest pole lap, or the note of a miss. */
export type MapsStore = Record<string, CircuitMap | MapMiss>;

export const isMap = (m: CircuitMap | MapMiss | undefined): m is CircuitMap => Boolean(m && 'points' in m);

/** The most points a map keeps: enough for a smooth line in a 1000-wide box. */
const MAP_POINTS = 400;

const round = (n: number): number => Math.round(n);
const middle = (sorted: number[]): number => sorted[Math.floor(sorted.length / 2)];

function spread(values: number[]): Spread | null {
  const v = values.filter(n => Number.isFinite(n)).sort((a, b) => a - b);
  return v.length ? [round(v[0]), round(middle(v)), round(v[v.length - 1])] : null;
}

/**
 * A session's weather from its readings; null with none. OpenF1 sends readings from well before a session starts, so
 * `window` keeps those from a quarter of an hour before the planned start to the session's real end: a shower before
 * a dry race is no rain in it, the downpour that delayed Singapore's Sprint is.
 */
export function weatherSummary(rows: readonly OF1Weather[], window?: { from: number; to: number }): SessionWeather | null {
  const kept = window ? rows.filter(r => { const at = Date.parse(r.date); return at >= window.from && at <= window.to; }) : rows;
  const air = spread(kept.map(r => r.air_temperature));
  if (!air) return null;
  const humidity = spread(kept.map(r => r.humidity));
  return {
    air,
    track: spread(kept.map(r => r.track_temperature).filter(t => t > 0)),
    humidity: humidity ? [humidity[0], humidity[2]] : null,
    rain: kept.some(r => r.rainfall > 0),
  };
}

/**
 * The UTC instant of a wall-clock time at the track on a given local day ("17:30" in Asia/Singapore on 2026-10-10 is
 * 09:30Z). The zone's offset is read at the guessed instant and applied twice, which settles across a DST change.
 */
export function trackTimeToUtc(day: string, hm: string, tz: string): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm);
  if (!m || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const wall = Date.parse(`${day}T${m[1].padStart(2, '0')}:${m[2]}:00Z`);
  const offsetAt = (t: number): number | null => {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(t));
      const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
      return Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`) - t;
    } catch {
      return null;
    }
  };
  const first = offsetAt(wall);
  if (first === null) return null;
  const second = offsetAt(wall - first);
  return second === null ? null : new Date(wall - second).toISOString();
}

/** The local day (YYYY-MM-DD) of an instant at the track. */
function trackDay(iso: string, tz: string): string | null {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
  } catch {
    return null;
  }
}

/** A message's words; OpenF1 has sent rows without them. */
const text = (m: OF1RaceControl): string => (typeof m.message === 'string' ? m.message.trim() : '');
const STARTED = (m: OF1RaceControl) => m.category === 'SessionStatus' && /^SESSION STARTED$/i.test(text(m));
const FINISHED = (m: OF1RaceControl) => m.category === 'SessionStatus' && /^SESSION FINISHED$/i.test(text(m));
const DELAYED = /\b(DELAYED START|START DELAYED|SESSION DELAYED|START OF THE SESSION (?:IS )?DELAYED)\b/i;
const NEW_START = /\bWILL (?:START|BEGIN) AT (\d{1,2}:\d{2})\b/i;
/** The red flag itself, or a message that opens with it; "RED FLAG LIFTED" ends one rather than starting it. */
const RED = (m: OF1RaceControl) => m.flag === 'RED' || (/^RED FLAG\b/i.test(text(m)) && !/\bLIFTED\b/i.test(text(m)));
/** Race control's words for the safety cars, whole messages only: "VSC" since 2026, "VIRTUAL SAFETY CAR" before. A
 *  wording not here shades nothing, rather than the wrong laps. */
const DEPLOYED: readonly [NeutralSpan['kind'], RegExp][] = [['VSC', /^(?:VSC|VIRTUAL SAFETY CAR) DEPLOYED$/i], ['SC', /^SAFETY CAR DEPLOYED$/i]];
const IN: Readonly<Record<NeutralSpan['kind'], RegExp>> = { VSC: /^(?:VSC|VIRTUAL SAFETY CAR) ENDING$/i, SC: /^SAFETY CAR IN THIS LAP$/i };
const CHEQUERED = (m: OF1RaceControl) => m.flag === 'CHEQUERED' || /^CHEQUERED FLAG$/i.test(text(m));

/** When race control last said the session finished (ms), or null. */
export function finishedAt(messages: readonly OF1RaceControl[]): number | null {
  const ats = messages.filter(FINISHED).map(m => Date.parse(m.date)).filter(t => Number.isFinite(t));
  return ats.length ? Math.max(...ats) : null;
}

/**
 * The marks race control leaves on a session. A late start needs race control to have said so ("DELAYED START"): a
 * race always starts a few minutes after its time, behind the formation lap, which is no mark. Its new time is the last
 * one race control gave before the session started ("FORMATION LAP WILL START AT 17:30", the track's time; a time past
 * the track's midnight is the next day's), else when it started. A red flag counts as restarted when the session
 * started again after it without finishing first: a red that ends a qualifying part is not restarted by the next part.
 * A race also gets its safety car laps (`race`): a deployment opens a span on its lap, and its ending ("IN THIS LAP",
 * "ENDING") closes it on its own. A red flag closes an open span on its lap: the race restarts from a standing start
 * (Monza and Monaco 2026). The other car deployed closes the first a lap before (Malaysia 2026's VSC became a safety
 * car), a span still open at the flag closes on the last lap, and one redeployed on the lap it came in runs on.
 */
export function sessionMarks(messages: readonly OF1RaceControl[], planned: string, tz: string | undefined, race = false): SessionMarks {
  // OpenF1's dates differ in their fractions of a second, so they are compared as instants, never as text.
  const msgs = messages.map(m => ({ m, at: Date.parse(m.date) })).filter(x => Number.isFinite(x.at)).sort((a, b) => a.at - b.at);
  const marks: SessionMarks = {};
  const delayed = msgs.find(x => DELAYED.test(text(x.m)));
  if (delayed) {
    const started = msgs.find(x => x.at >= delayed.at && STARTED(x.m));
    const said = msgs.filter(x => x.at >= delayed.at && (!started || x.at <= started.at) && NEW_START.test(text(x.m))).at(-1);
    let fromWords: number | null = null;
    if (said && tz) {
      const day = trackDay(said.m.date, tz);
      const hm = NEW_START.exec(text(said.m))?.[1];
      const iso = day && hm ? trackTimeToUtc(day, hm, tz) : null;
      if (iso) fromWords = Date.parse(iso) < said.at - 3_600_000 ? Date.parse(iso) + 86_400_000 : Date.parse(iso);
    }
    const startedAt = fromWords ?? started?.at;
    if (startedAt !== undefined && startedAt > Date.parse(planned)) marks.late = { planned, started: new Date(startedAt).toISOString() };
  }
  const reds = msgs.filter(x => RED(x.m));
  // One stoppage can be announced twice ("SESSION ABORTED" then "RED FLAG - RACE SUSPENDED"): a red within a minute of another is the same one.
  const kept = reds.filter((x, i) => i === 0 || x.at - reds[i - 1].at > 60_000);
  if (kept.length) {
    marks.red = kept.map(x => {
      const next = msgs.find(y => y.at > x.at && (STARTED(y.m) || FINISHED(y.m)));
      return { lap: x.m.lap_number ?? null, restarted: next !== undefined && STARTED(next.m) };
    });
  }
  if (race) {
    marks.neutral = neutralSpans(msgs.map(x => x.m));
    marks.lanes = laneWindows(msgs);
  }
  return marks;
}

const THROUGH = /^ALL CARS THROUGH THE PIT LANE$/i;
/** The whole field has passed through the pit lane within a lap behind the safety car: 110 s after race control's
 *  message at Monaco and Baku in 2026. */
const THROUGH_MS = 3 * 60_000;

/** A race's lane windows (sessionMarks) from its messages in time order. A red flag runs to the next start or finish,
 *  a stoppage announced twice once; a race never restarted, to four hours on. */
function laneWindows(msgs: readonly { m: OF1RaceControl; at: number }[]): LaneWindow[] {
  const iso = (t: number): string => new Date(t).toISOString();
  const out: LaneWindow[] = [];
  const reds = msgs.filter(x => RED(x.m));
  reds.forEach((x, i) => {
    if (i > 0 && x.at - reds[i - 1].at <= 60_000) return;
    const end = msgs.find(y => y.at > x.at && (STARTED(y.m) || FINISHED(y.m)));
    out.push({ kind: 'red', from: iso(x.at), to: iso(end ? end.at : x.at + 4 * 3_600_000) });
  });
  for (const x of msgs) if (THROUGH.test(text(x.m))) out.push({ kind: 'through', from: iso(x.at), to: iso(x.at + THROUGH_MS) });
  return out.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
}

/** A race's safety car spans from its messages in time order (sessionMarks). */
function neutralSpans(msgs: readonly OF1RaceControl[]): NeutralSpan[] {
  const laps = msgs.map(m => m.lap_number).filter((n): n is number => typeof n === 'number' && n > 0);
  const last = msgs.filter(CHEQUERED).map(m => m.lap_number).find((n): n is number => typeof n === 'number' && n > 0) ?? (laps.length ? Math.max(...laps) : 0);
  const spans: NeutralSpan[] = [];
  const close = (span: NeutralSpan, to: number): null => {
    if (to >= span.from) spans.push({ ...span, to });
    return null;
  };
  // Typed wide: TypeScript would narrow a plain `= null` to null for the whole loop.
  let open = null as NeutralSpan | null;
  let seen = 0;
  for (const m of msgs) {
    const lap = m.lap_number;
    if (typeof lap !== 'number' || !(lap > 0)) {
      // A closing message without its lap closes the span on the last lap race control named, never at the flag.
      if (open && (IN[open.kind].test(text(m)) || RED(m))) open = close(open, Math.max(seen, open.from));
      continue;
    }
    seen = lap;
    const kind = DEPLOYED.find(([, re]) => re.test(text(m)))?.[0];
    if (kind) {
      if (open?.kind === kind) continue;
      if (open) close(open, lap - 1);
      open = { kind, from: lap, to: lap };
    } else if (open && (IN[open.kind].test(text(m)) || RED(m))) open = close(open, lap);
  }
  if (open) close(open, Math.max(last, open.from));
  return spans.reduce<NeutralSpan[]>((out, s) => {
    const prev = out[out.length - 1];
    if (prev && prev.kind === s.kind && s.from <= prev.to) prev.to = Math.max(prev.to, s.to);
    else out.push(s);
    return out;
  }, []);
}

/** Each driver's stints in order, by car number. */
export function driverStints(rows: readonly OF1Stint[]): DriverStints[] {
  const by = new Map<number, OF1Stint[]>();
  for (const s of rows) {
    if (!Number.isFinite(s.lap_start) || !Number.isFinite(s.lap_end)) continue;
    by.set(s.driver_number, [...(by.get(s.driver_number) ?? []), s]);
  }
  return [...by.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([n, list]) => [n, list.sort((a, b) => a.stint_number - b.stint_number).map(s => [s.compound ?? 'UNKNOWN', s.lap_start, s.lap_end] as [string, number, number])]);
}

/** The fastest lap among every driver's best (laps.ts fastestLapsByDriver), with its three sectors. */
export function poleLap(best: ReadonlyMap<number, BestLap>): BestLap | null {
  let pole: BestLap | null = null;
  for (const lap of best.values()) {
    if (lap.sectors.some(s => s === null || !(s > 0)) || !lap.dateStart) continue;
    if (!pole || lap.lapDuration < pole.lapDuration) pole = lap;
  }
  return pole;
}

/**
 * A circuit's map from its pole lap: the car's positions (buildTrackPath lays them out, north up, without the (0, 0)
 * readings OpenF1 sends for a lost signal), timed from the lap's start, thinned to at most 400 points, and split where
 * sector 2 and sector 3 begin by the lap's own sector times. Null when the positions do not make a whole lap: too few,
 * a gap of more than a second and a half (a straight chord across the drawing), or the lap's start or end missing.
 */
export function circuitMap(lap: BestLap, samples: readonly OF1Location[], year: number, session: number): CircuitMap | null {
  const path = buildTrackPath([...samples], { width: 1000, padding: 40 });
  if (!path || path.points.length < 50) return null;
  const first = Math.min(...samples.filter(s => Number.isFinite(s.x) && Number.isFinite(s.y) && !(s.x === 0 && s.y === 0)).map(s => Date.parse(s.date)).filter(t => Number.isFinite(t)));
  const offset = (first - Date.parse(lap.dateStart)) / 1000;
  const timed = path.points.map(p => ({ x: p.x, y: p.y, t: p.t + offset }));
  const gap = timed.reduce((most, p, i) => (i ? Math.max(most, p.t - timed[i - 1].t) : most), 0);
  if (!(gap <= 1.5 && timed[0].t <= 2 && timed[timed.length - 1].t >= lap.lapDuration - 2)) return null;
  const step = Math.ceil(timed.length / MAP_POINTS);
  const pts = timed.filter((_, i) => i % step === 0 || i === timed.length - 1);
  const [s1, s2, s3] = lap.sectors as [number, number, number];
  const at = (t: number) => pts.reduce((best, p, i) => (Math.abs(p.t - t) < Math.abs(pts[best].t - t) ? i : best), 0);
  const split: [number, number] = [at(s1), at(s1 + s2)];
  if (!(split[0] > 0 && split[1] > split[0] && split[1] < pts.length - 1)) return null;
  return {
    year,
    session,
    driver: lap.driverNumber,
    lap: lap.lapDuration,
    sectors: [s1, s2, s3],
    w: path.width,
    h: path.height,
    points: pts.map(p => [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]),
    split,
  };
}
