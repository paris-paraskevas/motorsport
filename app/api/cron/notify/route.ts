import { NextResponse } from 'next/server';
import { loadAllSeries } from '@/lib/series';
import { listSubscriptions, deleteSubscription } from '@/lib/push-store';
import { sendPushTo } from '@/lib/push';
import { getUserFollowed } from '@/lib/userPrefs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HORIZON_MIN = 35; // notify for sessions starting in (~30 min window)
const HORIZON_FLOOR_MIN = 10;
const MAX_NOTIFICATIONS_PER_RUN = 5;

interface NotifiableSession {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  seriesSlug: string;
  seriesName: string;
}

function minutesUntil(date: Date, now: Date): number {
  return (date.getTime() - now.getTime()) / 60000;
}

function fmtTime(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Athens',
  }).format(date);
}

async function authorizeCronRequest(req: Request): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const header = req.headers.get('authorization');
  return header === `Bearer ${cronSecret}`;
}

export async function GET(req: Request) {
  const authorized = await authorizeCronRequest(req);
  if (!authorized) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const subs = await listSubscriptions();
    if (subs.length === 0) {
      return NextResponse.json({ ok: true, message: 'no subscribers' });
    }

    const all = await loadAllSeries();
    const now = new Date();

    const notifiable: NotifiableSession[] = [];
    for (const series of all) {
      for (const s of series.sessions) {
        const mins = minutesUntil(s.start, now);
        if (mins >= HORIZON_FLOOR_MIN && mins <= HORIZON_MIN) {
          notifiable.push({
            uid: s.uid,
            title: s.title,
            start: s.start,
            end: s.end,
            seriesSlug: series.meta.slug,
            seriesName: series.meta.name,
          });
        }
      }
    }

    if (notifiable.length === 0) {
      return NextResponse.json({ ok: true, message: 'nothing imminent', checked: all.length });
    }

    notifiable.sort((a, b) => a.start.getTime() - b.start.getTime());
    const queue = notifiable.slice(0, MAX_NOTIFICATIONS_PER_RUN);

    // Per-user followed cache (avoid re-fetching for the same userId)
    const followedByUser = new Map<string, string[] | null>();
    const getFollowed = async (userId: string): Promise<string[] | null> => {
      if (followedByUser.has(userId)) return followedByUser.get(userId)!;
      const f = await getUserFollowed(userId);
      followedByUser.set(userId, f);
      return f;
    };

    let sent = 0;
    let evicted = 0;
    let skipped = 0;
    for (const session of queue) {
      const minsLeft = Math.round(minutesUntil(session.start, now));
      const payload = {
        title: `${session.seriesName} · ${session.title}`,
        body: `Starts in ${minsLeft} min · ${fmtTime(session.start)} Athens`,
        url: `/series/${session.seriesSlug}`,
        tag: `paddock-${session.uid}`,
      };
      for (const { subscription, userId } of subs) {
        // Filter per user's followed series. Anonymous subs (userId === null)
        // get every series — they have no server-side prefs.
        if (userId) {
          const followed = await getFollowed(userId);
          if (followed !== null && !followed.includes(session.seriesSlug)) {
            skipped++;
            continue;
          }
        }
        const result = await sendPushTo(subscription, payload);
        if (result.ok) {
          sent++;
        } else if (result.gone) {
          await deleteSubscription(subscription.endpoint);
          evicted++;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      checked: all.length,
      notifiable: notifiable.length,
      queued: queue.length,
      sent,
      skipped,
      evicted,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
