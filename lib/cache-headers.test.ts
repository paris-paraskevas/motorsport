import { describe, expect, it } from 'vitest';
import { browserSafeCacheControl, withBrowserSafeCache } from './cache-headers';

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
