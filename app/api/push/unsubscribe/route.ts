import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  deleteSubscription,
  getSubscription,
  isSubscriptionOwner,
} from '@/lib/push-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: { endpoint?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }
  if (!body.endpoint) {
    return NextResponse.json({ ok: false, error: 'missing endpoint' }, { status: 400 });
  }

  let callerId: string | null = null;
  try {
    const a = await auth();
    callerId = a.userId ?? null;
  } catch {
    callerId = null;
  }

  try {
    const sub = await getSubscription(body.endpoint);
    if (!sub) {
      // Idempotent: nothing stored for this endpoint, treat as already-unsubscribed.
      return NextResponse.json({ ok: true });
    }
    if (!isSubscriptionOwner(sub, callerId)) {
      // Caller is not the owner. Most common case: user subscribed while
      // signed out, then signed in — caller has a userId, sub has null.
      // The browser-side fallback (pushManager.unsubscribe) still works
      // and the next push send will prune the stale entry via 404/410.
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }
    await deleteSubscription(body.endpoint);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/push/unsubscribe failed:', err);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
