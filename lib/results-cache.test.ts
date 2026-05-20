import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  readResultsCache,
  writeResultsCache,
  seasonCacheKey,
} from './results-cache';
import type { RaceResult } from '@/lib/types';

// In-memory KV mock. The real `@vercel/kv` is replaced wholesale so the cache
// helper's `kv.get` / `kv.set` calls become hash lookups, and we can assert
// the round-trip behaviour without a network.
const store = new Map<string, unknown>();
const setSpy = vi.fn();
const getSpy = vi.fn();

vi.mock('@vercel/kv', () => ({
  kv: {
    get: vi.fn(async (key: string) => {
      getSpy(key);
      // KV returns a JSON-deserialised value — Date objects come back as their
      // ISO strings. Simulate that by JSON-cycling whatever we put in.
      const raw = store.get(key);
      if (raw === undefined) return null;
      return JSON.parse(JSON.stringify(raw));
    }),
    set: vi.fn(async (key: string, value: unknown, _opts?: { ex?: number }) => {
      setSpy(key, value, _opts);
      store.set(key, value);
      return 'OK';
    }),
  },
}));

function makeRaceResult(round: number): RaceResult {
  return {
    round,
    raceName: `Round ${round} Feature Race`,
    date: new Date(`2026-0${round}-15T00:00:00Z`),
    circuit: `Circuit ${round}`,
    results: [
      { position: 1, driverName: 'A. Driver', team: 'Team A', status: 'Finished', points: 25 },
    ],
  };
}

describe('seasonCacheKey', () => {
  it('produces a stable, namespaced key per series + season', () => {
    expect(seasonCacheKey('f2', 2026)).toBe('paddock:results:f2:season:2026');
    expect(seasonCacheKey('f3', 2026)).toBe('paddock:results:f3:season:2026');
    // Different season keys remain distinct.
    expect(seasonCacheKey('f2', 2027)).toBe('paddock:results:f2:season:2027');
  });
});

describe('readResultsCache / writeResultsCache', () => {
  beforeEach(() => {
    store.clear();
    setSpy.mockClear();
    getSpy.mockClear();
    // KV considered configured for every test in this describe block.
    process.env.KV_REST_API_URL = 'https://kv.test.invalid';
    process.env.KV_REST_API_TOKEN = 'test-token';
  });
  afterEach(() => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });

  it('returns null on miss', async () => {
    const out = await readResultsCache<RaceResult[]>(seasonCacheKey('f3', 2026));
    expect(out).toBeNull();
  });

  it('writes with a 3-hour TTL via the `ex` option', async () => {
    const key = seasonCacheKey('f2', 2026);
    await writeResultsCache(key, { feature: [makeRaceResult(1)], sprint: [] });
    expect(setSpy).toHaveBeenCalledWith(
      key,
      expect.any(Object),
      expect.objectContaining({ ex: 3 * 60 * 60 }),
    );
  });

  it('round-trips a flat RaceResult[] and re-hydrates Date instances', async () => {
    const key = seasonCacheKey('f3', 2026);
    const payload = [makeRaceResult(1), makeRaceResult(2)];
    await writeResultsCache(key, payload);

    const out = await readResultsCache<RaceResult[]>(key);
    expect(out).not.toBeNull();
    expect(out!).toHaveLength(2);
    expect(out![0].round).toBe(1);
    // Critical: Date must survive the JSON round-trip as a Date instance, not
    // an ISO string. Downstream code in components/SeasonResultsPanel calls
    // `.toLocaleDateString()` which would throw on a plain string.
    expect(out![0].date).toBeInstanceOf(Date);
    expect(out![0].date.toISOString()).toBe('2026-01-15T00:00:00.000Z');
    expect(out![1].date).toBeInstanceOf(Date);
  });

  it('round-trips the F2-shaped { feature, sprint } payload and revives Dates inside both', async () => {
    const key = seasonCacheKey('f2', 2026);
    const payload = {
      feature: [makeRaceResult(1), makeRaceResult(2)],
      sprint: [makeRaceResult(1)],
    };
    await writeResultsCache(key, payload);

    const out = await readResultsCache<typeof payload>(key);
    expect(out).not.toBeNull();
    expect(out!.feature[0].date).toBeInstanceOf(Date);
    expect(out!.feature[1].date).toBeInstanceOf(Date);
    expect(out!.sprint[0].date).toBeInstanceOf(Date);
  });

  it('returns null without touching KV when env vars are missing', async () => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    const out = await readResultsCache<RaceResult[]>(seasonCacheKey('f3', 2026));
    expect(out).toBeNull();
    expect(getSpy).not.toHaveBeenCalled();
  });

  it('writeResultsCache is a no-op when env vars are missing (does not throw)', async () => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    await expect(
      writeResultsCache(seasonCacheKey('f3', 2026), [makeRaceResult(1)]),
    ).resolves.toBeUndefined();
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('readResultsCache swallows KV errors and pretends miss', async () => {
    const kvModule = await import('@vercel/kv');
    const original = kvModule.kv.get;
    (kvModule.kv.get as unknown as { mockImplementationOnce: (fn: () => Promise<unknown>) => void })
      .mockImplementationOnce(async () => {
        throw new Error('KV outage');
      });
    const out = await readResultsCache<RaceResult[]>(seasonCacheKey('f3', 2026));
    expect(out).toBeNull();
    // Restore for subsequent tests in the same file.
    (kvModule.kv.get as unknown as { mockImplementation: (fn: typeof original) => void })
      .mockImplementation(original);
  });
});
