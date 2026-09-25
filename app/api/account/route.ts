import type { NextRequest } from 'next/server';
import { authClient, clientIp, EMAIL_RE, field, hasSessionCookie, noStore, originProblem, PASSWORD_MIN, requestJar, type SessionClaims } from '@/lib/auth/supabase';
import { accountFromClaims, flagsFromClaims } from '@/lib/auth/server';
import { betDb } from '@/lib/betting/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The person's own account (PA A3): what the browser reads to know who is signed in (GET, asked only when the flag cookie
// says a session exists), the edits of the Account page (PATCH: name, email, password, the browser's flags), and the
// deletion (DELETE, after the person typed the words). Every write checks the request came from the site itself. The
// edits act through the session; the deletion acts on the session's own Supabase id (sub), never the app id, which for
// an imported account is a Clerk id the provider does not know.
export const DELETE_WORDS = 'Delete account';
export const FLAGS_MAX = 50;

const providersOf = (claims: SessionClaims): string[] => {
  const list = claims.app_metadata?.providers;
  return Array.isArray(list) ? list.filter((p): p is string => typeof p === 'string') : [];
};
const payload = (claims: SessionClaims) => ({ account: accountFromClaims(claims), flags: flagsFromClaims(claims), providers: providersOf(claims) });

export async function GET(req: NextRequest) {
  const jar = requestJar(req);
  const claims = hasSessionCookie(req) ? ((await authClient({ cookies: jar, ip: clientIp(req) }).auth.getClaims().catch(() => ({ data: null }))).data?.claims ?? null) : null;
  return jar.finish(noStore(claims ? payload(claims) : { account: null, flags: null, providers: [] }));
}

export async function PATCH(req: NextRequest) {
  const refused = originProblem(req);
  if (refused) return noStore({ error: refused }, 403);
  const body: Record<string, unknown> = ((await req.json().catch(() => null)) as Record<string, unknown> | null) ?? {};
  const jar = requestJar(req);
  const supabase = authClient({ cookies: jar, ip: clientIp(req) });
  const answer = (out: Record<string, unknown>, status = 200) => jar.finish(noStore(out, status));
  const claims = hasSessionCookie(req) ? ((await supabase.auth.getClaims().catch(() => ({ data: null }))).data?.claims ?? null) : null;
  if (!claims) return answer({ error: 'Sign in first.' }, 401);

  const attributes: { email?: string; password?: string; data?: Record<string, unknown> } = {};
  const data: Record<string, unknown> = {};
  if ('name' in body) {
    const name = field(body.name, 80);
    if (!name) return answer({ error: 'Tell us your name.' }, 400);
    data.full_name = name;
  }
  if ('flags' in body) {
    const flags = body.flags;
    if (!flags || typeof flags !== 'object' || Array.isArray(flags)) return answer({ error: 'Flags are an object.' }, 400);
    const merged = { ...flagsFromClaims(claims), ...(flags as Record<string, unknown>) };
    if (Object.keys(merged).length > FLAGS_MAX) return answer({ error: `At most ${FLAGS_MAX} flags.` }, 400);
    data.flags = merged;
  }
  if ('email' in body) {
    const email = field(body.email, 254).toLowerCase();
    if (!EMAIL_RE.test(email)) return answer({ error: 'Use a full email address.' }, 400);
    attributes.email = email;
  }
  if ('password' in body) {
    const password = typeof body.password === 'string' ? body.password : '';
    if (password.length < PASSWORD_MIN) return answer({ error: `Use at least ${PASSWORD_MIN} characters for the password.` }, 400);
    attributes.password = password;
  }
  if (Object.keys(data).length > 0) attributes.data = data;
  if (Object.keys(attributes).length === 0) return answer({ error: 'Nothing to change.' }, 400);

  const { error } = await supabase.auth.updateUser(attributes);
  if (error) {
    const message = error.code === 'weak_password' ? 'Choose a stronger password.' : error.code === 'email_exists' ? 'That address is already in use.' : 'The change could not be saved. Try again.';
    return answer({ error: message }, 400);
  }
  // The claims follow the change at once: a fresh token in the cookies and in the answer.
  await supabase.auth.refreshSession().catch(() => undefined);
  const fresh = (await supabase.auth.getClaims().catch(() => ({ data: null }))).data?.claims ?? claims;
  return answer({ ok: true, ...payload(fresh), ...(attributes.email ? { confirm: 'email_change', email: attributes.email } : {}) });
}

export async function DELETE(req: NextRequest) {
  const refused = originProblem(req);
  if (refused) return noStore({ error: refused }, 403);
  const body: Record<string, unknown> = ((await req.json().catch(() => null)) as Record<string, unknown> | null) ?? {};
  const jar = requestJar(req);
  const supabase = authClient({ cookies: jar, ip: clientIp(req) });
  const answer = (out: Record<string, unknown>, status = 200) => jar.finish(noStore(out, status));
  if (body.confirm !== DELETE_WORDS) return answer({ error: `Type "${DELETE_WORDS}" to confirm.` }, 400);
  const claims = hasSessionCookie(req) ? ((await supabase.auth.getClaims().catch(() => ({ data: null }))).data?.claims ?? null) : null;
  if (!claims) return answer({ error: 'Sign in first.' }, 401);
  const { error } = await betDb().auth.admin.deleteUser(claims.sub);
  if (error) return answer({ error: 'The account could not be deleted. Try again.' }, 400);
  // The session's cookies leave with the account (the provider's 404 for a gone user is tolerated by the client).
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  return answer({ ok: true });
}
