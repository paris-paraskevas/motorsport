import { describe, it, expect } from 'vitest';
import { diffRoundSchedule, type OfficialSessionLite } from './f1-schedule-crosscheck';

// OpenF1-shaped official set for a Fri-Sun weekend.
const official: OfficialSessionLite[] = [
  { name: 'Practice 1', dateStart: '2026-07-17T11:30:00+00:00' },
  { name: 'Qualifying', dateStart: '2026-07-18T14:00:00+00:00' },
  { name: 'Race', dateStart: '2026-07-19T13:00:00+00:00' },
];

describe('diffRoundSchedule', () => {
  it('no diffs when our sessions match official day + time', () => {
    const ours = [
      { title: 'F1 - Practice 1', start: new Date('2026-07-17T11:30:00Z') },
      { title: 'F1 - Qualifying', start: new Date('2026-07-18T14:00:00Z') },
      { title: 'F1 - Race', start: new Date('2026-07-19T13:00:00Z') },
    ];
    expect(diffRoundSchedule(ours, official)).toEqual([]);
  });

  it('flags a wrong DAY (the failure the count monitor misses)', () => {
    const ours = [{ title: 'F1 - Qualifying', start: new Date('2026-07-17T14:00:00Z') }]; // Fri not Sat
    const d = diffRoundSchedule(ours, official);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ kind: 'wrong-day', session: 'F1 - Qualifying' });
  });

  it('flags a wrong TIME on the right day (beyond tolerance)', () => {
    const ours = [{ title: 'F1 - Race', start: new Date('2026-07-19T15:00:00Z') }]; // 2h off
    const d = diffRoundSchedule(ours, official);
    expect(d).toHaveLength(1);
    expect(d[0].kind).toBe('wrong-time');
  });

  it('tolerates a small time delta (<= tolerance)', () => {
    const ours = [{ title: 'F1 - Race', start: new Date('2026-07-19T13:20:00Z') }]; // 20 min
    expect(diffRoundSchedule(ours, official)).toEqual([]);
  });

  it('skips our sessions with no OpenF1 counterpart (support/other)', () => {
    const ours = [{ title: 'F1 - Pit Lane Open', start: new Date('2026-07-16T09:00:00Z') }];
    expect(diffRoundSchedule(ours, official)).toEqual([]);
  });

  it('checks a date-only session on day alone', () => {
    expect(
      diffRoundSchedule([{ title: 'F1 - Race', start: new Date('2026-07-19T00:00:00Z'), dateOnly: true }], official),
    ).toEqual([]);
    expect(
      diffRoundSchedule([{ title: 'F1 - Race', start: new Date('2026-07-18T00:00:00Z'), dateOnly: true }], official),
    ).toHaveLength(1);
  });
});
