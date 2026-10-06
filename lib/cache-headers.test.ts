import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  browserSafeCacheControl,
  edgeCacheRules,
  purgeEdgeAfterRevalidate,
  purgeEdgeTags,
  withBrowserSafeCache,
  withEdgeCacheRules,
} from './cache-headers';

// The Worker's execution context as OpenNext hands it out; each test sets what the runtime offers.
const edge = vi.hoisted(() => ({ ctx: {} as Record<string, unknown> }));
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: () => ({ ctx: edge.ctx }) }));

// The header OpenNext emits lets a browser reuse a stale page or payload for a
// month; after a deploy that means the previous build's chunk names and content.
describe('browserSafeCacheControl', () => {
  it('turns an ISR page header into "ask before reuse" for browsers, keeping s-maxage', () => {
    expect(
      browserSafeCacheControl('s-maxage=1196, stale-while-revalidate=2592000', 'text/html; charset=utf-8'),
    ).toBe('s-maxage=1196, max-age=0, must-revalidate');
  });

  it('does the same for an RSC payload', () => {
    expect(browserSafeCacheControl('s-maxage=166, stale-while-revalidate=2592000', 'text/x-component')).toBe(
      's-maxage=166, max-age=0, must-revalidate',
    );
  });

  it('covers the "regenerating" header OpenNext sends while a page is being rebuilt', () => {
    expect(browserSafeCacheControl('s-maxage=2, stale-while-revalidate=2592000', 'text/html')).toBe(
      's-maxage=2, max-age=0, must-revalidate',
    );
  });

  it("covers Next's own header on a first render: a year less the ttl", () => {
    // Observed on `wrangler dev` for /series/f1/standings before this shipped.
    expect(browserSafeCacheControl('s-maxage=1200, stale-while-revalidate=31534800', 'text/html; charset=utf-8')).toBe(
      's-maxage=1200, max-age=0, must-revalidate',
    );
  });

  it('leaves everything else alone', () => {
    // Static assets and API responses.
    expect(browserSafeCacheControl('public, max-age=0, must-revalidate', 'text/css')).toBeNull();
    expect(browserSafeCacheControl('s-maxage=300, stale-while-revalidate=2592000', 'application/json')).toBeNull();
    // Dynamic pages carry no stale-while-revalidate.
    expect(browserSafeCacheControl('private, no-cache, no-store, max-age=0, must-revalidate', 'text/html')).toBeNull();
    // An explicit max-age is somebody's decision, whatever else is in the header.
    expect(browserSafeCacheControl('public, max-age=60, s-maxage=60, stale-while-revalidate=60', 'text/html')).toBeNull();
    // stale-while-revalidate without s-maxage is not the ISR shape.
    expect(browserSafeCacheControl('stale-while-revalidate=60', 'text/html')).toBeNull();
    expect(browserSafeCacheControl(null, 'text/html')).toBeNull();
    expect(browserSafeCacheControl('s-maxage=60, stale-while-revalidate=2592000', null)).toBeNull();
  });
});

