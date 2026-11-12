import { describe, expect, it } from 'vitest';
import type { BestLap } from './laps';
import type { OF1Location, OF1RaceControl, OF1Stint, OF1Weather } from './types';
import { circuitMap, driverStints, finishedAt, poleLap, sessionMarks, trackTimeToUtc, weatherSummary } from './weekend';

const rc = (date: string, message: string, extra: Partial<OF1RaceControl> = {}): OF1RaceControl => ({
  date, message, category: 'Other', flag: null, scope: null, sector: null, driver_number: null, lap_number: null, session_key: 1, ...extra,
});
const status = (date: string, message: string, lap: number | null = null) => rc(date, message, { category: 'SessionStatus', lap_number: lap });

describe('trackTimeToUtc', () => {
  it('reads a wall-clock time at the track as the instant it is, summer or winter', () => {
    expect(trackTimeToUtc('2026-10-10', '17:30', 'Asia/Singapore')).toBe('2026-10-10T09:30:00.000Z');
    expect(trackTimeToUtc('2026-09-06', '15:39', 'Europe/Rome')).toBe('2026-09-06T13:39:00.000Z');
    expect(trackTimeToUtc('2026-10-25', '15:00', 'America/Chicago')).toBe('2026-10-25T20:00:00.000Z');
    expect(trackTimeToUtc('2026-12-06', '17:00', 'Asia/Dubai')).toBe('2026-12-06T13:00:00.000Z');
  });

  it('reads a time on the day the clocks change at the track by the offset in force then', () => {
    // Rome leaves summer time at 03:00 on 25 October 2026; Austin at 02:00 on 1 November.
    expect(trackTimeToUtc('2026-10-25', '01:30', 'Europe/Rome')).toBe('2026-10-24T23:30:00.000Z');
    expect(trackTimeToUtc('2026-10-25', '12:00', 'Europe/Rome')).toBe('2026-10-25T11:00:00.000Z');
    expect(trackTimeToUtc('2026-11-01', '15:00', 'America/Chicago')).toBe('2026-11-01T21:00:00.000Z');
  });

  it('gives nothing for a zone the runtime does not know or a time it cannot read', () => {
    expect(trackTimeToUtc('2026-10-25', '15:00', 'Nowhere/Zone')).toBeNull();
    expect(trackTimeToUtc('2026-10-25', 'half past', 'Europe/Rome')).toBeNull();
  });
});

