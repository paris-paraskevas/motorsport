import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { loadAllSeries } from '@/lib/series';
import { listSubscriptions, deleteSubscription } from '@/lib/push-store';
import { sendPushTo } from '@/lib/push';
import { getUserFollowed, getUserNotifPrefs } from '@/lib/userPrefs';
import type { Session } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HORIZON_DAYS = 7;

function isKvConfigured(): boolean {
  return Boolean(
    process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
  );
}

async function authorizeCronRequest(req: Request): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const header = req.headers.get('authorization');
  return header === `Bearer ${cronSecret}`;
}

function isoWeekKey(date: Date): string {
  // Returns YYYY-Www, e.g. 2026-W19
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function fmtDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Athens',
  }).format(date);
}

function fmtTime(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Athens',
  }).format(date);
}

function pickMainSession(sessions: Session[]): Session {
  // Prefer significance tier "marquee" > "finale" > "weighted" > last in list
  const order: Record<string, number> = { marquee: 4, finale: 3, weighted: 2, note: 1 };
  let best = sessions[sessions.length - 1];
  let bestScore = 0;
  for (const s of sessions) {
    const score = order[s.significance?.tier ?? ''] ?? 0;
    if (score > bestScore) {
      best = s;
      bestScore = score;
    }
  }
  return best;
}

export async function GET(req: Request) {
  const authorized = await authorizeCronRequest(req);
  if (!authorized) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  if (!isKvConfigured()) {
    return NextResponse.json({ ok: false, error: 'kv not configured' }, { status: 503 });
  }

  try {
    const subs = await listSubscriptions();
    if (subs.length === 0) {
      return NextResponse.json({ ok: true, message: 'no subscribers' });
    }

    const allSeries = await loadAllSeries();
    const now = new Date();
    const weekEnd = new Date(now.getTime() + HORIZON_DAYS * 86400000);
    const weekKey = isoWeekKey(now);

    const userCache = new Map<
      string,
      { followed: string[] | null; raceWeekOn: boolean }
    >();
    const getUserState = async (userId: string) => {
      const cached = userCache.get(userId);
      if (cached) return cached;
      const [followed, prefs] = await Promise.all([
        getUserFollowed(userId),
        getUserNotifPrefs(userId),
      ]);
      const state = { followed, raceWeekOn: prefs.raceWeek };
      userCache.set(userId, state);
      return state;
    };

    // Pre-compute "this week" sessions per series
    const upcomingBySlug = new Map<string, Session[]>();
    for (const series of allSeries) {
      const inWindow = series.sessions.filter(s => s.start >= now && s.start <= weekEnd);
      if (inWindow.length > 0) {
        upcomingBySlug.set(series.meta.slug, inWindow);
      }
    }

    let sent = 0;
    let evicted = 0;
    let skipped = 0;

    for (const { subscription, userId } of subs) {
      if (!userId) {
        skipped++;
        continue;
      }
      const state = await getUserState(userId);
      if (!state.raceWeekOn) {
        skipped++;
        continue;
      }

      for (const series of allSeries) {
        const slug = series.meta.slug;
        if (state.followed !== null && !state.followed.includes(slug)) continue;
        const thisWeek = upcomingBySlug.get(slug);
        if (!thisWeek) continue;

        // Dedupe: don't send twice in the same ISO week
        const dedupKey = `paddock:user:${userId}:raceWeek:${weekKey}:${slug}`;
        const alreadySent = await kv.get(dedupKey);
        if (alreadySent) {
          skipped++;
          continue;
        }

        const main = pickMainSession(thisWeek);
        const payload = {
          title: `Race week — ${series.meta.name}`,
          body: `${thisWeek.length} session${thisWeek.length === 1 ? '' : 's'} this week. ${main.title}: ${fmtDate(main.start)} ${fmtTime(main.start)}.`,
          url: `/series/${slug}`,
          tag: `paddock-race-week-${slug}-${weekKey}`,
        };

        const result = await sendPushTo(subscription, payload);
        if (result.ok) {
          sent++;
          await kv.set(dedupKey, 1, { ex: 60 * 60 * 24 * 14 });
        } else if (result.gone) {
          await deleteSubscription(subscription.endpoint);
          evicted++;
          break;
        }
      }
    }

    return NextResponse.json({ ok: true, sent, evicted, skipped, weekKey });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
