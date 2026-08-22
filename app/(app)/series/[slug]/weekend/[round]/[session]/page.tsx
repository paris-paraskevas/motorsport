import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
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
  type SessionClassificationEntry,
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
import { SessionForecast } from '@/components/weekend/SessionForecast';
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
import { SessionClassChips } from '@/components/weekend/SessionClassChips';
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

// Panel 11d: the weekend's sessions as boxed chips, chronological, the current
// one lit — the row reads as a weekend rather than a menu. A session that does
// not exist is absent, and for F1 the row says so ("No sprint at this round")
// rather than leaving the absence ambiguous.
function SessionChips({ items, noSprint }: {
  items: ReturnType<typeof weekendSessionNav>['items'];
  noSprint: boolean;
}) {
  return (
    <nav aria-label="Weekend sessions" className="mb-6">
      <div className="flex flex-wrap items-center gap-2">
        {items.map(item => (
          <Link
            key={item.uid}
            href={item.href}
            aria-current={item.isCurrent ? 'page' : undefined}
            title={item.title}
            className={`inline-flex min-h-[38px] items-center border px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] whitespace-nowrap transition-colors duration-(--duration-fast) ${
              item.isCurrent
                ? 'border-text bg-surface-elevated text-text'
                : 'border-border-strong text-text-muted hover:text-text'
            }`}
          >
            {item.label}
          </Link>
        ))}
        {noSprint && (
          <span className="ml-1 font-mono text-[9px] uppercase tracking-[0.14em] text-text-faint">
            No sprint at this round
          </span>
        )}
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

// Panel 11d: a classification is a table, so it is built like one — a mono
// column-head row, tabular figures, gap as its own column, and the winner's
// row lifted rather than decorated. Six rows are the story; the full field
// sits one tap away behind a native <details>, retirements at the foot with
// their cause. The interval column is gone by design — Time · Gap · Pts is
// the whole grammar.
// Ten rows before "show all", not six (operator, 2026-08-21): a top six cuts
// the points-paying positions in half on a 22-car grid.
const LEAD_ROWS = 10;

function ResultTable({ data }: { data: SessionClassification }) {
  const entries = data.entries;
  const lead = entries.slice(0, LEAD_ROWS);
  const rest = entries.slice(LEAD_ROWS);
  const restClassified = rest.filter(e => !e.status);
  const restRetired = rest.filter(e => e.status);
  const hasNo = entries.some(e => e.carNumber);
  const q = data.isQualifying;

  const teamLine = (e: SessionClassificationEntry) =>
    e.car ? (e.team ? `${e.car} · ${e.team}` : e.car) : e.team;

  const row = (e: SessionClassificationEntry, raised: boolean) => (
    <li
      key={`${e.position}-${e.driverName}`}
      className={`flex items-baseline gap-3 border-t border-border px-1 py-2.5 ${raised ? 'bg-surface-elevated' : ''}`}
    >
      <span
        className={`w-7 shrink-0 text-right font-mono text-[13px] tabular-nums ${
          raised ? 'font-bold text-brand' : 'text-text-muted'
        }`}
      >
        {e.position ?? '–'}
      </span>
      {/* Column rules from here on (operator, 2026-08-21: position and number
          read as one number without them). Desktop only — on mobile the team
          stacks under the driver and vertical rules would cut through it. */}
      {hasNo && (
        <span className="hidden w-8 shrink-0 font-mono text-[11px] tabular-nums text-text-faint sm:block sm:border-l sm:border-border sm:pl-3">
          {e.carNumber ?? ''}
        </span>
      )}
      <div className="min-w-0 flex-1 sm:border-l sm:border-border sm:pl-3">
        <div className="flex items-baseline gap-2">
          <span className="truncate font-serif text-[17px] font-semibold leading-tight text-text">
            {e.driverName}
          </span>
          {e.coDriverName ? (
            <span className="hidden truncate text-xs text-text-muted md:inline">/ {e.coDriverName}</span>
          ) : null}
        </div>
        <div className="truncate font-mono text-[9px] uppercase tracking-[0.12em] text-text-muted sm:hidden">
          {teamLine(e)}
        </div>
      </div>
      <span className="hidden w-[24%] shrink-0 truncate font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted sm:block sm:border-l sm:border-border sm:pl-3">
        {teamLine(e)}
      </span>
      {q ? (
        <>
          <span className="hidden w-20 shrink-0 text-right font-mono text-[11px] tabular-nums text-text-muted sm:block sm:border-l sm:border-border sm:pl-3">
            {e.q1 ?? ''}
          </span>
          <span className="hidden w-20 shrink-0 text-right font-mono text-[11px] tabular-nums text-text-muted sm:block sm:border-l sm:border-border sm:pl-3">
            {e.q2 ?? ''}
          </span>
          <span className="hidden w-20 shrink-0 text-right font-mono text-[11px] tabular-nums text-text sm:block sm:border-l sm:border-border sm:pl-3">
            {e.q3 ?? ''}
          </span>
          <span className="w-20 shrink-0 text-right font-mono text-[11px] tabular-nums text-text sm:hidden">
            {e.q3 ?? e.q2 ?? e.q1 ?? ''}
          </span>
        </>
      ) : (
        <>
          <span className="hidden w-24 shrink-0 text-right font-mono text-[11px] tabular-nums text-text sm:block sm:border-l sm:border-border sm:pl-3">
            {e.time ?? ''}
          </span>
          <span
            className={`hidden w-20 shrink-0 text-right font-mono text-[11px] tabular-nums sm:block sm:border-l sm:border-border sm:pl-3 ${
              e.status ? 'text-brand' : 'text-text-muted'
            }`}
          >
            {e.status ?? e.gap ?? (e.position === 1 && e.time ? '—' : '')}
          </span>
          <span
            className={`w-24 shrink-0 truncate text-right font-mono text-[11px] tabular-nums sm:hidden ${
              e.status ? 'text-brand' : 'text-text'
            }`}
          >
            {e.status ?? (e.position === 1 ? e.time : e.gap || e.time) ?? ''}
          </span>
        </>
      )}
      {data.isRace ? (
        <span className={`w-9 shrink-0 text-right font-mono text-[12px] tabular-nums ${raised ? 'font-bold text-text' : 'text-text'}`}>
          {e.points ?? 0}
        </span>
      ) : null}
    </li>
  );

  return (
    <div>
      <div className="flex items-baseline gap-3 border-b border-text px-1 pb-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-text-muted">
        <span className="w-7 shrink-0 text-right">Pos</span>
        {hasNo && <span className="hidden w-8 shrink-0 sm:block">No</span>}
        <span className="min-w-0 flex-1">Driver</span>
        <span className="hidden w-[24%] shrink-0 sm:block">Team</span>
        {q ? (
          <>
            <span className="hidden w-20 shrink-0 text-right sm:block">Q1</span>
            <span className="hidden w-20 shrink-0 text-right sm:block">Q2</span>
            <span className="hidden w-20 shrink-0 text-right sm:block">Q3</span>
            <span className="w-20 shrink-0 text-right sm:hidden">Best</span>
          </>
        ) : (
          <>
            <span className="hidden w-24 shrink-0 text-right sm:block">Time</span>
            <span className="hidden w-20 shrink-0 text-right sm:block">Gap</span>
            <span className="w-24 shrink-0 text-right sm:hidden">Result</span>
          </>
        )}
        {data.isRace && <span className="w-9 shrink-0 text-right">Pts</span>}
      </div>
      <ul>{lead.map((e, i) => row(e, i === 0 && e.position === 1))}</ul>
      {rest.length > 0 && (
        <details className="group border-t border-border">
          <summary className="flex cursor-pointer select-none flex-wrap items-baseline gap-x-4 gap-y-1 px-1 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted [&::-webkit-details-marker]:hidden">
            <span>
              {restClassified.length > 0 ? `${restClassified.length} more classified` : ''}
              {restClassified.length > 0 && restRetired.length > 0 ? ' · ' : ''}
              {restRetired.length > 0 ? `${restRetired.length} retired` : ''}
            </span>
            <span className="text-brand group-open:hidden">Show all {entries.length} →</span>
            <span className="hidden text-brand group-open:inline">Show fewer</span>
          </summary>
          <ul>
            {restClassified.map(e => row(e, false))}
            {restRetired.map(e => row(e, false))}
          </ul>
        </details>
      )}
    </div>
  );
}

// Panel 12c: one block per class, the class named in ink with its meaning
// spelled out — the first block races for the outright win, every other class
// has its own winner on the same track. Entrant in serif, the crew in mono
// beneath it, car number in the No column.
function ClassBlock({ cls, data, idx }: { cls: string; data: SessionClassification; idx: number }) {
  const entries = data.entries;
  const lead = entries.slice(0, LEAD_ROWS);
  const rest = entries.slice(LEAD_ROWS);

  const row = (e: SessionClassificationEntry, raised: boolean) => (
    <li
      key={`${e.position}-${e.driverCode ?? e.team}`}
      className={`flex items-baseline gap-3 border-t border-border px-1 py-2.5 ${raised ? 'bg-surface-elevated' : ''}`}
    >
      <span
        className={`w-7 shrink-0 text-right font-mono text-[13px] tabular-nums ${
          raised ? 'font-bold text-brand' : 'text-text-muted'
        }`}
      >
        {e.position ?? '–'}
      </span>
      <span className="w-10 shrink-0 font-mono text-[11px] tabular-nums text-text-faint">
        {e.driverCode ?? ''}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-serif text-[17px] font-semibold leading-tight text-text">{e.team}</div>
        {e.driverName && e.driverName !== e.team ? (
          <div className="truncate font-mono text-[9px] uppercase tracking-[0.14em] text-text-muted">
            {e.driverName}
          </div>
        ) : null}
      </div>
      <span className="hidden w-24 shrink-0 text-right font-mono text-[11px] tabular-nums text-text sm:block sm:border-l sm:border-border sm:pl-3">
        {e.time ?? ''}
      </span>
      <span
        className={`w-20 shrink-0 text-right font-mono text-[11px] tabular-nums ${
          e.status ? 'text-brand' : 'text-text-muted'
        }`}
      >
        {e.status ?? e.gap ?? (raised ? '—' : '')}
      </span>
    </li>
  );

  return (
    <section className="mt-5">
      <div className="border-b border-text pb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em]">
        <span className="text-brand">{cls}</span>
        <span className="text-text-faint">
          {' '}· {idx === 0 ? 'Racing for the outright win' : 'Its own winner, same track'}
        </span>
      </div>
      <ul>{lead.map((e, i) => row(e, i === 0))}</ul>
      {rest.length > 0 && (
        <details className="group border-t border-border">
          <summary className="flex cursor-pointer select-none items-baseline gap-4 px-1 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted [&::-webkit-details-marker]:hidden">
            <span className="text-brand group-open:hidden">All {entries.length} cars →</span>
            <span className="hidden text-brand group-open:inline">Show fewer</span>
          </summary>
          <ul>{rest.map(e => row(e, false))}</ul>
        </details>
      )}
    </section>
  );
}

// Table-shaped placeholder while the classification + analysis stream in —
// the masthead and session chips above it render instantly (they replaced
// this segment's loading.tsx, whose whole-page skeleton locked every dead
// session URL to a streamed 200 — the GSC soft-404 batch).
function BodySkeleton() {
  return (
    <div aria-busy="true" className="mt-2">
      <div className="mb-3 h-4 w-44 animate-pulse bg-surface" />
      {[0, 1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="h-11 animate-pulse border-t border-border bg-surface/40" />
      ))}
    </div>
  );
}

async function SessionBody({
  series,
  weekend,
  session,
  round,
  slug,
  isPast,
  color,
  sessionName,
  weekendTitle,
}: {
  series: Awaited<ReturnType<typeof loadSeries>>;
  weekend: NonNullable<ReturnType<typeof weekendFor>>;
  session: NonNullable<ReturnType<typeof sessionBySlug>>;
  round: number;
  slug: string;
  isPast: boolean;
  color: string;
  sessionName: string;
  weekendTitle: string;
}) {
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

  // Embedded highlights for this session, where curated (any series). The race
  // session falls back to the round's headline clip.
  const media = await loadMedia(slug);
  const sessionVid = videoForSession(
    media,
    round,
    sessionSlug(session.title),
    isRaceLikeTitle(session.title),
  );

  // The classification foot states the data's provenance where it has one
  // stated source (F1 = OpenF1) and, for WRC, how the rally actually scores —
  // the two real points pools lib/results/wrc.ts computes.
  const sourceLine =
    slug === 'f1'
      ? 'Timing data via OpenF1'
      : slug === 'wrc'
        ? 'Sunday top seven score 7-6-5-4-3-2-1 · Power Stage top five add 5-4-3-2-1'
        : null;

  const weekendHref = `/series/${slug}/weekend/${round}`;

  return (
    <>
      {sessionVid && <VideoEmbed id={sessionVid} title={`${sessionName} — ${weekendTitle}`} />}

      {classification ? (
        <section className="mt-2">
          {slug === 'wrc' && (
            <div className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-brand">
              Overall, on cumulative time
            </div>
          )}
          <ResultTable data={classification} />
        </section>
      ) : classClassifications.length > 0 ? (
        <section className="mt-2">
          <SessionClassChips labels={classClassifications.map(c => c.cls)}>
            {classClassifications.map((c, i) => (
              <ClassBlock key={c.cls} cls={c.cls} data={c.data} idx={i} />
            ))}
          </SessionClassChips>
          <p className="mt-3 border-t border-text pt-2 font-mono text-[9px] uppercase tracking-[0.14em] text-text-faint">
            Gaps become laps once a class is lapped · a crew shares one result
          </p>
        </section>
      ) : isPast ? (
        <section className="border-y border-border py-5 text-center">
          <p className="text-text-muted text-sm">
            {/* Not "not available": half an hour after a session that reads as
                broken, which is exactly how it read on Dutch GP Friday. Timing
                genuinely takes a while to land — the site's data is warmed on a
                20-minute cycle — so say so rather than implying a fault. */}
            {slug === 'f1'
              ? 'Timing for this session usually lands shortly after it ends. Nothing published yet, so it is worth a look back in a little while.'
              : slug === 'wrc'
                ? 'The full field for this stage isn’t published yet. The rally result and season standings live on the series page.'
                : isRaceLikeTitle(session.title)
                  ? 'Timing for this race usually lands shortly after it ends, so it may only be a matter of minutes. Season results live on the series page.'
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

      {/* The hours around the running, which is what a reader wants on a session
          that has not produced timing yet. Self-suppressing: no circuit match, no
          forecast, or a session outside Open-Meteo's 16-day horizon renders
          nothing. */}
      <SessionForecast session={session} weekend={weekend} />

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.14em]">
        <Link
          href={weekendHref}
          data-heatmap-id="session:back-to-weekend"
          className="font-semibold text-brand transition-colors duration-(--duration-fast) hover:text-text"
        >
          Back to the weekend →
        </Link>
        {sourceLine && <span className="text-text-faint">{sourceLine}</span>}
      </div>

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
    </>
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

  const nav = weekendSessionNav(weekend, slug, round, session.uid);
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

  const venueLabel =
    roundMeta?.venue ?? circuitMatch?.circuit.name ?? weekend.sessions.find(s => s.location)?.location;

  // Panel 11d: Sprint appears only at a sprint weekend — absent rather than
  // present-and-empty — and the chips row says so for F1.
  const noSprint = slug === 'f1' && !weekend.sessions.some(s => /sprint/i.test(s.title));

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

      {/* Panel 11d masthead: series-bar breadcrumb, the way back stated at the
          top right, a serif title that names what the page IS once the session
          has run ("Race classification"), the instant + venue in mono. */}
      <section className="mb-6 border-b border-border pb-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em]">
            <span aria-hidden="true" className="h-3.5 w-[3px]" style={{ backgroundColor: color }} />
            <Link
              href={`/series/${slug}`}
              className="text-text-muted hover:text-text transition-colors duration-(--duration-fast)"
            >
              {series.meta.name}
            </Link>
            <span className="text-border-strong">·</span>
            <span className="tabular-nums text-text-muted">Round {round}</span>
            {venueLabel && (
              <>
                <span className="text-border-strong">·</span>
                <span className="text-text-muted">{venueLabel}</span>
              </>
            )}
            {isLive && (
              <>
                <span className="text-border-strong">·</span>
                <span className="inline-flex items-center gap-1.5 text-[10px] tracking-[0.14em] px-2 py-0.5 bg-live/15 text-live-pill">
                  <span className="w-1.5 h-1.5 rounded-full bg-live live-pulse" />
                  live
                </span>
              </>
            )}
          </div>
          <Link
            href={`/series/${slug}/weekend/${round}`}
            data-heatmap-id="session:masthead:weekend"
            className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-brand hover:text-text transition-colors duration-(--duration-fast)"
          >
            Back to the weekend →
          </Link>
        </div>

        <h1 className="mt-4 font-serif text-4xl font-semibold leading-none tracking-tight text-text md:text-5xl">
          {isPast && slug !== 'wrc' ? `${sessionName} classification` : sessionName}
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

      <SessionChips items={nav.items} noSprint={noSprint} />

      <Suspense fallback={<BodySkeleton />}>
        <SessionBody
          series={series}
          weekend={weekend}
          session={session}
          round={round}
          slug={slug}
          isPast={isPast}
          color={color}
          sessionName={sessionName}
          weekendTitle={weekendTitle}
        />
      </Suspense>

      <SessionPager prev={nav.prev} next={nav.next} />
    </div>
  );
}