describe('sessionMarks', () => {
  // Singapore's Sprint, 10 October 2026, as OpenF1's race control has it: planned for 17:00, the formation lap at 17:30.
  const sprint = [
    rc('2026-10-10T08:52:43+00:00', 'DELAYED START'),
    rc('2026-10-10T09:17:36.120000+00:00', 'FORMATION LAP WILL START AT 17:30'),
    rc('2026-10-10T09:25:00+00:00', 'FORMATION LAP(S) BEHIND SAFETY CAR'),
    status('2026-10-10T09:36:30+00:00', 'SESSION STARTED'),
  ];

  it('marks a late start at the time race control gave, in the track time', () => {
    expect(sessionMarks(sprint, '2026-10-10T09:00:00Z', 'Asia/Singapore')).toEqual({ late: { planned: '2026-10-10T09:00:00Z', started: '2026-10-10T09:30:00.000Z' } });
  });

  it('falls back to the moment the session started when it has no track time or no new time', () => {
    expect(sessionMarks(sprint, '2026-10-10T09:00:00Z', undefined).late?.started).toBe('2026-10-10T09:36:30.000Z');
    expect(sessionMarks([sprint[0], sprint[3]], '2026-10-10T09:00:00Z', 'Asia/Singapore').late?.started).toBe('2026-10-10T09:36:30.000Z');
  });

  it('never marks the few minutes a race always takes to start', () => {
    expect(sessionMarks([status('2026-09-06T13:03:30+00:00', 'SESSION STARTED', 1)], '2026-09-06T13:00:00Z', 'Europe/Rome')).toEqual({});
  });

  // Monza's race, 6 September 2026: stopped on lap 3, restarted.
  const monza = [
    status('2026-09-06T13:03:30+00:00', 'SESSION STARTED', 1),
    status('2026-09-06T13:07:42+00:00', 'SESSION ABORTED', 3),
    rc('2026-09-06T13:07:43+00:00', 'RED FLAG - RACE SUSPENDED', { lap_number: 3 }),
    rc('2026-09-06T13:27:50+00:00', 'RACE WILL RESUME AT 15:39', { lap_number: 4 }),
    status('2026-09-06T13:39:00+00:00', 'SESSION STARTED', 4),
    status('2026-09-06T14:54:46+00:00', 'SESSION FINISHED', 53),
  ];

  it('marks a red flag once, with its lap, restarted when the session started again', () => {
    expect(sessionMarks(monza, '2026-09-06T13:00:00Z', 'Europe/Rome')).toEqual({ red: [{ lap: 3, restarted: true }] });
    expect(sessionMarks(monza.slice(0, 3), '2026-09-06T13:00:00Z', 'Europe/Rome')).toEqual({ red: [{ lap: 3, restarted: false }] });
  });

  it('counts a red flag shown as the flag itself', () => {
    const q = [status('2026-10-10T13:00:00Z', 'SESSION STARTED'), rc('2026-10-10T13:20:00Z', 'TRACK CLEAR', { category: 'Flag', flag: 'RED' }), status('2026-10-10T13:35:00Z', 'SESSION STARTED')];
    expect(sessionMarks(q, '2026-10-10T13:00:00Z', 'Asia/Singapore').red).toEqual([{ lap: null, restarted: true }]);
  });

  it('takes the last new time race control gave before the session started, when a delay is pushed back', () => {
    const twice = [sprint[0], sprint[1], rc('2026-10-10T09:27:00+00:00', 'FORMATION LAP WILL START AT 17:45'), status('2026-10-10T09:51:30+00:00', 'SESSION STARTED')];
    expect(sessionMarks(twice, '2026-10-10T09:00:00Z', 'Asia/Singapore').late?.started).toBe('2026-10-10T09:45:00.000Z');
  });

  it("reads a new time past the track's midnight as the next day", () => {
    // Las Vegas, a 22:00 start pushed to 00:15: said at 23:50 local (07:50Z), so 00:15 is the next day's (08:15Z).
    const vegas = [rc('2026-11-21T07:40:00Z', 'DELAYED START'), rc('2026-11-21T07:50:00Z', 'FORMATION LAP WILL START AT 00:15')];
    expect(sessionMarks(vegas, '2026-11-21T06:00:00Z', 'America/Los_Angeles').late?.started).toBe('2026-11-21T08:15:00.000Z');
  });

  it('does not count a red flag as restarted by the next part, or "RED FLAG LIFTED" as a red flag, or a row without words', () => {
    const quali = [status('2026-10-10T13:00:00Z', 'SESSION STARTED'), rc('2026-10-10T13:17:00Z', 'RED FLAG'), status('2026-10-10T13:18:00Z', 'SESSION FINISHED'), status('2026-10-10T13:25:00Z', 'SESSION STARTED')];
    expect(sessionMarks(quali, '2026-10-10T13:00:00Z', 'Asia/Singapore').red).toEqual([{ lap: null, restarted: false }]);
    expect(sessionMarks([rc('2026-10-10T13:20:00Z', 'RED FLAG LIFTED - PIT EXIT OPEN')], '2026-10-10T13:00:00Z', 'Asia/Singapore')).toEqual({});
    const wordless = { ...status('2026-10-10T13:21:00Z', 'x'), message: null as unknown as string };
    expect(sessionMarks([rc('2026-10-10T13:20:00Z', 'RED FLAG'), wordless], '2026-10-10T13:00:00Z', 'Asia/Singapore').red).toEqual([{ lap: null, restarted: false }]);
  });
});

