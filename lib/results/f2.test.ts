import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FomSeasonBundle } from './fom-api';

// f2.ts is a thin adapter over fetchFomSeason (tested in fom-api.test.ts). These
// tests cover only the adapter: brand + season wiring and the passthrough shape.
vi.mock('./fom-api', () => ({ fetchFomSeason: vi.fn() }));
import { fetchFomSeason } from './fom-api';
import { fetchF2SeasonResults } from './f2';

const BUNDLE: FomSeasonBundle = {
  feature: [{ round: 1, raceName: 'Australia Feature Race', date: new Date('2026-03-08T00:00:00Z'), circuit: 'Albert Park', results: [{ position: 1, driverName: 'Nikola Tsolov', driverCode: 'TSO', team: 'Campos Racing', status: 'Finished', time: '56:05.248', points: 27 }] }],
  sprint: [{ round: 1, raceName: 'Australia Sprint Race', date: new Date('2026-03-07T00:00:00Z'), circuit: 'Albert Park', results: [{ position: 1, driverName: 'Joshua Dürksen', driverCode: 'DUR', team: 'Invicta Racing', status: 'Finished', time: '39:09.726', points: 10 }] }],
  qualifying: [{ round: 1, data: { isQualifying: false, isRace: false, entries: [] } }],
  practice: [{ round: 1, data: { isQualifying: false, isRace: false, entries: [] } }],
};

describe('fetchF2SeasonResults', () => {
  beforeEach(() => vi.mocked(fetchFomSeason).mockReset());

  it('requests the f2 brand for the given season and passes the bundle through', async () => {
    vi.mocked(fetchFomSeason).mockResolvedValue(BUNDLE);
    const out = await fetchF2SeasonResults(2026);
    expect(fetchFomSeason).toHaveBeenCalledWith('f2', 2026);
    expect(out).toEqual({
      feature: BUNDLE.feature,
      sprint: BUNDLE.sprint,
      qualifying: BUNDLE.qualifying,
      practice: BUNDLE.practice,
    });
  });

  it('defaults to the current UTC year when no season is passed', async () => {
    vi.mocked(fetchFomSeason).mockResolvedValue(BUNDLE);
    await fetchF2SeasonResults();
    expect(fetchFomSeason).toHaveBeenCalledWith('f2', new Date().getUTCFullYear());
  });
});
