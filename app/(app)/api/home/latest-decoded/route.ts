import { NextResponse } from 'next/server';
import { loadSeries } from '@/lib/series';
import { weekendFor, weekendStartEnd, weekendLabel, sessionSlug } from '@/lib/weekend';
import { fetchOpenF1WeekendSessions, type OpenF1Session } from '@/lib/results/openf1';
import { buildDecoderSummary } from '@/lib/openf1/decoder';

// "Latest Decoded" home-widget data (F1). Resolves the most recent PAST F1
// round, then surfaces a card for its qualifying (→ Qualifying Decoder, with the
// pole + P2 driver codes) and/or race (→ Race Story). Served as cacheable Ajax
// so /app stays statically generated; the OpenF1 fan-out behind
// buildDecoderSummary is itself KV-cached (immutable historical data), so a warm
// window does no upstream work.
//
// LIGHT by design: only the qualifying path calls buildDecoderSummary (one
// drivers+laps fetch, KV read-through) to get pole/P2 codes; the race path is a
// deep link only — no Race Story assembly here. Fail-soft to null throughout.
export const dynamic = 'force-dynamic';

const F1_SLUG = 'f1';

export interface HomeDecodedData {
  round: number;
  /** GP / weekend name, e.g. "Austrian Grand Prix". */
  gp: string;
  qualifying: {
    href: string;
    pole: string | null;
    p2: string | null;
  } | null;
  race: { href: string } | null;
}

/** Pole + P2 driver codes from a session's decoder summary. `laps` is
 *  pre-sorted fastest-first, so [0] is pole and [1] is P2. */
async function poleAndP2(sessionKey: number): Promise<{ pole: string | null; p2: string | null }> {
  const summary = await buildDecoderSummary(sessionKey, F1_SLUG);
  if (summary.laps.length === 0) return { pole: null, p2: null };
  const codeFor = (n: number | undefined): string | null =>
    summary.drivers.find(d => d.number === n)?.code ?? null;
  return { pole: codeFor(summary.laps[0]?.driverNumber), p2: codeFor(summary.laps[1]?.driverNumber) };
}

export async function GET() {
  try {
    const series = await loadSeries(F1_SLUG);
    const rounds = series.rounds?.rounds ?? [];
    const now = Date.now();

    // Latest round whose weekend has finished (endDate is a YYYY-MM-DD date; treat
    // it as past once the calendar day is over). Rounds.json is ascending, so the
    // last finished one is the most recent.
    const pastRounds = rounds
      .filter(r => !r.cancelled && Number.isFinite(Date.parse(r.endDate)))
      // endDate is date-only; add a day so "today is race day" still counts as
      // finished once that day has elapsed in UTC.
      .filter(r => Date.parse(r.endDate) + 86_400_000 <= now)
      .sort((a, b) => Date.parse(b.endDate) - Date.parse(a.endDate));
    const latest = pastRounds[0];
    if (!latest) return NextResponse.json(null, { headers: cacheHeaders() });

    const weekend = weekendFor(series, latest.round);
    if (!weekend) return NextResponse.json(null, { headers: cacheHeaders() });

    const gp = latest.name || weekendLabel(weekend, latest.round).title;

    // Find the weekend's qualifying + race sessions (past, non-TBC). Quali matches
    // the same family the session page decodes; race is the main grand prix.
    const sessions = weekend.sessions.filter(s => !s.dateOnly && s.end.getTime() <= now);
    const qualiSession = sessions.find(s => /qualifying|superpole|shootout/i.test(s.title) && !/sprint/i.test(s.title))
      ?? sessions.find(s => /qualifying|superpole|shootout/i.test(s.title));
    const raceSession = sessions.find(s => /grand prix|^race$|\brace\b/i.test(s.title) && !/sprint/i.test(s.title));

    // One OpenF1 session list for the weekend, shared by both lookups (the call is
    // data-cached upstream). Used to resolve the quali session_key for decoding.
    let candidates: OpenF1Session[] = [];
    if (qualiSession) {
      const { start, end } = weekendStartEnd(weekend);
      candidates = await fetchOpenF1WeekendSessions(start, end);
    }

    let qualifying: HomeDecodedData['qualifying'] = null;
    if (qualiSession) {
      const slug = sessionSlug(qualiSession.title);
      const match = matchByNameOrTime(candidates, slug, qualiSession.start);
      let codes = { pole: null as string | null, p2: null as string | null };
      if (match) codes = await poleAndP2(match.session_key);
      qualifying = {
        href: `/series/${F1_SLUG}/weekend/${latest.round}/${slug}`,
        pole: codes.pole,
        p2: codes.p2,
      };
    }

    const race: HomeDecodedData['race'] = raceSession
      ? { href: `/series/${F1_SLUG}/weekend/${latest.round}/${sessionSlug(raceSession.title)}` }
      : null;

    // Nothing worth showing if neither half resolved.
    if (!qualifying && !race) return NextResponse.json(null, { headers: cacheHeaders() });

    const data: HomeDecodedData = { round: latest.round, gp, qualifying, race };
    return NextResponse.json(data, { headers: cacheHeaders() });
  } catch {
    return NextResponse.json(null, { headers: cacheHeaders() });
  }
}

// Match a curated session to its OpenF1 twin: slugified name first, then nearest
// start within 3h (mirrors matchOpenF1Session in the session page — names drift
// across eras, start times don't).
function matchByNameOrTime(candidates: OpenF1Session[], slug: string, start: Date): OpenF1Session | null {
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

function cacheHeaders() {
  return {
    // Historical/immutable once a weekend is done; long edge-cache, stale-while-
    // revalidate so the swap to the NEXT finished round costs at most one miss.
    'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
  };
}
