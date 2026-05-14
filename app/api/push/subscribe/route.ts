import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { saveSubscription } from '@/lib/push-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SubscribeBody {
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    expirationTime?: number | null;
  };
}

export async function POST(req: Request) {
  let body: SubscribeBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  const sub = body?.subscription;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return NextResponse.json({ ok: false, error: 'malformed subscription' }, { status: 400 });
  }

  let userId: string | null = null;
  try {
    const a = await auth();
    userId = a.userId ?? null;
  } catch {
    userId = null;
  }

  try {
    await saveSubscription(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      },
      userId,
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
