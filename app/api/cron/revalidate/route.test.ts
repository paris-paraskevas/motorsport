import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

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
    process.env.CRON_SECRET = secret;
  });
  afterEach(() => {
    delete process.env.CRON_SECRET;
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
});
