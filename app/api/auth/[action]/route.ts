import type { NextRequest } from 'next/server';
import { authClient, clientIp, EMAIL_RE, field, noStore, originProblem, PASSWORD_MIN, requestJar, safeNext } from '@/lib/auth/supabase';
import { accountFromClaims } from '@/lib/auth/server';
import { sendWelcomeEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The sign-in routes (PA A3), POST only, each answered as JSON the site's own forms read: the browser never talks to
// Supabase, so the session's cookies are set here and stay out of the page's scripts. Every action checks the request
// came from the site itself (its Origin names the host). Wrong credentials get one message that never says which part
// was wrong, and `code` and `reset` answer an unknown address exactly as a known one, so no form tells a stranger who
// has an account. A username typed where the address goes is answered as such: sign-in is by address alone.
const ACTIONS = new Set(['password', 'code', 'verify', 'sign-up', 'reset', 'nonce', 'google', 'sign-out']);
const VERIFY_TYPES = new Set(['email', 'signup', 'recovery', 'email_change']);
export const WRONG_CREDENTIALS = 'Wrong email or password.';
export const USE_EMAIL = 'Sign in with your email address.';
export const BAD_CODE = 'That code did not work. Check it, or send a new one.';
export const CHECK_FAILED = 'The check did not pass. Try again.';
export const GOOGLE_FAILED = 'Google sign-in did not work. Try again.';
/** The Google nonce's cookie: minted by `nonce`, read back by `google`, so a captured ID token cannot be replayed from
 *  another browser (Google gets the SHA-256 as the button's data-nonce; Supabase checks the token carries it). */
export const NONCE_COOKIE = 'pd_google_nonce';
const NONCE_MAX_AGE = 600;

type VerifyType = 'email' | 'signup' | 'recovery' | 'email_change';

const nonceCookie = (value: string, maxAge: number) => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge, value });

/** 32 random bytes as base64url (no character a cookie would encode), and their SHA-256 as hex. */
export async function mintNonce(): Promise<{ raw: string; hashed: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return { raw, hashed };
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  if (!ACTIONS.has(action)) return noStore({ error: 'Unknown action' }, 404);
  const refused = originProblem(req);
  if (refused) return noStore({ error: refused }, 403);
  const body: Record<string, unknown> = ((await req.json().catch(() => null)) as Record<string, unknown> | null) ?? {};
  const jar = requestJar(req);
  const supabase = authClient({ cookies: jar, ip: clientIp(req) });
  const answer = (payload: Record<string, unknown>, status = 200) => jar.finish(noStore(payload, status));
  const captchaToken = field(body.captchaToken, 4096) || undefined;
  const email = field(body.email, 254).toLowerCase();
  const next = safeNext(body.next);
  const needsEmail = action === 'password' || action === 'code' || action === 'sign-up' || action === 'reset' || action === 'verify';
  if (needsEmail && !EMAIL_RE.test(email)) return answer({ error: USE_EMAIL }, 400);

  switch (action) {
    case 'password': {
      const password = typeof body.password === 'string' ? body.password : '';
      if (!password) return answer({ error: WRONG_CREDENTIALS }, 400);
      const { error } = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken } });
      if (error?.code === 'email_not_confirmed') return answer({ error: 'Confirm your email first: ask for a code.', unconfirmed: true }, 400);
      if (error) return answer({ error: error.code === 'captcha_failed' ? CHECK_FAILED : WRONG_CREDENTIALS }, 400);
      return answer({ ok: true, next });
    }
    case 'code': {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false, captchaToken } });
      if (error?.code === 'captcha_failed') return answer({ error: CHECK_FAILED }, 400);
      return answer({ ok: true });
    }
    case 'reset': {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { captchaToken });
      if (error?.code === 'captcha_failed') return answer({ error: CHECK_FAILED }, 400);
      return answer({ ok: true });
    }
    case 'verify': {
      const token = field(body.token, 12).replace(/\s+/g, '');
      const type = field(body.type, 20);
      if (!/^\d{6}$/.test(token) || !VERIFY_TYPES.has(type)) return answer({ error: BAD_CODE }, 400);
      const { data, error } = await supabase.auth.verifyOtp({ email, token, type: type as VerifyType });
      if (error || !data.session) return answer({ error: BAD_CODE }, 400);
      if (type === 'signup' && data.user) {
        const account = accountFromClaims({ sub: data.user.id, email: data.user.email, app_metadata: data.user.app_metadata, user_metadata: data.user.user_metadata });
        if (account?.email) await sendWelcomeEmail({ id: account.id, email: account.email, name: account.name });
      }
      return answer({ ok: true, next });
    }
    case 'sign-up': {
      const name = field(body.name, 80);
      const password = typeof body.password === 'string' ? body.password : '';
      if (!name) return answer({ error: 'Tell us your name.' }, 400);
      if (password.length < PASSWORD_MIN) return answer({ error: `Use at least ${PASSWORD_MIN} characters for the password.` }, 400);
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name }, captchaToken } });
      if (error?.code === 'captcha_failed') return answer({ error: CHECK_FAILED }, 400);
      if (error?.code === 'weak_password') return answer({ error: 'Choose a stronger password.' }, 400);
      // An address already taken is answered as a fresh one (the provider says so too when asked), so nothing here tells
      // a stranger who has an account; the person finds their way through Sign in or a code.
      if (error && error.code !== 'user_already_exists') return answer({ error: 'The account could not be created. Try again.' }, 400);
      return answer({ ok: true, confirm: !data?.session, next });
    }
    case 'nonce': {
      const { raw, hashed } = await mintNonce();
      const res = jar.finish(noStore({ ok: true, hashed }));
      const { value, ...options } = nonceCookie(raw, NONCE_MAX_AGE);
      res.cookies.set(NONCE_COOKIE, value, options);
      return res;
    }
    case 'google': {
      const credential = field(body.credential, 4096);
      const nonce = req.cookies.get(NONCE_COOKIE)?.value;
      if (!credential || !nonce) return answer({ error: GOOGLE_FAILED }, 400);
      const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: credential, nonce });
      const res = error ? answer({ error: GOOGLE_FAILED }, 400) : answer({ ok: true, next });
      const { value, ...options } = nonceCookie('', 0);
      res.cookies.set(NONCE_COOKIE, value, options);
      return res;
    }
    case 'sign-out': {
      await supabase.auth.signOut({ scope: body.everywhere === true ? 'global' : 'local' }).catch(() => undefined);
      return answer({ ok: true });
    }
    default:
      return noStore({ error: 'Unknown action' }, 404);
  }
}