describe('withBrowserSafeCache', () => {
  it('returns the same response object when nothing applies', () => {
    const res = new Response('{}', { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
    expect(withBrowserSafeCache(res)).toBe(res);
  });

  it('copies status, body and the other headers, and replaces cache-control', async () => {
    const res = new Response('<html>', {
      status: 200,
      statusText: 'OK',
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 's-maxage=1196, stale-while-revalidate=2592000',
        vary: 'rsc, next-router-state-tree',
        'x-opennext': '1',
      },
    });
    const out = withBrowserSafeCache(res);
    expect(out).not.toBe(res);
    expect(out.status).toBe(200);
    expect(out.headers.get('cache-control')).toBe('s-maxage=1196, max-age=0, must-revalidate');
    expect(out.headers.get('vary')).toBe('rsc, next-router-state-tree');
    expect(out.headers.get('x-opennext')).toBe('1');
    expect(await out.text()).toBe('<html>');
  });
});

// PF2: the rules a cache in front of the Worker needs. Workers Cache keys by path and query, not the hostname, and
// may keep a response without Cache-Control on heuristic freshness.
describe('edgeCacheRules', () => {
  it('makes every response of the dev. host private', () => {
    expect(edgeCacheRules('dev.paddock-tracker.com', '/series/f1', 's-maxage=300, max-age=0, must-revalidate')).toEqual({
      cacheControl: 'private, no-store',
    });
    expect(edgeCacheRules('dev.paddock-tracker.com', '/admin/designer', null)).toEqual({ cacheControl: 'private, no-store' });
  });

  it('says no-store where nothing was said: a redirect, a route handler without a header', () => {
    expect(edgeCacheRules('paddock-tracker.com', '/series/f1', null)).toEqual({ cacheControl: 'no-store' });
  });

  it('tags a cacheable page with its path and the site, and leaves its header alone', () => {
    expect(edgeCacheRules('paddock-tracker.com', '/calendar', 's-maxage=128, max-age=0, must-revalidate')).toEqual({
      cacheTag: 'path:/calendar,site',
    });
    // A route handler or a media file with a positive max-age is kept by the edge too, so it is tagged too.
    expect(edgeCacheRules('paddock-tracker.com', '/api/search', 'public, max-age=3600, stale-while-revalidate=86400')).toEqual({
      cacheTag: 'path:/api/search,site',
    });
    expect(edgeCacheRules('paddock-tracker.com', '/media/a.jpg', 'public, max-age=31536000, immutable')).toEqual({
      cacheTag: 'path:/media/a.jpg,site',
    });
  });

  it('says no-store on a STALE answer, whose one-second copy would answer the revalidation HEAD', () => {
    expect(edgeCacheRules('paddock-tracker.com', '/series/f1', 's-maxage=1, max-age=0, must-revalidate', 'STALE')).toEqual({
      cacheControl: 'no-store',
    });
    expect(edgeCacheRules('paddock-tracker.com', '/series/f1', 's-maxage=1196, max-age=0, must-revalidate', 'HIT')).toEqual({
      cacheTag: 'path:/series/f1,site',
    });
  });

  it("says no-store on Next's regenerating window of a second or two, whatever the state header says", () => {
    expect(edgeCacheRules('paddock-tracker.com', '/calendar', 's-maxage=1, max-age=0, must-revalidate', 'HIT')).toEqual({
      cacheControl: 'no-store',
    });
    expect(edgeCacheRules('paddock-tracker.com', '/calendar', 's-maxage=2, max-age=0, must-revalidate', null)).toEqual({
      cacheControl: 'no-store',
    });
    expect(edgeCacheRules('paddock-tracker.com', '/calendar', 's-maxage=3, max-age=0, must-revalidate', null)).toEqual({
      cacheTag: 'path:/calendar,site',
    });
  });

  it('touches nothing private, no-store or without a positive window', () => {
    expect(edgeCacheRules('paddock-tracker.com', '/blog/x', 'private, no-cache, no-store, max-age=0, must-revalidate')).toEqual({});
    expect(edgeCacheRules('paddock-tracker.com', '/settings', 'private, max-age=600')).toEqual({});
    expect(edgeCacheRules('paddock-tracker.com', '/x', 'public, max-age=0, must-revalidate')).toEqual({});
    expect(edgeCacheRules('paddock-tracker.com', '/x', 'no-cache')).toEqual({});
  });
});

describe('withEdgeCacheRules', () => {
  it('returns the same response object when nothing applies', () => {
    const res = new Response('x', { headers: { 'cache-control': 'private, no-store' } });
    expect(withEdgeCacheRules(new Request('https://paddock-tracker.com/settings'), res)).toBe(res);
  });

  it('copies the response and sets the header or the tag', async () => {
    const res = new Response('<html>', {
      status: 200,
      headers: { 'cache-control': 's-maxage=300, max-age=0, must-revalidate', 'content-type': 'text/html' },
    });
    const out = withEdgeCacheRules(new Request('https://paddock-tracker.com/series/f1'), res);
    expect(out.headers.get('cache-tag')).toBe('path:/series/f1,site');
    expect(out.headers.get('cache-control')).toBe('s-maxage=300, max-age=0, must-revalidate');
    expect(await out.text()).toBe('<html>');
    const dev = withEdgeCacheRules(
      new Request('https://dev.paddock-tracker.com/series/f1'),
      new Response('y', { headers: { 'cache-control': 's-maxage=300' } }),
    );
    expect(dev.headers.get('cache-control')).toBe('private, no-store');
    expect(dev.headers.get('cache-tag')).toBeNull();
  });

  it("keeps a redirect's status and location and says no-store", () => {
    const res = new Response(null, { status: 301, headers: { location: 'https://paddock-tracker.com/calendar' } });
    const out = withEdgeCacheRules(new Request('https://www.paddock-tracker.com/calendar'), res);
    expect(out.status).toBe(301);
    expect(out.headers.get('location')).toBe('https://paddock-tracker.com/calendar');
    expect(out.headers.get('cache-control')).toBe('no-store');
    expect(out.headers.get('cache-tag')).toBeNull();
  });

  it('purges by tag through the context and reads the answer', async () => {
    expect(await purgeEdgeTags({}, ['site'])).toBe(false);
    const refused = vi.fn(async () => ({ success: false, errors: [{ code: 10000, message: 'rate limited' }] }));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await purgeEdgeTags({ cache: { purge: refused } }, ['site'])).toBe(false);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('rate limited'));
    const purge = vi.fn(async () => ({ success: true, errors: [] }));
    expect(await purgeEdgeTags({ cache: { purge } }, ['path:/calendar', 'site'])).toBe(true);
    expect(purge).toHaveBeenCalledWith({ tags: ['path:/calendar', 'site'] });
    error.mockRestore();
  });

  it('after a revalidation: purges now, once more after the tag window, and two close purges share the second pass', async () => {
    vi.useFakeTimers();
    const purge = vi.fn(async () => ({ success: true, errors: [] }));
    const waited: Promise<unknown>[] = [];
    edge.ctx = { cache: { purge }, waitUntil: (p: Promise<unknown>) => waited.push(p) };
    expect(await purgeEdgeAfterRevalidate(['site'])).toBe(true);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(await purgeEdgeAfterRevalidate(['path:/blog'])).toBe(true);
    expect(purge).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(7_000);
    await Promise.all(waited);
    // The first call's second pass was superseded by the second call; the second call's second pass ran.
    expect(purge).toHaveBeenCalledTimes(3);
    expect(purge).toHaveBeenLastCalledWith({ tags: ['path:/blog'] });
    edge.ctx = {};
    expect(await purgeEdgeAfterRevalidate(['site'])).toBe(false);
  });

  it("reads OpenNext's cache state from the response: a STALE page is not stored", () => {
    const stale = withEdgeCacheRules(
      new Request('https://paddock-tracker.com/series/f1'),
      new Response('<html>', { headers: { 'cache-control': 's-maxage=1, max-age=0, must-revalidate', 'x-opennext-cache': 'STALE' } }),
    );
    expect(stale.headers.get('cache-control')).toBe('no-store');
    expect(stale.headers.get('cache-tag')).toBeNull();
    const nextStale = withEdgeCacheRules(
      new Request('https://paddock-tracker.com/news'),
      new Response('<html>', { headers: { 'cache-control': 's-maxage=1, max-age=0, must-revalidate', 'x-nextjs-cache': 'STALE' } }),
    );
    expect(nextStale.headers.get('cache-control')).toBe('no-store');
  });
});

// PF2 PR C: a page revalidated inside the Worker must also leave the cache in front of it, or readers keep the old copy
// for the page's whole window. Every route that calls revalidatePath purges; a new one that forgets fails here.
describe('every revalidation site purges the edge', () => {
  afterEach(() => vi.useRealTimers());

  function routeFiles(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) routeFiles(full, out);
      else if (name === 'route.ts') out.push(full);
    }
    return out;
  }

  it('names purgeEdgeAfterRevalidate in every route that calls revalidatePath', () => {
    const files = routeFiles(join(process.cwd(), 'app', 'api'));
    expect(files.length).toBeGreaterThan(20);
    const forgetful = files.filter(f => {
      const src = readFileSync(f, 'utf8');
      return src.includes('revalidatePath(') && !src.includes('purgeEdgeAfterRevalidate(');
    });
    expect(forgetful).toEqual([]);
  });
});
