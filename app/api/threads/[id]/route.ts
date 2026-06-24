import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';
import { decideThread, isAdmin } from '@/lib/threads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST = moderate a thread (admin only): { action: 'approve' | 'reject' }.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isBettingConfigured()) return NextResponse.json({ error: 'not available' }, { status: 503 });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isAdmin(await currentUser())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id } = await params;
  let body: { action?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  if (body.action !== 'approve' && body.action !== 'reject') {
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  }
  try {
    await decideThread(id, userId, body.action === 'approve');
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'unknown' }, { status: 500 });
  }
}
