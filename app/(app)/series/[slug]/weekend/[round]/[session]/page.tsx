import Link from 'next/link';
import { notFound } from 'next/navigation';
import { seriesInk } from '@/lib/site';
import type { Metadata } from 'next';
import { ArrowUpRight, Tv } from 'lucide-react';
import { loadSeries } from '@/lib/series';
import { circuitLayoutFor } from '@/lib/circuit-layout';
import { matchCircuitEntry, venueCandidates } from '@/lib/circuits';
import { LocalTime } from '@/components/LocalTime';
import {
  sessionBySlug,
  sessionSlug,
  weekendFor,
  weekendLabel,
  weekendSessionNav,
  weekendStartEnd,
} from '@/lib/weekend';
import {
  fetchOpenF1WeekendSessions,
  fetchSessionClassification,
  hasResolvedDrivers,
  type SessionClassification,
} from '@/lib/results/openf1';
import {
  matchOpenF1Session,
  isRaceLikeTitle,
  CLASS_RESULT_SERIES,
  FORMULA_SESSION_SERIES,
  fetchClassClassifications,
  fetchFormulaNonRaceClassification,
  fetchRoundClassification,
} from '@/lib/results/session-classification';
import { fetchMotoGPSessionClassification } from '@/lib/results/motogp';
import { fetchWsbkSessionClassification } from '@/lib/results/wsbk';
import { fetchWrcStageClassification } from '@/lib/results/wrc';
import { withSocialMeta } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbLd, sportsEventLd } from '@/lib/json-ld';
import { VideoEmbed } from '@/components/VideoEmbed';
import { loadMedia, videoForSession } from '@/lib/media';
import {
  readResultsCache,
  writeResultsCache,
  sessionClassCacheKey,
} from '@/lib/results-cache';
import { buildDecoderSummary, type DecoderSummary } from '@/lib/openf1/decoder';
import { QualifyingDecoder } from '@/components/f1/QualifyingDecoder';
import { AnalysisGate } from '@/components/f1/AnalysisGate';
import { auth } from '@clerk/nextjs/server';
import { buildRaceStory } from '@/lib/openf1/racestory-loader';
import type { RaceStoryData } from '@/lib/openf1/racestory';
import { RaceStory } from '@/components/f1/RaceStory';
import {
  buildSpeedTrapLeaderboard,
  type SpeedTrapLeaderboard as SpeedTrapData,
} from '@/lib/openf1/speed-traps';
import { SpeedTrapLeaderboard } from '@/components/f1/SpeedTrapLeaderboard';
import { buildPitStopLeague, type PitStopLeague as PitStopData } from '@/lib/openf1/pit-league';
import { PitStopLeague } from '@/components/f1/PitStopLeague';
import { buildOvertakesBoard, type OvertakesBoard as OvertakesData } from '@/lib/openf1/overtakes';
import { OvertakesBoard } from '@/components/f1/OvertakesBoard';
import { buildPracticeAnalysis, type PracticeAnalysis as PracticeData } from '@/lib/openf1/practice';
import { PracticeAnalysis } from '@/components/f1/PracticeAnalysis';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { PAGE_WIDE, SITE_URL } from '@/lib/site';

export const dynamic = 'force-dynamic';

// Post-race classifications are immutable, so we KV-persist each session's
// computed result and read it first on later renders — eliding the upstream
// fan-out (OpenF1's ~4-call chain, Pulselive, or the season-results pull).
// The 7-day TTL is the balance between two pressures: long enough that a
// session captured on Friday survives the live-session 401 lockout OpenF1
// imposes across the rest of the race weekend; short enough to re-pull within
// the window where late penalty corrections land (those are otherwise owned by
// the results-overrides lifecycle, not this cache).
const SESSION_CLASS_TTL_SECONDS = 7 * 24 * 60 * 60;

type CachedSessionClassification = {
  classification: SessionClassification | null;
  classClassifications: { cls: string; data: SessionClassification }[];
};

