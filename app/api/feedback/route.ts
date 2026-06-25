import { NextResponse, after } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';
import { ensureAppUser } from '@/lib/betting/credits';
import { setDisplayNameIfMissing, clerkDisplayName } from '@/lib/betting/friends';
import { isStaff } from '@/lib/threads';
import { createFeedback, listFeedback, type FeedbackKind } from '@/lib/feedback';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET = the staff board (all items). Staff only (401/403 otherwise) — everyday
// users never see it.
export async function GET() {
  if (!isBettingConfigured()) return NextResponse.json({ items: [] });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isStaff(await currentUser())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  try {
    return NextResponse.json({ items: await listFeedback() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'unknown' }, { status: 500 });
  }
}

// POST = post a feedback item (staff only): { kind, title, body }.
export async function POST(req: Request) {
  if (!isBettingConfigured()) return NextResponse.json({ error: 'not available' }, { status: 503 });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isStaff(await currentUser())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let body: { kind?: unknown; title?: unknown; body?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const kind = (typeof body.kind === 'string' ? body.kind : 'comment') as FeedbackKind;
  const title = typeof body.title === 'string' ? body.title : '';
  const text = typeof body.body === 'string' ? body.body : '';

  try {
    await ensureAppUser(userId);
    const id = await createFeedback(userId, kind, title, text);
    after(async () => {
      try {
        await setDisplayNameIfMissing(userId, clerkDisplayName(await currentUser()));
      } catch {
        /* best-effort */
      }
    });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'could not post';
    const domain = /must be/i.test(message);
    return NextResponse.json({ ok: false, error: message }, { status: domain ? 422 : 500 });
  }
}
