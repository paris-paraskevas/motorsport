import { NextResponse } from 'next/server';
import { loadAllSeries } from '@/lib/series';
import { listSubscriptions, deleteSubscription, type StoredSubscription } from '@/lib/push-store';
import { sendPushTo, isPushConfigured, type PushPayload } from '@/lib/push';
import { recordSent } from '@/lib/push-history';
import { getUserFollowed, getUserNotifPrefs } from '@/lib/userPrefs';
import { authorizeCronRequest, cronAuthFailureResponse } from '@/lib/cron-auth';
import {
  wasNotified,
  markNotified,
  unmarkNotified,
  shouldRetryAfterTotalFailure,
  type NotifyKind,
} from '@/lib/notify-ledger';
import {
  looksLikeRaceSession,
  resultsRenderedFor,
  seriesSupportsResultsReady,
} from '@/lib/results-ready';
import { buildRoundLookup, roundFor, sessionSlug, deriveTitleHint } from '@/lib/weekend';
import type { Series } from '@/lib/types';

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
// F1 "analysis ready": OpenF1 historical data opens up ~30 min after a session
// ends, which is when the Qualifying Decoder / Race Story is reliably populated.
// Window is 30-90 min post-end — wide enough that a 15-min cron tick always
// lands inside it once; the ledger ('analysis') dedups so it fires exactly once.
const ANALYSIS_MIN_MIN = 30;
const ANALYSIS_MAX_MIN = 90;
// Only F1 has the Decoder / Race Story analysis surface.
const ANALYSIS_SERIES_SLUG = 'f1';
// Mirror the session page's family detection (see app/api/home/latest-decoded):
// quali = race-grid qualifying family (excludes sprint), race = the grand prix.
const ANALYSIS_QUALI_RE = /qualifying|superpole|shootout/i;
const ANALYSIS_RACE_RE = /grand prix|^race$|\brace\b/i;
const ANALYSIS_SPRINT_RE = /sprint/i;
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

// GP / weekend name for the analysis nudge body. Prefers the curated round name
// from rounds.json (same source the Latest-Decoded widget trusts), falling back
// to a cleaned session title, then a plain "Round N".
function gpName(series: Series, round: number, sessionTitle: string): string {
  const curated = series.rounds?.rounds.find(r => r.round === round)?.name;
  return curated || deriveTitleHint(sessionTitle) || `Round ${round}`;
}

// Deep-link a pre-session reminder straight to that session's weekend page when
// we can resolve its round (the slug is derived the same way the session page
// resolves by — see analysisPayload). Falls back to the series landing when the
// round isn't resolvable, so the link is never broken.
function preSessionPayload(
  session: CandidateSession,
  minsLeft: number,
  round: number | undefined,
): PushPayload {
  const url =
    round !== undefined
      ? `/series/${session.seriesSlug}/weekend/${round}/${sessionSlug(session.title)}`
      : `/series/${session.seriesSlug}`;
  return {
    title: `${session.seriesName} · ${session.title}`,
    body: `Starts in ${minsLeft} min · ${fmtTime(session.start)} Athens`,
    url,
    tag: `paddock-${session.uid}`,
    color: session.seriesColor,
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'mute', title: 'Mute series' },
    ],
    data: { seriesSlug: session.seriesSlug },
  };
}

// Deep-link "results are in" to that round's race-session page when resolvable,
// else the series results tab. The race session's slug comes from its own title
// (the same `s.title` that matched looksLikeRaceSession), matching how the
// weekend page resolves a session by slug.
function resultsPayload(session: CandidateSession, round: number | undefined): PushPayload {
  const url =
    round !== undefined
      ? `/series/${session.seriesSlug}/weekend/${round}/${sessionSlug(session.title)}`
      : `/series/${session.seriesSlug}/results`;
  return {
    title: `${session.seriesName} · Results are in`,
    body: `${session.title} — full classification is up`,
    url,
    tag: `paddock-res-${session.uid}`,
    color: session.seriesColor,
    actions: [
      { action: 'open', title: 'See results' },
      { action: 'mute', title: 'Mute series' },
    ],
    data: { seriesSlug: session.seriesSlug },
  };
}

// F1 "analysis ready" nudge. Deep-links straight into the session page, which
// renders the Qualifying Decoder (quali) or Race Story (race). The slug is
// derived from the session title via sessionSlug() — the same key the session
// page resolves by (sessionBySlug) — so the link is guaranteed valid even when
// the curated title isn't literally "Qualifying"/"Race" (e.g. "Grand Prix").
function analysisPayload(
  session: CandidateSession,
  round: number,
  gp: string,
  isRace: boolean,
): PushPayload {
  const surface = isRace ? 'Race Story' : 'Qualifying Decoder';
  return {
    title: 'Formula 1 · Analysis ready',
    body: `${surface} is up — ${gp}`,
    url: `/series/${session.seriesSlug}/weekend/${round}/${sessionSlug(session.title)}`,
    tag: `paddock-analysis-${session.uid}`,
    color: session.seriesColor,
    actions: [{ action: 'open', title: 'Open' }],
    data: { seriesSlug: session.seriesSlug },
  };
}

