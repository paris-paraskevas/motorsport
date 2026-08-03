import { NextResponse, after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { auth, currentUser } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';
import { isAdmin, canAuthor } from '@/lib/threads';
import { isPushConfigured } from '@/lib/push';
import { decidePost, reschedulePost, submitPost, publishDuePosts, updatePostContent, getPostById, type PostContentPatch, type BlogPost } from '@/lib/blog';
import { announcePublishedPosts } from '@/lib/notify-blog';
import { notifyAdminsDraftReady, notifyAuthorDecision } from '@/lib/blog-notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Writer/admin authz for a specific post. Admins act on any post; a writer only
// on their OWN (post.author_id === userId). The `post` table is service-role-only
// (no RLS policies), so this ownership check IS the security boundary. Returns the
// post on success, or the NextResponse to send on failure.
async function authorizePostActor(id: string, userId: string): Promise<BlogPost | NextResponse> {
  const post = await getPostById(id);
  if (!post) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const user = await currentUser();
  if (isAdmin(user)) return post;
  if (canAuthor(user) && post.authorId === userId) return post;
  return NextResponse.json({ error: 'forbidden' }, { status: 403 });
}

// POST = approve/schedule, reject, or re-schedule a post (admin, or the writer who
// owns it): { action: 'approve' | 'reject' | 'reschedule', publishAt? }. Approve
// schedules a draft (publishAt is an ISO string, required); reschedule moves an
// already-scheduled (approved, not-yet-live) post to a new publishAt; the publish
// cron makes it live at that time. Reject is terminal.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isBettingConfigured()) return NextResponse.json({ error: 'not available' }, { status: 503 });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const gate = await authorizePostActor(id, userId);
  if (gate instanceof NextResponse) return gate;
  let body: { action?: unknown; publishAt?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  if (
    body.action !== 'approve' &&
    body.action !== 'reject' &&
    body.action !== 'reschedule' &&
    body.action !== 'submit'
  ) {
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  }
  // Only an admin decides. A writer may submit their own post (authorizePostActor
  // already proved ownership) but must not approve or reject it — that separation
  // is the whole point of the review state.
  if (body.action !== 'submit' && !isAdmin(await currentUser())) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const publishAt = typeof body.publishAt === 'string' ? body.publishAt : undefined;
  try {
    if (body.action === 'submit') {
      const submitted = await submitPost(id);
      // Off the critical path: the submission is already committed, and a notify
      // hiccup must not fail it. This is the ONLY path that alerts the operator —
      // creating a draft deliberately does not.
      after(async () => {
        try {
          await notifyAdminsDraftReady({ id: submitted.id, title: submitted.title });
        } catch (e) {
          console.error('submit notify failed:', e);
        }
      });
      return NextResponse.json({ ok: true, status: submitted.status });
    }
    if (body.action === 'reschedule') {
      if (!publishAt) return NextResponse.json({ error: 'publishAt required to reschedule' }, { status: 422 });
      await reschedulePost(id, publishAt);
    } else {
      await decidePost(id, userId, body.action === 'approve', publishAt);
      // Tell the author what happened, with the scheduled time. Previously nothing
      // did, so a writer had to poll the console to find out.
      const decided = gate;
      after(async () => {
        try {
          await notifyAuthorDecision({
            id: decided.id,
            title: decided.title,
            slug: decided.slug,
            authorId: decided.authorId,
            approved: body.action === 'approve',
            publishAt: publishAt ?? decided.publishAt,
          });
        } catch (e) {
          console.error('author decision notify failed:', e);
        }
      });
    }
    // Approving OR re-scheduling can leave a post due now (publish_at in the past)
    // — publish + notify it immediately instead of waiting for the
    // GitHub-Actions-throttled publish cron (which can lag ~2h). publishDuePosts is
    // the status-guarded once-ever flip, so the cron won't re-announce it.
    // Best-effort: the action already succeeded and the cron is the backstop —
    // never fail the request on a publish/push hiccup.
    if (body.action === 'approve' || body.action === 'reschedule') {
      try {
        const published = await publishDuePosts(new Date());
        if (published.length > 0) {
          revalidatePath('/blog');
          for (const p of published) revalidatePath(`/blog/${p.slug}`);
          if (isPushConfigured()) await announcePublishedPosts(published);
        }
      } catch (e) {
        console.error('inline publish-on-approve failed (cron will retry):', e);
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    const domain = /required|not a draft|not scheduled/i.test(message);
    return NextResponse.json({ error: message }, { status: domain ? 422 : 500 });
  }
}

// PATCH = edit a post's text/cover in place (admin, or the writer who owns it): any
// of { title?, summary?, body?, heroImage? }. heroImage is an https:// or
// root-relative URL; null or '' clears it (shape enforced in updatePostContent).
// Editable while draft or scheduled — updatePostContent guards status ∈
// {draft, approved}, so a writer can revise right up until the post publishes,
// then it's locked. Slug, series and publish time remain immutable in this surface
// (spec docs/superpowers/specs/2026-07-03-draft-inline-edit-design.md; hero made
// editable 0.230.0). Validation / status domain errors map to 422, mirroring the
// handler above.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isBettingConfigured()) return NextResponse.json({ error: 'not available' }, { status: 503 });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const gate = await authorizePostActor(id, userId);
  if (gate instanceof NextResponse) return gate;
  let body: { title?: unknown; summary?: unknown; body?: unknown; heroImage?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const patch: PostContentPatch = {};
  if (typeof body.title === 'string') patch.title = body.title;
  if (typeof body.summary === 'string') patch.summary = body.summary;
  if (typeof body.body === 'string') patch.body = body.body;
  // heroImage: '' and null both mean "clear" — normalized to null in lib/blog.
  if (typeof body.heroImage === 'string' || body.heroImage === null) patch.heroImage = body.heroImage;
  if (
    patch.title === undefined &&
    patch.summary === undefined &&
    patch.body === undefined &&
    patch.heroImage === undefined
  ) {
    return NextResponse.json(
      { error: 'nothing to update — send title, summary, body and/or heroImage' },
      { status: 400 },
    );
  }
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'heroImage') continue; // blank/null = clear, not an error
    if (!String(value).trim()) {
      return NextResponse.json({ error: `${key} must not be empty` }, { status: 400 });
    }
  }
  try {
    await updatePostContent(id, patch);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    const domain = /must be|required|not editable/i.test(message);
    return NextResponse.json({ error: message }, { status: domain ? 422 : 500 });
  }
}
