import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseDTMRaceClassification, canonicalRound } from './dtm';

// Real motorsport.com DTM result table captured 2026-06-21 from
// /dtm/results/2026/lausitzring-665350/?st=RACE1 (flag/car <img>s stripped —
// the parser never reads them). 21 cars, 16 finishers + 5 DNFs.
const html = readFileSync(
  join(__dirname, '..', '..', 'tests', 'fixtures', 'dtm-lausitzring-race1.html'),
  'utf-8',
);

describe('parseDTMRaceClassification', () => {
  const entries = parseDTMRaceClassification(html);

  it('parses the full grid', () => {
    expect(entries).not.toBeNull();
    expect(entries!.length).toBe(21);
  });

  it('reads P1 with driver, team, points and a total time (not a gap)', () => {
    const p1 = entries![0];
    expect(p1.position).toBe(1);
    expect(p1.driverName).toBe('M. Mapelli');
    expect(p1.team).toBe('Red Bull Team Abt');
    expect(p1.points).toBe(25);
    expect(p1.status).toBe('Finished');
    expect(p1.time).toBeTruthy();
    expect(p1.time).not.toMatch(/^\+/);
  });

  it('reads a runner-up gap into the time field', () => {
    const p2 = entries![1];
    expect(p2.driverName).toBe('B. Dörr');
    expect(p2.points).toBe(20);
    expect(p2.time).toMatch(/^\+/);
  });

  it('maps DNFs to status and sorts them below every finisher', () => {
    const dnfs = entries!.filter(e => e.status === 'DNF');
    expect(dnfs.length).toBe(5);
    const lastFinisher = Math.max(
      ...entries!.filter(e => e.status === 'Finished').map(e => e.position),
    );
    expect(Math.min(...dnfs.map(e => e.position))).toBeGreaterThan(lastFinisher);
  });

  it('returns entries sorted by finishing position', () => {
    const positions = entries!.map(e => e.position);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('fails closed (null) on structurally broken HTML', () => {
    expect(parseDTMRaceClassification('<html><body>no result table</body></html>')).toBeNull();
  });
});

describe('canonicalRound', () => {
  // DTM 2026 skips round 4 (calendar jumps 3 → 5), so positional index diverges
  // from the curated round after the gap.
  const rounds = [
    { round: 1, startDate: '2026-04-24' },
    { round: 2, startDate: '2026-05-22' },
    { round: 3, startDate: '2026-06-19' },
    { round: 5, startDate: '2026-07-24' },
  ];

  it('matches an event to its curated round by date (1-day source drift tolerated)', () => {
    expect(canonicalRound(new Date('2026-06-18'), 3, rounds)).toBe(3);
    expect(canonicalRound(new Date('2026-04-25'), 1, rounds)).toBe(1);
  });

  it('returns the curated round across a calendar gap, not the positional index', () => {
    // 4th completed event is curated round 5 — positional fallback would say 4.
    expect(canonicalRound(new Date('2026-07-24'), 4, rounds)).toBe(5);
  });

  it('falls back to the positional round when no curated round is near', () => {
    expect(canonicalRound(new Date('2026-12-01'), 9, rounds)).toBe(9);
    expect(canonicalRound(null, 7, rounds)).toBe(7);
    expect(canonicalRound(new Date('2026-06-18'), 3, undefined)).toBe(3);
  });
});
