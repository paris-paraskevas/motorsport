import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const createServerClient = vi.fn(() => ({ auth: {} }));
vi.mock('@supabase/ssr', () => ({ createServerClient: (...args: unknown[]) => createServerClient(...(args as [])) }));

import { authClient, clientIp, hasSessionCookie, originProblem, requestJar, safeNext, SESSION_COOKIE, SIGNED_IN_COOKIE, WORKER_USER_AGENT, withSessionRules } from './supabase';

// The account seam's client factory (PA A3): the Worker's headers on every call, the cookie rules on every write, the
// request jar that carries a refresh to the response, and the two request checks the routes share.
type Captured = { url: string; key: string; options: { global: { headers: Record<string, string> }; cookieOptions: Record<string, unknown>; cookies: { encode: string; getAll: () => unknown; setAll: (list: unknown[], extra?: Record<string, string>) => void } } };
const captured = (): Captured => {
  const call = createServerClient.mock.calls.at(-1) as unknown as [string, string, Captured['options']];
  return { url: call[0], key: call[1], options: call[2] };
};
const live = { name: SESSION_COOKIE, value: 'tokens', options: { path: '/', sameSite: 'lax' as const, httpOnly: false, maxAge: 400 * 24 * 60 * 60, domain: 'paddock-tracker.com' } };
const gone = { name: SESSION_COOKIE, value: '', options: { path: '/', sameSite: 'lax' as const, httpOnly: false, maxAge: 0 } };