export async function GET(req: Request) {
  const auth = authorizeCronRequest(req);
  if (auth !== 'ok') return cronAuthFailureResponse(auth);

  // Fail clearly when push isn't configured rather than throwing from deep
  // inside the send loop (configure() would, and the route would mask it as a
  // generic 500). Does not touch the fail-closed cron-auth above.
  if (!isPushConfigured()) {
    return NextResponse.json({ ok: false, reason: 'push not configured' }, { status: 503 });
  }

  try {
    const subs = await listSubscriptions();
    if (subs.length === 0) {
      return NextResponse.json({ ok: true, message: 'no subscribers' });
    }

    const all = await loadAllSeries();
    const now = new Date();

    const queue: QueuedNotification[] = [];

    for (const series of all) {
      // Round lookup powers every deep link (session reminders, results, and the
      // F1 analysis nudge). groupByWeekend over one series is cheap and the cron
      // touches every series for pre-session reminders anyway, so build it once
      // per series here and reuse across that series' sessions.
      const isAnalysisSeries = series.meta.slug === ANALYSIS_SERIES_SLUG;
      const roundLookup = buildRoundLookup(series, now);

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
        const round = roundFor(roundLookup, series.meta.slug, s.uid);

        if (mins > T30_MIN_MIN && mins <= T30_MAX_MIN) {
          if (!(await wasNotified('t30', s.uid))) {
            queue.push({
              kind: 't30',
              session: candidate,
              payload: preSessionPayload(candidate, Math.round(mins), round),
            });
          }
        } else if (mins > T10_MIN_MIN && mins <= T10_MAX_MIN) {
          if (!(await wasNotified('t10', s.uid))) {
            queue.push({
              kind: 't10',
              session: candidate,
              payload: preSessionPayload(candidate, Math.round(mins), round),
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
                payload: resultsPayload(candidate, round),
              });
            }
          }
        }

        // F1 "analysis ready": qualifying or race sessions that ended 30-90 min
        // ago — by then OpenF1 historical data has opened up and the Qualifying
        // Decoder / Race Story is reliably populated. One nudge per session,
        // deep-linked to its session page. No upstream fetch: ledger-dedup'd and
        // gated purely on the time window (vs 'res', which probes the feed).
        if (
          isAnalysisSeries &&
          minsSinceEnd >= ANALYSIS_MIN_MIN &&
          minsSinceEnd <= ANALYSIS_MAX_MIN
        ) {
          const isSprint = ANALYSIS_SPRINT_RE.test(s.title);
          const isQuali = !isSprint && ANALYSIS_QUALI_RE.test(s.title);
          const isRace = !isSprint && ANALYSIS_RACE_RE.test(s.title);
          if (isQuali || isRace) {
            // Without a round we can't build a valid deep link — skip rather than
            // ship a broken URL. (`round` resolved once above from roundLookup.)
            if (round !== undefined && !(await wasNotified('analysis', s.uid))) {
              const gp = gpName(series, round, s.title);
              queue.push({
                kind: 'analysis',
                session: candidate,
                payload: analysisPayload(candidate, round, gp, isRace),
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

    const sendToAll = async (
      kind: NotifyKind,
      payload: PushPayload,
      seriesSlug: string,
      subsList: StoredSubscription[],
    ) => {
      let sent = 0;
      let evicted = 0;
      let skipped = 0;
      let errored = 0;
      // One history row per user, even with several push subscriptions.
      const recorded = new Set<string>();
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
          // Record to the signed-in user's sent-history (fail-soft, once per
          // user per notification — anon subs have no owner to scope to).
          if (userId && !recorded.has(userId)) {
            recorded.add(userId);
            await recordSent(userId, {
              kind,
              title: payload.title,
              body: payload.body,
              url: payload.url ?? '/app',
              ts: Date.now(),
              seriesSlug,
            });
          }
        } else if (result.gone) {
          await deleteSubscription(subscription.endpoint);
          evicted++;
        } else {
          // Real (non-gone) send error — a transient push-service/network blip.
          errored++;
        }
      }
      return { sent, evicted, skipped, errored };
    };

    let sent = 0;
    let evicted = 0;
    let skipped = 0;
    for (const item of batch) {
      // Mark BEFORE sending: a crash mid-fanout must not re-spam every
      // subscriber on the next tick. Worst case is one missed notification,
      // which beats a doubled one.
      await markNotified(item.kind, item.session.uid);
      const r = await sendToAll(item.kind, item.payload, item.session.seriesSlug, subs);
      sent += r.sent;
      evicted += r.evicted;
      skipped += r.skipped;
      // Transient TOTAL failure (zero delivered, ≥1 real error): undo the mark
      // so the next tick retries. Safe against duplicates — this runs only after
      // a completed loop with zero successes, so anyone already notified keeps
      // the mark. Terminal outcomes (some sent, only gone-evictions, or simply
      // no eligible subscribers) stay marked.
      if (shouldRetryAfterTotalFailure(r)) {
        await unmarkNotified(item.kind, item.session.uid);
      }
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
    console.error('GET /api/cron/notify failed:', err);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
