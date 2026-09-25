import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

type Jar = { getAll: () => { name: string; value: string }[]; setAll: (list: { name: string; value: string; options: Record<string, unknown> }[], extra?: Record<string, string>) => void };
let session: { claims: Record<string, unknown> | null; refresh?: boolean } = { claims: null };
const authClient = vi.fn(({ cookies }: { cookies: Jar }) => ({
  auth: {
    getClaims: async () => {
      if (session.refresh) cookies.setAll(withSessionRules([{ name: 'pd-session', value: 'fresh', options: { path: '/', sameSite: 'lax', httpOnly: true, secure: true, maxAge: 100 } }], true), { 'Cache-Control': 'private, no-store' });
      return session.claims ? { data: { claims: session.claims }, error: null } : { data: null, error: { message: 'invalid' } };
    },
  },
}));
vi.mock('@/lib/auth/supabase', async importOriginal => ({ ...(await importOriginal<typeof import('@/lib/auth/supabase')>()), authClient: (input: { cookies: Jar }) => authClient(input) }));

import { withSessionRules } from '@/lib/auth/supabase';
import middleware from './middleware';

// The middleware over Supabase Auth (PA A3): the session first, the refreshed cookies on every response kind, the
// dev host's lock failing closed, the user-scoped APIs' 404 without a session.
const at = (path: string, { host = 'paddock-tracker.com', cookie }: { host?: string; cookie?: string } = {}) =>
  new NextRequest(`https://${host}${path}`, { headers: { host, ...(cookie ? { cookie } : {}) } });
const admin = { sub: 'u1', app_metadata: { role: 'admin', legacy_id: 'user_1' } };
const reader = { sub: 'u2', app_metadata: {} };
const signedIn = 'pd-session=tokens; theme=dark';

describe('the middleware (PA A3)', () => {
  afterEach(() => {
    session = { claims: null };
    authClient.mockClear();
  });

  it('an anonymous request never reaches Supabase and passes through with no cookie set', async () => {
    const res = await middleware(at('/settings', { cookie: 'theme=dark' }));
    expect(authClient).not.toHaveBeenCalled();
    expect(res.headers.get('x-middleware-next')).toBe('1');
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it('a request with a session cookie has its token verified with the reader’s address forwarded; a refresh rides on the request downstream and on the response, each cookie in its own header, with the library’s headers', async () => {
    session = { claims: reader, refresh: true };
    const req = new NextRequest('https://paddock-tracker.com/settings', { headers: { host: 'paddock-tracker.com', cookie: signedIn, 'cf-connecting-ip': '203.0.113.9' } });
    const res = await middleware(req);
    expect(authClient).toHaveBeenCalledWith(expect.objectContaining({ ip: '203.0.113.9' }));
    expect(res.headers.get('x-middleware-next')).toBe('1');
    const set = res.headers.getSetCookie();
    expect(set.map(c => c.split('=')[0])).toEqual(['pd-session', 'pd_signed_in']);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('x-middleware-request-cookie')).toContain('pd-session=fresh');
    expect(res.headers.get('x-middleware-request-cookie')).toContain('pd_signed_in=1');
  });

  it('the refreshed cookies leave on a redirect, a rewrite, a 403 and a 404 as well', async () => {
    session = { claims: reader, refresh: true };
    const redirect = await middleware(at('/series/f1?tab=results', { cookie: signedIn }));
    expect(redirect.status).toBe(308);
    expect(redirect.headers.get('location')).toBe('https://paddock-tracker.com/series/f1/results');
    expect(redirect.headers.getSetCookie()).toHaveLength(2);
    const rewrite = await middleware(at('/history/monza?sort=-points', { cookie: signedIn }));
    expect(rewrite.headers.get('x-middleware-rewrite')).toContain('/__view/');
    expect(rewrite.headers.getSetCookie()).toHaveLength(2);
    expect(rewrite.headers.get('x-middleware-request-cookie')).toContain('pd-session=fresh');
    const forbidden = await middleware(at('/admin/designer', { host: 'dev.paddock-tracker.com', cookie: signedIn }));
    expect(forbidden.status).toBe(403);
    expect(forbidden.headers.getSetCookie()).toHaveLength(2);
    session = { claims: admin, refresh: true };
    const notFound = await middleware(at('/app', { host: 'dev.paddock-tracker.com', cookie: signedIn }));
    expect(notFound.status).toBe(404);
    expect(notFound.headers.getSetCookie()).toHaveLength(2);
  });

  it('the dev host: no session goes to sign in with the way back, a reader gets 403, an admin gets the designer at the root and the admin surface alone', async () => {
    const anonymous = await middleware(at('/admin/designer?x=1', { host: 'dev.paddock-tracker.com' }));
    expect(anonymous.status).toBe(307);
    expect(anonymous.headers.get('location')).toBe('https://dev.paddock-tracker.com/sign-in?next=%2Fadmin%2Fdesigner%3Fx%3D1');
    // A cookie whose token does not verify counts as no session (the lock fails closed).
    session = { claims: null };
    expect((await middleware(at('/admin/designer', { host: 'dev.paddock-tracker.com', cookie: signedIn }))).status).toBe(307);
    session = { claims: reader };
    expect((await middleware(at('/admin/designer', { host: 'dev.paddock-tracker.com', cookie: signedIn }))).status).toBe(403);
    session = { claims: admin };
    const root = await middleware(at('/', { host: 'dev.paddock-tracker.com', cookie: signedIn }));
    expect(root.headers.get('x-middleware-rewrite')).toBe('https://dev.paddock-tracker.com/admin/designer');
    expect((await middleware(at('/admin/designer', { host: 'dev.paddock-tracker.com', cookie: signedIn }))).headers.get('x-middleware-next')).toBe('1');
    expect((await middleware(at('/api/admin/design/pages', { host: 'dev.paddock-tracker.com', cookie: signedIn }))).headers.get('x-middleware-next')).toBe('1');
    expect((await middleware(at('/f1?hm=1', { host: 'dev.paddock-tracker.com', cookie: signedIn }))).headers.get('x-middleware-next')).toBe('1');
    expect((await middleware(at('/f1', { host: 'dev.paddock-tracker.com', cookie: signedIn }))).status).toBe(404);
    // The auth pages are exempt, so a signed-out visitor can reach them.
    expect((await middleware(at('/sign-in', { host: 'dev.paddock-tracker.com' }))).headers.get('x-middleware-next')).toBe('1');
  });

  it('a user-scoped API without a session answers 404; with one it passes; the public APIs pass either way', async () => {
    expect((await middleware(at('/api/user/prefs'))).status).toBe(404);
    expect((await middleware(at('/api/push/subscribe'))).status).toBe(404);
    expect((await middleware(at('/api/account'))).headers.get('x-middleware-next')).toBe('1');
    session = { claims: reader };
    expect((await middleware(at('/api/user/prefs', { cookie: signedIn }))).headers.get('x-middleware-next')).toBe('1');
    expect((await middleware(at('/api/push/subscribe', { cookie: signedIn }))).headers.get('x-middleware-next')).toBe('1');
  });
});
