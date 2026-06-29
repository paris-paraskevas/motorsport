import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { listHistory, type PushHistoryItem } from '@/lib/push-history';

// Per-user sent-notification history for the header notification center. Signed-in
// only and per-user, so NOT edge-cacheable — mirrors the other auth'd per-user
// routes under app/(app)/api/** (see api/home/bets). Anonymous callers get []
// (200) so the signed-out client simply renders an empty bell-less header rather
// than erroring. Fail-soft: a transient KV/auth error returns [] too — the bell
// is a passive surface and must never throw a wall of red at the user.
export const dynamic = 'force-dynamic';

// Match lib/push-history's default page size; the panel shows a bounded backlog.
const LIMIT = 30;

function noStore(items: PushHistoryItem[]) {
  return NextResponse.json(items, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return noStore([]);
    return noStore(await listHistory(userId, LIMIT));
  } catch {
    return noStore([]);
  }
}