describe("sessionMarks: a race's safety cars (O28)", () => {
  const sc = (date: string, lap: number, message: string) => rc(date, message, { category: 'SafetyCar', lap_number: lap });
  const flag = (date: string, lap: number) => rc(date, 'CHEQUERED FLAG', { category: 'Flag', flag: 'CHEQUERED', lap_number: lap });
  const marks = (msgs: OF1RaceControl[], race = true) => sessionMarks(msgs, '2026-10-11T12:00:00Z', 'Asia/Singapore', race);

  // Singapore's race, 11 October 2026, as OpenF1's race control has it.
  const singapore = [
    status('2026-10-11T12:03:39.077000+00:00', 'SESSION STARTED', 1),
    sc('2026-10-11T12:16:35+00:00', 8, 'VSC DEPLOYED'),
    sc('2026-10-11T12:17:40+00:00', 9, 'VSC ENDING'),
    sc('2026-10-11T13:07:14+00:00', 39, 'VSC DEPLOYED'),
    sc('2026-10-11T13:09:13+00:00', 40, 'VSC ENDING'),
    flag('2026-10-11T13:45:40+00:00', 62),
    status('2026-10-11T13:45:40.086000+00:00', 'SESSION FINISHED', 62),
  ];

  it("reads round 17's four VSC messages as laps 8 to 9 and 39 to 40", () => {
    expect(marks(singapore)).toEqual({ neutral: [{ kind: 'VSC', from: 8, to: 9 }, { kind: 'VSC', from: 39, to: 40 }], lanes: [] });
  });

  it('reads the safety car in its own words and the virtual one as race control wrote it before 2026', () => {
    const china = [sc('2026-03-15T07:20:00Z', 10, 'SAFETY CAR DEPLOYED'), sc('2026-03-15T07:26:00Z', 13, 'SAFETY CAR IN THIS LAP')];
    const older = [sc('2026-03-15T07:50:00Z', 21, 'VIRTUAL SAFETY CAR DEPLOYED'), sc('2026-03-15T07:53:00Z', 22, 'VIRTUAL SAFETY CAR ENDING')];
    expect(marks([...older, ...china]).neutral).toEqual([{ kind: 'SC', from: 10, to: 13 }, { kind: 'VSC', from: 21, to: 22 }]);
    // Words about the safety car that neither send it out nor bring it in shade nothing.
    const asides = [
      rc('2026-10-04T07:00:00Z', 'FORMATION LAP(S) BEHIND SAFETY CAR', { lap_number: 1 }),
      rc('2026-10-04T07:01:00Z', 'SAFETY CAR LIGHTS ON', { lap_number: 1 }),
      rc('2026-10-04T08:00:00Z', 'LAPPED CARS MAY NOW OVERTAKE THE SAFETY CAR: 77', { lap_number: 26 }),
    ];
    expect(marks(asides).neutral).toEqual([]);
  });

  it('closes a span still open at the flag on the last lap', () => {
    expect(marks([sc('2026-07-05T15:18:50Z', 48, 'SAFETY CAR DEPLOYED'), flag('2026-07-05T15:31:05Z', 52)]).neutral).toEqual([{ kind: 'SC', from: 48, to: 52 }]);
    // Without the flag (OpenF1 still sending), on the last lap race control has named.
    expect(marks([sc('2026-07-05T15:18:50Z', 48, 'SAFETY CAR DEPLOYED'), rc('2026-07-05T15:25:00Z', 'TRACK CLEAR', { lap_number: 50 })]).neutral).toEqual([{ kind: 'SC', from: 48, to: 50 }]);
  });

  it('closes a span at a red flag, so the standing restart is not shaded (Monza and Monaco 2026)', () => {
    const monza = [
      sc('2026-09-06T13:06:49+00:00', 3, 'SAFETY CAR DEPLOYED'),
      status('2026-09-06T13:07:42+00:00', 'SESSION ABORTED', 3),
      rc('2026-09-06T13:07:43+00:00', 'RED FLAG - RACE SUSPENDED', { lap_number: 3 }),
      rc('2026-09-06T13:34:00+00:00', 'SAFETY CAR LIGHTS ON', { lap_number: 4 }),
      status('2026-09-06T13:39:00+00:00', 'SESSION STARTED', 4),
      flag('2026-09-06T14:54:46+00:00', 53),
    ];
    expect(marks(monza)).toEqual({
      red: [{ lap: 3, restarted: true }],
      neutral: [{ kind: 'SC', from: 3, to: 3 }],
      // The tyre changes under the red flag, from the flag to the restart.
      lanes: [{ kind: 'red', from: '2026-09-06T13:07:43.000Z', to: '2026-09-06T13:39:00.000Z' }],
    });
    const monaco = [
      sc('2026-06-07T14:20:00Z', 60, 'SAFETY CAR DEPLOYED'),
      sc('2026-06-07T14:29:41Z', 65, 'SAFETY CAR IN THIS LAP'),
      sc('2026-06-07T14:31:18Z', 66, 'SAFETY CAR DEPLOYED'),
      rc('2026-06-07T14:35:07Z', 'RED FLAG - RACE SUSPENDED', { lap_number: 68 }),
      status('2026-06-07T15:12:00Z', 'SESSION STARTED', 68),
      flag('2026-06-07T15:40:00Z', 78),
    ];
    expect(marks(monaco).neutral).toEqual([{ kind: 'SC', from: 60, to: 65 }, { kind: 'SC', from: 66, to: 68 }]);
  });

  it('closes a VSC a lap before the safety car that follows it, and keeps one span for a car redeployed on the lap it came in', () => {
    const malaysia = [sc('2026-10-04T09:53:01Z', 43, 'VSC DEPLOYED'), sc('2026-10-04T09:58:26Z', 45, 'SAFETY CAR DEPLOYED'), sc('2026-10-04T10:11:34Z', 51, 'SAFETY CAR IN THIS LAP')];
    expect(marks(malaysia).neutral).toEqual([{ kind: 'VSC', from: 43, to: 44 }, { kind: 'SC', from: 45, to: 51 }]);
    const britain = [
      sc('2026-07-05T15:18:50Z', 48, 'SAFETY CAR DEPLOYED'),
      sc('2026-07-05T15:27:42Z', 51, 'SAFETY CAR IN THIS LAP'),
      sc('2026-07-05T15:27:50Z', 51, 'SAFETY CAR DEPLOYED'),
      sc('2026-07-05T15:29:51Z', 52, 'SAFETY CAR IN THIS LAP'),
      flag('2026-07-05T15:31:05Z', 52),
    ];
    expect(marks(britain).neutral).toEqual([{ kind: 'SC', from: 48, to: 52 }]);
    // Deployed and ended on the same lap: one lap shaded.
    expect(marks([sc('2026-03-08T05:00:00Z', 34, 'VSC DEPLOYED'), sc('2026-03-08T05:01:00Z', 34, 'VSC ENDING')]).neutral).toEqual([{ kind: 'VSC', from: 34, to: 34 }]);
  });

  it('closes a span whose closing message came without its lap on the last lap race control named, not at the flag', () => {
    const unlapped = [
      sc('2026-03-08T05:00:00Z', 10, 'SAFETY CAR DEPLOYED'),
      rc('2026-03-08T05:04:00Z', 'LAPPED CARS MAY NOW OVERTAKE THE SAFETY CAR: 77', { lap_number: 12 }),
      rc('2026-03-08T05:06:00Z', 'SAFETY CAR IN THIS LAP', { category: 'SafetyCar' }),
      flag('2026-03-08T06:00:00Z', 40),
    ];
    expect(marks(unlapped).neutral).toEqual([{ kind: 'SC', from: 10, to: 12 }]);
    // With no lap named since the deployment, its own lap.
    expect(marks([sc('2026-03-08T05:00:00Z', 10, 'VSC DEPLOYED'), rc('2026-03-08T05:01:00Z', 'VSC ENDING', { category: 'SafetyCar' }), flag('2026-03-08T06:00:00Z', 40)]).neutral).toEqual([{ kind: 'VSC', from: 10, to: 10 }]);
  });

  it('marks when race control sent the whole field through the pit lane, as Monaco and Baku saved it (2026)', () => {
    const through = (date: string, lap: number) => rc(date, 'ALL CARS THROUGH THE PIT LANE', { lap_number: lap });
    const monaco = [
      sc('2026-06-07T14:20:00+00:00', 60, 'SAFETY CAR DEPLOYED'),
      through('2026-06-07T14:21:52+00:00', 61),
      sc('2026-06-07T14:29:41+00:00', 65, 'SAFETY CAR IN THIS LAP'),
      sc('2026-06-07T14:31:18+00:00', 66, 'SAFETY CAR DEPLOYED'),
      through('2026-06-07T14:31:38+00:00', 66),
      status('2026-06-07T14:35:06+00:00', 'SESSION ABORTED', 68),
      rc('2026-06-07T14:35:07+00:00', 'RED FLAG - RACE SUSPENDED', { lap_number: 68 }),
      status('2026-06-07T15:12:00+00:00', 'SESSION STARTED', 68),
    ];
    expect(marks(monaco).lanes).toEqual([
      { kind: 'through', from: '2026-06-07T14:21:52.000Z', to: '2026-06-07T14:24:52.000Z' },
      { kind: 'through', from: '2026-06-07T14:31:38.000Z', to: '2026-06-07T14:34:38.000Z' },
      { kind: 'red', from: '2026-06-07T14:35:07.000Z', to: '2026-06-07T15:12:00.000Z' },
    ]);
    const baku = [sc('2026-09-26T12:12:30+00:00', 36, 'SAFETY CAR DEPLOYED'), through('2026-09-26T12:12:43+00:00', 36)];
    expect(marks(baku).lanes).toEqual([{ kind: 'through', from: '2026-09-26T12:12:43.000Z', to: '2026-09-26T12:15:43.000Z' }]);
    // The pit exit closed before the start, or a sprint: no lane.
    expect(marks([rc('2026-10-11T11:30:00Z', 'PIT EXIT CLOSED', { lap_number: 1 })]).lanes).toEqual([]);
    expect('lanes' in marks(baku, false)).toBe(false);
  });

  it('shades nothing for words it does not know, and reads no spans for a session that is not a race', () => {
    expect(marks([sc('2027-03-08T05:00:00Z', 5, 'SC DEPLOYED'), sc('2027-03-08T05:04:00Z', 7, 'SC ENDING')]).neutral).toEqual([]);
    expect(marks(singapore, false)).toEqual({});
    expect('neutral' in marks([], true)).toBe(true);
  });
});

