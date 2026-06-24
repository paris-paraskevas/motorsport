import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// In-memory KV mock, same approach as lib/results-cache.test.ts: replace the
// real @vercel/kv wholesale so kv.get / kv.set become hash lookups, and assert
// the round-trip + last-good behaviour without a network. JSON-cycling on read
// simulates KV returning Date objects as ISO strings.
const store = new Map<string, unknown>();
const setSpy = vi.fn();
const getSpy = vi.fn();

vi.mock('@vercel/kv', () => ({
  kv: {
    get: vi.fn(async (key: string) => {
      getSpy(key);
      const raw = store.get(key);
      if (raw === undefined) return null;
      return JSON.parse(JSON.stringify(raw));
    }),
    set: vi.fn(async (key: string, value: unknown, opts?: { ex?: number }) => {
      setSpy(key, value, opts);
      store.set(key, value);
      return 'OK';
    }),
  },
}));

import { fetchF1Standings } from './standings/f1';
import {
  fetchF1LastRace,
  fetchF1SeasonResults,
  fetchF1SeasonSprints,
} from './results/f1';
import { f1LastGoodKey } from './f1-cache';

// --- Upstream fixtures (mirror the existing standings/results test fixtures) ---

const standingsDriverFixture = {
  MRData: {
    StandingsTable: {
      StandingsLists: [
        {
          DriverStandings: [
            {
              position: '1',
              points: '350',
              wins: '10',
              Driver: { givenName: 'Max', familyName: 'Verstappen', code: 'VER' },
              Constructors: [{ name: 'Red Bull' }],
            },
          ],
        },
      ],
    },
  },
};

const standingsConstructorFixture = {
  MRData: {
    StandingsTable: {
      StandingsLists: [
        {
          ConstructorStandings: [
            { position: '1', points: '600', wins: '12', Constructor: { name: 'Red Bull' } },
          ],
        },
      ],
    },
  },
};

const lastRaceFixture = {
  MRData: {
    RaceTable: {
      Races: [
        {
          round: '23',
          raceName: 'Abu Dhabi Grand Prix',
          date: '2026-12-06',
          Circuit: { circuitName: 'Yas Marina Circuit' },
          Results: [
            {
              position: '1',
              points: '25',
              Driver: { givenName: 'Max', familyName: 'Verstappen', code: 'VER' },
              Constructor: { name: 'Red Bull' },
              status: 'Finished',
              Time: { time: '1:26:33.291' },
            },
          ],
        },
      ],
    },
  },
};

// Season endpoint is paged: page 1 returns the data with a `total` equal to the
// row count so the pager stops after one page.
function seasonFixture(field: 'Results' | 'SprintResults') {
  return {
    MRData: {
      total: '1',
      RaceTable: {
        Races: [
          {
            round: '1',
            raceName: 'Bahrain Grand Prix',
            date: '2026-03-08',
            Circuit: { circuitName: 'Bahrain International Circuit' },
            [field]: [
              {
                position: '1',
                points: field === 'SprintResults' ? '8' : '25',
                Driver: { givenName: 'Max', familyName: 'Verstappen', code: 'VER' },
                Constructor: { name: 'Red Bull' },
                status: 'Finished',
              },
            ],
          },
        ],
      },
    },
  };
}

// Fetch mock that routes by URL substring and can be flipped to "all fail"
// (every response !ok) to simulate a Jolpica 521 outage.
function mockFetch(allFail = false) {
  return vi.fn(async (url: string) => {
    if (allFail) return { ok: false, status: 521, json: async () => ({}) } as unknown as Response;
    if (url.includes('driverStandings')) {
      return { ok: true, json: async () => standingsDriverFixture } as unknown as Response;
    }
    if (url.includes('constructorStandings')) {
      return { ok: true, json: async () => standingsConstructorFixture } as unknown as Response;
    }
    if (url.includes('/last/results')) {
      return { ok: true, json: async () => lastRaceFixture } as unknown as Response;
    }
    if (url.includes('/sprint')) {
      return { ok: true, json: async () => seasonFixture('SprintResults') } as unknown as Response;
    }
    if (url.includes('/results')) {
      return { ok: true, json: async () => seasonFixture('Results') } as unknown as Response;
    }
    return { ok: false, json: async () => ({}) } as unknown as Response;
  });
}

function configureKv() {
  process.env.KV_REST_API_URL = 'https://kv.test.invalid';
  process.env.KV_REST_API_TOKEN = 'test-token';
}
function unconfigureKv() {
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
}

