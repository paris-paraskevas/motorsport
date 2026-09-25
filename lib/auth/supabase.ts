import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { JwtPayload, SupabaseClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

// The account seam's client factory (PA A3): the one place that builds a Supabase Auth client over a request's cookies,
// for the middleware (which refreshes the session), the routes (which sign people in and out) and the server seam (which
// reads the verified claims). The browser never talks to Supabase: sessions live in httpOnly cookies the Worker alone
// reads, and the site's own routes under /api/auth and /api/account do the talking. Server code only, without the
// server-only marker: the middleware imports this module, and its bundle is not built under the marker's condition.

/** The session cookie's name (the library appends .0, .1… when a value outgrows one cookie) and the plain flag beside it
 *  that tells the browser a session exists, with no credential in it (lib/auth/client.tsx reads the same name). */
export const SESSION_COOKIE = 'pd-session';
export const SIGNED_IN_COOKIE = 'pd_signed_in';
/** The Worker's own User-Agent on every request to Supabase: a secret key that arrives with a browser's is refused. */
export const WORKER_USER_AGENT = 'paddock-worker';

/** A session's verified claims: sub, email, app_metadata (legacy_id, role, donor), user_metadata (full_name, username,
 *  avatar_url, flags), session_id. */
export type SessionClaims = JwtPayload;

export interface CookiePair {
  name: string;
  value: string;
}
export interface CookieToSet extends CookiePair {
  options: CookieOptions;
}
/** Where a client reads and writes its cookies: the request's jar in the middleware and the routes, Next's store in a page. */
export interface CookieJar {
  getAll(): CookiePair[];
  setAll(cookies: CookieToSet[], headers?: Record<string, string>): void;
}

/** The names of a session cookie and its chunks. */
export function isSessionCookie(name: string): boolean {
  return name === SESSION_COOKIE || name.startsWith(`${SESSION_COOKIE}.`);
}

/** The project's address and the Worker's key. The secret key (sb_secret_…, a Worker secret) drives every request; the
 *  legacy service-role key stands in until it is set, since Supabase honours both. Names alone are ever printed. */
export function authConfig(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Auth not configured: set SUPABASE_URL and SUPABASE_SECRET_KEY');
  return { url, key };
}

export function isAuthConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));
}

/** A cookie's options as Next's cookie stores take them (the library's carry a serializer's `encode` too). */
export function nextCookieOptions(options: CookieOptions): Omit<CookieOptions, 'encode'> {
  const out = { ...options };
  delete out.encode;
  return out;
}

/** The cookies the library hands, under the site's rules: every session cookie httpOnly, Secure where asked, SameSite=Lax,
 *  host-only (no Domain: a cookie for the parent domain would travel to Clerk's hostnames while they stay for the way
 *  back) and on the root path, with its name, value and maxAge exactly as handed (maxAge 0 clears at sign-out); and the
 *  flag cookie set beside a session, cleared beside its removal. */
export function withSessionRules(cookies: CookieToSet[], secure: boolean): CookieToSet[] {
  const out: CookieToSet[] = [];
  let flag: 'set' | 'clear' | null = null;
  let base: CookieOptions | null = null;
  for (const c of cookies) {
    const options = nextCookieOptions({ ...c.options, httpOnly: true, secure, sameSite: 'lax', path: '/' });
    delete options.domain;
    out.push({ name: c.name, value: c.value, options });
    if (!isSessionCookie(c.name)) continue;
    const cleared = c.value === '' || c.options.maxAge === 0;
    // A chunked write clears the stale chunks beside the new ones: any live session cookie means a session.
    if (!cleared) {
      flag = 'set';
      base = options;
    } else if (flag !== 'set') {
      flag = 'clear';
      base = base ?? options;
    }
  }
  if (flag === 'set') out.push({ name: SIGNED_IN_COOKIE, value: '1', options: { ...base, httpOnly: false } });
  if (flag === 'clear') out.push({ name: SIGNED_IN_COOKIE, value: '', options: { ...base, httpOnly: false, maxAge: 0 } });
  return out;
}

export interface AuthClientInput {
  cookies: CookieJar;
  /** The reader's address, forwarded to Supabase so its per-address limits count readers, not the Worker. */
  ip?: string | null;
  /** Secure cookies: production's default; the local server runs on http. */
  secure?: boolean;
}

