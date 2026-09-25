import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

type Jar = { setAll: (list: { name: string; value: string; options: Record<string, unknown> }[]) => void };
const auth = { getClaims: vi.fn(), updateUser: vi.fn(), refreshSession: vi.fn(async () => ({ data: {}, error: null })), signOut: vi.fn(async () => ({ error: null })) };
let jar: Jar | null = null;
const authClient = vi.fn<(input: { cookies: Jar }) => { auth: typeof auth }>(({ cookies }) => {
  jar = cookies;
  return { auth };
});
vi.mock('@/lib/auth/supabase', async importOriginal => ({ ...(await importOriginal<typeof import('@/lib/auth/supabase')>()), authClient: (input: { cookies: Jar }) => authClient(input) }));
const deleteUser = vi.fn<(id: string) => Promise<{ data: unknown; error: { message: string } | null }>>(async () => ({ data: {}, error: null }));
vi.mock('@/lib/betting/client', () => ({ betDb: () => ({ auth: { admin: { deleteUser: (id: string) => deleteUser(id as never) } } }) }));

import { withSessionRules } from '@/lib/auth/supabase';
import { DELETE, DELETE_WORDS, GET, PATCH } from './route';

// The person's own account (PA A3): read by the browser, edited from the Account page, deleted on the words.
const claims = (over: Record<string, unknown> = {}) => ({
  sub: '00000000-0000-4000-8000-000000000001',
  email: 'alex@example.com',
  app_metadata: { legacy_id: 'user_1', role: 'admin', donor: false, provider: 'email', providers: ['email', 'google'] },
  user_metadata: { full_name: 'Alex Driver', username: 'alexd', avatar_url: null, flags: { 'support-prompt': 'never' } },
  ...over,
});
const headers = { host: 'paddock-tracker.com', origin: 'https://paddock-tracker.com', 'content-type': 'application/json' };
const request = (method: string, body?: unknown, over: Record<string, string> = {}, cookie = 'pd-session=tokens') =>
  new NextRequest('https://paddock-tracker.com/api/account', { method, headers: { ...headers, ...over, ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
const read = async (res: Response) => ({ status: res.status, body: await res.json(), cache: res.headers.get('cache-control'), cookies: res.headers.getSetCookie().map(c => c.split(';')[0]) });

describe('/api/account', () => {
  afterEach(() => {
    for (const fn of Object.values(auth)) fn.mockReset();
    auth.refreshSession.mockResolvedValue({ data: {}, error: null });
    auth.signOut.mockResolvedValue({ error: null });
    deleteUser.mockClear();
    authClient.mockClear();
    jar = null;
  });

  it('GET answers the account, its flags and its providers for a session, nothing without a cookie, and never a cached answer', async () => {
    auth.getClaims.mockResolvedValueOnce({ data: { claims: claims() }, error: null });
    const signedIn = await read(await GET(request('GET')));
    expect(signedIn).toMatchObject({ status: 200, cache: 'private, no-store', body: { account: { id: 'user_1', name: 'Alex Driver', role: 'admin' }, flags: { 'support-prompt': 'never' }, providers: ['email', 'google'] } });
    const anonymous = await read(await GET(request('GET', undefined, {}, '')));
    expect(anonymous.body).toEqual({ account: null, flags: null, providers: [] });
    expect(authClient).toHaveBeenCalledTimes(1);
    // A refresh during the read rides on the answer.
    auth.getClaims.mockImplementationOnce(async () => {
      jar?.setAll(withSessionRules([{ name: 'pd-session', value: 'fresh', options: { path: '/', maxAge: 100 } }], true));
      return { data: { claims: claims() }, error: null };
    });
    expect((await read(await GET(request('GET')))).cookies).toEqual(['pd-session=fresh', 'pd_signed_in=1']);
  });

  it('PATCH edits the name, the flags (merged), the address (a code follows) and the password through the session, then answers the fresh claims', async () => {
    auth.getClaims.mockResolvedValue({ data: { claims: claims() }, error: null });
    auth.updateUser.mockResolvedValue({ data: {}, error: null });
    const flagged = await read(await PATCH(request('PATCH', { flags: { 'whats-new': 'v42' } })));
    expect(auth.updateUser).toHaveBeenLastCalledWith({ data: { flags: { 'support-prompt': 'never', 'whats-new': 'v42' } } });
    expect(auth.refreshSession).toHaveBeenCalled();
    expect(flagged).toMatchObject({ status: 200, body: { ok: true, account: { id: 'user_1' }, flags: { 'support-prompt': 'never' } } });
    await PATCH(request('PATCH', { name: ' Alex D ', password: 'eight-ch' }));
    expect(auth.updateUser).toHaveBeenLastCalledWith({ password: 'eight-ch', data: { full_name: 'Alex D' } });
    const address = await read(await PATCH(request('PATCH', { email: ' New@Example.com ' })));
    expect(auth.updateUser).toHaveBeenLastCalledWith({ email: 'new@example.com' });
    expect(address.body).toMatchObject({ ok: true, confirm: 'email_change', email: 'new@example.com' });
    for (const [body, error] of [
      [{ name: '' }, /name/],
      [{ flags: [1] }, /object/],
      [{ email: 'nope' }, /full email/],
      [{ password: 'seven-c' }, /8 characters/],
      [{}, /Nothing to change/],
    ] as const) {
      expect((await read(await PATCH(request('PATCH', body)))).body.error).toMatch(error);
    }
    auth.updateUser.mockResolvedValueOnce({ data: {}, error: { code: 'email_exists', message: 'x' } });
    expect((await read(await PATCH(request('PATCH', { email: 'taken@example.com' })))).body.error).toMatch(/already in use/);
    auth.updateUser.mockResolvedValueOnce({ data: {}, error: { code: 'weak_password', message: 'x' } });
    expect((await read(await PATCH(request('PATCH', { password: 'password' })))).body.error).toMatch(/stronger/);
  });

  it('PATCH and DELETE refuse a request from elsewhere and a signed-out one', async () => {
    expect((await read(await PATCH(request('PATCH', { name: 'x' }, { origin: 'https://evil.example' })))).status).toBe(403);
    auth.getClaims.mockResolvedValueOnce({ data: null, error: { message: 'invalid' } });
    expect((await read(await PATCH(request('PATCH', { name: 'x' })))).status).toBe(401);
    expect((await read(await PATCH(request('PATCH', { name: 'x' }, {}, '')))).status).toBe(401);
    expect(auth.updateUser).not.toHaveBeenCalled();
    expect((await read(await DELETE(request('DELETE', { confirm: DELETE_WORDS }, { origin: 'https://evil.example' })))).status).toBe(403);
    expect((await read(await DELETE(request('DELETE', { confirm: DELETE_WORDS }, {}, '')))).status).toBe(401);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('DELETE needs the words, deletes the session’s own Supabase id (never the app id) and ends the session', async () => {
    auth.getClaims.mockResolvedValue({ data: { claims: claims() }, error: null });
    expect((await read(await DELETE(request('DELETE', { confirm: 'delete' })))).body.error).toMatch(/Type "Delete account"/);
    expect(deleteUser).not.toHaveBeenCalled();
    auth.signOut.mockImplementationOnce(async () => {
      jar?.setAll(withSessionRules([{ name: 'pd-session', value: '', options: { path: '/', maxAge: 0 } }], true));
      return { error: null };
    });
    const gone = await read(await DELETE(request('DELETE', { confirm: DELETE_WORDS })));
    expect(deleteUser).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000001');
    expect(gone).toMatchObject({ status: 200, body: { ok: true }, cookies: ['pd-session=', 'pd_signed_in='] });
    deleteUser.mockResolvedValueOnce({ data: {}, error: { message: 'boom' } });
    expect((await read(await DELETE(request('DELETE', { confirm: DELETE_WORDS })))).status).toBe(400);
  });
});
