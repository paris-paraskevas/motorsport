import type { Session } from './types';

// The one time-correct grid engine for the calendar. The landmine: a session
// must land in the DEVICE-LOCAL day cell. Timed sessions bucket by the device's
// local Y-M-D (a `Date`'s get*() are device-local in the browser); date-only
// sessions are UTC-midnight markers with no real hour (Session.dateOnly), so
// they bucket by their UTC calendar date and render as "TBC", never a clock
// time. Every view buckets through `localDayKey`, so they all agree.
//
// All grid construction uses the local Date constructor (local midnight), so it
// MUST run client-side after the clock syncs (CalendarView gates on `clock`) —
// never at SSR, where the server's zone would differ from the device's.

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Device-local Y-M-D key for a Date. */
export function dayKeyOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** UTC Y-M-D key — for date-only sessions (UTC-midnight wall dates). */
export function utcDayKeyOf(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** The day cell a session belongs in: device-local for timed, UTC for date-only.
 *  `utc` is the calendar's "times in" mode — when the user pins UTC, a timed
 *  session must bucket by its UTC date too, or a 23:00-local session would show
 *  a UTC clock time in the cell for the wrong calendar day. */
export function localDayKey(session: Session, utc = false): string {
  return session.dateOnly || utc ? utcDayKeyOf(session.start) : dayKeyOf(session.start);
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function addWeeks(d: Date, n: number): Date {
  return addDays(d, n * 7);
}

/** Anchor the month nav to the 1st of the resulting month. */
export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

// Monday-based weekday index: 0=Mon … 6=Sun.
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function startOfWeek(d: Date): Date {
  return addDays(startOfDay(d), -mondayIndex(d));
}

export interface DayCell {
  date: Date;
  key: string;
  inMonth: boolean;
  isToday: boolean;
}

/** 6×7 month matrix (ISO Monday start) of local-midnight day cells for `anchor`'s month. */
export function buildMonthMatrix(anchor: Date, today: Date): DayCell[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const todayKey = dayKeyOf(today);
  const month = anchor.getMonth();
  const cells: DayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const date = addDays(gridStart, i);
    const key = dayKeyOf(date);
    cells.push({ date, key, inMonth: date.getMonth() === month, isToday: key === todayKey });
  }
  return cells;
}

/** The 7 day cells (Mon→Sun) of the week containing `anchor`. */
export function weekDays(anchor: Date, today: Date): DayCell[] {
  const start = startOfWeek(anchor);
  const todayKey = dayKeyOf(today);
  const cells: DayCell[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(start, i);
    const key = dayKeyOf(date);
    cells.push({ date, key, inMonth: true, isToday: key === todayKey });
  }
  return cells;
}

/** Group entries by their local day key. */
export function bucketByDay<T extends { session: Session }>(entries: T[], utc = false): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const e of entries) {
    const k = localDayKey(e.session, utc);
    const arr = m.get(k);
    if (arr) arr.push(e);
    else m.set(k, [e]);
  }
  return m;
}

export interface DayEvent<T> {
  key: string;
  seriesSlug: string;
  seriesName: string;
  color: string;
  round?: number;
  entries: T[];
}

/** Collapse a day's sessions into one block per series-round.
 *
 *  This is what makes a month cell readable. A busy Saturday carries 15 sessions
 *  across six series — as sessions that needs a "+12 more" cliff to fit; as
 *  events it is six rows that fit whole. The round is part of the key so a
 *  doubleheader (Formula E London R16 + R17) stays two blocks, not one. */
export function groupIntoEvents<
  T extends { session: Session; color: string; seriesSlug: string; seriesName: string },
>(entries: T[], roundOf: (entry: T) => number | undefined): DayEvent<T>[] {
  const out: DayEvent<T>[] = [];
  const byKey = new Map<string, DayEvent<T>>();
  for (const e of entries) {
    const round = roundOf(e);
    const key = `${e.seriesSlug}:${round ?? '-'}`;
    let ev = byKey.get(key);
    if (!ev) {
      ev = {
        key,
        seriesSlug: e.seriesSlug,
        seriesName: e.seriesName,
        color: e.color,
        round,
        entries: [],
      };
      byKey.set(key, ev);
      out.push(ev);
    }
    ev.entries.push(e);
  }
  return out;
}

