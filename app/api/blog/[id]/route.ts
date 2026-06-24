import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';
import { isAdmin } from '@/lib/threads';
import { decidePost } from '@/lib/blog';

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
