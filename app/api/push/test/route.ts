import { NextResponse } from 'next/server';
import { listSubscriptions, deleteSubscription } from '@/lib/push-store';
import { sendPushTo } from '@/lib/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Send a test notification to every stored subscription.
 * Useful during initial setup to verify VAPID keys + KV + service worker handshake.
 */
export async function POST() {
  try {
    const subs = await listSubscriptions();
    if (subs.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'no subscriptions stored' },
        { status: 404 },
      );
    }

    let sent = 0;
    let evicted = 0;
    for (const { subscription } of subs) {
      const result = await sendPushTo(subscription, {
        title: 'Paddock — test',
        body: 'Push notifications are wired up. You\'ll hear about upcoming sessions.',
        url: '/',
        tag: 'paddock-test',
      });
      if (result.ok) {
        sent++;
      } else if (result.gone) {
        await deleteSubscription(subscription.endpoint);
        evicted++;
      }
    }
    return NextResponse.json({ ok: true, sent, evicted });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
