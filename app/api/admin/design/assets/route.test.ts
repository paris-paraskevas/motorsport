import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentAccount = vi.fn();
vi.mock('@/lib/auth/server', () => ({ currentAccount: () => currentAccount(), accountId: async () => ((await currentAccount()) as { id?: string } | null)?.id ?? null }));

// A fake `asset` table: `rows` answers the reads; `insert` records its payload
// and answers with a row built from it (the key is generated inside the route).
const insert = vi.fn();
let insertError: { message: string } | null = null;
let rows: { data: unknown; error: { message: string } | null } = { data: [], error: null };
const STAMP = '2026-09-08T14:30:00.505502+00:00';
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => true,
  betDb: () => ({
    from: () => {
      const read = {
        select: () => read,
        eq: () => read,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(rows).then(resolve, reject),
      };
      return {
        select: () => read,
        insert: (payload: Record<string, unknown>) => {
          insert(payload);
          return {
            select: () => ({
              single: async () => ({
                data: insertError ? null : { id: 'a1b2c3d4-0000-4000-8000-000000000001', ...payload, created_at: STAMP, updated_at: STAMP },
                error: insertError,
              }),
            }),
          };
        },
      };
    },
  }),
}));

// A fake media bucket behind the Cloudflare context, or none.
const put = vi.fn();
const remove = vi.fn();
let bucketPresent = true;
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: () => ({
    env: bucketPresent
      ? {
          MEDIA: {
            put: async (key: string, value: Uint8Array, options: unknown) => {
              put(key, value.length, options);
            },
            get: async () => null,
            delete: async (key: string) => {
              remove(key);
            },
          },
        }
      : {},
  }),
}));

import { GET, POST } from './route';
import { ASSET_KEY } from '@/lib/design/asset-defaults';

const admin = { id: 'user_admin', role: 'admin' };
const PNG_1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

function upload(fields: Record<string, string>, file?: { bytes: Uint8Array | Buffer; type: string; name?: string }) {
  const form = new FormData();
  if (file) form.append('file', new File([file.bytes as BlobPart], file.name ?? 'photo', { type: file.type }));
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return POST(new Request('https://paddock-tracker.com/api/admin/design/assets', { method: 'POST', body: form }));
}
const words = { caption: 'Antonelli on the grid', credit: 'Paris Paraskevas', licence: 'Own work' };

describe('/api/admin/design/assets', () => {
  beforeEach(() => {
    currentAccount.mockReset();
    currentAccount.mockResolvedValue(admin);
    insert.mockReset();
    put.mockReset();
    remove.mockReset();
    insertError = null;
    bucketPresent = true;
    rows = { data: [], error: null };
    process.env.PADDOCK_ENV = 'production';
  });
  afterEach(() => {
    delete process.env.PADDOCK_ENV;
  });

  it('GET is 404 for a non-admin and lists the rows with whether the media store is bound', async () => {
    currentAccount.mockResolvedValue({ id: 'u' });
    expect((await GET()).status).toBe(404);
    currentAccount.mockResolvedValue(admin);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ assets: [], mediaConfigured: true });
    bucketPresent = false;
    expect(((await (await GET()).json()) as { mediaConfigured: boolean }).mediaConfigured).toBe(false);
  });

  it('POST is 404 for a non-admin, 403 off production and 503 without the media binding, before anything is stored', async () => {
    currentAccount.mockResolvedValue({ id: 'u' });
    expect((await upload(words, { bytes: PNG_1x1, type: 'image/png' })).status).toBe(404);
    currentAccount.mockResolvedValue(admin);
    delete process.env.PADDOCK_ENV;
    expect((await upload(words, { bytes: PNG_1x1, type: 'image/png' })).status).toBe(403);
    process.env.PADDOCK_ENV = 'production';
    bucketPresent = false;
    expect((await upload(words, { bytes: PNG_1x1, type: 'image/png' })).status).toBe(503);
    expect(put).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('refuses a missing file, an empty file, a missing credit or licence, and bytes that are not an image, before storing', async () => {
    expect((await upload(words)).status).toBe(400);
    expect((await upload(words, { bytes: new Uint8Array(0), type: 'image/png' })).status).toBe(400);
    const noCredit = await upload({ ...words, credit: '' }, { bytes: PNG_1x1, type: 'image/png' });
    expect(noCredit.status).toBe(400);
    expect(((await noCredit.json()) as { problems: string[] }).problems).toEqual(['a credit is needed: who took or owns the photo']);
    const notImage = await upload(words, { bytes: new TextEncoder().encode('<svg></svg>'), type: 'image/png' });
    expect(notImage.status).toBe(400);
    expect(((await notImage.json()) as { error: string }).error).toBe('the file is not a JPEG, PNG or WebP image');
    expect(put).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('refuses a file over the cap by its size before reading it', async () => {
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    const res = await upload(words, { bytes: big, type: 'image/jpeg' });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('the file is over 10.0 MB');
    expect(put).not.toHaveBeenCalled();
  });

  it('stores the file under a generated key with its proven type, writes the row, and answers 201 with the asset', async () => {
    const res = await upload(words, { bytes: PNG_1x1, type: 'application/octet-stream' });
    expect(res.status).toBe(201);
    expect(put).toHaveBeenCalledTimes(1);
    const [key, length, options] = put.mock.calls[0] as [string, number, unknown];
    expect(ASSET_KEY.test(key)).toBe(true);
    expect(key.endsWith('.png')).toBe(true);
    expect(length).toBe(PNG_1x1.length);
    expect(options).toEqual({ httpMetadata: { contentType: 'image/png', cacheControl: 'public, max-age=31536000, immutable' } });
    expect(insert).toHaveBeenCalledWith({
      application_key: 'paddock',
      r2_key: key,
      kind: 'image',
      caption: 'Antonelli on the grid',
      credit: 'Paris Paraskevas',
      licence: 'Own work',
      width: 1,
      height: 1,
      bytes: PNG_1x1.length,
      content_type: 'image/png',
      updated_by: 'user_admin',
    });
    const json = (await res.json()) as { asset: { key: string; url: string; width: number; updatedAt: string } };
    expect(json.asset.key).toBe(key);
    expect(json.asset.url).toBe(`/media/${key}`);
    expect(json.asset.width).toBe(1);
    expect(json.asset.updatedAt).toBe(STAMP);
    expect(remove).not.toHaveBeenCalled();
  });

  it('removes the stored file again when the row cannot be written', async () => {
    insertError = { message: 'boom' };
    const res = await upload(words, { bytes: PNG_1x1, type: 'image/png' });
    expect(res.status).toBe(500);
    expect(put).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith((put.mock.calls[0] as [string])[0]);
  });
});
