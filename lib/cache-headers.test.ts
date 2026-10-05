import { describe, expect, it } from 'vitest';
import { browserSafeCacheControl, edgeCacheRules, withBrowserSafeCache, withEdgeCacheRules } from './cache-headers';

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

  it('tags a cacheable page with its path and leaves its header alone', () => {
    expect(edgeCacheRules('paddock-tracker.com', '/calendar', 's-maxage=128, max-age=0, must-revalidate')).toEqual({
      cacheTag: 'path:/calendar',
    });
  });

  it('touches nothing private, no-store or merely public', () => {
    expect(edgeCacheRules('paddock-tracker.com', '/blog/x', 'private, no-cache, no-store, max-age=0, must-revalidate')).toEqual({});
    expect(edgeCacheRules('paddock-tracker.com', '/api/search', 'public, max-age=3600, stale-while-revalidate=86400')).toEqual({});
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
    expect(out.headers.get('cache-tag')).toBe('path:/series/f1');
    expect(out.headers.get('cache-control')).toBe('s-maxage=300, max-age=0, must-revalidate');
    expect(await out.text()).toBe('<html>');
    const dev = withEdgeCacheRules(
      new Request('https://dev.paddock-tracker.com/series/f1'),
      new Response('y', { headers: { 'cache-control': 's-maxage=300' } }),
    );
    expect(dev.headers.get('cache-control')).toBe('private, no-store');
    expect(dev.headers.get('cache-tag')).toBeNull();
  });
});
