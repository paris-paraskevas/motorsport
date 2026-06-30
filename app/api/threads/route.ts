import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';
import { ensureAppUser } from '@/lib/betting/credits';
import { setDisplayNameIfMissing, clerkDisplayName } from '@/lib/betting/friends';
import { createThread, listThreads } from '@/lib/threads';
import { listSeriesSlugs } from '@/lib/series';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET = the public approved feed (empty when betting/Supabase isn't provisioned).
export async function GET() {
  if (!isBettingConfigured()) return NextResponse.json({ threads: [] });
  try {
    return NextResponse.json({ threads: await listThreads('approved') });
  } catch (err) {
    // Log the real error server-side; return a generic message so DB/PostgREST
    // internals never leak to clients (security audit).
    console.error('GET /api/threads failed:', err);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}

// POST = submit a thread (signed-in). Lands `pending` until a moderator approves.
export async function POST(req: Request) {
  if (!isBettingConfigured()) return NextResponse.json({ error: 'not available' }, { status: 503 });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { title?: unknown; body?: unknown; seriesSlug?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const title = typeof body.title === 'string' ? body.title : '';
  const text = typeof body.body === 'string' ? body.body : '';
  // Optional series tag. Validate against the real series slugs (the source of
  // truth is content/series/<slug>) and silently drop anything unknown — a stale
  // picker option shouldn't 4xx; it just lands the thread untagged.
  const rawSlug = typeof body.seriesSlug === 'string' ? body.seriesSlug.trim() : '';
  const seriesSlug = rawSlug && (await listSeriesSlugs()).includes(rawSlug) ? rawSlug : null;

  try {
    await ensureAppUser(userId);
    const id = await createThread(userId, title, text, seriesSlug);
    // Name backfill off the critical path (currentUser can fail on a fresh
    // sign-in handshake) so the author shows a name, not "Racer ####".
    after(async () => {
      try {
        await setDisplayNameIfMissing(userId, clerkDisplayName(await currentUser()));
      } catch {
        /* best-effort */
      }
    });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'could not post';
    const domain = /title must|body must/i.test(message);
    // Curated validation messages (422) stay user-facing; anything else is an
    // internal failure — log it server-side and return a generic 500 so we
    // don't leak DB/PostgREST internals (security audit).
    if (domain) return NextResponse.json({ ok: false, error: message }, { status: 422 });
    console.error('POST /api/threads failed:', err);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