describe('the auth client (PA A3)', () => {
  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_test');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'legacy');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    createServerClient.mockClear();
  });

  it('sends the Worker’s User-Agent and the reader’s address, keeps the session in a tokens-only cookie of the site’s name, and prefers the secret key', () => {
    const jar = { getAll: vi.fn(() => []), setAll: vi.fn() };
    authClient({ cookies: jar, ip: '203.0.113.9', secure: true });
    const { url, key, options } = captured();
    expect([url, key]).toEqual(['https://example.supabase.co', 'sb_secret_test']);
    expect(options.global.headers).toEqual({ 'User-Agent': WORKER_USER_AGENT, 'Sb-Forwarded-For': '203.0.113.9' });
    expect(options.cookieOptions).toEqual({ name: SESSION_COOKIE, httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
    expect(options.cookies.encode).toBe('tokens-only');
    options.cookies.getAll();
    expect(jar.getAll).toHaveBeenCalled();
    authClient({ cookies: jar });
    expect(captured().options.global.headers).toEqual({ 'User-Agent': WORKER_USER_AGENT });
    vi.stubEnv('SUPABASE_SECRET_KEY', '');
    authClient({ cookies: jar });
    expect(captured().key).toBe('legacy');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    expect(() => authClient({ cookies: jar })).toThrow(/SUPABASE_SECRET_KEY/);
  });

  it('every write goes through the session rules: httpOnly, Secure as asked, Lax, host-only, the maxAge kept, the flag cookie beside a session and cleared beside its removal', () => {
    const jar = { getAll: () => [], setAll: vi.fn() };
    authClient({ cookies: jar, secure: true });
    captured().options.cookies.setAll([live], { 'Cache-Control': 'no-store' });
    expect(jar.setAll).toHaveBeenCalledWith(
      [
        { name: SESSION_COOKIE, value: 'tokens', options: { path: '/', sameSite: 'lax', httpOnly: true, secure: true, maxAge: 400 * 24 * 60 * 60 } },
        { name: SIGNED_IN_COOKIE, value: '1', options: { path: '/', sameSite: 'lax', httpOnly: false, secure: true, maxAge: 400 * 24 * 60 * 60 } },
      ],
      { 'Cache-Control': 'no-store' },
    );
    expect(withSessionRules([gone], false)).toEqual([
      { name: SESSION_COOKIE, value: '', options: { path: '/', sameSite: 'lax', httpOnly: true, secure: false, maxAge: 0 } },
      { name: SIGNED_IN_COOKIE, value: '', options: { path: '/', sameSite: 'lax', httpOnly: false, secure: false, maxAge: 0 } },
    ]);
    // A chunked write clears a stale chunk beside the live ones: the flag says signed in.
    const chunked = withSessionRules([{ ...live, name: `${SESSION_COOKIE}.0` }, { ...gone, name: `${SESSION_COOKIE}.1` }], true);
    expect(chunked.map(c => [c.name, c.value])).toEqual([[`${SESSION_COOKIE}.0`, 'tokens'], [`${SESSION_COOKIE}.1`, ''], [SIGNED_IN_COOKIE, '1']]);
    // A cookie that is not the session’s passes with the same protections and moves no flag.
    expect(withSessionRules([{ name: 'other', value: 'x', options: { maxAge: 5 } }], true)).toEqual([{ name: 'other', value: 'x', options: { maxAge: 5, httpOnly: true, secure: true, sameSite: 'lax', path: '/' } }]);
  });

  it('the request jar reads the request’s cookies, writes them onto the request for the render downstream, and puts each on the response in its own Set-Cookie with the library’s headers', () => {
    const req = new NextRequest('https://paddock-tracker.com/settings', { headers: { cookie: `${SESSION_COOKIE}=old; theme=dark` } });
    const jar = requestJar(req);
    expect(jar.getAll()).toEqual([{ name: SESSION_COOKIE, value: 'old' }, { name: 'theme', value: 'dark' }]);
    expect(hasSessionCookie(req)).toBe(true);
    jar.setAll(withSessionRules([{ ...live, value: 'new' }], true), { 'Cache-Control': 'private, no-store' });
    expect(req.cookies.get(SESSION_COOKIE)?.value).toBe('new');
    expect(req.cookies.get(SIGNED_IN_COOKIE)?.value).toBe('1');
    const res = jar.finish(NextResponse.next({ request: { headers: req.headers } }));
    const set = res.headers.getSetCookie();
    expect(set).toHaveLength(2);
    expect(set[0]).toMatch(new RegExp(`^${SESSION_COOKIE}=new; `));
    for (const attribute of [/Path=\//, /Max-Age=34560000/, /HttpOnly/i, /Secure/i, /SameSite=lax/i]) expect(set[0]).toMatch(attribute);
    expect(set[0]).not.toMatch(/Domain=/i);
    expect(set[1]).toMatch(new RegExp(`^${SIGNED_IN_COOKIE}=1;`));
    expect(set[1]).not.toMatch(/HttpOnly/i);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    // A removal leaves the request without the cookie and clears it on the response.
    jar.setAll(withSessionRules([gone], true));
    expect(req.cookies.get(SESSION_COOKIE)).toBeUndefined();
    const out = jar.finish(new NextResponse('Not found', { status: 404 }));
    expect(out.headers.getSetCookie().filter(c => c.startsWith(`${SESSION_COOKIE}=;`))).toHaveLength(1);
    expect(hasSessionCookie(new NextRequest('https://paddock-tracker.com/', { headers: { cookie: 'theme=dark' } }))).toBe(false);
  });

  it('the reader’s address, the same-site check on a write, and a safe next path', () => {
    expect(clientIp(new Request('https://x/', { headers: { 'cf-connecting-ip': '198.51.100.2', 'x-forwarded-for': '10.0.0.1, 10.0.0.2' } }))).toBe('198.51.100.2');
    expect(clientIp(new Request('https://x/', { headers: { 'x-forwarded-for': '10.0.0.1, 10.0.0.2' } }))).toBe('10.0.0.1');
    expect(clientIp(new Request('https://x/'))).toBeNull();
    const at = (headers: Record<string, string>) => originProblem(new Request('https://paddock-tracker.com/api/auth/password', { method: 'POST', headers }));
    expect(at({ origin: 'https://paddock-tracker.com', host: 'paddock-tracker.com' })).toBeNull();
    expect(at({ origin: 'https://evil.example', host: 'paddock-tracker.com' })).toMatch(/from the site itself/);
    expect(at({ host: 'paddock-tracker.com' })).toMatch(/from the site itself/);
    expect(at({ origin: 'null', host: 'paddock-tracker.com' })).toMatch(/from the site itself/);
    expect(safeNext('/settings/account')).toBe('/settings/account');
    expect(safeNext('/f1?tab=x')).toBe('/f1?tab=x');
    for (const bad of ['//evil.example', 'https://evil.example', 'settings', '/a b', '/a\\b', 7, null, undefined]) expect(safeNext(bad)).toBe('/');
  });
});
