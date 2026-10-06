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

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  edge.ctx = {};
});

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

  it("tags a cacheable page with its path and the site, leaves the browser's header alone and gives the edge its own line: the page's window, then stale while refreshing or failing", () => {
    expect(edgeCacheRules('paddock-tracker.com', '/calendar', 's-maxage=128, max-age=0, must-revalidate')).toEqual({
      cacheTag: 'path:/calendar,site',
      cdnCacheControl: 'max-age=128, stale-while-revalidate=86400, stale-if-error=86400',
    });
    // A route handler or a media file with a positive max-age is kept by the edge too, so it is tagged too; its own
    // max-age is the window.
    expect(edgeCacheRules('paddock-tracker.com', '/api/search', 'public, max-age=3600, stale-while-revalidate=86400')).toEqual({
      cacheTag: 'path:/api/search,site',
      cdnCacheControl: 'max-age=3600, stale-while-revalidate=86400, stale-if-error=86400',
    });
    expect(edgeCacheRules('paddock-tracker.com', '/media/a.jpg', 'public, max-age=31536000, immutable')).toEqual({
      cacheTag: 'path:/media/a.jpg,site',
      cdnCacheControl: 'max-age=31536000, stale-while-revalidate=86400, stale-if-error=86400',
    });
    // s-maxage wins over max-age for the window, whichever comes first in the header.
    expect(edgeCacheRules('paddock-tracker.com', '/x', 'max-age=0, s-maxage=600')).toEqual({
      cacheTag: 'path:/x,site',
      cdnCacheControl: 'max-age=600, stale-while-revalidate=86400, stale-if-error=86400',
    });
  });

  it('a STALE answer: no-store for browsers, an already-expired copy for the edge, so readers are answered at once while the Worker still runs behind', () => {
    expect(edgeCacheRules('paddock-tracker.com', '/series/f1', 's-maxage=1, max-age=0, must-revalidate', 'STALE')).toEqual({
      cacheControl: 'no-store',
      cdnCacheControl: 'max-age=0, stale-while-revalidate=86400, stale-if-error=86400',
    });
    expect(edgeCacheRules('paddock-tracker.com', '/series/f1', 's-maxage=1196, max-age=0, must-revalidate', 'HIT')).toEqual({
      cacheTag: 'path:/series/f1,site',
      cdnCacheControl: 'max-age=1196, stale-while-revalidate=86400, stale-if-error=86400',
    });
  });

  it("Next's regenerating window of a second or two, whatever the state header says: the same no-store and expired copy", () => {
    expect(edgeCacheRules('paddock-tracker.com', '/calendar', 's-maxage=1, max-age=0, must-revalidate', 'HIT')).toEqual({
      cacheControl: 'no-store',
      cdnCacheControl: 'max-age=0, stale-while-revalidate=86400, stale-if-error=86400',
    });
    expect(edgeCacheRules('paddock-tracker.com', '/calendar', 's-maxage=2, max-age=0, must-revalidate', null)).toEqual({
      cacheControl: 'no-store',
      cdnCacheControl: 'max-age=0, stale-while-revalidate=86400, stale-if-error=86400',
    });
    expect(edgeCacheRules('paddock-tracker.com', '/calendar', 's-maxage=3, max-age=0, must-revalidate', null)).toEqual({
      cacheTag: 'path:/calendar,site',
      cdnCacheControl: 'max-age=3, stale-while-revalidate=86400, stale-if-error=86400',
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
    expect(out.headers.get('cloudflare-cdn-cache-control')).toBe('max-age=300, stale-while-revalidate=86400, stale-if-error=86400');
    expect(await out.text()).toBe('<html>');
    const dev = withEdgeCacheRules(
      new Request('https://dev.paddock-tracker.com/series/f1'),
      new Response('y', { headers: { 'cache-control': 's-maxage=300' } }),
    );
    expect(dev.headers.get('cache-control')).toBe('private, no-store');
    expect(dev.headers.get('cache-tag')).toBeNull();
    expect(dev.headers.get('cloudflare-cdn-cache-control')).toBeNull();
  });

  it('gives no edge line to what it never stores (a private page, a bare redirect) and the expired-copy line to a STALE or regenerating answer', () => {
    const priv = withEdgeCacheRules(
      new Request('https://paddock-tracker.com/series/f1'),
      new Response('x', { headers: { 'cache-control': 'private, max-age=600' } }),
    );
    expect(priv.headers.get('cloudflare-cdn-cache-control')).toBeNull();
    const bare = withEdgeCacheRules(new Request('https://paddock-tracker.com/series/f1'), new Response('x'));
    expect(bare.headers.get('cache-control')).toBe('no-store');
    expect(bare.headers.get('cloudflare-cdn-cache-control')).toBeNull();
    for (const [cc, state] of [
      ['s-maxage=1, max-age=0, must-revalidate', 'STALE'],
      ['s-maxage=2, max-age=0, must-revalidate', null],
    ] as const) {
      const out = withEdgeCacheRules(
        new Request('https://paddock-tracker.com/series/f1'),
        new Response('x', { headers: { 'cache-control': cc, ...(state ? { 'x-opennext-cache': state } : {}) } }),
      );
      expect(out.headers.get('cache-control'), cc).toBe('no-store');
      expect(out.headers.get('cloudflare-cdn-cache-control'), cc).toBe('max-age=0, stale-while-revalidate=86400, stale-if-error=86400');
    }
  });

  it("keeps a redirect's status and location and says no-store", () => {
    const res = new Response(null, { status: 301, headers: { location: 'https://paddock-tracker.com/calendar' } });
    const out = withEdgeCacheRules(new Request('https://www.paddock-tracker.com/calendar'), res);
    expect(out.status).toBe(301);
    expect(out.headers.get('location')).toBe('https://paddock-tracker.com/calendar');
    expect(out.headers.get('cache-control')).toBe('no-store');
    expect(out.headers.get('cache-tag')).toBeNull();
  });

  it('purges by tag through the context and reads the answer: absent, refused, thrown, done', async () => {
    expect(await purgeEdgeTags({}, ['site'])).toBe(false);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const refused = vi.fn(async () => ({ success: false, errors: [{ code: 10000, message: 'rate limited' }] }));
    expect(await purgeEdgeTags({ cache: { purge: refused } }, ['site'])).toBe(false);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('rate limited'));
    const thrown = vi.fn(async () => {
      throw new Error('network down');
    });
    expect(await purgeEdgeTags({ cache: { purge: thrown } }, ['site'])).toBe(false);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('network down'));
    const purge = vi.fn(async () => ({ success: true, errors: [] }));
    expect(await purgeEdgeTags({ cache: { purge } }, ['path:/calendar', 'site'])).toBe(true);
    expect(purge).toHaveBeenCalledWith({ tags: ['path:/calendar', 'site'] });
  });

  it('after a revalidation: purges now and once more after the tag window; close purges share one second pass over all their tags', async () => {
    vi.useFakeTimers();
    const purge = vi.fn(async () => ({ success: true, errors: [] }));
    const waited: Promise<unknown>[] = [];
    edge.ctx = { cache: { purge }, waitUntil: (p: Promise<unknown>) => waited.push(p) };
    expect(await purgeEdgeAfterRevalidate(['site'])).toBe(true);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(await purgeEdgeAfterRevalidate(['path:/blog'])).toBe(true);
    expect(purge).toHaveBeenCalledTimes(2);
    expect(waited).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(7_000);
    await Promise.all(waited);
    expect(purge).toHaveBeenCalledTimes(3);
    expect(purge).toHaveBeenLastCalledWith({ tags: ['site', 'path:/blog'] });
    // A later purge, after the window, schedules a second pass of its own.
    expect(await purgeEdgeAfterRevalidate(['path:/news'])).toBe(true);
    expect(waited).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(7_000);
    await Promise.all(waited);
    expect(purge).toHaveBeenLastCalledWith({ tags: ['path:/news'] });
  });

  it('without a cache API or without waitUntil: no purge or a single purge, never a throw', async () => {
    edge.ctx = {};
    expect(await purgeEdgeAfterRevalidate(['site'])).toBe(false);
    const purge = vi.fn(async () => ({ success: true, errors: [] }));
    edge.ctx = { cache: { purge } };
    expect(await purgeEdgeAfterRevalidate(['site'])).toBe(true);
    expect(purge).toHaveBeenCalledTimes(1);
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
// for the page's whole window. Every file under app/ or lib/ that revalidates purges; a new one that forgets fails here.
describe('every revalidation site purges the edge', () => {
  const REVALIDATES = /\b(?:revalidatePath|revalidateTag|updateTag)\(/;

  function sourceFiles(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) sourceFiles(full, out);
      else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith('.d.ts')) out.push(full);
    }
    return out;
  }

  it('names purgeEdgeAfterRevalidate in every file that calls revalidatePath, revalidateTag or updateTag', () => {
    const files = [...sourceFiles(join(process.cwd(), 'app')), ...sourceFiles(join(process.cwd(), 'lib'))];
    const revalidating = files.filter(f => REVALIDATES.test(readFileSync(f, 'utf8')));
    expect(revalidating.length).toBeGreaterThan(20);
    const forgetful = revalidating.filter(f => !readFileSync(f, 'utf8').includes('purgeEdgeAfterRevalidate('));
    expect(forgetful).toEqual([]);
  });
});
