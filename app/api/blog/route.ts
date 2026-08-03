import { NextResponse, after } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';
import { ensureAppUser } from '@/lib/betting/credits';
import { setDisplayNameIfMissing, clerkDisplayName } from '@/lib/betting/friends';
import { isAdmin, canAuthor } from '@/lib/threads';
import { createDraft, listPosts } from '@/lib/blog';
import { listSeriesSlugs } from '@/lib/series';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET = the blog console queues (drafts + scheduled). Admins see every post; a
// writer sees only their OWN (the latent authorId filter). 401/403 for everyone
// else, so the client panel self-hides.
export async function GET() {
  if (!isBettingConfigured()) return NextResponse.json({ drafts: [], scheduled: [] });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const user = await currentUser();
  const admin = isAdmin(user);
  if (!admin && !canAuthor(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  // Writers are scoped to their own posts; they can still act on what they see
  // (the [id] routes authorize each action per-post by ownership).
  const authorScope = admin ? undefined : userId;
  try {
    // Three queues now: `drafts` are private workspaces (a writer's own, or every
    // writer's for an admin), `inReview` is what awaits a decision, `scheduled` is
    // approved-and-waiting. `drafts` used to double as the review queue.
    const [drafts, inReview, scheduled] = await Promise.all([
      listPosts('draft', undefined, authorScope),
      listPosts('in_review', undefined, authorScope),
      listPosts('approved', undefined, authorScope),
    ]);
    return NextResponse.json({ drafts, inReview, scheduled, isAdmin: admin });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'unknown' }, { status: 500 });
  }
}

// POST = create a draft post (writer or admin). Lands `draft` owned by the
// creator, who (or an admin) then approves it with a publish_at so the
// publish-posts cron flips it live. Fires the "draft ready" admin push off the
// critical path — covers the hand-authored path (the headless scripts/draft-post
// path fires it directly).
export async function POST(req: Request) {
  if (!isBettingConfigured()) return NextResponse.json({ error: 'not available' }, { status: 503 });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!canAuthor(await currentUser())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let body: {
    slug?: unknown;
    title?: unknown;
    summary?: unknown;
    body?: unknown;
    seriesSlug?: unknown;
    tags?: unknown;
    heroImage?: unknown;
    originalUrl?: unknown;
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
  // Free-form tags — accept an array or a comma-separated string; createDraft
  // normalizes (lowercase kebab, dedupe, cap). Unknown-shaped input → untagged.
  const tags = Array.isArray(body.tags)
    ? (body.tags.filter(t => typeof t === 'string') as string[])
    : typeof body.tags === 'string'
      ? body.tags.split(',')
      : [];

  try {
    await ensureAppUser(userId);
    const id = await createDraft(userId, {
      slug: str(body.slug),
      title: str(body.title),
      summary: str(body.summary),
      body: str(body.body),
      seriesSlug,
      tags,
      heroImage: str(body.heroImage) || null,
      // Import provenance — createDraft validates the shape (https:// only).
      originalUrl: str(body.originalUrl) || null,
      publishAt: typeof body.publishAt === 'string' ? body.publishAt : null,
    });
    after(async () => {
      try {
        await setDisplayNameIfMissing(userId, clerkDisplayName(await currentUser()));
      } catch {
        /* best-effort */
      }
      // Deliberately NO admin notification here. Creating a draft is a private
      // act; the operator is alerted when the writer SUBMITS it (action 'submit'
      // on /api/blog/[id]). Notifying on create is what made every half-finished
      // save ping the operator, so writers stopped saving.
    });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'could not create draft';
    const domain = /must be|already exists|required/i.test(message);
    return NextResponse.json({ ok: false, error: message }, { status: domain ? 422 : 500 });
  }
}
