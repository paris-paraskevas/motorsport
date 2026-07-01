import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { saveSubscription } from '@/lib/push-store';
import { isAllowedPushEndpoint } from '@/lib/push-hosts';

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
  if (
    typeof sub?.endpoint !== 'string' ||
    typeof sub?.keys?.p256dh !== 'string' ||
    typeof sub?.keys?.auth !== 'string'
  ) {
    return NextResponse.json({ ok: false, error: 'malformed subscription' }, { status: 400 });
  }

  // The notify cron web-pushes to every stored endpoint, so an endpoint is an
  // outbound-POST target — validate it before it can be stored. First the shape
  // (https + sane lengths), then the host against the Web Push service allowlist
  // (see lib/push-hosts) so the store can't be seeded with arbitrary/attacker
  // URLs (security audit 2026-06-11 finding #2, hardened to an allowlist).
  let endpointUrl: URL | null = null;
  try {
    endpointUrl = new URL(sub.endpoint);
  } catch {
    endpointUrl = null;
  }
  if (
    !endpointUrl ||
    endpointUrl.protocol !== 'https:' ||
    sub.endpoint.length > 1024 ||
    sub.keys.p256dh.length > 512 ||
    sub.keys.auth.length > 512 ||
    !isAllowedPushEndpoint(endpointUrl)
  ) {
    return NextResponse.json({ ok: false, error: 'invalid subscription' }, { status: 400 });
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
    console.error('POST /api/push/subscribe failed:', err);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
