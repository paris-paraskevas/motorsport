// Family A (O33): Formula 2, Formula 3, MotoGP, WorldSBK and DTM, two or three races a weekend (the Multi-Race Weekend
// Drafts, answered 25 Oct). Task 2.b's PR 2 keeps each round's practice and qualifying beside its races; its pages
// follow in PR 3. Pure: the publisher's family A block (scripts/wp-publish.mts) fetches, these turn answers into tables.

import type { FomResultRow } from '../results/fom-api';
import type { SessionClassificationEntry } from '../results/openf1';
import type { CalendarEntry, ResultRound, Table } from './render';

/** A real place: no field reaches 100, and FOM writes 666 and 66666 for a driver without one. */
const placed = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n < 100;

/** A timed session from FOM's own rows (Formula 2 and 3: practice, qualifying): the placed drivers in order, then the
 *  rest under the place FOM displays for them ("NC", "DQ"), each with its time as FOM writes it: a best lap, or behind
 *  practice's leader the gap. FOM's "666" and "66666" are its markers for no place. */
export function fomTable(title: string, rows: readonly FomResultRow[]): Table | null {
  const lines = rows
    .map(r => ({
      pos: /^\d+$/.test(r.positionNumber ?? '') ? Number(r.positionNumber) : null,
      shown: (r.displayPosition ?? '').trim(),
      name: r.driverFirstName && r.driverLastName ? `${r.driverFirstName} ${r.driverLastName}` : (r.driverShortName ?? ''),
      team: r.teamName ?? '',
      time: (r.displayTime ?? '').trim(),
    }))
    .filter(l => l.name.trim() !== '');
  const top = lines.filter(l => placed(l.pos)).sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
  if (!top.length) return null;
  const rest = lines.filter(l => !placed(l.pos));
  return {
    title,
    columns: ['Pos', 'Driver', 'Team', 'Time'],
    rows: [...top.map(l => [String(l.pos), l.name, l.team, l.time]), ...rest.map(l => [l.shown, l.name, l.team, l.time])],
  };
}

/** A timed session from a fetcher's classification (MotoGP, WorldSBK: practice, qualifying, Superpole, warm-up): the
 *  placed riders in order with their time, else their gap; then anyone unplaced under the status the fetcher gives. */
export function timedTable(title: string, entries: readonly SessionClassificationEntry[], person: 'Driver' | 'Rider'): Table | null {
  const named = entries.filter(e => e.driverName.trim() !== '');
  const top = named.filter(e => placed(e.position)).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  if (!top.length) return null;
  const rest = named.filter(e => !placed(e.position));
  return {
    title,
    columns: ['Pos', person, 'Team', 'Time'],
    rows: [...top.map(e => [String(e.position), e.driverName, e.team, e.time ?? e.gap ?? '']), ...rest.map(e => [e.status ?? '', e.driverName, e.team, e.time ?? ''])],
  };
}

/** A qualifying FOM gives by number (`session=1`, `session=2`) under the timetable's name: a group ("Qualifying A",
 *  "Group B - Qualifying") as "Qualifying Group A"; a weekend's second qualifying (Baku, Madrid) as "Qualifying 2". */
export function fomQualifyingLabel(shortName: string | undefined, n: number): string {
  const group = /(?:^|\s)([AB])(?:\s|$)/.exec(shortName ?? '')?.[1];
  return group ? `Qualifying Group ${group}` : `Qualifying ${n}`;
}

/** The timed sessions a run asks a fetcher for: in the calendar under one of `names`, ended over an hour ago, not yet
 *  held by their round, the newest first, at most `max`. */
export function sessionsWanted(rounds: readonly ResultRound[], calendar: readonly CalendarEntry[], names: ReadonlySet<string>, now: Date, max: number): CalendarEntry[] {
  const held = new Set(rounds.flatMap(r => (r.others ?? []).map(o => `${r.round}|${o.label}`)));
  return calendar
    .filter(e => e.round !== null && !e.dateOnly && names.has(e.session) && Date.parse(e.end) + 3_600_000 <= now.getTime())
    .filter(e => !held.has(`${e.round}|${e.session}`))
    .sort((a, b) => (a.start < b.start ? 1 : a.start > b.start ? -1 : 0))
    .slice(0, Math.max(0, max));
}
