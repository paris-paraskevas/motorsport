import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';
import { ensureAppUser } from '@/lib/betting/credits';
import { sendFriendRequest, respondToFriendRequest, searchUsers, removeFriend } from '@/lib/betting/friends';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Friend-graph mutations: request / accept / decline. The /play page server-loads
// the friend + request lists; this route just mutates, then the client
// router.refresh()es to re-read. 503-safe so it's inert until betting is provisioned.
export async function POST(req: Request) {
  if (!isBettingConfigured()) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { action?: unknown; userId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const action = typeof body.action === 'string' ? body.action : '';
  const target = typeof body.userId === 'string' ? body.userId : '';
  if (!target || target === userId) {
    return NextResponse.json({ error: 'a valid userId is required' }, { status: 400 });
  }

  try {
    await ensureAppUser(userId);
    if (action === 'request') {
      await ensureAppUser(target); // referenced by the FK; must exist
      const result = await sendFriendRequest(userId, target);
      return NextResponse.json({ ok: true, result });
    }
    if (action === 'accept' || action === 'decline') {
      await respondToFriendRequest(userId, target, action === 'accept');
      return NextResponse.json({ ok: true });
    }
    if (action === 'remove') {
      await removeFriend(userId, target);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// Friend search by display name — GET /api/friends?q=<query>. Returns matches with
// each one's friend state vs the viewer (drives the add-friend UI). Inert until provisioned.
export async function GET(req: Request) {
  if (!isBettingConfigured()) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  await ensureAppUser(userId);
  const q = new URL(req.url).searchParams.get('q') ?? '';
  const results = await searchUsers(userId, q);
  return NextResponse.json({ results });
}
