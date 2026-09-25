import { NextResponse, type NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { authClient, clientIp, hasSessionCookie, noStore, originProblem, requestJar, type SessionClaims } from '@/lib/auth/supabase';
import { betDb } from '@/lib/betting/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The person's photo (PA A3): a PNG, JPEG or WebP of at most 2 MB into the public avatars bucket under a random name
// (nobody can list the bucket; a public bucket serves a path one knows), its address on the account; DELETE takes it
// off the account and out of the bucket. The bucket's own limits (supabase/migrations/20260924200000_accounts.sql) say
// the same, so a request that slips past this file still meets them.
export const PHOTO_MAX = 2 * 1024 * 1024;
const TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const BUCKET_PATH = '/storage/v1/object/public/avatars/';

/** The object's path when an address points into the site's own bucket, else null: only those are removed. */
export function ownPhotoPath(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const i = url.indexOf(BUCKET_PATH);
  return i < 0 ? null : decodeURIComponent(url.slice(i + BUCKET_PATH.length).split('?')[0]) || null;
}

async function removeOwn(url: unknown): Promise<void> {
  const path = ownPhotoPath(url);
  if (!path) return;
  await betDb().storage.from('avatars').remove([path]).catch(() => undefined);
}

interface Session {
  answer: (out: Record<string, unknown>, status?: number) => NextResponse;
  supabase: SupabaseClient;
  claims: SessionClaims;
}

/** The request's session and the answer that carries its cookies, or the response that refuses it. */
async function withSession(req: NextRequest): Promise<Session | NextResponse> {
  const refused = originProblem(req);
  const jar = requestJar(req);
  const supabase = authClient({ cookies: jar, ip: clientIp(req) });
  const answer = (out: Record<string, unknown>, status = 200) => jar.finish(noStore(out, status));
  if (refused) return answer({ error: refused }, 403);
  const claims = hasSessionCookie(req) ? ((await supabase.auth.getClaims().catch(() => ({ data: null }))).data?.claims ?? null) : null;
  if (!claims) return answer({ error: 'Sign in first.' }, 401);
  return { answer, supabase, claims };
}

export async function POST(req: NextRequest) {
  const session = await withSession(req);
  if (session instanceof NextResponse) return session;
  const { answer, supabase, claims } = session;
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return answer({ error: 'Choose a picture.' }, 400);
  const ext = TYPES[file.type];
  if (!ext) return answer({ error: 'Use a PNG, JPEG or WebP picture.' }, 400);
  if (file.size > PHOTO_MAX) return answer({ error: 'Pictures are 2 MB at most.' }, 400);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const path = `${crypto.randomUUID()}.${ext}`;
  const store = betDb().storage.from('avatars');
  const { error } = await store.upload(path, bytes, { contentType: file.type, upsert: false });
  if (error) return answer({ error: 'The picture could not be saved. Try again.' }, 400);
  const imageUrl = store.getPublicUrl(path).data.publicUrl;
  const { error: saved } = await supabase.auth.updateUser({ data: { avatar_url: imageUrl } });
  if (saved) return answer({ error: 'The picture could not be saved. Try again.' }, 400);
  await removeOwn(claims.user_metadata?.avatar_url);
  await supabase.auth.refreshSession().catch(() => undefined);
  return answer({ ok: true, imageUrl });
}

export async function DELETE(req: NextRequest) {
  const session = await withSession(req);
  if (session instanceof NextResponse) return session;
  const { answer, supabase, claims } = session;
  const { error } = await supabase.auth.updateUser({ data: { avatar_url: null } });
  if (error) return answer({ error: 'The picture could not be removed. Try again.' }, 400);
  await removeOwn(claims.user_metadata?.avatar_url);
  await supabase.auth.refreshSession().catch(() => undefined);
  return answer({ ok: true });
}
