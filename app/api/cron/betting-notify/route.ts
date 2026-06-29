import { NextResponse } from 'next/server';
import { listSubscriptions, deleteSubscription, type StoredSubscription } from '@/lib/push-store';
import { sendPushTo, isPushConfigured, type PushPayload } from '@/lib/push';
import { recordSent } from '@/lib/push-history';
import { getUserFollowed, getUserNotifPrefs } from '@/lib/userPrefs';
import { authorizeCronRequest, cronAuthFailureResponse } from '@/lib/cron-auth';
import { wasNotified, markNotified, unmarkNotified, shouldRetryAfterTotalFailure } from '@/lib/notify-ledger';
import { isBettingConfigured, betDb } from '@/lib/betting/client';
import { loadAllSeriesMeta } from '@/lib/series';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Betting push notifications, mirrored from the sessions notify cron. Fires
// hourly (see .github/workflows/betting-notify.yml); the KV dedup ledger makes
// re-runs idempotent, so the exact tick time never matters.
//
// Two notifications, both fanned out per-user with the same prefs filter the
// sessions cron uses — gated on `prefs.betting`, honouring followed-series and
// per-series mute, and going silent when `prefs.sound` is off:
//
//   bet-lock     — ~1 day before a market locks (markets lock ~1h before
//                  qualifying), so bettors remember to get their picks in.
//   bet-settled  — once a round's markets have settled / results are in.
//
// One notification per series+round, NOT per market type (winner/podium/top10
// share a round). Dedup keys are `{series}:{round}`.

// Lock-reminder window: markets whose lock is between ~23h and ~25h out. The
// hourly cron makes this a 2h-wide window so a single round always catches
// exactly one tick; the ledger absorbs the overlap on the boundary hours.
const LOCK_MIN_MS = 23 * 60 * 60 * 1000;
const LOCK_MAX_MS = 25 * 60 * 60 * 1000;
// Settled-market scan horizon. Settled rows have no settled_at column, so we
// bound by lock time: a round settles within the results lookback (~8h) after
// its lock, so a 7-day window over `locks_at` captures every freshly-settled
// round while keeping the scan small. The `bet-settled` ledger key (30d TTL)
// guarantees once-ever even though the row stays in-window for a week.
const SETTLED_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

interface RoundNotification {
  kind: 'bet-lock' | 'bet-settled';
  seriesSlug: string;
  round: number;
  payload: PushPayload;
}

interface MarketRow {
  series_slug: string;
  round: number;
  locks_at: string;
  status: string;
}