function parseRound(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

// The per-series classification adapters + session pickers moved to
// lib/results/session-classification.ts (the series-contract layer) — this
// page now only orchestrates: cache policy, the F1/OpenF1 path, and render.

async function resolve(params: Promise<{ slug: string; round: string; session: string }>) {
  const { slug, round: roundRaw, session: sessionParam } = await params;
  const round = parseRound(roundRaw);
  if (!round) return null;
  let series;
  try {
    series = await loadSeries(slug);
  } catch {
    return null;
  }
  const weekend = weekendFor(series, round);
  if (!weekend) return null;
  const session = sessionBySlug(weekend, sessionParam);
  if (!session) return null;
  return { series, weekend, session, round, slug, sessionParam };
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string; round: string; session: string }> },
): Promise<Metadata> {
  const ctx = await resolve(params);
  // notFound() in metadata, not a fallback title: the streamed shell flushes
  // before the body's notFound() can 404 (soft-404 class, weekend/[round]).
  if (!ctx) notFound();
  const { title: weekendTitle } = weekendLabel(ctx.weekend, ctx.round);
  const base = `${ctx.series.meta.name} · ${weekendTitle} · ${ctx.session.title.replace(/^.*?-\s*/, '')}`;
  const title = base.length > 60 ? `${base.slice(0, 59)}…` : base;
  const hasFullClassification =
    ['f1', 'f2', 'f3', 'motogp', 'wsbk'].includes(ctx.slug);
  const metaSessionName = ctx.session.title.replace(/^.*?[-–—:]\s*/, '').trim() || ctx.session.title;
  const description = `What time is ${metaSessionName} at the ${ctx.series.meta.name} ${weekendTitle}? Start time shown in your local time zone${hasFullClassification ? ', plus full classification and results' : ''}.`;
  const path = `/series/${ctx.slug}/weekend/${ctx.round}/${ctx.sessionParam}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    ...withSocialMeta({ title, description, path }),
  };
}

function SessionRail({ items }: { items: ReturnType<typeof weekendSessionNav>['items'] }) {
  return (
    <nav aria-label="Weekend sessions" className="mb-6 border-y border-border">
      {/* Wrap rather than horizontal-scroll: rallies have ~18 stage sessions,
          and the old `overflow-x-auto scrollbar-none` hid SS11+ off-screen with
          no scrollbar affordance. Few-session weekends (F1 etc.) still sit on
          one line; many-session weekends wrap to a full, visible stage index. */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 py-1">
        {items.map(item => (
          <Link
            key={item.uid}
            href={item.href}
            aria-current={item.isCurrent ? 'page' : undefined}
            title={item.title}
            className={`shrink-0 inline-flex items-center h-10 border-b-2 px-0.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] whitespace-nowrap transition-colors duration-(--duration-fast) ${
              item.isCurrent
                ? 'border-tint text-text'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function SessionPager({
  prev,
  next,
}: {
  prev: { href: string; label: string } | null;
  next: { href: string; label: string } | null;
}) {
  if (!prev && !next) return null;
  return (
    <div className="mt-8 flex items-center justify-between font-mono text-[11px] font-semibold uppercase tracking-[0.16em]">
      {prev ? (
        <Link
          href={prev.href}
          className="inline-flex items-center gap-1.5 text-text-muted hover:text-text transition-colors duration-(--duration-fast)"
        >
          <span aria-hidden>&larr;</span> {prev.label}
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          href={next.href}
          className="inline-flex items-center gap-1.5 text-text-muted hover:text-text transition-colors duration-(--duration-fast)"
        >
          {next.label} <span aria-hidden>&rarr;</span>
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}

function ClassificationTable({
  data,
  heading = 'Classification',
  showHeading = true,
}: {
  data: SessionClassification;
  // Multi-class series render one table per class ("Hypercar", "LMGT3").
  heading?: string;
  // The single-classification case sits inside a CollapsibleSection whose
  // summary already reads "Classification"; suppress the inner heading there
  // to avoid duplicating it. Multi-class tables keep their per-class headings.
  showHeading?: boolean;
}) {
  // Interval (gap to the car ahead) renders only where the feed actually
  // carries it — F1 rows via OpenF1's gap_to_leader (see deriveIntervals in
  // lib/results/openf1.ts). Other series never set it, so the column simply
  // doesn't exist for them; rows where it can't be honestly derived (leader,
  // lapped, DNF) show an em dash.
  const hasIntervals = data.entries.some(e => e.interval);
  return (
    <section className="border-y border-border py-4">
      {showHeading ? (
        <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-3">
          {heading}
        </h2>
      ) : null}
      <ul className="divide-y divide-border/60">
        {data.entries.map(e => (
          <li
            key={`${e.position}-${e.driverName}`}
            className="flex items-baseline gap-3 py-2 transition-colors duration-(--duration-fast) hover:bg-surface"
          >
            <span className="w-6 text-text-faint text-sm font-mono tabular-nums text-right">
              {e.position ?? '–'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-text text-sm font-medium truncate">{e.driverName}</span>
                {e.coDriverName ? (
                  <span className="hidden sm:inline text-text-muted text-xs font-normal truncate">/ {e.coDriverName}</span>
                ) : null}
                {e.driverCode ? (
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] font-semibold text-text-faint border border-border px-1.5 py-0.5">
                    {e.driverCode}
                  </span>
                ) : null}
              </div>
              <div className="text-text-muted text-xs truncate">
                {e.car ? (e.team ? `${e.car} · ${e.team}` : e.car) : e.team}
              </div>
            </div>
            {data.isQualifying ? (
              <span className="hidden sm:flex items-baseline gap-3 font-mono text-[11px] tabular-nums text-text-muted">
                <span className="w-20 text-right">{e.q1 ?? ''}</span>
                <span className="w-20 text-right">{e.q2 ?? ''}</span>
                <span className="w-20 text-right text-text">{e.q3 ?? ''}</span>
              </span>
            ) : null}
            {hasIntervals ? (
              <span className="hidden sm:block w-20 shrink-0 font-mono text-[11px] tabular-nums text-right text-text-muted">
                {e.interval ?? '—'}
              </span>
            ) : null}
            <span className={`font-mono text-[11px] tabular-nums text-right w-24 truncate ${data.isQualifying ? 'sm:hidden text-text' : 'text-text-muted'}`}>
              {e.status ?? (e.position === 1 ? e.time : e.gap || e.time) ?? ''}
            </span>
            {data.isRace ? (
              <span className="text-text text-sm font-mono tabular-nums text-right w-10">
                {e.points ?? 0}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {data.isQualifying ? (
        <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint sm:text-right">
          <span className="hidden sm:inline">Columns: Q1 · Q2 · Q3</span>
          <span className="sm:hidden">Best qualifying lap shown</span>
        </div>
      ) : hasIntervals ? (
        <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint sm:text-right">
          <span className="hidden sm:inline">Columns: Interval · Gap</span>
          <span className="sm:hidden">Gap to leader shown</span>
        </div>
      ) : null}
    </section>
  );
}

export default async function SessionPage({
  params,
}: {
  params: Promise<{ slug: string; round: string; session: string }>;
}) {
  const ctx = await resolve(params);
  if (!ctx) notFound();
  const { series, weekend, session, round, slug, sessionParam } = ctx;

  const now = new Date();
  const isLive = !session.dateOnly && session.start <= now && now <= session.end;
  const isPast = !isLive && session.end < now;
  const color = series.meta.color;
  const { title: weekendTitle } = weekendLabel(weekend, round);
  const sessionName = session.title.replace(/^.*?[-–—:]\s*/, '').trim() || session.title;

  // Classification: F1 has every session via OpenF1; the class-based series
  // (WEC / IMSA / GT World) render per-class tables from their season feeds;
  // the RACE_SESSION_SERIES set reuses flat season-results feeds. Only past
  // sessions have a classification, and once a session is past it's immutable —
  // so read a KV-persisted copy first and only hit upstream on a miss.
  let classification: SessionClassification | null = null;
  let classClassifications: { cls: string; data: SessionClassification }[] = [];
  if (isPast && slug === 'wrc') {
    // Curated per-stage content is a cheap local read and the operator edits it
    // in place — skip the 7-day KV session cache so edits surface on the next
    // deploy instead of being pinned stale for a week.
    classification = await fetchWrcStageClassification(round, session.title);
  } else if (isPast) {
    const cacheKey = sessionClassCacheKey(
      slug,
      series.meta.season,
      round,
      sessionSlug(session.title),
    );
    const cached = await readResultsCache<CachedSessionClassification>(cacheKey);
    if (cached) {
      classification = cached.classification;
      classClassifications = cached.classClassifications ?? [];
    } else {
      if (slug === 'f1') {
        const { start, end } = weekendStartEnd(weekend);
        const candidates = await fetchOpenF1WeekendSessions(start, end);
        const match = session.dateOnly
          ? null
          : matchOpenF1Session(candidates, sessionSlug(session.title), session.start);
        if (match) classification = await fetchSessionClassification(match);
      } else if (CLASS_RESULT_SERIES.has(slug) && isRaceLikeTitle(session.title)) {
        classClassifications = await fetchClassClassifications(series, round, session.title);
      } else if (FORMULA_SESSION_SERIES.has(slug) && !isRaceLikeTitle(session.title)) {
        classification = await fetchFormulaNonRaceClassification(slug, series.meta.season, round, session.title);
      } else if ((slug === 'motogp' || slug === 'wsbk') && !isRaceLikeTitle(session.title)) {
        const sl = sessionSlug(session.title);
        classification =
          slug === 'wsbk'
            ? await fetchWsbkSessionClassification(series.meta.season, round, sl)
            : await fetchMotoGPSessionClassification(series.meta.season, round, sl);
      } else {
        classification = await fetchRoundClassification(series, round, session.title);
      }

      // Persist only a real result — never cache a null/empty miss, so a
      // transient upstream failure (e.g. the OpenF1 live-session 401) doesn't
      // freeze an empty page for the whole TTL; it retries next render instead.
      // `hasResolvedDrivers` extends that to a HALF-failure: a classification
      // whose driver join was throttled to `[]` renders `#1`/`#3` with blank
      // teams, and caching that pinned the Hungary race in that state for days.
      if ((classification && hasResolvedDrivers(classification)) || classClassifications.length > 0) {
        await writeResultsCache(
          cacheKey,
          { classification, classClassifications },
          SESSION_CLASS_TTL_SECONDS,
        );
      }
    }
  }

  // F1 telemetry surfaces (past sessions, free historical OpenF1): qualifying →
  // the Decoder (lap comparison), race/sprint → the Race Story (strategy +
  // moments), practice → the Practice Analysis (fastest laps + long-run pace).
  // Boards sit below those: the speed trap (every session), the pit-stop league
  // + overtakes board (race only). All are server-rendered (SEO-visible) and
  // KV-cached per session, so a warm render skips the OpenF1 fan-out; the
  // Decoder traces fetch client-side per pair. Resolve this session's OpenF1 key
  // once and reuse it for every board.
  // Account gate: the F1 telemetry ANALYSIS surfaces (Qualifying Analysis + the
  // ghost Replay, Race Story, Practice Analysis) are signed-in-only. Resolved
  // server-side so a locked visitor never receives the analysis payload (a
  // client <SignedIn> wrap would still ship it in the HTML). Classification and
  // the stat boards (speed trap / pit league / overtakes) stay public. The page
  // is already force-dynamic, so auth() adds no caching penalty.
  const { userId } = await auth();
  const analysisUnlocked = Boolean(userId);

  let decoderSummary: DecoderSummary | null = null;
  let raceStory: RaceStoryData | null = null;
  let speedTrap: SpeedTrapData | null = null;
  let pitLeague: PitStopData | null = null;
  let overtakes: OvertakesData | null = null;
  let practice: PracticeData | null = null;
  if (slug === 'f1' && isPast && !session.dateOnly) {
    const isQualifyingSession = /qualifying|superpole|shootout/i.test(sessionName);
    const isRaceSession = isRaceLikeTitle(session.title);
    // Practice = the FP1/FP2/FP3 sessions (and any "Practice N"); a sprint
    // weekend's single practice counts too. Quali/race titles are matched
    // first above, so this only catches the genuine practice sessions.
    const isPracticeSession =
      !isQualifyingSession && !isRaceSession && /practice|^fp\s*\d/i.test(sessionName);
    if (isQualifyingSession || isRaceSession || isPracticeSession) {
      const { start, end } = weekendStartEnd(weekend);
      const candidates = await fetchOpenF1WeekendSessions(start, end);
      const match = matchOpenF1Session(candidates, sessionSlug(session.title), session.start);
      if (match) {
        const sk = match.session_key;
        // Speed trap applies to every session type; the pit-stop league +
        // overtakes board are race-only; the practice analysis is practice-only.
        // Assemble the right set in parallel — each builder is independently
        // KV-cached and degrades to empty, and the client's token bucket paces
        // the underlying OpenF1 calls.
        const [decoder, story, traps, pit, ot, prac] = await Promise.all([
          isQualifyingSession ? buildDecoderSummary(sk, 'f1') : Promise.resolve(null),
          isRaceSession ? buildRaceStory(sk, 'f1') : Promise.resolve(null),
          buildSpeedTrapLeaderboard(sk, 'f1'),
          isRaceSession ? buildPitStopLeague(sk, 'f1') : Promise.resolve(null),
          isRaceSession ? buildOvertakesBoard(sk, 'f1') : Promise.resolve(null),
          isPracticeSession ? buildPracticeAnalysis(sk, 'f1') : Promise.resolve(null),
        ]);
        if (decoder && decoder.laps.length > 0) decoderSummary = decoder;
        if (story && (story.stints.length > 0 || story.moments.length > 0)) raceStory = story;
        if (traps.entries.length > 0) speedTrap = traps;
        if (pit && pit.entries.length > 0) pitLeague = pit;
        if (ot && ot.entries.length > 0) overtakes = ot;
        if (prac && (prac.fastest.length > 0 || prac.longRuns.length > 0)) practice = prac;
      }
    }
  }

  const nav = weekendSessionNav(weekend, slug, round, session.uid);

  // Embedded highlights for this session, where curated (any series). The race
  // session falls back to the round's headline clip.
  const media = await loadMedia(slug);
  const sessionVid = videoForSession(
    media,
    round,
    sessionSlug(session.title),
    isRaceLikeTitle(session.title),
  );

  // Watch link (same series.meta.watch the home UP NEXT card reads) + the
  // round's circuit schematic where one is curated — resolved exactly like the
  // weekend page (venue/name via the shared circuit matcher; fs reads, so it
  // gracefully nulls for circuits without a layout).
  const watch = series.meta.watch;
  // roundMeta first: a curated `venue` overrides name-based circuit resolution
  // (the 2026 Bahrain GP runs at Sepang), and both lookups below depend on it.
  const roundMeta = series.rounds?.rounds?.find(r => r.round === round);
  const venueCandidateList = venueCandidates({
    venue: roundMeta?.venue,
    location: weekend.sessions.find(s => s.location)?.location,
    title: weekendTitle,
  });
  const circuitLayout = await circuitLayoutFor(...venueCandidateList);

  // SportsEvent enrichment for the session event — the same circuit (address/geo)
  // + round (host country / cancellation) resolution the weekend page does, so
  // the session-level SportsEvent carries a full address, not a name-only Place.
  // fs reads, cheap; gracefully partial when a venue/round isn't curated.
  const circuitMatch = await matchCircuitEntry(...venueCandidateList);

  // Per-session structured data: a breadcrumb (Home > series > weekend >
  // session) plus a session-level SportsEvent whose startDate is the real
  // session instant — the "what time is <session>" rich-result signal. Emitted
  // only when the time is known (dateOnly/TBC sessions have no real instant).
  const sessionEventName = `${sessionName} at ${series.meta.name} ${weekendTitle}`;
  const sessionUrl = `${SITE_URL}/series/${slug}/weekend/${round}/${sessionParam}`;
  const sessionEventDescription =
    `${sessionName} at the ${series.meta.name} ${weekendTitle}` +
    `, Round ${round} of the ${series.meta.season} season.`;

  return (
    <div
      className={`relative ${PAGE_WIDE}`}
      style={{ '--tint': color, '--tint-fill': color, ['--series-color' as string]: color } as React.CSSProperties}
    >
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', url: SITE_URL },
          { name: series.meta.name, url: `${SITE_URL}/series/${slug}` },
          { name: weekendTitle, url: `${SITE_URL}/series/${slug}/weekend/${round}` },
          { name: sessionName, url: sessionUrl },
        ])}
      />
      {!session.dateOnly && (
        <JsonLd
          data={sportsEventLd({
            weekend,
            series,
            slug,
            round,
            title: sessionEventName,
            startDate: session.start,
            endDate: session.end,
            url: sessionUrl,
            description: sessionEventDescription,
            organizerUrl: series.meta.officialSite ?? `${SITE_URL}/series/${slug}`,
            addressCountry: circuitMatch?.circuit.countryCode ?? roundMeta?.countryCode,
            venue: circuitMatch?.circuit.name,
            geo: circuitMatch
              ? { lat: circuitMatch.circuit.lat, lon: circuitMatch.circuit.lon }
              : undefined,
            cancelled: roundMeta?.cancelled,
            watch,
          })}
        />
      )}
      <div
        className="absolute top-0 left-0 right-0 h-px -z-10"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />

      <section className="mb-8 border-y border-border py-5 md:py-6">
        <div className="flex items-center gap-2.5 mb-3 flex-wrap font-mono text-[11px] uppercase tracking-[0.18em] font-semibold">
          <Link
            href={`/series/${slug}`}
            className="text-text-muted hover:text-text transition-colors duration-(--duration-fast)"
          >
            {series.meta.name}
          </Link>
          <span className="text-border-strong">·</span>
          <Link
            href={`/series/${slug}/weekend/${round}`}
            className="text-text-muted hover:text-text transition-colors duration-(--duration-fast)"
          >
            {weekendTitle}
          </Link>
          <span className="text-border-strong">·</span>
          <span className="tabular-nums text-tint">Round {round}</span>
          {isLive && (
            <>
              <span className="text-border-strong">·</span>
              <span className="inline-flex items-center gap-1.5 text-[10px] tracking-[0.14em] px-2 py-0.5 bg-live/15 text-live-pill">
                <span className="w-1.5 h-1.5 rounded-full bg-live live-pulse" />
                live
              </span>
            </>
          )}
          {/* Quick-links back into the series — from a deep session page,
              Standings / Results are otherwise a multi-step back-track. */}
          <span className="text-border-strong">·</span>
          <Link
            href={`/series/${slug}/standings`}
            className="text-text-muted hover:text-text transition-colors duration-(--duration-fast)"
          >
            Standings
          </Link>
          <span className="text-border-strong">·</span>
          <Link
            href={`/series/${slug}/results`}
            className="text-text-muted hover:text-text transition-colors duration-(--duration-fast)"
          >
            Results
          </Link>
        </div>

        <h1 className="font-display text-4xl md:text-5xl font-extrabold uppercase tracking-wide leading-[0.95] text-text">
          {sessionName}
          <span style={{ color: seriesInk(color) }}>.</span>
        </h1>

        <div className="mt-4 flex items-baseline gap-4 flex-wrap">
          {session.dateOnly ? (
            <span className="text-lg md:text-xl font-semibold text-text tnum font-mono">TBC</span>
          ) : (
            <time
              dateTime={session.start.toISOString()}
              className="text-lg md:text-xl font-semibold text-text tnum font-mono"
            >
              <LocalTime instant={session.start.getTime()} />
            </time>
          )}
          {session.location && (
            <span className="text-sm text-text-faint">{session.location}</span>
          )}
        </div>

        {watch && (
          <div className="mt-3">
            <a
              href={watch.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted hover:text-brand transition-colors duration-(--duration-fast)"
            >
              <Tv size={13} />
              {isPast ? 'Watch on' : 'Watch live on'} {watch.service}
              <ArrowUpRight size={12} className="opacity-60" />
            </a>
          </div>
        )}

        {circuitLayout && (
          <figure className="mt-4 flex items-center gap-3">
            {/* Compact take on the weekend hero's circuit figure: fixed square
                box (the schematics share a square viewBox) so the lazy image
                reserves its footprint, name + attribution alongside. */}
            <div className="aspect-square w-16 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={circuitLayout.svg}
                alt={`${circuitLayout.name} circuit layout`}
                loading="lazy"
                width={64}
                height={64}
                className="h-full w-full object-contain"
              />
            </div>
            <figcaption className="min-w-0">
              <div className="text-sm font-medium text-text">{circuitLayout.name}</div>
              <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
                Circuit map ·{' '}
                <a
                  href={circuitLayout.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-text-muted"
                >
                  {circuitLayout.source}
                </a>{' '}
                ({circuitLayout.license})
              </div>
            </figcaption>
          </figure>
        )}
      </section>

      <SessionRail items={nav.items} />

      {sessionVid && (
        <VideoEmbed id={sessionVid} title={`${sessionName} — ${weekendTitle}`} />
      )}

      <CollapsibleSection title={slug === 'wrc' ? 'Overall classification' : 'Classification'} defaultOpen>
        {classification ? (
          <ClassificationTable data={classification} showHeading={false} />
        ) : classClassifications.length > 0 ? (
          <div className="space-y-4">
            {classClassifications.map(({ cls, data }) => (
              <ClassificationTable key={cls} data={data} heading={cls} />
            ))}
          </div>
        ) : isPast ? (
          <section className="border-y border-border py-5 text-center">
            <p className="text-text-muted text-sm">
              {slug === 'f1'
                ? 'Classification not available for this session yet.'
                : slug === 'wrc'
                  ? 'The full field for this stage isn’t published yet. The rally result and season standings live on the series page.'
                  : isRaceLikeTitle(session.title)
                    ? 'Classification not available for this race yet — season results live on the series page.'
                    : 'Practice and qualifying classifications aren’t published for this series — race sessions carry the full result.'}
            </p>
            <Link
              href={`/series/${slug}/results`}
              className="mt-3 inline-block font-mono text-[11px] uppercase tracking-[0.16em] font-semibold text-text-muted hover:text-text transition-colors duration-(--duration-fast)"
            >
              Season results →
            </Link>
          </section>
        ) : (
          <section className="border-y border-border py-5 text-center">
            <p className="text-text-muted text-sm">
              Classification appears here once the session has run.
            </p>
          </section>
        )}
      </CollapsibleSection>

      {decoderSummary &&
        (analysisUnlocked ? (
          <CollapsibleSection title="Qualifying Analysis" defaultOpen>
            <QualifyingDecoder summary={decoderSummary} seriesColor={color} />
          </CollapsibleSection>
        ) : (
          <AnalysisGate
            title="Qualifying Analysis"
            blurb="Lap-by-lap pole breakdown, sector and corner deltas, and the ghost-lap Replay."
            seriesColor={color}
          />
        ))}

      {raceStory &&
        (analysisUnlocked ? (
          <CollapsibleSection title="Race Story" defaultOpen>
            <RaceStory data={raceStory} seriesColor={color} />
          </CollapsibleSection>
        ) : (
          <AnalysisGate
            title="Race Story"
            blurb="The strategy that decided the race — stints, tyre choices, pit windows and the moments that turned it."
            seriesColor={color}
          />
        ))}

      {practice &&
        (analysisUnlocked ? (
          <CollapsibleSection title="Practice Analysis" defaultOpen={false}>
            <PracticeAnalysis data={practice} seriesColor={color} />
          </CollapsibleSection>
        ) : (
          <AnalysisGate
            title="Practice Analysis"
            blurb="Fastest laps and long-run race pace from every practice session."
            seriesColor={color}
          />
        ))}

      {speedTrap && (
        <CollapsibleSection title="Speed Trap" defaultOpen={false}>
          <SpeedTrapLeaderboard data={speedTrap} seriesColor={color} />
        </CollapsibleSection>
      )}

      {pitLeague && (
        <CollapsibleSection title="Pit-Stop League" defaultOpen={false}>
          <PitStopLeague data={pitLeague} seriesColor={color} />
        </CollapsibleSection>
      )}

      {overtakes && (
        <CollapsibleSection title="Overtakes of the Race" defaultOpen={false}>
          <OvertakesBoard data={overtakes} seriesColor={color} />
        </CollapsibleSection>
      )}

      <SessionPager prev={nav.prev} next={nav.next} />
    </div>
  );
}
