import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

// The Worker's execution context as OpenNext hands it out; each test sets what the runtime offers.
const edge = vi.hoisted(() => ({ ctx: {} as Record<string, unknown> }));
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: () => ({ ctx: edge.ctx }) }));

import { POST, pickPaths } from './route';

function post(body: unknown, auth?: string) {
  return POST(
    new Request('https://paddock-tracker.com/api/cron/revalidate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );
}

describe('pickPaths', () => {
  it('keeps root-relative paths, deduplicated, and drops everything else', () => {
    expect(pickPaths(['/', '/series/f1', '/series/f1', '/series/f1/standings'])).toEqual([
      '/',
      '/series/f1',
      '/series/f1/standings',
    ]);
    expect(pickPaths(['https://evil.example/', '//evil', '/a?b=c', 'series/f1', 42, null, '/ok'])).toEqual(['/ok']);
    expect(pickPaths('/')).toEqual([]);
  });

  it('caps at fifty paths', () => {
    const many = Array.from({ length: 80 }, (_, i) => `/p/${i}`);
    expect(pickPaths(many)).toHaveLength(50);
  });
});

describe('POST /api/cron/revalidate', () => {
  const secret = 'test-secret';
  beforeEach(() => {
    revalidatePath.mockClear();
    edge.ctx = {};
    process.env.CRON_SECRET = secret;
  });
  afterEach(() => {
    delete process.env.CRON_SECRET;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('fails closed without a configured secret', async () => {
    delete process.env.CRON_SECRET;
    const res = await post({ paths: ['/'] }, `Bearer ${secret}`);
    expect(res.status).toBe(503);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects the wrong secret', async () => {
    const res = await post({ paths: ['/'] }, 'Bearer nope');
    expect(res.status).toBe(401);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects a body with no usable path', async () => {
    const res = await post({ paths: ['https://x/'] }, `Bearer ${secret}`);
    expect(res.status).toBe(400);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('revalidates each valid path once and reports them', async () => {
    const res = await post({ paths: ['/', '/series/f1/standings', '/series/f1/standings', 'bad'] }, `Bearer ${secret}`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; revalidated: string[] };
    expect(json.ok).toBe(true);
    expect(json.revalidated).toEqual(['/', '/series/f1/standings']);
    expect(revalidatePath).toHaveBeenCalledTimes(2);
    expect(revalidatePath).toHaveBeenCalledWith('/series/f1/standings');
  });

  // PF2: the edge copies (Workers Cache) are purged by tag through the Worker's execution context.
  it('reports edgePurged false where the runtime offers no cache API', async () => {
    const res = await post({ paths: ['/'] }, `Bearer ${secret}`);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { edgePurged: boolean }).edgePurged).toBe(false);
  });

  it('purges the path tags, reports the success and purges once more after the tag window', async () => {
    vi.useFakeTimers();
    const purge = vi.fn(async () => ({ success: true, errors: [] }));
    const waited: Promise<unknown>[] = [];
    edge.ctx = { cache: { purge }, waitUntil: (p: Promise<unknown>) => waited.push(p) };
    const res = await post({ paths: ['/', '/series/f1'] }, `Bearer ${secret}`);
    expect(((await res.json()) as { edgePurged: boolean }).edgePurged).toBe(true);
    expect(purge).toHaveBeenCalledTimes(1);
    expect(purge).toHaveBeenCalledWith({ tags: ['path:/', 'path:/series/f1'] });
    expect(waited).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(6_000);
    await waited[0];
    expect(purge).toHaveBeenCalledTimes(2);
    expect(purge).toHaveBeenLastCalledWith({ tags: ['path:/', 'path:/series/f1'] });
  });

  it('reports edgePurged false when the purge is refused, logs the refusal and does not purge again', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const purge = vi.fn(async () => ({ success: false, errors: [{ code: 10000, message: 'rate limited' }] }));
    const waitUntil = vi.fn();
    edge.ctx = { cache: { purge }, waitUntil };
    const res = await post({ paths: ['/'] }, `Bearer ${secret}`);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { edgePurged: boolean; revalidated: string[] })).toMatchObject({ edgePurged: false, revalidated: ['/'] });
    expect(error).toHaveBeenCalledWith(expect.stringContaining('rate limited'));
    expect(waitUntil).not.toHaveBeenCalled();
  });
});
