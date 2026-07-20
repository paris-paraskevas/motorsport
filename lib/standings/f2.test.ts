import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// f2.ts is a thin adapter: fetchFomStandings (tested in lib/results/fom-api.test.ts)
// wrapped in the durable source-snapshot last-good. These tests cover the adapter:
// brand + current-year wiring, and the last-good behaviour. In-memory fake of the
// source_snapshot table (mirrors the prior test + lib/standings/dtm.test.ts).
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
import { fetchF2Standings } from './f2';

const STANDINGS = {
  drivers: [
    { position: 1, driverName: 'Nikola Tsolov', driverCode: 'TSO', team: 'Campos Racing', points: 37, wins: 1 },
    { position: 2, driverName: 'Gabriele Mini', driverCode: 'MIN', team: 'MP Motorsport', points: 18, wins: 0 },
  ],
  constructors: [
    { position: 1, name: 'Campos Racing', points: 55 },
    { position: 2, name: 'MP Motorsport', points: 40 },
  ],
};

describe('fetchF2Standings', () => {
  beforeEach(() => { vi.mocked(fetchFomStandings).mockReset(); snapshotConfigured = false; snapshotTable.clear(); });

  it('requests f2 for the current UTC year and passes the FOM standings through', async () => {
    vi.mocked(fetchFomStandings).mockResolvedValue(STANDINGS);
    const r = await fetchF2Standings();
    expect(fetchFomStandings).toHaveBeenCalledWith('f2', new Date().getUTCFullYear());
    expect(r).toEqual(STANDINGS);
  });

  it('returns null when the FOM standings are unavailable', async () => {
    vi.mocked(fetchFomStandings).mockResolvedValue(null);
    expect(await fetchF2Standings()).toBeNull();
  });
});

describe('fetchF2Standings — durable last-good (source_snapshot)', () => {
  beforeEach(() => { snapshotTable.clear(); snapshotConfigured = true; vi.mocked(fetchFomStandings).mockReset(); });
  afterEach(() => { snapshotConfigured = false; snapshotTable.clear(); });

  it('SUCCESS persists the standings under standings:f2', async () => {
    vi.mocked(fetchFomStandings).mockResolvedValue(STANDINGS);
    await fetchF2Standings();
    expect(snapshotTable.has('standings:f2')).toBe(true);
  });

  it('FAILURE serves the last-good standings instead of null', async () => {
    vi.mocked(fetchFomStandings).mockResolvedValueOnce(STANDINGS);
    await fetchF2Standings(); // prime
    vi.mocked(fetchFomStandings).mockResolvedValueOnce(null); // API blip
    const recovered = await fetchF2Standings();
    expect(recovered).not.toBeNull();
    expect(recovered!.drivers[0].driverName).toBe('Nikola Tsolov');
    expect(recovered!.constructors).toHaveLength(2);
  });

  it('a good fetch overwrites the snapshot (self-heal)', async () => {
    snapshotTable.set('standings:f2', { drivers: [{ position: 1, driverName: 'stale', team: 'x', points: 0 }], constructors: [] });
    vi.mocked(fetchFomStandings).mockResolvedValue(STANDINGS);
    await fetchF2Standings();
    const stored = snapshotTable.get('standings:f2') as { drivers: unknown[] };
    expect(stored.drivers).toHaveLength(2);
  });

  it('FAILURE with no snapshot returns null', async () => {
    vi.mocked(fetchFomStandings).mockResolvedValue(null);
    expect(await fetchF2Standings()).toBeNull();
  });
});
