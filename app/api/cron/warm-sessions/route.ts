import { NextResponse } from 'next/server';
import { authorizeCronRequest, cronAuthFailureResponse } from '@/lib/cron-auth';
import { loadSeries } from '@/lib/series';
import {
  buildRoundLookup,
  roundFor,
  sessionSlug,
  weekendFor,
  weekendStartEnd,
} from '@/lib/weekend';
import {
  fetchOpenF1WeekendSessions,
  fetchSessionClassification,
  hasResolvedDrivers,
  type OpenF1Session,
} from '@/lib/results/openf1';
import {
  readResultsCache,
  writeResultsCache,
  sessionClassCacheKey,
} from '@/lib/results-cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Pre-warms the F1 session-classification KV (paddock:session-class:f1:*) for
// sessions that ENDED recently, so the entry exists BEFORE OpenF1's next
// live-session 401 lockout. Today the capture only happens when a visitor opens
// the session page between "session ends" and "next session goes live" — miss
// that window (overnight quali → race morning) and the page renders empty until
// the weekend is over. This cron closes the gap on a 30-min tick
// (.github/workflows/warm-sessions.yml).
//
// It invokes the SAME capture path the session page uses (fetch OpenF1 weekend
// sessions → match by slug/start → fetch classification → KV write with the
// page's exact `{ classification, classClassifications }` shape + 7-day TTL)
// rather than self-pinging the public page URL: a direct capture skips the
// page's full telemetry fan-out (decoder/race-story builders — pointless load
// mid-lockout), needs no Clerk/auth in the loop, and lets the run report
// exactly what it warmed. Keep the write shape in sync with
// app/(app)/series/[slug]/weekend/[round]/[session]/page.tsx
// (`CachedSessionClassification` + SESSION_CLASS_TTL_SECONDS).
//
// F1-only by design — that's the series with the lockout; other series' feeds
// stay readable after a session ends. Cron-auth'd + fail-closed
// (lib/cron-auth). Report-only failures: an empty OpenF1 answer (still locked
// out / not yet published) is never cached, so the next tick retries.

// Sessions that ended within this window are warm candidates. 6h comfortably
// covers a full race-day gap between ticks plus late-running sessions.
const LOOKBACK_MINUTES = 6 * 60;
// Give OpenF1 a few minutes to publish session_result before the first attempt;
// too-early fetches just burn calls (misses are retried next tick anyway).
const MIN_AGE_MINUTES = 10;
// Politeness cap on upstream capture attempts per run (~3 OpenF1 calls each).
// No F1 weekend has more than 2-3 sessions ending within a 6h window.
const MAX_CAPTURES_PER_RUN = 3;
// Must match the session page's SESSION_CLASS_TTL_SECONDS (7 days): long enough
// that a Friday capture survives the rest of the weekend's lockout.
const SESSION_CLASS_TTL_SECONDS = 7 * 24 * 60 * 60;

// Same matcher as the session page: slugified OpenF1 session name first, then
// nearest start time within 3h — names drift across eras, start times don't.
function matchOpenF1Session(
  candidates: OpenF1Session[],
  slug: string,
  start: Date,
): OpenF1Session | null {
  const byName = candidates.find(s => sessionSlug(s.session_name) === slug);
  if (byName) return byName;
  let best: OpenF1Session | null = null;
  let bestDelta = 3 * 3600 * 1000;
  for (const s of candidates) {
    const delta = Math.abs(new Date(s.date_start).getTime() - start.getTime());
    if (delta < bestDelta) {
      bestDelta = delta;
      best = s;
    }
  }
  return best;
}

interface WarmOutcome {
  session: string;
  round: number | null;
  status:
    | 'warmed'
    | 'already-warm'
    | 'no-round'
    | 'no-openf1-match'
    | 'no-classification'
    | 'no-driver-names'
    | 'capture-cap';
}

export async function GET(req: Request) {
  const auth = authorizeCronRequest(req);
  if (auth !== 'ok') return cronAuthFailureResponse(auth);

  try {
    const series = await loadSeries('f1');
    const now = new Date();
    const roundLookup = buildRoundLookup(series, now);

    const candidates = series.sessions
      .filter(s => {
        if (s.dateOnly) return false;
        const minsSinceEnd = (now.getTime() - s.end.getTime()) / 60000;
        return minsSinceEnd >= MIN_AGE_MINUTES && minsSinceEnd <= LOOKBACK_MINUTES;
      })
      // Newest-ended first — if the cap ever bites, the freshest session (the
      // one the next lockout threatens first) wins.
      .sort((a, b) => b.end.getTime() - a.end.getTime());

    // One OpenF1 sessions fetch per weekend, shared across a weekend's sessions.
    const weekendSessionsByRound = new Map<number, OpenF1Session[]>();
    const outcomes: WarmOutcome[] = [];
    let captures = 0;

    for (const s of candidates) {
      const slug = sessionSlug(s.title);
      const round = roundFor(roundLookup, series.meta.slug, s.uid);
      if (round === undefined) {
        outcomes.push({ session: slug, round: null, status: 'no-round' });
        continue;
      }

      const cacheKey = sessionClassCacheKey('f1', series.meta.season, round, slug);
      const existing = await readResultsCache<unknown>(cacheKey);
      if (existing != null) {
        outcomes.push({ session: slug, round, status: 'already-warm' });
        continue;
      }

      if (captures >= MAX_CAPTURES_PER_RUN) {
        outcomes.push({ session: slug, round, status: 'capture-cap' });
        continue;
      }
      captures++;

      let weekendSessions = weekendSessionsByRound.get(round);
      if (!weekendSessions) {
        const weekend = weekendFor(series, round, now);
        if (!weekend) {
          outcomes.push({ session: slug, round, status: 'no-round' });
          continue;
        }
        const { start, end } = weekendStartEnd(weekend);
        weekendSessions = await fetchOpenF1WeekendSessions(start, end);
        weekendSessionsByRound.set(round, weekendSessions);
      }

      const match = matchOpenF1Session(weekendSessions, slug, s.start);
      if (!match) {
        outcomes.push({ session: slug, round, status: 'no-openf1-match' });
        continue;
      }

      const classification = await fetchSessionClassification(match);
      if (!classification || classification.entries.length === 0) {
        // Likely still locked out or not yet published — never cache a miss;
        // the next 30-min tick retries.
        outcomes.push({ session: slug, round, status: 'no-classification' });
        continue;
      }
      if (!hasResolvedDrivers(classification)) {
        // Timing came back but the `/drivers` join didn't, so every row is a
        // bare `#<car number>`. Caching that pins a nameless table for the full
        // 7-day TTL; skip and let the next tick try again.
        outcomes.push({ session: slug, round, status: 'no-driver-names' });
        continue;
      }

      await writeResultsCache(
        cacheKey,
        { classification, classClassifications: [] },
        SESSION_CLASS_TTL_SECONDS,
      );
      outcomes.push({ session: slug, round, status: 'warmed' });
    }

    const warmed = outcomes.filter(o => o.status === 'warmed');
    if (warmed.length > 0) {
      console.log(
        `[warm-sessions] warmed ${warmed.length} F1 session classification(s): ` +
          warmed.map(o => `r${o.round}/${o.session}`).join(', '),
      );
    }

    return NextResponse.json({
      ok: true,
      checkedAt: now.toISOString(),
      candidates: candidates.length,
      warmed: warmed.map(o => ({ round: o.round, session: o.session })),
      outcomes,
    });
  } catch (err) {
    console.error('GET /api/cron/warm-sessions failed:', err);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