describe('finishedAt', () => {
  it('gives the last time race control said the session finished, or nothing', () => {
    expect(finishedAt([status('2026-09-06T14:54:46+00:00', 'SESSION FINISHED', 53), status('2026-09-06T13:03:30+00:00', 'SESSION STARTED', 1)])).toBe(Date.parse('2026-09-06T14:54:46Z'));
    expect(finishedAt([status('2026-09-06T13:03:30+00:00', 'SESSION STARTED', 1)])).toBeNull();
  });
});

describe('weatherSummary', () => {
  const w = (air: number, track: number, humidity: number, rainfall: number): OF1Weather => ({
    date: '2026-10-10T09:00:00Z', air_temperature: air, track_temperature: track, humidity, pressure: 1008, rainfall, wind_direction: 0, wind_speed: 1, session_key: 1, meeting_key: 1,
  });

  it('gives the low, middle and high, drops a track reading of 0, and notes any rain', () => {
    expect(weatherSummary([w(30.6, 0, 66.3, 0), w(29.3, 45.2, 86.1, 1), w(30.1, 38.1, 70, 0), w(30.2, 50.4, 70, 0)])).toEqual({
      air: [29, 30, 31],
      track: [38, 45, 50],
      humidity: [66, 86],
      rain: true,
    });
  });

  it('gives no track spread when the sensor read nothing, and nothing at all without readings', () => {
    expect(weatherSummary([w(31, 0, 60, 0)])?.track).toBeNull();
    expect(weatherSummary([])).toBeNull();
  });

  it("keeps only the readings in the session's window: a shower before a dry race is no rain in it", () => {
    const at = (iso: string, rain: number): OF1Weather => ({ ...w(30, 40, 70, rain), date: iso });
    const rows = [at('2026-10-11T11:10:00Z', 1), at('2026-10-11T11:50:00Z', 0), at('2026-10-11T12:30:00Z', 0), at('2026-10-11T14:20:00Z', 1)];
    const race = { from: Date.parse('2026-10-11T12:00:00Z') - 15 * 60_000, to: Date.parse('2026-10-11T13:55:00Z') };
    expect(weatherSummary(rows, race)?.rain).toBe(false);
    expect(weatherSummary(rows)?.rain).toBe(true);
    expect(weatherSummary(rows.slice(0, 1), race)).toBeNull();
  });
});

