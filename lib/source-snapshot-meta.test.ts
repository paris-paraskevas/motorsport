import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The loader's phases per source (P1.9): the writer path records F (the fetch
// with its parse) and W (the write) for a key with the run's name; the reader
// path records nothing; the Debug trace reads every key's meta back, parsed
// strings or objects alike; KV failing answers empty.

const hset = vi.fn(async () => 1);
let stored: Record<string, unknown> | null = {};
let kvFails = false;
vi.mock('@/lib/kv', () => ({
  kv: {
    hset: (...args: unknown[]) => {
      if (kvFails) throw new Error('kv down');
      return hset(...(args as []));
    },
    hgetall: async () => {
      if (kvFails) throw new Error('kv down');
      return stored;
    },
  },
}));
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => true,
  betDb: () => ({
    from: () => ({
      upsert: async () => ({ data: null, error: null }),
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    }),
  }),
}));

import { readSnapshotMeta, runnerName, withSourceSnapshot, writeSnapshot } from './source-snapshot';

const field = (call: number, key: string) => JSON.parse((hset.mock.calls[call] as unknown as [string, Record<string, string>])[1][key]) as { run: string; at: string; F?: number; W?: number };

describe("the loader's phases per source (P1.9)", () => {
  beforeEach(() => {
    hset.mockClear();
    stored = {};
    kvFails = false;
    process.env.KV_REST_API_URL = 'https://kv.test';
    process.env.KV_REST_API_TOKEN = 't';
    delete process.env.GITHUB_RUN_ID;
    delete process.env.DATA_SOURCE;
  });
  afterEach(() => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    delete process.env.DATA_SOURCE;
  });

  it('names the run, and the writer path records F and W for the key under the run', async () => {
    expect(runnerName()).toBe('local');
    process.env.GITHUB_RUN_ID = '4242';
    expect(runnerName()).toBe('warm-live-data#4242');
    delete process.env.GITHUB_RUN_ID;
    await withSourceSnapshot('standings:f2', async () => ({ rows: [1] }), v => v == null);
    expect(hset).toHaveBeenCalledTimes(1);
    expect((hset.mock.calls[0] as unknown as [string])[0]).toBe('snapshot-meta:last');
    const meta = field(0, 'standings:f2');
    expect(meta.run).toBe('local');
    expect(typeof meta.F).toBe('number');
    expect(typeof meta.W).toBe('number');
    expect(Date.parse(meta.at)).not.toBeNaN();
  });

  it('the reader path records nothing; a direct write records W alone; without KV nothing is written', async () => {
    process.env.DATA_SOURCE = 'db';
    await withSourceSnapshot('standings:f2', async () => ({ rows: [1] }), v => v == null);
    expect(hset).not.toHaveBeenCalled();
    delete process.env.DATA_SOURCE;
    await writeSnapshot('news:aggregate:3', { items: [] });
    const meta = field(0, 'news:aggregate:3');
    expect(meta.F).toBeUndefined();
    expect(typeof meta.W).toBe('number');
    hset.mockClear();
    delete process.env.KV_REST_API_URL;
    await writeSnapshot('x', {});
    expect(hset).not.toHaveBeenCalled();
  });

  it("reads every key's meta back, strings or objects alike, skips what is neither, and answers empty when KV fails", async () => {
    stored = {
      'standings:f1': JSON.stringify({ run: 'warm-live-data#77', at: '2026-09-10T11:20:00.000Z', F: 812, W: 40 }),
      'news:aggregate:3': { run: 'local', at: '2026-09-10T09:00:00.000Z', W: 12 },
      junk: 'not json',
      odd: { nothing: true },
    };
    const meta = await readSnapshotMeta();
    expect(Object.keys(meta).sort()).toEqual(['news:aggregate:3', 'standings:f1']);
    expect(meta['standings:f1']).toMatchObject({ run: 'warm-live-data#77', F: 812, W: 40 });
    kvFails = true;
    expect(await readSnapshotMeta()).toEqual({});
    kvFails = false;
    delete process.env.KV_REST_API_TOKEN;
    expect(await readSnapshotMeta()).toEqual({});
  });
});
