import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

type Jar = { setAll: (list: { name: string; value: string; options: Record<string, unknown> }[]) => void };
const auth = {
  signInWithPassword: vi.fn(),
  signInWithOtp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  verifyOtp: vi.fn(),
  signUp: vi.fn(),
  signInWithIdToken: vi.fn(),
  signOut: vi.fn(),
};
let jar: Jar | null = null;
const authClient = vi.fn<(input: { cookies: Jar }) => { auth: typeof auth }>(({ cookies }) => {
  jar = cookies;
  return { auth };
});
vi.mock('@/lib/auth/supabase', async importOriginal => ({ ...(await importOriginal<typeof import('@/lib/auth/supabase')>()), authClient: (input: { cookies: Jar }) => authClient(input) }));
const sendWelcomeEmail = vi.fn<(input: { id: string; email: string; name?: string | null }) => Promise<boolean>>(async () => true);
vi.mock('@/lib/email', () => ({ sendWelcomeEmail: (a: unknown) => sendWelcomeEmail(a as never) }));

import { withSessionRules } from '@/lib/auth/supabase';
import { BAD_CODE, CHECK_FAILED, POST, USE_EMAIL, WRONG_CREDENTIALS } from './route';

// The sign-in routes (PA A3): each action over a mocked client, the same-site check, the safe way back, the one message
// for wrong credentials, the enumeration-safe answers, the welcome sent once at the first confirmed sign-up. The mocked
// client writes its cookies as the real one does, through the session rules (the flag cookie beside the session's).
const session = () => {
  jar?.setAll(withSessionRules([{ name: 'pd-session', value: 'tokens', options: { path: '/', maxAge: 100, httpOnly: true } }], true));
  return { data: { session: { access_token: 'a' }, user: { id: 'u1', email: 'alex@example.com', app_metadata: { provider: 'email' }, user_metadata: { full_name: 'Alex Driver' } } }, error: null };
};
const failure = (code: string) => ({ data: { session: null, user: null }, error: { code, message: code } });
const call = async (action: string, body: unknown, headers: Record<string, string> = {}) => {
  const req = new NextRequest(`https://paddock-tracker.com/api/auth/${action}`, {
    method: 'POST',
    headers: { host: 'paddock-tracker.com', origin: 'https://paddock-tracker.com', 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const res = await POST(req, { params: Promise.resolve({ action }) });
  return { status: res.status, body: await res.json(), cookies: res.headers.getSetCookie().map(c => c.split(';')[0]), cache: res.headers.get('cache-control') };
};

describe('/api/auth/[action]', () => {
  afterEach(() => {
    for (const fn of Object.values(auth)) fn.mockReset();
    sendWelcomeEmail.mockClear();
    authClient.mockClear();
    jar = null;
  });

  it('refuses an unknown action, a request from elsewhere, and a username where the address goes', async () => {
    expect((await call('magic', {})).status).toBe(404);
    const foreign = await call('password', { email: 'alex@example.com', password: 'x' }, { origin: 'https://evil.example' });
    expect(foreign.status).toBe(403);
    expect(foreign.body.error).toMatch(/from the site itself/);
    expect(authClient).not.toHaveBeenCalled();
    const username = await call('password', { email: 'alexd', password: 'secret-123' });
    expect(username).toMatchObject({ status: 400, body: { error: USE_EMAIL } });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('password: signs in with the captcha token, sets the session cookies, answers the safe way back, and one message for anything wrong', async () => {
    auth.signInWithPassword.mockImplementationOnce(session);
    const ok = await call('password', { email: ' Alex@Example.com ', password: 'secret-123', captchaToken: 'tok', next: '/settings/account' });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'alex@example.com', password: 'secret-123', options: { captchaToken: 'tok' } });
    expect(ok).toMatchObject({ status: 200, body: { ok: true, next: '/settings/account' }, cookies: ['pd-session=tokens', 'pd_signed_in=1'], cache: 'private, no-store' });
    auth.signInWithPassword.mockResolvedValueOnce(failure('invalid_credentials'));
    expect(await call('password', { email: 'alex@example.com', password: 'nope', next: 'https://evil.example' })).toMatchObject({ status: 400, body: { error: WRONG_CREDENTIALS }, cookies: [] });
    auth.signInWithPassword.mockResolvedValueOnce(failure('captcha_failed'));
    expect((await call('password', { email: 'alex@example.com', password: 'nope' })).body.error).toBe(CHECK_FAILED);
    auth.signInWithPassword.mockResolvedValueOnce(failure('email_not_confirmed'));
    expect((await call('password', { email: 'alex@example.com', password: 'nope' })).body).toMatchObject({ unconfirmed: true });
    expect((await call('password', { email: 'alex@example.com' })).body.error).toBe(WRONG_CREDENTIALS);
    auth.signInWithPassword.mockImplementationOnce(session);
    expect((await call('password', { email: 'alex@example.com', password: 'x', next: '//evil.example' })).body.next).toBe('/');
  });

  it('code and reset: an unknown address is answered exactly as a known one, and only a failed check is reported', async () => {
    auth.signInWithOtp.mockResolvedValueOnce({ data: {}, error: null });
    expect(await call('code', { email: 'alex@example.com', captchaToken: 't' })).toMatchObject({ status: 200, body: { ok: true } });
    expect(auth.signInWithOtp).toHaveBeenCalledWith({ email: 'alex@example.com', options: { shouldCreateUser: false, captchaToken: 't' } });
    auth.signInWithOtp.mockResolvedValueOnce(failure('otp_disabled'));
    expect(await call('code', { email: 'nobody@example.com' })).toMatchObject({ status: 200, body: { ok: true } });
    auth.signInWithOtp.mockResolvedValueOnce(failure('captcha_failed'));
    expect(await call('code', { email: 'alex@example.com' })).toMatchObject({ status: 400, body: { error: CHECK_FAILED } });
    auth.resetPasswordForEmail.mockResolvedValueOnce({ data: {}, error: null });
    expect(await call('reset', { email: 'alex@example.com', captchaToken: 't' })).toMatchObject({ status: 200, body: { ok: true } });
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('alex@example.com', { captchaToken: 't' });
    auth.resetPasswordForEmail.mockResolvedValueOnce(failure('user_not_found'));
    expect(await call('reset', { email: 'nobody@example.com' })).toMatchObject({ status: 200, body: { ok: true } });
  });

  it('verify: a six-digit code of a known type signs in; the welcome goes once, at a confirmed sign-up alone; a wrong code gets one message', async () => {
    auth.verifyOtp.mockImplementationOnce(session);
    const signup = await call('verify', { email: 'alex@example.com', token: ' 123 456 ', type: 'signup', next: '/f1' });
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'alex@example.com', token: '123456', type: 'signup' });
    expect(signup).toMatchObject({ status: 200, body: { ok: true, next: '/f1' }, cookies: ['pd-session=tokens', 'pd_signed_in=1'] });
    expect(sendWelcomeEmail).toHaveBeenCalledWith({ id: 'u1', email: 'alex@example.com', name: 'Alex Driver' });
    auth.verifyOtp.mockImplementationOnce(session);
    await call('verify', { email: 'alex@example.com', token: '123456', type: 'email' });
    expect(sendWelcomeEmail).toHaveBeenCalledTimes(1);
    auth.verifyOtp.mockResolvedValueOnce(failure('otp_expired'));
    expect(await call('verify', { email: 'alex@example.com', token: '123456', type: 'recovery' })).toMatchObject({ status: 400, body: { error: BAD_CODE } });
    expect(await call('verify', { email: 'alex@example.com', token: '12345', type: 'email' })).toMatchObject({ status: 400, body: { error: BAD_CODE } });
    expect(await call('verify', { email: 'alex@example.com', token: '123456', type: 'magiclink' })).toMatchObject({ status: 400, body: { error: BAD_CODE } });
    expect(auth.verifyOtp).toHaveBeenCalledTimes(3);
  });

  it('sign-up: a name, an address and a password of eight; the code step follows; a taken address is answered as a fresh one', async () => {
    auth.signUp.mockResolvedValueOnce({ data: { user: { id: 'u2' }, session: null }, error: null });
    const ok = await call('sign-up', { name: ' Bo Rider ', email: 'bo@example.com', password: 'eight-ch', captchaToken: 't', next: '/f1' });
    expect(auth.signUp).toHaveBeenCalledWith({ email: 'bo@example.com', password: 'eight-ch', options: { data: { full_name: 'Bo Rider' }, captchaToken: 't' } });
    expect(ok).toMatchObject({ status: 200, body: { ok: true, confirm: true, next: '/f1' } });
    expect((await call('sign-up', { email: 'bo@example.com', password: 'eight-ch' })).body.error).toMatch(/name/);
    expect((await call('sign-up', { name: 'Bo', email: 'bo@example.com', password: 'seven-c' })).body.error).toMatch(/8 characters/);
    auth.signUp.mockResolvedValueOnce(failure('user_already_exists'));
    expect(await call('sign-up', { name: 'Bo', email: 'bo@example.com', password: 'eight-ch' })).toMatchObject({ status: 200, body: { ok: true, confirm: true } });
    auth.signUp.mockResolvedValueOnce(failure('weak_password'));
    expect((await call('sign-up', { name: 'Bo', email: 'bo@example.com', password: 'eight-ch' })).body.error).toMatch(/stronger/);
    auth.signUp.mockImplementationOnce(session);
    expect((await call('sign-up', { name: 'Bo', email: 'bo@example.com', password: 'eight-ch' })).body).toMatchObject({ ok: true, confirm: false });
  });

  it('google: the ID token and the raw nonce go to the provider; sign-out clears the session, everywhere when asked', async () => {
    auth.signInWithIdToken.mockImplementationOnce(session);
    const ok = await call('google', { credential: 'jwt', nonce: 'raw', next: '/settings' });
    expect(auth.signInWithIdToken).toHaveBeenCalledWith({ provider: 'google', token: 'jwt', nonce: 'raw' });
    expect(ok).toMatchObject({ status: 200, body: { ok: true, next: '/settings' }, cookies: ['pd-session=tokens', 'pd_signed_in=1'] });
    auth.signInWithIdToken.mockResolvedValueOnce(failure('bad_id_token'));
    expect((await call('google', { credential: 'jwt' })).status).toBe(400);
    expect((await call('google', {})).status).toBe(400);
    auth.signOut.mockImplementation(async () => {
      jar?.setAll(withSessionRules([{ name: 'pd-session', value: '', options: { path: '/', maxAge: 0 } }], true));
      return { error: null };
    });
    expect(await call('sign-out', {})).toMatchObject({ status: 200, body: { ok: true }, cookies: ['pd-session=', 'pd_signed_in='] });
    expect(auth.signOut).toHaveBeenLastCalledWith({ scope: 'local' });
    await call('sign-out', { everywhere: true });
    expect(auth.signOut).toHaveBeenLastCalledWith({ scope: 'global' });
    auth.signOut.mockRejectedValueOnce(new Error('no session'));
    expect((await call('sign-out', {})).status).toBe(200);
  });
});
