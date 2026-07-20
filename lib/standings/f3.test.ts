import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// f3.ts is a thin adapter: fetchFomStandings (tested in lib/results/fom-api.test.ts)
// wrapped in the durable source-snapshot last-good. Mirrors f2.test.ts.
const snapshotTable = new Map<string, unknown>();
let snapshotConfigured = false;

vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => snapshotConfigured,
  betDb: () => ({
    from: () => {
      let selectedKey: string | null = null;
      const builder = {
        select: () => builder,
        eq: (_col: string, value: string) => { selectedKey = value; return builder; },
        maybeSingle: async () => {
          const raw = selectedKey != null ? snapshotTable.get(selectedKey) : undefined;
          return raw === undefined ? { data: null, error: null } : { data: { payload: JSON.parse(JSON.stringify(raw)) }, error: null };
        },
        upsert: async (row: { source_key: string; payload: unknown }) => { snapshotTable.set(row.source_key, row.payload); return { data: null, error: null }; },
      };
      return builder;
    },
  }),
}));

vi.mock('@/lib/results/fom-api', () => ({ fetchFomStandings: vi.fn() }));

import { fetchFomStandings } from '@/lib/results/fom-api';
import { fetchF3Standings } from './f3';

const STANDINGS = {
  drivers: [
    { position: 1, driverName: 'Ugo Ugochukwu', driverCode: 'UGO', team: 'Campos Racing', points: 41, wins: 1 },
    { position: 2, driverName: 'Bruno Del Pino', driverCode: 'BDE', team: 'Van Amersfoort Racing', points: 20, wins: 0 },
  ],
  constructors: [
    { position: 1, name: 'Campos Racing', points: 60 },
    { position: 2, name: 'Trident', points: 45 },
  ],
};

describe('fetchF3Standings', () => {
  beforeEach(() => { vi.mocked(fetchFomStandings).mockReset(); snapshotConfigured = false; snapshotTable.clear(); });

  it('requests f3 for the current UTC year and passes the FOM standings through', async () => {
    vi.mocked(fetchFomStandings).mockResolvedValue(STANDINGS);
    const r = await fetchF3Standings();
    expect(fetchFomStandings).toHaveBeenCalledWith('f3', new Date().getUTCFullYear());
    expect(r).toEqual(STANDINGS);
  });

  it('returns null when the FOM standings are unavailable', async () => {
    vi.mocked(fetchFomStandings).mockResolvedValue(null);
    expect(await fetchF3Standings()).toBeNull();
  });
});

describe('fetchF3Standings — durable last-good (source_snapshot)', () => {
  beforeEach(() => { snapshotTable.clear(); snapshotConfigured = true; vi.mocked(fetchFomStandings).mockReset(); });
  afterEach(() => { snapshotConfigured = false; snapshotTable.clear(); });

  it('SUCCESS persists the standings under standings:f3', async () => {
    vi.mocked(fetchFomStandings).mockResolvedValue(STANDINGS);
    await fetchF3Standings();
    expect(snapshotTable.has('standings:f3')).toBe(true);
  });

  it('FAILURE serves the last-good standings instead of null', async () => {
    vi.mocked(fetchFomStandings).mockResolvedValueOnce(STANDINGS);
    await fetchF3Standings();
    vi.mocked(fetchFomStandings).mockResolvedValueOnce(null);
    const recovered = await fetchF3Standings();
    expect(recovered).not.toBeNull();
    expect(recovered!.drivers[0].driverName).toBe('Ugo Ugochukwu');
  });
});
