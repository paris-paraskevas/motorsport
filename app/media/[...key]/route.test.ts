import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
let bucketPresent = true;
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: () => ({
    env: bucketPresent ? { MEDIA: { put: async () => undefined, get: (key: string) => get(key), delete: async () => undefined } } : {},
  }),
}));

import { GET } from './route';

const KEY = '2026/09/a1b2c3d4-0000-4000-8000-000000000001.jpg';
const call = (segments: string[]) =>
  GET(new Request(`https://paddock-tracker.com/media/${segments.join('/')}`), { params: Promise.resolve({ key: segments }) });

describe('/media/[...key]', () => {
  beforeEach(() => {
    get.mockReset();
    bucketPresent = true;
  });

  it('is 404 for anything that is not a key in the rule, before the bucket is asked', async () => {
    for (const bad of [['photo.jpg'], ['2026', '09', 'x.jpg'], ['..', '..', 'wrangler.jsonc'], []]) {
      expect((await call(bad)).status, bad.join('/')).toBe(404);
    }
    expect(get).not.toHaveBeenCalled();
  });

  it('is 503 without the media binding and 404 for a key the bucket does not hold', async () => {
    bucketPresent = false;
    expect((await call(KEY.split('/'))).status).toBe(503);
    bucketPresent = true;
    get.mockResolvedValue(null);
    expect((await call(KEY.split('/'))).status).toBe(404);
    expect(get).toHaveBeenCalledWith(KEY);
  });

  it('streams the object with its type, a one-year immutable cache header, the etag and the length', async () => {
    const body = new Blob([new Uint8Array([1, 2, 3])]).stream();
    get.mockResolvedValue({ body, httpMetadata: { contentType: 'image/jpeg' }, httpEtag: '"abc"', size: 3 });
    const res = await call(KEY.split('/'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(res.headers.get('etag')).toBe('"abc"');
    expect(res.headers.get('content-length')).toBe('3');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });
});
