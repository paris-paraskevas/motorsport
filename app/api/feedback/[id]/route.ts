import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';
import { isAdmin } from '@/lib/threads';
import { setFeedbackStatus, type FeedbackStatus } from '@/lib/feedback';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST = move an item's status (admin only): { status }. Moderators post + read;
// only the admin triages.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isBettingConfigured()) return NextResponse.json({ error: 'not available' }, { status: 503 });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isAdmin(await currentUser())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id } = await params;
  let body: { status?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  try {
    await setFeedbackStatus(id, body.status as FeedbackStatus);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    return NextResponse.json({ error: message }, { status: /unknown status/.test(message) ? 400 : 500 });
  }
}
