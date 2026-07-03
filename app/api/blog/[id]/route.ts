import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';
import { isAdmin } from '@/lib/threads';
import { decidePost, updatePostContent, type PostContentPatch } from '@/lib/blog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST = moderate a post (admin only): { action: 'approve' | 'reject', publishAt? }.
// Approve schedules it (publishAt is an ISO string, required); the publish cron
// makes it live at that time. Reject is terminal.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isBettingConfigured()) return NextResponse.json({ error: 'not available' }, { status: 503 });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isAdmin(await currentUser())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id } = await params;
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
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    const domain = /required|not a draft/i.test(message);
    return NextResponse.json({ error: message }, { status: domain ? 422 : 500 });
  }
}

// PATCH = edit a draft/scheduled post's text in place (admin only, same guards
// as POST): any of { title?, summary?, body? }. Slug, series, hero image and
// publish time are immutable in this surface (spec
// docs/superpowers/specs/2026-07-03-draft-inline-edit-design.md). Validation /
// status domain errors map to 422, mirroring the moderation handler above.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isBettingConfigured()) return NextResponse.json({ error: 'not available' }, { status: 503 });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isAdmin(await currentUser())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id } = await params;
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
