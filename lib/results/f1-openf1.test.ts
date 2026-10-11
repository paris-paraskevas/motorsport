import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RaceResult } from '@/lib/types';

// OpenF1 as F1's backup (B5): only rounds after jolpi.ca's latest, only when jolpi.ca answered, named as jolpi.ca
// names them, marked provisional; the standings take the added points, an added race's win and a countback re-rank.

const fetchOpenF1 = vi.fn();
const fetchUpstream = vi.fn();
vi.mock('@/lib/openf1/client', () => ({ fetchOpenF1: (...a: unknown[]) => fetchOpenF1(...a), OF1_REVALIDATE: { short: 300, daily: 86400, immutable: 604800 } }));
vi.mock('@/lib/fetch-upstream', () => ({ fetchUpstream: (...a: unknown[]) => fetchUpstream(...a) }));

import { identities, missingSlots, openF1Gap, scheduleSlots, toRaceResult, withAddedSessions } from './f1-openf1';

const entry = (position: number, driverName: string, driverCode: string, team: string, points: number) => ({ position, driverName, driverCode, team, status: 'Finished', points });
const jolpiR16: RaceResult = {
  round: 16,
  raceName: 'Bahrain Grand Prix in Malaysia',
  date: new Date('2026-10-04T00:00:00Z'),
  circuit: 'Sepang',
  results: [entry(1, 'Max Verstappen', 'VER', 'Red Bull', 25), entry(2, 'Charles Leclerc', 'LEC', 'Ferrari', 18), entry(3, 'Andrea Kimi Antonelli', 'ANT', 'Mercedes', 15)],
};
const schedule = [
  { round: '16', raceName: 'Bahrain Grand Prix in Malaysia', date: '2026-10-04', time: '07:00:00Z', Circuit: { circuitName: 'Sepang' } },
  { round: '17', raceName: 'Singapore Grand Prix', date: '2026-10-11', time: '12:00:00Z', Circuit: { circuitName: 'Marina Bay Street Circuit' }, Sprint: { date: '2026-10-10', time: '09:00:00Z' } },
  { round: '18', raceName: 'United States Grand Prix', date: '2026-10-25', time: '20:00:00Z', Circuit: { circuitName: 'Circuit of the Americas' } },
];
const NOW = Date.parse('2026-10-11T16:00:00Z');

describe('the gap after jolpi.ca', () => {
  it('lists each race and sprint with its start in UTC', () => {
    const slots = scheduleSlots(schedule);
    expect(slots.filter(s => s.round === 17).map(s => [s.kind, new Date(s.startsAt).toISOString()])).toEqual([
      ['race', '2026-10-11T12:00:00.000Z'],
      ['sprint', '2026-10-10T09:00:00.000Z'],
    ]);
  });

  it('takes only what has run after jolpi.ca’s latest round of its kind', () => {
    const slots = scheduleSlots(schedule);
    const sprint17 = { ...jolpiR16, round: 17, raceName: 'Singapore Grand Prix' };
    const sprint12 = { ...jolpiR16, round: 12 };
    expect(missingSlots(slots, { races: [jolpiR16], sprints: [sprint17] }, NOW).map(s => `${s.kind} ${s.round}`)).toEqual(['race 17']);
    expect(missingSlots(slots, { races: [jolpiR16], sprints: [sprint12] }, NOW).map(s => `${s.kind} ${s.round}`)).toEqual(['race 17', 'sprint 17']);
    // A kind not asked for, or answered empty, is not looked for; round 18 has not started.
    expect(missingSlots(slots, { races: [jolpiR16] }, NOW).map(s => `${s.kind} ${s.round}`)).toEqual(['race 17']);
    expect(missingSlots(slots, { races: [], sprints: [] }, NOW)).toEqual([]);
    expect(missingSlots(slots, { races: [jolpiR16, { ...jolpiR16, round: 17 }], sprints: [sprint17] }, NOW)).toEqual([]);
  });
});

describe('an OpenF1 session as a jolpi.ca race', () => {
  const slot = scheduleSlots(schedule).find(s => s.round === 17 && s.kind === 'race')!;
  const drivers = [
    { driver_number: 3, full_name: 'Max VERSTAPPEN', name_acronym: 'VER', team_name: 'Red Bull Racing' },
    { driver_number: 16, full_name: 'Charles LECLERC', name_acronym: 'LEC', team_name: 'Ferrari' },
    { driver_number: 12, full_name: 'Kimi ANTONELLI', name_acronym: 'ANT', team_name: 'Mercedes' },
    { driver_number: 43, full_name: 'Franco COLAPINTO', name_acronym: 'COL', team_name: 'Alpine' },
    { driver_number: 87, full_name: 'Oliver BEARMAN', name_acronym: 'BEA', team_name: 'Haas F1 Team' },
  ];
  const results = [
    { position: null, driver_number: 43, dnf: true, gap_to_leader: null, points: 0 },
    { position: 2, driver_number: 16, duration: 6128.12, gap_to_leader: 7.335, points: 18 },
    { position: 1, driver_number: 3, duration: 6120.785, gap_to_leader: 0, points: 25 },
    { position: 4, driver_number: 87, gap_to_leader: '+1 LAP', points: 0 },
    { position: 3, driver_number: 12, duration: 6145.358, gap_to_leader: 24.573, points: 15 },
  ];

  it('keeps jolpi.ca’s names and teams by code, OpenF1’s order, times, gaps and statuses', () => {
    const race = toRaceResult(slot, results, drivers, identities([jolpiR16]))!;
    expect(race.provisional).toBe(true);
    expect(race.raceName).toBe('Singapore Grand Prix');
    expect(race.circuit).toBe('Marina Bay Street Circuit');
    expect(race.results.map(e => [e.position, e.driverName, e.team, e.status, e.time ?? null, e.points])).toEqual([
      [1, 'Max Verstappen', 'Red Bull', 'Finished', '1:42:00.785', 25],
      [2, 'Charles Leclerc', 'Ferrari', 'Finished', '+7.335', 18],
      [3, 'Andrea Kimi Antonelli', 'Mercedes', 'Finished', '+24.573', 15],
      // Unknown to jolpi.ca: OpenF1's own name, set in title case, and its team.
      [4, 'Oliver Bearman', 'Haas F1 Team', '+1 Lap', null, 0],
      [5, 'Franco Colapinto', 'Alpine', 'Retired', null, 0],
    ]);
  });

  it('is not used when a row has no name or team', () => {
    expect(toRaceResult(slot, [{ position: 1, driver_number: 99, points: 25 }], [], new Map())).toBeNull();
  });
});

