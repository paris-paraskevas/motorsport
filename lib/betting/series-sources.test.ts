import { describe, expect, it, vi } from 'vitest';

// The three correctness gates documented in ./series-sources — a series may
// only run markets when its field (pricing) names match its settlement names
// (a), settlement sees exactly one race per round: the Feature (b), and round
// numbering aligns with the curated rounds.json (c — live-probed, tripwired
// here). These tests pin the adapter behaviour with fixture data; the live
// probes behind the wiring decisions are recorded in the module's ledger.

vi.mock('@/lib/standings/f1', () => ({ fetchF1Standings: vi.fn() }));
vi.mock('@/lib/results/f1', () => ({ fetchF1SeasonResults: vi.fn() }));
vi.mock('@/lib/standings/f2', () => ({ fetchF2Standings: vi.fn() }));
vi.mock('@/lib/results/f2', () => ({ fetchF2SeasonResults: vi.fn() }));

import { FIELD_SOURCES, RESULT_SOURCES } from './series-sources';
import { fetchF2Standings } from '@/lib/standings/f2';
import { fetchF2SeasonResults } from '@/lib/results/f2';

const feature = (round: number, driverName: string) => ({
  round,
  raceName: `Feature R${round}`,
  date: new Date('2026-06-01T12:00:00Z'),
  results: [{ position: 1, driverName, team: 'T', points: 25 }],
});

describe('betting series-sources gates', () => {
  it('gate (a): F2 field names and settlement names normalize identically (double-space record)', async () => {
    // The FIA feeds carry "Oliver  Goethe" (double space) on BOTH sides today;
    // normalization must keep a one-sided upstream cleanup from stranding a
    // market priced under the un-cleaned key.
    vi.mocked(fetchF2Standings).mockResolvedValue({
      drivers: [
        { position: 1, driverName: 'Oliver  Goethe', team: 'T', points: 100 },
        { position: 2, driverName: 'Jak Crawford', team: 'T', points: 90 },
      ],
      constructors: [],
    } as never);
    vi.mocked(fetchF2SeasonResults).mockResolvedValue({
      feature: [feature(1, 'Oliver Goethe')], // upstream cleaned ONE side
      sprints: [],
    } as never);

    const field = await FIELD_SOURCES.f2();
    const races = await RESULT_SOURCES.f2();
    const fieldNames = new Set(field!.map(d => d.name));
    expect(fieldNames.has('Oliver Goethe')).toBe(true); // normalized at pricing
    expect(races[0].results[0].driverName).toBe('Oliver Goethe'); // and at settlement
    expect(fieldNames.has(races[0].results[0].driverName)).toBe(true);
  });

  it('gate (b): F2 settlement sees Feature races only — a sprint result can never settle a market', async () => {
    vi.mocked(fetchF2SeasonResults).mockResolvedValue({
      feature: [feature(1, 'A Driver'), feature(2, 'B Driver')],
      sprints: [feature(1, 'Sprint Winner'), feature(2, 'Sprint Winner')],
    } as never);

    const races = await RESULT_SOURCES.f2();
    expect(races).toHaveLength(2);
    expect(races.map(r => r.raceName)).toEqual(['Feature R1', 'Feature R2']);
    expect(races.some(r => r.results.some(e => e.driverName === 'Sprint Winner'))).toBe(false);
  });

  it('gate (b): exactly one settlement race per round', async () => {
    vi.mocked(fetchF2SeasonResults).mockResolvedValue({
      feature: [feature(1, 'A'), feature(2, 'B'), feature(3, 'C')],
      sprints: [feature(1, 'X'), feature(3, 'Y')],
    } as never);
    const races = await RESULT_SOURCES.f2();
    const rounds = races.map(r => r.round);
    expect(new Set(rounds).size).toBe(rounds.length);
  });

  it('gate (c) tripwire: F3 stays unwired until content/series/f3/rounds.json matches the FIA renumbering', () => {
    // Live probe 2026-07-03: FIA renumbered contiguously after the Bahrain
    // cancellation while the curated rounds.json keeps the pre-cancellation
    // holes — a market opened for curated round N would settle against a
    // DIFFERENT race. Wiring f3 requires renumbering rounds.json first, then
    // deleting this tripwire deliberately.
    expect('f3' in FIELD_SOURCES).toBe(false);
    expect('f3' in RESULT_SOURCES).toBe(false);
  });

  it('only gate-verified series are wired', () => {
    expect(Object.keys(FIELD_SOURCES).sort()).toEqual(['f1', 'f2']);
    expect(Object.keys(RESULT_SOURCES).sort()).toEqual(['f1', 'f2']);
  });
});
