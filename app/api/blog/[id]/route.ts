import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { auth, currentUser } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';
import { isAdmin, isWriter } from '@/lib/threads';
import { isPushConfigured } from '@/lib/push';
import { decidePost, publishDuePosts, updatePostContent, getPostById, type PostContentPatch, type BlogPost } from '@/lib/blog';
import { announcePublishedPosts } from '@/lib/notify-blog';

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
  if (isWriter(user) && post.authorId === userId) return post;
  return NextResponse.json({ error: 'forbidden' }, { status: 403 });
}

// POST = approve/schedule or reject a post (admin, or the writer who owns it):
// { action: 'approve' | 'reject', publishAt? }. Approve schedules it (publishAt is
// an ISO string, required); the publish cron makes it live at that time. Reject is
// terminal.
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
  if (body.action !== 'approve' && body.action !== 'reject') {
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  }
  const publishAt = typeof body.publishAt === 'string' ? body.publishAt : undefined;
  try {
    await decidePost(id, userId, body.action === 'approve', publishAt);
    // If this approval made a post due now (publish_at already passed), publish +
    // notify it immediately instead of waiting for the GitHub-Actions-throttled
    // publish cron (which can lag ~2h). publishDuePosts is the status-guarded
    // once-ever flip, so the cron won't re-announce an already-published post.
    // Best-effort: the approve already succeeded and the cron is the backstop —
    // never fail the request on a publish/push hiccup.
    if (body.action === 'approve') {
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
    const domain = /required|not a draft/i.test(message);
    return NextResponse.json({ error: message }, { status: domain ? 422 : 500 });
  }
}

// PATCH = edit a post's text in place (admin, or the writer who owns it): any of
// { title?, summary?, body? }. Editable while draft or scheduled — updatePostContent
// guards status ∈ {draft, approved}, so a writer can revise right up until the post
// publishes, then it's locked. Slug, series, hero image and publish time are
// immutable in this surface (spec docs/superpowers/specs/2026-07-03-draft-inline-edit-design.md).
// Validation / status domain errors map to 422, mirroring the handler above.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isBettingConfigured()) return NextResponse.json({ error: 'not available' }, { status: 503 });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const gate = await authorizePostActor(id, userId);
  if (gate instanceof NextResponse) return gate;
  let body: { title?: unknown; summary?: unknown; body?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const patch: PostContentPatch = {};
  if (typeof body.title === 'string') patch.title = body.title;
  if (typeof body.summary === 'string') patch.summary = body.summary;
  if (typeof body.body === 'string') patch.body = body.body;
  if (patch.title === undefined && patch.summary === undefined && patch.body === undefined) {
    return NextResponse.json({ error: 'nothing to update — send title, summary and/or body' }, { status: 400 });
  }
  for (const [key, value] of Object.entries(patch)) {
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