describe('the standings with the added sessions', () => {
  const standings = {
    drivers: [
      { position: 1, driverName: 'Charles Leclerc', driverCode: 'LEC', team: 'Ferrari', points: 100, wins: 1 },
      { position: 2, driverName: 'Max Verstappen', driverCode: 'VER', team: 'Red Bull', points: 90, wins: 1 },
    ],
    constructors: [
      { position: 1, name: 'Ferrari', points: 100, wins: 1 },
      { position: 2, name: 'Red Bull', points: 90, wins: 1 },
    ],
  };
  const race17: RaceResult = { ...jolpiR16, round: 17, provisional: true, results: [entry(1, 'Max Verstappen', 'VER', 'Red Bull', 25), entry(2, 'Charles Leclerc', 'LEC', 'Ferrari', 18)] };

  it('adds the points and the race’s win, and re-ranks by points', () => {
    const out = withAddedSessions(standings, { races: [race17], sprints: [] }, [jolpiR16]);
    expect(out.drivers.map(d => [d.position, d.driverName, d.points, d.wins])).toEqual([
      [1, 'Charles Leclerc', 118, 1],
      [2, 'Max Verstappen', 115, 2],
    ]);
    expect(out.constructors.map(c => [c.position, c.name, c.points, c.wins])).toEqual([
      [1, 'Ferrari', 118, 1],
      [2, 'Red Bull', 115, 2],
    ]);
  });

  it('breaks a tie on points by the most wins, then the most seconds', () => {
    const tied = { drivers: [{ ...standings.drivers[0], points: 90 }, standings.drivers[1]], constructors: standings.constructors };
    const sprint: RaceResult = { ...race17, results: [entry(1, 'Max Verstappen', 'VER', 'Red Bull', 8), entry(2, 'Charles Leclerc', 'LEC', 'Ferrari', 8)] };
    const out = withAddedSessions(tied, { races: [], sprints: [sprint] }, [jolpiR16]);
    // 98 each; a sprint win is not a win, so jolpi.ca’s round 16 decides: Verstappen won it.
    expect(out.drivers.map(d => [d.position, d.driverName, d.points, d.wins])).toEqual([
      [1, 'Max Verstappen', 98, 1],
      [2, 'Charles Leclerc', 98, 1],
    ]);
  });

  it('is jolpi.ca’s table untouched when OpenF1 added nothing', () => {
    expect(withAddedSessions(standings, { races: [], sprints: [] }, [jolpiR16])).toBe(standings);
  });
});

describe('openF1Gap', () => {
  beforeEach(() => {
    fetchOpenF1.mockReset();
    fetchUpstream.mockReset();
  });

  it('asks nothing when jolpi.ca did not answer', async () => {
    expect(await openF1Gap({ races: [], sprints: [] })).toEqual({ races: [], sprints: [] });
    expect(fetchUpstream).not.toHaveBeenCalled();
    expect(fetchOpenF1).not.toHaveBeenCalled();
  });

  it('fills the race OpenF1 has once it has ended', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    fetchUpstream.mockResolvedValue({ ok: true, json: async () => ({ MRData: { RaceTable: { Races: schedule } } }) });
    fetchOpenF1.mockImplementation(async (endpoint: string) => {
      if (endpoint === 'sessions') return [
        { session_key: 11383, session_name: 'Sprint', date_start: '2026-10-10T09:00:00+00:00', date_end: '2026-10-10T09:30:00+00:00' },
        { session_key: 11388, session_name: 'Race', date_start: '2026-10-11T12:00:00+00:00', date_end: '2026-10-11T14:00:00+00:00' },
      ];
      if (endpoint === 'session_result') return [{ position: 1, driver_number: 3, duration: 6120.785, gap_to_leader: 0, points: 25 }];
      if (endpoint === 'drivers') return [{ driver_number: 3, full_name: 'Max VERSTAPPEN', name_acronym: 'VER', team_name: 'Red Bull Racing' }];
      return [];
    });
    const sprint17 = { ...jolpiR16, round: 17, raceName: 'Singapore Grand Prix' };
    const gap = await openF1Gap({ races: [jolpiR16], sprints: [sprint17] });
    vi.useRealTimers();
    expect(gap.sprints).toEqual([]);
    expect(gap.races.map(r => [r.round, r.raceName, r.provisional, r.results[0].driverName, r.results[0].team])).toEqual([[17, 'Singapore Grand Prix', true, 'Max Verstappen', 'Red Bull']]);
    expect(fetchOpenF1).toHaveBeenCalledWith('session_result', { session_key: 11388 }, expect.anything());
  });
});
