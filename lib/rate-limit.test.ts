import { beforeEach, describe, expect, it, vi } from 'vitest';

const counters = new Map<string, number>();
const expired: string[] = [];

vi.mock('@vercel/kv', () => ({
  kv: {
    incr: vi.fn(async (key: string) => {
      const next = (counters.get(key) ?? 0) + 1;
      counters.set(key, next);
      return next;
    }),
    expire: vi.fn(async (key: string) => {
      expired.push(key);
      return 1;
    }),
  },
}));

import { allowRequest, clientIp } from './rate-limit';

describe('allowRequest', () => {
  beforeEach(() => {
    counters.clear();
    expired.length = 0;
    process.env.KV_REST_API_URL = 'https://kv.example';
    process.env.KV_REST_API_TOKEN = 'token';
  });

  it('allows up to the limit then rejects within the same window', async () => {
    const results: boolean[] = [];
    for (let i = 0; i < 7; i++) {
      results.push(await allowRequest('test:bucket', 5, 900));
    }
    expect(results).toEqual([true, true, true, true, true, false, false]);
  });

  it('sets the TTL exactly once per window', async () => {
    await allowRequest('ttl:bucket', 5, 900);
    await allowRequest('ttl:bucket', 5, 900);
    expect(expired).toHaveLength(1);
  });

  it('fails open when KV is not configured', async () => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    for (let i = 0; i < 10; i++) {
      expect(await allowRequest('open:bucket', 2, 900)).toBe(true);
    }
  });

  it('buckets are independent', async () => {
    expect(await allowRequest('a', 1, 900)).toBe(true);
    expect(await allowRequest('a', 1, 900)).toBe(false);
    expect(await allowRequest('b', 1, 900)).toBe(true);
  });
});

describe('clientIp', () => {
  it('takes the first x-forwarded-for hop', () => {
    const req = new Request('https://x.example', {
      headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' },
    });
    expect(clientIp(req)).toBe('203.0.113.7');
  });

  it('falls back to x-real-ip then unknown', () => {
    expect(
      clientIp(new Request('https://x.example', { headers: { 'x-real-ip': '198.51.100.2' } })),
    ).toBe('198.51.100.2');
    expect(clientIp(new Request('https://x.example'))).toBe('unknown');
  });
});
