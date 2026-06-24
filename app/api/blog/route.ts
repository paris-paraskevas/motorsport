import { NextResponse, after } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';
import { ensureAppUser } from '@/lib/betting/credits';
import { setDisplayNameIfMissing, clerkDisplayName } from '@/lib/betting/friends';
import { isAdmin } from '@/lib/threads';
import { createDraft, listPosts } from '@/lib/blog';
import { notifyAdminsDraftReady } from '@/lib/blog-notify';
import { listSeriesSlugs } from '@/lib/series';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET = the admin review queues (drafts + scheduled). 401/403 for non-admins, so
// the client moderation panel self-hides.
export async function GET() {
  if (!isBettingConfigured()) return NextResponse.json({ drafts: [], scheduled: [] });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isAdmin(await currentUser())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  try {
    const [drafts, scheduled] = await Promise.all([listPosts('draft'), listPosts('approved')]);
    return NextResponse.json({ drafts, scheduled });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'unknown' }, { status: 500 });
  }
}

// POST = create a draft post (admin only). Lands `draft`; an admin then approves
// it with a publish_at and the publish-posts cron flips it live. Fires the
// "draft ready" admin push off the critical path — covers the hand-authored
// path (the headless scripts/draft-post path fires it directly).
export async function POST(req: Request) {
  if (!isBettingConfigured()) return NextResponse.json({ error: 'not available' }, { status: 503 });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isAdmin(await currentUser())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let body: {
    slug?: unknown;
    title?: unknown;
    summary?: unknown;
    body?: unknown;
    seriesSlug?: unknown;
    heroImage?: unknown;
    publishAt?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  // Optional series tag — validated against real slugs; unknown silently drops to untagged.
  const rawSlug = str(body.seriesSlug).trim();
  const seriesSlug = rawSlug && (await listSeriesSlugs()).includes(rawSlug) ? rawSlug : null;

  try {
    await ensureAppUser(userId);
    const id = await createDraft(userId, {
      slug: str(body.slug),
      title: str(body.title),
      summary: str(body.summary),
      body: str(body.body),
      seriesSlug,
      heroImage: str(body.heroImage) || null,
      publishAt: typeof body.publishAt === 'string' ? body.publishAt : null,
    });
    after(async () => {
      try {
        await setDisplayNameIfMissing(userId, clerkDisplayName(await currentUser()));
      } catch {
        /* best-effort */
      }
      await notifyAdminsDraftReady({ id, title: str(body.title) });
    });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'could not create draft';
    const domain = /must be|already exists|required/i.test(message);
    return NextResponse.json({ ok: false, error: message }, { status: domain ? 422 : 500 });
  }
}