export async function GET(req: Request) {
  const auth = authorizeCronRequest(req);
  if (auth !== 'ok') return cronAuthFailureResponse(auth);

  // Betting may be unconfigured (no Supabase env) — no-op cleanly so the
  // workflow's 200-check passes rather than erroring.
  if (!isBettingConfigured()) {
    return NextResponse.json({ ok: true, message: 'betting not configured' });
  }

  // Fail clearly when push isn't configured rather than throwing from inside the
  // send loop. Does not touch the fail-closed cron-auth above.
  if (!isPushConfigured()) {
    return NextResponse.json({ ok: false, reason: 'push not configured' }, { status: 503 });
  }

  try {
    const subs = await listSubscriptions();
    if (subs.length === 0) {
      return NextResponse.json({ ok: true, message: 'no subscribers' });
    }

    const metas = await loadAllSeriesMeta();
    const metaBySlug = new Map(metas.map(m => [m.slug, m] as const));
    const seriesName = (slug: string) => metaBySlug.get(slug)?.name ?? slug;
    const seriesColor = (slug: string) => metaBySlug.get(slug)?.color;

    const now = Date.now();
    const db = betDb();
    const queue: RoundNotification[] = [];

    // (a) LOCK reminders — open markets locking in [now+23h, now+25h]. One per
    //     series+round (dedup'd), so winner/podium/top10 don't triple-fire.
    const lockLo = new Date(now + LOCK_MIN_MS).toISOString();
    const lockHi = new Date(now + LOCK_MAX_MS).toISOString();
    const { data: lockRows, error: lockErr } = await db
      .from('market')
      .select('series_slug, round, locks_at, status')
      .eq('status', 'open')
      .gte('locks_at', lockLo)
      .lte('locks_at', lockHi);
    if (lockErr) throw new Error(`lock query failed: ${lockErr.message}`);

    const seenLock = new Set<string>();
    for (const m of (lockRows ?? []) as MarketRow[]) {
      try {
        const slug = m.series_slug;
        const round = m.round;
        const dedupId = `${slug}:${round}`;
        if (seenLock.has(dedupId)) continue;
        seenLock.add(dedupId);
        if (await wasNotified('bet-lock', dedupId)) continue;
        queue.push({
          kind: 'bet-lock',
          seriesSlug: slug,
          round,
          payload: {
            title: `🏁 ${seriesName(slug)} — predictions close tomorrow`,
            body: 'Bets lock ~1h before qualifying. Get your picks in.',
            url: '/play',
            tag: `paddock-bet-lock-${dedupId}`,
            color: seriesColor(slug),
            data: { seriesSlug: slug },
          },
        });
      } catch {
        // A single malformed row must not abort the run.
      }
    }

    // (b) SETTLED notices — markets that have settled. Once-ever per series+round
    //     (the 30d ledger key). Bounded to recently-locked rows to keep the scan
    //     cheap (settlement happens within hours of lock).
    const settledLo = new Date(now - SETTLED_LOOKBACK_MS).toISOString();
    const { data: settledRows, error: settledErr } = await db
      .from('market')
      .select('series_slug, round, locks_at, status')
      .eq('status', 'settled')
      .gte('locks_at', settledLo);
    if (settledErr) throw new Error(`settled query failed: ${settledErr.message}`);

    const seenSettled = new Set<string>();
    for (const m of (settledRows ?? []) as MarketRow[]) {
      try {
        const slug = m.series_slug;
        const round = m.round;
        const dedupId = `${slug}:${round}`;
        if (seenSettled.has(dedupId)) continue;
        seenSettled.add(dedupId);
        if (await wasNotified('bet-settled', dedupId)) continue;
        queue.push({
          kind: 'bet-settled',
          seriesSlug: slug,
          round,
          payload: {
            title: `✅ ${seriesName(slug)} R${round} — results are in`,
            body: 'See how your predictions did.',
            url: '/play',
            tag: `paddock-bet-settled-${dedupId}`,
            color: seriesColor(slug),
            data: { seriesSlug: slug },
          },
        });
      } catch {
        // A single malformed row must not abort the run.
      }
    }

    if (queue.length === 0) {
      return NextResponse.json({ ok: true, message: 'nothing to send' });
    }

    // Per-user followed + notif-prefs cache (avoid re-fetching for the same
    // userId across notifications). Mirrors the sessions cron, gated on the
    // `betting` pref instead of `sessions`.
    const userCache = new Map<
      string,
      { followed: string[] | null; bettingOn: boolean; soundOn: boolean; muted: Set<string> }
    >();
    const getUserState = async (userId: string) => {
      const cached = userCache.get(userId);
      if (cached) return cached;
      const [followed, prefs] = await Promise.all([
        getUserFollowed(userId),
        getUserNotifPrefs(userId),
      ]);
      const state = {
        followed,
        bettingOn: prefs.betting !== false,
        soundOn: prefs.sound !== false,
        muted: new Set(prefs.mutedSeries ?? []),
      };
      userCache.set(userId, state);
      return state;
    };

    const sendToAll = async (
      kind: RoundNotification['kind'],
      payload: PushPayload,
      slug: string,
      subsList: StoredSubscription[],
    ) => {
      let sent = 0;
      let evicted = 0;
      let skipped = 0;
      let errored = 0;
      for (const { subscription, userId } of subsList) {
        try {
          let silent = false;
          if (userId) {
            const state = await getUserState(userId);
            if (!state.bettingOn) {
              skipped++;
              continue;
            }
            if (state.followed !== null && !state.followed.includes(slug)) {
              skipped++;
              continue;
            }
            if (state.muted.has(slug)) {
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
            if (userId) {
              await recordSent(userId, {
                kind,
                title: payload.title,
                body: payload.body,
                url: payload.url ?? '/app',
                ts: Date.now(),
                seriesSlug: slug,
              });
            }
          } else if (result.gone) {
            await deleteSubscription(subscription.endpoint);
            evicted++;
          } else {
            // Real (non-gone) send error — a transient blip.
            errored++;
          }
        } catch {
          // A gone/erroring sub must not abort the fan-out. Count it as a real
          // error so a total failure still triggers a retry.
          errored++;
        }
      }
      return { sent, evicted, skipped, errored };
    };

    let sent = 0;
    let evicted = 0;
    let skipped = 0;
    for (const item of queue) {
      // Mark BEFORE sending: a crash mid-fanout must not re-spam every
      // subscriber on the next tick. Worst case is one missed notification,
      // which beats a doubled one.
      const dedupId = `${item.seriesSlug}:${item.round}`;
      await markNotified(item.kind, dedupId);
      const r = await sendToAll(item.kind, item.payload, item.seriesSlug, subs);
      sent += r.sent;
      evicted += r.evicted;
      skipped += r.skipped;
      // Transient total failure → undo the mark so the next hourly tick retries.
      // Only after a completed loop with zero successes (no duplicate risk).
      if (shouldRetryAfterTotalFailure(r)) {
        await unmarkNotified(item.kind, dedupId);
      }
    }

    return NextResponse.json({
      ok: true,
      queued: queue.map(q => ({ kind: q.kind, series: q.seriesSlug, round: q.round })),
      sent,
      skipped,
      evicted,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
