import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { listSubscriptions, deleteSubscription } from '@/lib/push-store';
import { sendPushTo } from '@/lib/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function endpointTail(endpoint: string): string {
  return endpoint.slice(-24);
}

/**
 * Send a test notification.
 *
 * - Signed-in: targets only the current user's subscriptions.
 * - Signed-out: 401 (everyone has to sign in now).
 */
export async function POST() {
  const a = await auth();
  if (!a.userId) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const all = await listSubscriptions();
    const subs = all.filter(s => s.userId === a.userId);

    if (subs.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'no subscriptions stored for this account' },
        { status: 404 },
      );
    }

    const results: Array<{ endpoint: string; ok: boolean; status?: number }> = [];
    let sent = 0;
    let evicted = 0;
    for (const { subscription } of subs) {
      const result = await sendPushTo(subscription, {
        title: 'Paddock Tracker — test',
        body: 'Push notifications are wired up. You\'ll hear about upcoming sessions.',
        url: '/',
        tag: 'paddock-test',
      });
      if (result.ok) {
        sent++;
        results.push({ endpoint: endpointTail(subscription.endpoint), ok: true });
      } else {
        results.push({
          endpoint: endpointTail(subscription.endpoint),
          ok: false,
          status: result.status,
        });
        if (result.gone) {
          await deleteSubscription(subscription.endpoint);
          evicted++;
        }
      }
    }
    return NextResponse.json({ ok: true, sent, evicted, devices: results });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
