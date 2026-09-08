import { beforeEach, describe, expect, it, vi } from 'vitest';

let configured = true;
let result: { data: unknown; error: { message: string } | null } = { data: [], error: null };
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => configured,
  betDb: () => ({
    from: () => {
      const q = {
        select: () => q,
        eq: () => q,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject),
      };
      return q;
    },
  }),
}));

let env: Record<string, unknown> | null = null;
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: () => {
    if (!env) throw new Error('no cloudflare context');
    return { env };
  },
}));

import {
  ASSET_KEY,
  ASSET_MAX_BYTES,
  assetFileProblems,
  assetFromRow,
  getMediaBucket,
  isAssetId,
  loadAssetsForEditing,
  mediaUrl,
  newAssetKey,
  parseAssetMeta,
} from './assets';

const ID = 'a1b2c3d4-0000-4000-8000-000000000001';
const KEY = '2026/09/a1b2c3d4-0000-4000-8000-000000000001.jpg';
const STAMP = '2026-09-08T14:30:00.505502+00:00';
const row = {
  id: ID,
  r2_key: KEY,
  caption: 'Antonelli on the grid',
  credit: 'Paris Paraskevas',
  licence: 'Own work',
  width: 4032,
  height: 3024,
  bytes: 2_400_000,
  content_type: 'image/jpeg',
  created_at: '2026-09-08T14:29:00+00:00',
  updated_at: STAMP,
};

describe('the rules', () => {
  it('a key is year, month, a UUID and one of three extensions', () => {
    expect(ASSET_KEY.test(KEY)).toBe(true);
    expect(ASSET_KEY.test(newAssetKey('image/png', new Date('2026-09-08T14:00:00Z')))).toBe(true);
    expect(newAssetKey('image/webp', new Date('2026-01-05T00:00:00Z'), '11111111-2222-4333-8444-555555555555')).toBe('2026/01/11111111-2222-4333-8444-555555555555.webp');
    for (const bad of ['photo.jpg', '2026/09/not-a-uuid.jpg', `${KEY}/..`, KEY.replace('.jpg', '.gif'), `../${KEY}`]) expect(ASSET_KEY.test(bad), bad).toBe(false);
    expect(mediaUrl(KEY)).toBe(`/media/${KEY}`);
    expect(isAssetId(ID)).toBe(true);
    expect(isAssetId('nope')).toBe(false);
  });

  it('the words: a caption may be empty, a credit and a licence may not, each within its length', () => {
    expect(parseAssetMeta({ caption: '  Grid  ', credit: ' Paris ', licence: 'Own work' })).toEqual({
      value: { caption: 'Grid', credit: 'Paris', licence: 'Own work' },
      problems: [],
    });
    const { problems } = parseAssetMeta({ caption: 'x'.repeat(301), credit: '', licence: 'y'.repeat(81) });
    expect(problems).toEqual([
      'the caption is at most 300 characters',
      'a credit is needed: who took or owns the photo',
      'the licence is at most 80 characters',
    ]);
    expect(parseAssetMeta({ credit: 'x', licence: '  ' }).problems).toEqual(['a licence is needed: under what terms the photo may be shown']);
  });

  it('the file, by what the browser reports: the three kinds, within the cap, not empty', () => {
    expect(assetFileProblems({ type: 'image/jpeg', size: 1024 })).toEqual([]);
    expect(assetFileProblems({ type: 'image/gif', size: 1024 })).toEqual(['only JPEG, PNG and WebP photos are accepted']);
    expect(assetFileProblems({ type: 'image/png', size: 0 })).toEqual(['the file is empty']);
    expect(assetFileProblems({ type: 'image/webp', size: ASSET_MAX_BYTES + 1 })).toEqual(['the file is over 10.0 MB']);
  });
});

describe('assetFromRow', () => {
  it('coerces a row, and leaves out one without a usable key or a stamp', () => {
    expect(assetFromRow(row)).toEqual({
      id: ID,
      key: KEY,
      url: `/media/${KEY}`,
      caption: 'Antonelli on the grid',
      credit: 'Paris Paraskevas',
      licence: 'Own work',
      width: 4032,
      height: 3024,
      bytes: 2_400_000,
      contentType: 'image/jpeg',
      createdAt: '2026-09-08T14:29:00+00:00',
      updatedAt: STAMP,
    });
    expect(assetFromRow({ ...row, caption: null, width: null })).toMatchObject({ caption: '', width: null });
    expect(assetFromRow({ ...row, r2_key: 'photo.jpg' })).toBeNull();
    expect(assetFromRow({ ...row, updated_at: null })).toBeNull();
    expect(assetFromRow(null)).toBeNull();
  });
});

describe('getMediaBucket', () => {
  it('is the MEDIA binding when the Cloudflare context has one, null otherwise', () => {
    env = null;
    expect(getMediaBucket()).toBeNull();
    env = {};
    expect(getMediaBucket()).toBeNull();
    const bucket = { put: async () => undefined, get: async () => null, delete: async () => undefined };
    env = { MEDIA: bucket };
    expect(getMediaBucket()).toBe(bucket);
  });
});

describe('loadAssetsForEditing', () => {
  beforeEach(() => {
    configured = true;
    result = { data: [], error: null };
  });

  it('is null when unconfigured or on an error, empty when there are no rows', async () => {
    configured = false;
    expect(await loadAssetsForEditing()).toBeNull();
    configured = true;
    result = { data: null, error: { message: 'boom' } };
    expect(await loadAssetsForEditing()).toBeNull();
    result = { data: [], error: null };
    expect(await loadAssetsForEditing()).toEqual([]);
  });

  it('returns usable rows newest first', async () => {
    const older = { ...row, id: 'a1b2c3d4-0000-4000-8000-000000000002', r2_key: KEY.replace('01.jpg', '02.png'), created_at: '2026-09-07T10:00:00+00:00' };
    result = { data: [older, row, { ...row, r2_key: 'bad' }], error: null };
    const rows = await loadAssetsForEditing();
    expect(rows?.map(a => a.id)).toEqual([ID, older.id]);
  });
});