describe('driverStints', () => {
  const s = (driver_number: number, stint_number: number, compound: string | null, lap_start: number, lap_end: number): OF1Stint => ({ driver_number, stint_number, compound, lap_start, lap_end, tyre_age_at_start: 0, session_key: 1 });

  it("groups each driver's stints in order, by car number", () => {
    expect(driverStints([s(16, 2, 'MEDIUM', 25, 39), s(1, 1, 'SOFT', 1, 32), s(16, 1, 'SOFT', 1, 24), s(1, 2, 'MEDIUM', 33, 62), s(16, 3, null, 40, 62)])).toEqual([
      [1, [['SOFT', 1, 32], ['MEDIUM', 33, 62]]],
      [16, [['SOFT', 1, 24], ['MEDIUM', 25, 39], ['UNKNOWN', 40, 62]]],
    ]);
  });
});

describe('poleLap and circuitMap', () => {
  const lap = (driverNumber: number, lapDuration: number, sectors: [number | null, number | null, number | null]): BestLap => ({
    driverNumber, lapNumber: 11, lapDuration, sectors, dateStart: '2026-10-10T13:40:00.000Z', segments: [[], [], []],
  });

  it('takes the fastest lap that has all three sectors', () => {
    const best = new Map([[1, lap(1, 91.373, [27.002, 38.531, 25.84])], [16, lap(16, 91.2, [27, null, 25])], [44, lap(44, 91.5, [27.1, 38.6, 25.8])]]);
    expect(poleLap(best)?.driverNumber).toBe(1);
  });

  it('draws the lap and splits it where sectors two and three begin', () => {
    // A square lap of 100 positions, one every 0.9 s, clear of (0, 0), which OpenF1 sends for a lost signal and the
    // drawing drops; sectors of 30 s each begin at 29.7 s and 60.3 s.
    const samples: OF1Location[] = Array.from({ length: 100 }, (_, i) => {
      const side = Math.floor(i / 25), f = (i % 25) / 25;
      const [x, y] = [[f, 0], [1, f], [1 - f, 1], [0, 1 - f]][side];
      return { driver_number: 1, date: new Date(Date.parse('2026-10-10T13:40:00Z') + i * 900).toISOString(), x: 100 + x * 1000, y: 100 + y * 1000, z: 0, session_key: 7 };
    });
    const map = circuitMap(lap(1, 90, [30, 30, 30]), samples, 2026, 7);
    expect(map?.split).toEqual([33, 67]);
    expect(map?.points).toHaveLength(100);
    expect({ year: map?.year, session: map?.session, driver: map?.driver, sectors: map?.sectors, w: map?.w }).toEqual({ year: 2026, session: 7, driver: 1, sectors: [30, 30, 30], w: 1000 });
  });

  it('draws nothing from too few positions', () => {
    expect(circuitMap(lap(1, 90, [30, 30, 30]), [], 2026, 7)).toBeNull();
  });

  // A round lap of 90 s, a position every 0.25 s, the first 0.2 s after the lap began, with a lost signal in it.
  const roundLap = (keep?: (t: number) => boolean): OF1Location[] => {
    const out: OF1Location[] = [];
    for (let i = 0; i < 360; i++) {
      const t = 0.2 + i * 0.25;
      if (keep && !keep(t)) continue;
      const a = (t / 90) * 2 * Math.PI, lost = i === 100;
      out.push({ driver_number: 1, date: new Date(Date.parse('2026-10-10T13:40:00Z') + t * 1000).toISOString(), x: lost ? 0 : 500 + 400 * Math.cos(a), y: lost ? 0 : 500 + 400 * Math.sin(a), z: 0, session_key: 7 });
    }
    return out;
  };

  it('times the lap from its own start, drops a lost signal and keeps at most 400 points', () => {
    const map = circuitMap(lap(1, 90, [30, 30, 30]), roundLap(), 2026, 7);
    expect(map?.points).toHaveLength(359);
    // Sector 2 begins 30 s into the lap: the reading at 29.95 s, the 120th, is point 118 once the lost one is dropped;
    // sector 3's at 59.95 s is point 238.
    expect(map?.split).toEqual([118, 238]);
    const dense = Array.from({ length: 900 }, (_, i) => {
      const t = i * 0.1, a = (t / 90) * 2 * Math.PI;
      return { driver_number: 1, date: new Date(Date.parse('2026-10-10T13:40:00Z') + t * 1000).toISOString(), x: 500 + 400 * Math.cos(a), y: 500 + 400 * Math.sin(a), z: 0, session_key: 7 };
    });
    expect(circuitMap(lap(1, 90, [30, 30, 30]), dense, 2026, 7)?.points.length).toBeLessThanOrEqual(400);
  });

  it('draws nothing from a lap with a gap in its positions or with its end missing', () => {
    expect(circuitMap(lap(1, 90, [30, 30, 30]), roundLap(t => t < 40 || t > 48), 2026, 7)).toBeNull();
    expect(circuitMap(lap(1, 90, [30, 30, 30]), roundLap(t => t < 80), 2026, 7)).toBeNull();
  });
});
