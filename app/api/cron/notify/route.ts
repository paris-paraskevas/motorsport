import { NextResponse } from 'next/server';
import { loadAllSeries } from '@/lib/series';
import { listSubscriptions, deleteSubscription, type StoredSubscription } from '@/lib/push-store';
import { sendPushTo, type PushPayload } from '@/lib/push';
import { getUserFollowed, getUserNotifPrefs } from '@/lib/userPrefs';
import { authorizeCronRequest, cronAuthFailureResponse } from '@/lib/cron-auth';
import { wasNotified, markNotified, type NotifyKind } from '@/lib/notify-ledger';
import {
  looksLikeRaceSession,
  resultsRenderedFor,
  seriesSupportsResultsReady,
} from '@/lib/results-ready';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The GitHub Actions cron fires every 15 minutes. Each pre-session window is
// 15 minutes wide, so every session gets exactly one tick per window; the KV
// ledger absorbs late/double ticks. (Was a single [10,35] window before
// 0.22.0 — operator spec is a heads-up at ~30 AND ~10 minutes out.)
const T30_MAX_MIN = 35;
const T30_MIN_MIN = 20;
const T10_MAX_MIN = 15;
const T10_MIN_MIN = 0;
// Results lookback: how long after a race ends we keep checking whether the
// results feed has it. Covers slow upstreams (Wikipedia editors, scrape lag).
const RESULTS_LOOKBACK_MIN = 8 * 60;
const MAX_NOTIFICATIONS_PER_RUN = 6;

interface CandidateSession {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  seriesSlug: string;
  seriesName: string;
  seriesColor: string;
}

interface QueuedNotification {
  kind: NotifyKind;
  session: CandidateSession;
  payload: PushPayload;
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

function preSessionPayload(session: CandidateSession, minsLeft: number): PushPayload {
  return {
    title: `${session.seriesName} · ${session.title}`,
    body: `Starts in ${minsLeft} min · ${fmtTime(session.start)} Athens`,
    url: `/series/${session.seriesSlug}`,
    tag: `paddock-${session.uid}`,
    color: session.seriesColor,
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'mute', title: 'Mute series' },
    ],
    data: { seriesSlug: session.seriesSlug },
  };
}

function resultsPayload(session: CandidateSession): PushPayload {
  return {
    title: `${session.seriesName} · Results are in`,
    body: `${session.title} — full classification is up`,
    url: `/series/${session.seriesSlug}/results`,
    tag: `paddock-res-${session.uid}`,
    color: session.seriesColor,
    actions: [
      { action: 'open', title: 'See results' },
      { action: 'mute', title: 'Mute series' },
    ],
    data: { seriesSlug: session.seriesSlug },
  };
}

export async function GET(req: Request) {
  const auth = authorizeCronRequest(req);
  if (auth !== 'ok') return cronAuthFailureResponse(auth);

  try {
    const subs = await listSubscriptions();
    if (subs.length === 0) {
      return NextResponse.json({ ok: true, message: 'no subscribers' });
    }

    const all = await loadAllSeries();
    const now = new Date();

    const queue: QueuedNotification[] = [];

    for (const series of all) {
      for (const s of series.sessions) {
        // Never notify for date-only events — we don't know the real start time.
        if (s.dateOnly) continue;
        const candidate: CandidateSession = {
          uid: s.uid,
          title: s.title,
          start: s.start,
          end: s.end,
          seriesSlug: series.meta.slug,
          seriesName: series.meta.name,
          seriesColor: series.meta.color,
        };
        const mins = minutesUntil(s.start, now);

        if (mins > T30_MIN_MIN && mins <= T30_MAX_MIN) {
          if (!(await wasNotified('t30', s.uid))) {
            queue.push({
              kind: 't30',
              session: candidate,
              payload: preSessionPayload(candidate, Math.round(mins)),
            });
          }
        } else if (mins > T10_MIN_MIN && mins <= T10_MAX_MIN) {
          if (!(await wasNotified('t10', s.uid))) {
            queue.push({
              kind: 't10',
              session: candidate,
              payload: preSessionPayload(candidate, Math.round(mins)),
            });
          }
        }

        // Results-ready: race sessions that ended recently, for series whose
        // results feed we can check. The (cached) feed fetch only happens for
        // pending candidates — a handful of calls per race weekend.
        const minsSinceEnd = -minutesUntil(s.end, now);
        if (
          minsSinceEnd > 0 &&
          minsSinceEnd <= RESULTS_LOOKBACK_MIN &&
          seriesSupportsResultsReady(series.meta.slug) &&
          looksLikeRaceSession(s.title)
        ) {
          if (!(await wasNotified('res', s.uid))) {
            if (await resultsRenderedFor(series.meta.slug, s.start)) {
              queue.push({
                kind: 'res',
                session: candidate,
                payload: resultsPayload(candidate),
              });
            }
          }
        }
      }
    }

    if (queue.length === 0) {
      return NextResponse.json({ ok: true, message: 'nothing to send', checked: all.length });
    }

    queue.sort((a, b) => a.session.start.getTime() - b.session.start.getTime());
    const batch = queue.slice(0, MAX_NOTIFICATIONS_PER_RUN);

    // Per-user followed + notif-prefs cache (avoid re-fetching for the same userId)
    const userCache = new Map<string, { followed: string[] | null; sessionsOn: boolean; soundOn: boolean; muted: Set<string> }>();
    const getUserState = async (userId: string) => {
      const cached = userCache.get(userId);
      if (cached) return cached;
      const [followed, prefs] = await Promise.all([
        getUserFollowed(userId),
        getUserNotifPrefs(userId),
      ]);
      const state = {
        followed,
        sessionsOn: prefs.sessions,
        soundOn: prefs.sound !== false,
        muted: new Set(prefs.mutedSeries ?? []),
      };
      userCache.set(userId, state);
      return state;
    };

    const sendToAll = async (payload: PushPayload, seriesSlug: string, subsList: StoredSubscription[]) => {
      let sent = 0;
      let evicted = 0;
      let skipped = 0;
      for (const { subscription, userId } of subsList) {
        let silent = false;
        if (userId) {
          const state = await getUserState(userId);
          if (!state.sessionsOn) {
            skipped++;
            continue;
          }
          if (state.followed !== null && !state.followed.includes(seriesSlug)) {
            skipped++;
            continue;
          }
          if (state.muted.has(seriesSlug)) {
            skipped++;
            continue;
          }
          silent = !state.soundOn;
        }
        const result = await sendPushTo(
          subscription,
          silent ? { ...payload, silent: true } : payload,
        );
        if (result.ok) {
          sent++;
        } else if (result.gone) {
          await deleteSubscription(subscription.endpoint);
          evicted++;
        }
      }
      return { sent, evicted, skipped };
    };

    let sent = 0;
    let evicted = 0;
    let skipped = 0;
    for (const item of batch) {
      // Mark BEFORE sending: a crash mid-fanout must not re-spam every
      // subscriber on the next tick. Worst case is one missed notification,
      // which beats a doubled one.
      await markNotified(item.kind, item.session.uid);
      const r = await sendToAll(item.payload, item.session.seriesSlug, subs);
      sent += r.sent;
      evicted += r.evicted;
      skipped += r.skipped;
    }

    return NextResponse.json({
      ok: true,
      checked: all.length,
      queued: batch.map(q => ({ kind: q.kind, uid: q.session.uid, title: q.session.title })),
      sent,
      skipped,
      evicted,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
