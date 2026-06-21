import { describe, it, expect } from 'vitest';
import { buildSessionClassification as buildF2 } from './f2';
import { buildSessionClassification as buildF3 } from './f3';
import { buildSessionClassification as buildMgp } from './motogp';
import { parseSessionClassification as parseWsbk } from './wsbk';

// Regression guards for the per-session classification parsers added 2026-06-21
// (practice/qualifying on the weekend session pages). Each builds the shared
// SessionClassification shape; quali is single-lap so isQualifying stays false.

// --- F2 / F3 share the fiaformula{2,3}.com __NEXT_DATA__ shape ---------------
function fiaRoot(session: Record<string, unknown>) {
  return { props: { pageProps: { pageData: { RoundNumber: 1, SessionResults: [session] } } } };
}
const fiaRows = [
  { FinishPosition: 1, DriverForename: 'Alpha', DriverSurname: 'One', TLA: 'AON', TeamName: 'Team A', Best: '1:28.695', Gap: '' },
  { FinishPosition: 2, DriverForename: 'Beta', DriverSurname: 'Two', TLA: 'BTW', TeamName: 'Team B', Best: '1:28.911', Gap: '0.216' },
  { FinishPosition: null, DriverForename: 'Gamma', DriverSurname: 'Three', TLA: 'GTH', TeamName: 'Team C' },
];

describe('F2 session classification', () => {
  const c = buildF2(
    fiaRoot({ SessionShortName: 'Qual', SessionType: 'QUALIFYING', SessionResultsAvailable: true, Results: fiaRows }),
    'Qual',
  )!;
  it('is a timed session (single-lap quali → neither isQualifying nor isRace)', () => {
    expect(c.isQualifying).toBe(false);
    expect(c.isRace).toBe(false);
  });
  it('shows the pole lap on P1 (no gap) and a +gap on P2', () => {
    expect(c.entries[0]).toMatchObject({ position: 1, driverName: 'Alpha One', driverCode: 'AON', time: '1:28.695' });
    expect(c.entries[0].gap).toBeUndefined();
    expect(c.entries[1].gap).toBe('+0.216');
  });
  it('places a row with no finish position last, marked DNS', () => {
    const last = c.entries[c.entries.length - 1];
    expect(last).toMatchObject({ driverName: 'Gamma Three', position: null, status: 'DNS' });
  });
  it('returns null when the asked session is absent', () => {
    expect(buildF2(fiaRoot({ SessionShortName: 'Qual', Results: fiaRows }), 'Prac')).toBeNull();
  });
});

describe('F3 session classification', () => {
  it('matches by SessionType, so it finds practice even when short name is "Prac 1"', () => {
    const c = buildF3(
      fiaRoot({ SessionShortName: 'Prac 1', SessionType: 'PRACTICE', SessionResultsAvailable: true, Results: fiaRows }),
      'PRACTICE',
    )!;
    expect(c.entries).toHaveLength(3);
    expect(c.entries[0].time).toBe('1:28.695');
  });
});

// --- MotoGP: Pulselive classification rows -----------------------------------
describe('MotoGP session classification', () => {
  const c = buildMgp([
    { position: 1, rider: { full_name: 'Marco Bezzecchi', number: 72 }, team: { name: 'Aprilia' }, gap: { first: '0.000' } },
    { position: 2, rider: { full_name: 'Franco Morbidelli', number: 21 }, team: { name: 'VR46' }, gap: { first: '0.035' } },
    { rider: { full_name: 'Out Rider', number: 5 }, team: { name: 'Team' }, status: 'OUTSTND' },
  ]);
  it('uses the rider number as the code and drops the +0.000 pole gap', () => {
    expect(c.entries[0]).toMatchObject({ position: 1, driverCode: '#72' });
    expect(c.entries[0].gap).toBeUndefined();
    expect(c.entries[1].gap).toBe('+0.035');
  });
  it('maps a non-classified status (OUTSTND) to DNF, sorted last', () => {
    expect(c.entries[2]).toMatchObject({ position: null, status: 'DNF' });
  });
});

// --- WSBK: Pulselive JSON:API envelope; time is the best LAP in ms -----------
describe('WSBK session classification', () => {
  const data = Array.from({ length: 8 }, (_, i) => ({
    type: 'results',
    id: `r${i}`,
    attributes: { position: i + 1, time: 128244 + i * 400, status: 'Classified' },
    relationships: { rider: { data: { type: 'rider', id: `ri${i}` } }, team: { data: { type: 'team', id: `te${i}` } } },
  }));
  const included = [
    ...Array.from({ length: 8 }, (_, i) => ({ type: 'rider', id: `ri${i}`, attributes: { name: 'R', surname: `${i}`, number: i + 1 } })),
    ...Array.from({ length: 8 }, (_, i) => ({ type: 'team', id: `te${i}`, attributes: { name: `Team ${i}` } })),
  ];
  it('formats the topper best lap (ms → m:ss.mmm) and gaps the rest', () => {
    const c = parseWsbk({ data, included })!;
    expect(c.entries[0].time).toBe('2:08.244'); // 128244 ms
    expect(c.entries[0].gap).toBeUndefined();
    expect(c.entries[1].gap).toBe('+0.400s'); // +400 ms
  });
  it('returns null below the finisher floor', () => {
    expect(parseWsbk({ data: data.slice(0, 3), included })).toBeNull();
  });
});