describe('f1-cache last-good resilience', () => {
  beforeEach(() => {
    store.clear();
    setSpy.mockClear();
    getSpy.mockClear();
    vi.unstubAllGlobals();
    configureKv();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    unconfigureKv();
  });

  describe('fetchF1Standings', () => {
    it('SUCCESS writes the result to the standings last-good key', async () => {
      vi.stubGlobal('fetch', mockFetch());
      const result = await fetchF1Standings();
      expect(result).not.toBeNull();
      expect(result!.drivers).toHaveLength(1);
      expect(setSpy).toHaveBeenCalledWith(
        f1LastGoodKey('standings'),
        expect.objectContaining({ data: expect.any(Object), cachedAt: expect.any(String) }),
        expect.objectContaining({ ex: 21 * 24 * 60 * 60 }),
      );
    });

    it('FAILURE serves the last-good standings instead of null', async () => {
      // 1) Prime the cache with a good fetch.
      vi.stubGlobal('fetch', mockFetch());
      const good = await fetchF1Standings();
      expect(good).not.toBeNull();
      // 2) Jolpica goes down (521 everywhere). Live parse → null; serve last-good.
      vi.stubGlobal('fetch', mockFetch(true));
      const recovered = await fetchF1Standings();
      expect(recovered).not.toBeNull();
      expect(recovered!.drivers[0].driverName).toBe('Max Verstappen');
      expect(recovered!.constructors[0].name).toBe('Red Bull');
    });

    it('FAILURE with no last-good present returns null (today behaviour)', async () => {
      vi.stubGlobal('fetch', mockFetch(true));
      const result = await fetchF1Standings();
      expect(result).toBeNull();
    });
  });

  describe('fetchF1LastRace', () => {
    it('SUCCESS writes to the last-race key', async () => {
      vi.stubGlobal('fetch', mockFetch());
      const result = await fetchF1LastRace();
      expect(result).not.toBeNull();
      expect(result!.raceName).toBe('Abu Dhabi Grand Prix');
      expect(setSpy).toHaveBeenCalledWith(
        f1LastGoodKey('last-race'),
        expect.any(Object),
        expect.objectContaining({ ex: 21 * 24 * 60 * 60 }),
      );
    });

    it('FAILURE serves the last-good race with a rehydrated Date', async () => {
      vi.stubGlobal('fetch', mockFetch());
      await fetchF1LastRace();
      vi.stubGlobal('fetch', mockFetch(true));
      const recovered = await fetchF1LastRace();
      expect(recovered).not.toBeNull();
      expect(recovered!.raceName).toBe('Abu Dhabi Grand Prix');
      // Critical: Date must survive the JSON round-trip as a Date instance.
      expect(recovered!.date).toBeInstanceOf(Date);
      expect(recovered!.date.toISOString().startsWith('2026-12-06')).toBe(true);
    });
  });

  describe('fetchF1SeasonResults', () => {
    it('SUCCESS writes to the season-results key', async () => {
      vi.stubGlobal('fetch', mockFetch());
      const races = await fetchF1SeasonResults();
      expect(races).toHaveLength(1);
      expect(setSpy).toHaveBeenCalledWith(
        f1LastGoodKey('season-results'),
        expect.any(Object),
        expect.objectContaining({ ex: 21 * 24 * 60 * 60 }),
      );
    });

    it('FAILURE serves the last-good season array with rehydrated Dates', async () => {
      vi.stubGlobal('fetch', mockFetch());
      await fetchF1SeasonResults();
      vi.stubGlobal('fetch', mockFetch(true));
      const recovered = await fetchF1SeasonResults();
      expect(recovered).toHaveLength(1);
      expect(recovered[0].raceName).toBe('Bahrain Grand Prix');
      expect(recovered[0].date).toBeInstanceOf(Date);
    });

    it('FAILURE with no last-good present returns [] (today behaviour)', async () => {
      vi.stubGlobal('fetch', mockFetch(true));
      const recovered = await fetchF1SeasonResults();
      expect(recovered).toEqual([]);
    });
  });

  describe('fetchF1SeasonSprints', () => {
    it('SUCCESS writes to the season-sprints key', async () => {
      vi.stubGlobal('fetch', mockFetch());
      const sprints = await fetchF1SeasonSprints();
      expect(sprints).toHaveLength(1);
      expect(setSpy).toHaveBeenCalledWith(
        f1LastGoodKey('season-sprints'),
        expect.any(Object),
        expect.objectContaining({ ex: 21 * 24 * 60 * 60 }),
      );
    });

    it('FAILURE serves the last-good sprint array', async () => {
      vi.stubGlobal('fetch', mockFetch());
      await fetchF1SeasonSprints();
      vi.stubGlobal('fetch', mockFetch(true));
      const recovered = await fetchF1SeasonSprints();
      expect(recovered).toHaveLength(1);
      expect(recovered[0].results[0].points).toBe(8);
    });
  });

  describe('FAIL OPEN — KV unconfigured (local dev)', () => {
    beforeEach(() => {
      unconfigureKv();
    });

    it('standings: never touches KV; success passes through', async () => {
      vi.stubGlobal('fetch', mockFetch());
      const result = await fetchF1Standings();
      expect(result).not.toBeNull();
      expect(getSpy).not.toHaveBeenCalled();
      expect(setSpy).not.toHaveBeenCalled();
    });

    it('standings: failure returns null exactly as today (no throw, no KV)', async () => {
      vi.stubGlobal('fetch', mockFetch(true));
      const result = await fetchF1Standings();
      expect(result).toBeNull();
      expect(getSpy).not.toHaveBeenCalled();
      expect(setSpy).not.toHaveBeenCalled();
    });

    it('results: failures return [] / null exactly as today (no KV)', async () => {
      vi.stubGlobal('fetch', mockFetch(true));
      expect(await fetchF1SeasonResults()).toEqual([]);
      expect(await fetchF1SeasonSprints()).toEqual([]);
      expect(await fetchF1LastRace()).toBeNull();
      expect(getSpy).not.toHaveBeenCalled();
      expect(setSpy).not.toHaveBeenCalled();
    });
  });

  describe('KV read error is swallowed (fail open to fresh value)', () => {
    it('serves the fresh empty value when KV read throws on the failure path', async () => {
      const kvModule = await import('@vercel/kv');
      (kvModule.kv.get as unknown as { mockImplementationOnce: (fn: () => Promise<unknown>) => void })
        .mockImplementationOnce(async () => {
          throw new Error('KV outage');
        });
      vi.stubGlobal('fetch', mockFetch(true));
      const result = await fetchF1SeasonResults();
      expect(result).toEqual([]); // read threw → null → falls back to fresh []
    });
  });
});