/** One client per request, never shared: over the request's cookies, with the Worker's User-Agent and the reader's
 *  address on every call, and the session in a tokens-only cookie the browser cannot read. */
export function authClient({ cookies, ip, secure = process.env.NODE_ENV === 'production' }: AuthClientInput): SupabaseClient {
  const { url, key } = authConfig();
  const headers: Record<string, string> = { 'User-Agent': WORKER_USER_AGENT };
  if (ip) headers['Sb-Forwarded-For'] = ip;
  return createServerClient(url, key, {
    global: { headers },
    cookieOptions: { name: SESSION_COOKIE, httpOnly: true, secure, sameSite: 'lax', path: '/' },
    cookies: {
      encode: 'tokens-only',
      getAll: () => cookies.getAll(),
      setAll: (list, extra) => cookies.setAll(withSessionRules(list, secure), extra),
    },
  });
}

export interface RequestJar extends CookieJar {
  /** The cookies written so far. */
  readonly pending: CookieToSet[];
  /** Every pending cookie in its own Set-Cookie, and the library's headers, on the response that goes out. */
  finish<T extends NextResponse>(res: T): T;
}

/** A request's cookies as a jar: reads from the request; a write lands on the request too (so a rewrite or a pass-through
 *  built with `{ request: { headers } }` renders with the refreshed session) and waits for finish() to reach the response. */
export function requestJar(req: NextRequest): RequestJar {
  const pending: CookieToSet[] = [];
  let extra: Record<string, string> = {};
  return {
    pending,
    getAll: () => req.cookies.getAll().map(({ name, value }) => ({ name, value })),
    setAll: (cookies, headers) => {
      for (const c of cookies) {
        pending.push(c);
        if (c.value === '' || c.options.maxAge === 0) req.cookies.delete(c.name);
        else req.cookies.set(c.name, c.value);
      }
      if (headers) extra = { ...extra, ...headers };
    },
    finish(res) {
      for (const c of pending) res.cookies.set(c.name, c.value, nextCookieOptions(c.options));
      for (const [k, v] of Object.entries(extra)) res.headers.set(k, v);
      return res;
    },
  };
}

/** Whether the request carries a session cookie at all: an anonymous request never reaches Supabase. */
export function hasSessionCookie(req: NextRequest): boolean {
  return req.cookies.getAll().some(c => isSessionCookie(c.name));
}

/** The reader's address as Cloudflare hands it, else the first forwarded one; null when neither is present. */
export function clientIp(req: Request): string | null {
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
}

/** A write from the site itself: the Origin the browser sends must name the host the request reached. The problem when
 *  it does not (or is missing: browsers send it on every cross-site and same-site POST), null when it does. */
export function originProblem(req: Request): string | null {
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  const refused = 'This request must come from the site itself';
  if (!origin || !host) return refused;
  try {
    return new URL(origin).host === host ? null : refused;
  } catch {
    return refused;
  }
}

/** Where to go after a sign-in: a path of this site alone (never a scheme, a host or a protocol-relative one), else Home. */
export function safeNext(value: unknown): string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !/[\s\\]/.test(value) ? value : '/';
}

/** An address's shape (the provider checks the rest) and the shortest password the site takes. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_MIN = 8;

/** A text field of a request body: trimmed and capped; '' when absent or not a string. */
export function field(value: unknown, max = 200): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/** A JSON answer no cache may keep: every auth and account answer is the person's own. */
export function noStore(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

/** Turnstile's check, done here: Supabase Auth skips its own captcha check for requests made with the secret key (proven
 *  against prod on 2026-09-25: no token and a bad token both answered invalid_credentials), so the Worker asks
 *  Cloudflare's siteverify itself. Without TURNSTILE_SECRET (a preview without the widget) the check is off, as the
 *  widget is; with it, a missing or refused token fails. Cloudflare's endpoint is unreachable: refused too. */
export async function turnstilePasses(token: string | undefined, ip: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) return true;
  if (!token) return false;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
    });
    const body = (await res.json()) as { success?: boolean };
    return body.success === true;
  } catch {
    return false;
  }
}
