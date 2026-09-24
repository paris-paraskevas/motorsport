import { NextResponse } from 'next/server';
import { accountId } from '@/lib/auth/server';
import { listSubscriptions } from '@/lib/push-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function endpointProvider(endpoint: string): string {
  try {
    const host = new URL(endpoint).hostname;
    if (host.includes('fcm.googleapis.com')) return 'fcm (chrome/android)';
    if (host.includes('mozilla.com') || host.includes('autopush.services.mozilla')) return 'mozilla (firefox)';
    if (host.includes('web.push.apple.com')) return 'apns (apple)';
    if (host.includes('windows.com') || host.includes('notify.windows')) return 'wns (edge/windows)';
    return host;
  } catch {
    return 'unknown';
  }
}

/**
 * Returns the current user's push subscriptions, sanitized.
 * If signed-out, returns 401 (so curl callers can see they need auth).
 */
export async function GET() {
  const userId = await accountId();
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const all = await listSubscriptions();
  const mine = all.filter(s => s.userId === userId);

  return NextResponse.json({
    userId,
    totalStored: all.length,
    yours: mine.length,
    subscriptions: mine.map(s => ({
      provider: endpointProvider(s.subscription.endpoint),
      endpointTail: s.subscription.endpoint.slice(-24),
      createdAt: new Date(s.createdAt).toISOString(),
    })),
  });
}
