import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const auth = { getClaims: vi.fn(), updateUser: vi.fn(async () => ({ data: {}, error: null })), refreshSession: vi.fn(async () => ({ data: {}, error: null })) };
vi.mock('@/lib/auth/supabase', async importOriginal => ({ ...(await importOriginal<typeof import('@/lib/auth/supabase')>()), authClient: () => ({ auth }) }));
const upload = vi.fn(async () => ({ data: {}, error: null }));
const remove = vi.fn(async () => ({ data: {}, error: null }));
const bucket = {
  upload: (...a: unknown[]) => upload(...(a as [])),
  remove: (...a: unknown[]) => remove(...(a as [])),
  getPublicUrl: (path: string) => ({ data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/avatars/${path}` } }),
};
vi.mock('@/lib/betting/client', () => ({ betDb: () => ({ storage: { from: () => bucket } }) }));

import { DELETE, ownPhotoPath, PHOTO_MAX, POST } from './route';

// The person's photo (PA A3): the kinds and the size taken, the random name, the old picture removed, the address on the account.
const claims = (avatar: string | null = null) => ({ sub: 'u1', email: 'alex@example.com', app_metadata: {}, user_metadata: { full_name: 'Alex', avatar_url: avatar } });
const headers = { host: 'paddock-tracker.com', origin: 'https://paddock-tracker.com', cookie: 'pd-session=tokens' };
const upload_ = (file: File | null, over: Record<string, string> = {}) => {
  const form = new FormData();
  if (file) form.set('file', file);
  return POST(new NextRequest('https://paddock-tracker.com/api/account/photo', { method: 'POST', headers: { ...headers, ...over }, body: form }));
};
const read = async (res: Response) => ({ status: res.status, body: await res.json() });

describe('/api/account/photo', () => {
  afterEach(() => {
    auth.getClaims.mockReset();
    auth.updateUser.mockClear();
    upload.mockClear();
    remove.mockClear();
  });

  it('uploads a PNG under a random name, puts its address on the account, removes the old one and refreshes the claims', async () => {
    auth.getClaims.mockResolvedValue({ data: { claims: claims('https://x.supabase.co/storage/v1/object/public/avatars/old.png') }, error: null });
    const out = await read(await upload_(new File([new Uint8Array([1, 2, 3])], 'me.png', { type: 'image/png' })));
    expect(out.status).toBe(200);
    expect(out.body.imageUrl).toMatch(/^https:\/\/x\.supabase\.co\/storage\/v1\/object\/public\/avatars\/[0-9a-f-]{36}\.png$/);
    const [path, bytes, options] = upload.mock.calls[0] as unknown as [string, Uint8Array, Record<string, unknown>];
    expect(path).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect([...bytes]).toEqual([1, 2, 3]);
    expect(options).toEqual({ contentType: 'image/png', upsert: false });
    expect(auth.updateUser).toHaveBeenCalledWith({ data: { avatar_url: out.body.imageUrl } });
    expect(remove).toHaveBeenCalledWith(['old.png']);
    expect(auth.refreshSession).toHaveBeenCalled();
  });

  it('refuses the wrong kind, a picture over 2 MB, no picture, a request from elsewhere and a signed-out one', async () => {
    auth.getClaims.mockResolvedValue({ data: { claims: claims() }, error: null });
    expect((await read(await upload_(new File([new Uint8Array(10)], 'me.gif', { type: 'image/gif' })))).body.error).toMatch(/PNG, JPEG or WebP/);
    expect((await read(await upload_(new File([new Uint8Array(PHOTO_MAX + 1)], 'big.jpg', { type: 'image/jpeg' })))).body.error).toMatch(/2 MB/);
    expect((await read(await upload_(null))).body.error).toMatch(/Choose a picture/);
    expect((await read(await upload_(new File([new Uint8Array(3)], 'me.webp', { type: 'image/webp' }), { origin: 'https://evil.example' }))).status).toBe(403);
    auth.getClaims.mockResolvedValueOnce({ data: null, error: { message: 'invalid' } });
    expect((await read(await upload_(new File([new Uint8Array(3)], 'me.webp', { type: 'image/webp' })))).status).toBe(401);
    expect(upload).not.toHaveBeenCalled();
  });

  it('DELETE takes the picture off the account and removes only the site’s own object', async () => {
    auth.getClaims.mockResolvedValue({ data: { claims: claims('https://lh3.googleusercontent.com/a/photo') }, error: null });
    const req = () => new NextRequest('https://paddock-tracker.com/api/account/photo', { method: 'DELETE', headers });
    expect((await read(await DELETE(req()))).body).toEqual({ ok: true });
    expect(auth.updateUser).toHaveBeenCalledWith({ data: { avatar_url: null } });
    expect(remove).not.toHaveBeenCalled();
    auth.getClaims.mockResolvedValue({ data: { claims: claims('https://x.supabase.co/storage/v1/object/public/avatars/k%20k.png?v=1') }, error: null });
    await DELETE(req());
    expect(remove).toHaveBeenCalledWith(['k k.png']);
    expect(ownPhotoPath('https://lh3.googleusercontent.com/a/photo')).toBeNull();
    expect(ownPhotoPath(null)).toBeNull();
  });
});
