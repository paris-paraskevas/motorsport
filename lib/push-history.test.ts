import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { recordSent, listHistory, type PushHistoryItem } from './push-history';

// In-memory KV LIST mock. Model each list as a JS array with index 0 = head
// (newest), matching Redis: LPUSH prepends to the head, LRANGE 0..n reads from
// the head, LTRIM 0..n keeps the head slice. This mirrors how recordSent /
// listHistory use the real `@vercel/kv` list API.
const lists = new Map<string, unknown[]>();

vi.mock('@vercel/kv', () => ({
  kv: {
    lpush: vi.fn(async (key: string, ...values: unknown[]) => {
      const arr = lists.get(key) ?? [];
      // Redis LPUSH with multiple values inserts them one-by-one, so the LAST
      // arg ends up at the head. Our callers push a single value, but model it
      // faithfully anyway.
      for (const v of values) arr.unshift(v);
      lists.set(key, arr);
      return arr.length;
    }),
    ltrim: vi.fn(async (key: string, start: number, stop: number) => {
      const arr = lists.get(key) ?? [];
      lists.set(key, arr.slice(start, stop + 1));
      return 'OK';
    }),
    lrange: vi.fn(async (key: string, start: number, stop: number) => {
      const arr = lists.get(key) ?? [];
      // Redis LRANGE stop is inclusive.
      return arr.slice(start, stop + 1);
    }),
  },
}));

function item(kind: string, n: number): PushHistoryItem {
  return {
    kind,
    title: `Title ${n}`,
    body: `Body ${n}`,
    url: `/series/f1/weekend/${n}/qualifying`,
    ts: 1_700_000_000_000 + n,
    seriesSlug: 'f1',
  };
}

describe('push-history (KV configured)', () => {
  beforeEach(() => {
    lists.clear();
    process.env.KV_REST_API_URL = 'https://kv.test.invalid';
    process.env.KV_REST_API_TOKEN = 'test-token';
  });
  afterEach(() => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });

  it('records an item and lists it back', async () => {
    await recordSent('user_1', item('t30', 1));
    const out = await listHistory('user_1');
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('t30');
    expect(out[0].title).toBe('Title 1');
    expect(out[0].url).toBe('/series/f1/weekend/1/qualifying');
    expect(out[0].seriesSlug).toBe('f1');
  });

  it('lists newest first', async () => {
    await recordSent('user_2', item('t30', 1));
    await recordSent('user_2', item('res', 2));
    await recordSent('user_2', item('analysis', 3));
    const out = await listHistory('user_2');
    expect(out.map(i => i.kind)).toEqual(['analysis', 'res', 't30']);
  });

  it('caps the stored list at 50 (newest kept), regardless of how many were recorded', async () => {
    for (let n = 1; n <= 60; n++) await recordSent('user_3', item('t30', n));
    // Stored list never exceeds the cap.
    expect(lists.get('paddock:push-history:user_3')!.length).toBe(50);
    // The newest (n=60) is at the head; the oldest survivor is n=11.
    const all = await listHistory('user_3', 100);
    expect(all).toHaveLength(50);
    expect(all[0].ts).toBe(1_700_000_000_000 + 60);
    expect(all[all.length - 1].ts).toBe(1_700_000_000_000 + 11);
  });

  it('honours the limit on read (default 30, custom respected)', async () => {
    for (let n = 1; n <= 40; n++) await recordSent('user_4', item('t30', n));
    const def = await listHistory('user_4'); // default 30
    expect(def).toHaveLength(30);
    const five = await listHistory('user_4', 5);
    expect(five).toHaveLength(5);
    expect(five[0].ts).toBe(1_700_000_000_000 + 40); // newest first
  });

  it('scopes history per user', async () => {
    await recordSent('user_a', item('t30', 1));
    await recordSent('user_b', item('res', 2));
    expect((await listHistory('user_a')).map(i => i.kind)).toEqual(['t30']);
    expect((await listHistory('user_b')).map(i => i.kind)).toEqual(['res']);
  });

  it('returns [] for a user with no history', async () => {
    expect(await listHistory('nobody')).toEqual([]);
  });
});

describe('push-history (KV unconfigured)', () => {
  beforeEach(() => {
    lists.clear();
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });

  it('recordSent is a no-op and listHistory returns [] without touching KV', async () => {
    await expect(recordSent('user_1', item('t30', 1))).resolves.toBeUndefined();
    expect(await listHistory('user_1')).toEqual([]);
    expect(lists.size).toBe(0);
  });
});

describe('push-history fail-soft', () => {
  beforeEach(() => {
    lists.clear();
    process.env.KV_REST_API_URL = 'https://kv.test.invalid';
    process.env.KV_REST_API_TOKEN = 'test-token';
  });
  afterEach(() => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });

  it('recordSent swallows a KV error (never breaks a send)', async () => {
    const kvModule = await import('@vercel/kv');
    (kvModule.kv.lpush as unknown as { mockImplementationOnce: (fn: () => Promise<unknown>) => void })
      .mockImplementationOnce(async () => {
        throw new Error('KV outage');
      });
    await expect(recordSent('user_err', item('t30', 1))).resolves.toBeUndefined();
  });

  it('listHistory swallows a KV error and returns []', async () => {
    const kvModule = await import('@vercel/kv');
    (kvModule.kv.lrange as unknown as { mockImplementationOnce: (fn: () => Promise<unknown>) => void })
      .mockImplementationOnce(async () => {
        throw new Error('KV outage');
      });
    expect(await listHistory('user_err')).toEqual([]);
  });
});