/** Compact series labels for the tightest surfaces — a mobile month cell is
 *  ~38px of weekday column, where "GT World Challenge" clips to "GT W" and says
 *  nothing. Abbreviating is editorial, not algorithmic ("NASCAR Cup" shortens to
 *  NASCAR, "Formula E" to FE), so this is an explicit map over the 15 curated
 *  series with a derived fallback for anything scaffolded later. */
const SERIES_CODES: Record<string, string> = {
  'adac-ravenol-24h': 'ADAC24',
  dtm: 'DTM',
  f1: 'F1',
  f2: 'F2',
  f3: 'F3',
  'formula-e': 'FE',
  'gt-world': 'GTWC',
  imsa: 'IMSA',
  indycar: 'INDY',
  motogp: 'MOTOGP',
  'nascar-cup': 'NASCAR',
  nls: 'NLS',
  wec: 'WEC',
  wrc: 'WRC',
  wsbk: 'WSBK',
};

export function seriesCode(slug: string): string {
  return SERIES_CODES[slug] ?? slug.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 6);
}

/** Clock label for a session. Date-only sessions have no real hour at all
 *  (Session.dateOnly) and read "TBC" — never a fabricated 00:00. */
export function sessionTimeLabel(session: Session, utc = false): string {
  if (session.dateOnly) return 'TBC';
  return new Intl.DateTimeFormat('en-GB', {
    ...(utc ? { timeZone: 'UTC' } : {}),
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(session.start);
}

/** Short zone name for the "times in" indicator. Returns 'GMT' before the
 *  clock syncs so the pre-hydration render matches the server's. */
export function tzLabel(now: Date, clock: boolean, utc = false): string {
  if (utc) return 'UTC';
  if (!clock) return 'GMT';
  return (
    new Intl.DateTimeFormat('en-GB', { timeZoneName: 'short' })
      .formatToParts(now)
      .find(p => p.type === 'timeZoneName')?.value ?? 'local'
  );
}

export function monthLabel(d: Date): string {
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(d);
}

export function weekLabel(anchor: Date): string {
  const start = startOfWeek(anchor);
  const end = addDays(start, 6);
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}–${end.getDate()} ${new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' }).format(end)}`;
  }
  const fmtStart = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(start);
  const fmtEnd = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(end);
  return `${fmtStart} – ${fmtEnd}`;
}

export function dayLabel(d: Date): string {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

export type SessionKind = 'practice' | 'qualifying' | 'race' | 'other';

/** Every kind the filter can select, in display order. 'other' is a REAL option
 *  rather than an implicit tag-along: it used to be shown only while all three
 *  named kinds were selected, so unticking Practice silently also dropped every
 *  session classifySession didn't recognise (a WRC shakedown, a support race). */
export const SESSION_KINDS: SessionKind[] = ['practice', 'qualifying', 'race', 'other'];

/** Coarse session type for the calendar's event filter. Client-safe (no server
 *  imports). Order matters: practice + qualifying are tested before race so a
 *  "Sprint Qualifying" reads as qualifying (not race) and a warm-up reads as
 *  practice. Anything unrecognised is 'other'. */
export function classifySession(title: string): SessionKind {
  const t = title.toLowerCase();
  if (/\b(practice|free practice|fp\d|warm[- ]?up|shakedown|test session|testing)\b/.test(t)) return 'practice';
  if (/\b(qualifying|qualification|hyperpole|shootout|super ?pole|pole position)\b/.test(t)) return 'qualifying';
  if (/\b(race|grand prix|gp|sprint|feature|moto2|moto3|motogp|500|400|24\s?hours?|rally|heat|final|e-?prix)\b/.test(t)) return 'race';
  return 'other';
}
