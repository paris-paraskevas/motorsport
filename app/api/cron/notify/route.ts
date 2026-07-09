import { NextResponse } from 'next/server';
import { loadAllSeries } from '@/lib/series';
import { listSubscriptions, deleteSubscription } from '@/lib/push-store';
import { sendPushTo, isPushConfigured, type PushPayload } from '@/lib/push';
import { recordSent } from '@/lib/push-history';
import { getUserFollowed, getUserNotifPrefs, isQuietNow, type SessionTypePrefs } from '@/lib/userPrefs';
import { authorizeCronRequest, cronAuthFailureResponse } from '@/lib/cron-auth';
import {
  wasNotified,
  markNotified,
  unmarkNotified,
} from '@/lib/notify-ledger';
import {
  looksLikeRaceSession,
  resultsRenderedFor,
  seriesSupportsResultsReady,
} from '@/lib/results-ready';
import { buildRoundLookup, roundFor, sessionSlug, deriveTitleHint } from '@/lib/weekend';
import type { Series } from '@/lib/types';
import {
  eligibleForNotify,
  coalescedPayload,
  type CandidateSession,
  type QueuedNotification,
} from '@/lib/notify-coalesce';

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
  const surface = isRace ? 'Race Story' : 'Qualifying Analysis';
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
    const userCache = new Map<string, { followed: string[] | null; sessionsOn: boolean; soundOn: boolean; muted: Set<string>; sessionTypes: SessionTypePrefs | undefined; quiet: boolean }>();
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
        sessionTypes: prefs.sessionTypes,
        quiet: isQuietNow(prefs, now),
      };
      userCache.set(userId, state);
      return state;
    };

    // Mark every queued item as handled BEFORE sending: a crash mid-fanout must
    // not re-spam every subscriber next tick (one missed beats one doubled).
    for (const item of batch) {
      await markNotified(item.kind, item.session.uid);
    }

    // Coalesce per subscription: gather the items this subscriber is eligible
    // for, then send ONE summary if ≥2, the single payload if exactly 1, nothing
    // if 0 — this kills the "several buzzes in one minute" burst (operator
    // 2026-07-09). Anonymous subs (no account → no prefs, no followed series to
    // honour) get nothing; push now requires sign-in. A subscriber in quiet
    // hours is skipped for this tick.
    let sent = 0;
    let evicted = 0;
    let skipped = 0;
    let errored = 0;
    const recorded = new Set<string>();
    for (const { subscription, userId } of subs) {
      if (!userId) {
        skipped++;
        continue;
      }
      const state = await getUserState(userId);
      if (state.quiet) {
        skipped++;
        continue;
      }
      const mine = batch.filter(item => eligibleForNotify(state, item));
      if (mine.length === 0) {
        skipped++;
        continue;
      }
      const silent = !state.soundOn;
      const payload =
        mine.length === 1
          ? silent
            ? { ...mine[0].payload, silent: true }
            : mine[0].payload
          : coalescedPayload(mine, silent);
      const result = await sendPushTo(subscription, payload);
      if (result.ok) {
        sent++;
        // Record every delivered item to the user's history (the bell shows them
        // all even when the push itself was coalesced) — once per user per tick.
        if (!recorded.has(userId)) {
          recorded.add(userId);
          for (const item of mine) {
            await recordSent(userId, {
              kind: item.kind,
              title: item.payload.title,
              body: item.payload.body,
              url: item.payload.url ?? '/app',
              ts: Date.now(),
              seriesSlug: item.session.seriesSlug,
            });
          }
        }
      } else if (result.gone) {
        await deleteSubscription(subscription.endpoint);
        evicted++;
      } else {
        errored++;
      }
    }

    // Batch-level retry: the whole tick delivered nothing but hit real (non-gone)
    // errors → unmark every item so the next tick retries the transient blip.
    if (sent === 0 && errored > 0) {
      for (const item of batch) {
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
