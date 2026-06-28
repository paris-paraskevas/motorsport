import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { loadSeries } from '@/lib/series';
import type { Weekend } from '@/lib/types';
import { LocalTime } from '@/components/LocalTime';
import {
  sessionBySlug,
  sessionSlug,
  weekendFor,
  weekendLabel,
  weekendStartEnd,
} from '@/lib/weekend';
import {
  fetchOpenF1WeekendSessions,
  fetchSessionClassification,
  type OpenF1Session,
  type SessionClassification,
} from '@/lib/results/openf1';
import { fetchWecSeasonResults, WEC_RESULT_CLASSES } from '@/lib/results/wec';
import { fetchF2SeasonResults } from '@/lib/results/f2';
import { fetchF3SessionResults } from '@/lib/results/f3';
import { fetchMotoGPSessionClassification } from '@/lib/results/motogp';
import { fetchWsbkSessionClassification } from '@/lib/results/wsbk';
import { fetchImsaSeasonResults } from '@/lib/results/imsa';
import { IMSA_CLASSES } from '@/lib/standings/imsa';
import {
  fetchAllGtWorldSeasonRaces,
  type GtWorldRaceResult,
} from '@/lib/results/gt-world';
import { loadSnapshotSource } from '@/components/weekend/WeekendStandingsSnapshot';
import type { RaceResult, Series } from '@/lib/types';
import { withSocialMeta } from '@/lib/seo';
import { VideoEmbed } from '@/components/VideoEmbed';
import { loadMedia, videoForSession } from '@/lib/media';
import {
  readResultsCache,
  writeResultsCache,
  sessionClassCacheKey,
} from '@/lib/results-cache';
import { buildDecoderSummary, type DecoderSummary } from '@/lib/openf1/decoder';
import { QualifyingDecoder } from '@/components/f1/QualifyingDecoder';
import { buildRaceStory } from '@/lib/openf1/racestory-loader';
import type { RaceStoryData } from '@/lib/openf1/racestory';
import { RaceStory } from '@/components/f1/RaceStory';

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

// Match our curated session to its OpenF1 twin: slugified name first, then
// nearest start time within 3h — names drift ("Sprint Qualifying" vs
// "Sprint Shootout" eras), start times don't.
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

// Race-session classifications for non-F1 series (the per-round results the
// series' own results tab renders). Real classifications only: WRC comes
// from the per-rally articles (NOT the chart sub-totals), DTM has no
// per-race source yet, IMSA/GTWC class shapes are a follow-up.
// WRC is absent deliberately: rallies have stage itineraries, not a "race"
// session — its per-rally classification lives on the results tab.
const RACE_SESSION_SERIES = new Set([
  'f2', 'f3', 'formula-e', 'indycar', 'motogp', 'wsbk', 'nascar-cup',
]);

function isRaceLikeTitle(title: string): boolean {
  const cleaned = title.replace(/^.*?[-–—:]\s*/, '');
  if (/sprint\s*(qualifying|shootout)/i.test(cleaned)) return false;
  return /race|sprint|feature/i.test(cleaned);
}

// Multi-race rounds (Feature/Sprint, R1/Superpole/R2) — pick the candidate
// whose name shares the most tokens with the session title; tie → first.
function pickRaceForSession(candidates: RaceResult[], sessionTitle: string): RaceResult | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  const tokens = ['sprint', 'feature', 'superpole', 'race 1', 'race 2'];
  const t = sessionTitle.toLowerCase();
  let best = candidates[0];
  let bestScore = -1;
  for (const c of candidates) {
    const n = c.raceName.toLowerCase();
    let score = 0;
    for (const tok of tokens) {
      if (t.includes(tok) && n.includes(tok)) score += 2;
      if (t.includes(tok) !== n.includes(tok)) score -= 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

// Class-based series whose race sessions render one classification table per
// class/cup, fed by the same season feeds the Results tab uses (categories
// parity, operator 2026-06-13: a class with results on the Results tab must
// show them on the weekend's race-session page too).
const CLASS_RESULT_SERIES = new Set(['wec', 'imsa', 'gt-world']);

// Sprint rounds carry two races; match "Sprint Race 1/2" session titles to
// the SRO raceName ("Race 1"/"Race 2") by digit. Endurance rounds have one.
function pickGtWorldRace(
  races: GtWorldRaceResult[],
  sessionTitle: string,
): GtWorldRaceResult | null {
  if (races.length === 0) return null;
  if (races.length === 1) return races[0];
  const digit = /race\s*(\d)/i.exec(sessionTitle)?.[1];
  if (digit) {
    const hit = races.find(r => r.raceName.includes(digit));
    if (hit) return hit;
  }
  return races.find(r => /main/i.test(r.raceName)) ?? races[0];
}

// No points columns anywhere here: these are timing exports (the same
// limitation the Results tab documents per series), so isRace stays false
// and the time column shows total time / gap.
async function fetchClassClassifications(
  series: Series,
  round: number,
  sessionTitle: string,
): Promise<{ cls: string; data: SessionClassification }[]> {
  const slug = series.meta.slug;

  if (slug === 'wec') {
    const rounds = await fetchWecSeasonResults();
    const roundResults = rounds.find(r => r.round === round);
    if (!roundResults) return [];
    return WEC_RESULT_CLASSES.flatMap(cls => {
      const entries = roundResults.perClass[cls] ?? [];
      if (entries.length === 0) return [];
      return [{
        cls: cls as string,
        data: {
          isQualifying: false,
          isRace: false,
          entries: entries.map(e => ({
            position: e.position,
            driverName: e.drivers || e.team,
            driverCode: `#${e.carNumber}`,
            team: e.drivers ? e.team : e.manufacturer,
            time: e.elapsedTime,
            gap: e.gap,
          })),
        },
      }];
    });
  }

  if (slug === 'imsa') {
    const rounds = await fetchImsaSeasonResults();
    const roundResults = rounds.find(r => r.round === round);
    if (!roundResults) return [];
    return IMSA_CLASSES.flatMap(cls => {
      const entries = roundResults.perClass[cls] ?? [];
      if (entries.length === 0) return [];
      return [{
        cls: cls as string,
        data: {
          isQualifying: false,
          isRace: false,
          entries: entries.map(e => ({
            position: e.position,
            driverName: e.drivers || e.team,
            driverCode: `#${e.carNumber}`,
            team: e.vehicle ? `${e.team} · ${e.vehicle}` : e.team,
            time: e.elapsedTime,
            gap: e.gap,
          })),
        },
      }];
    });
  }

  if (slug === 'gt-world') {
    const races = (await fetchAllGtWorldSeasonRaces(series.meta.season)).filter(
      r => r.round === round,
    );
    const race = pickGtWorldRace(races, sessionTitle);
    if (!race) return [];
    const cupOrder = ['pro', 'gold', 'silver', 'bronze', 'unknown'] as const;
    return cupOrder.flatMap(cup => {
      const entries = race.entries.filter(e => e.cup === cup);
      if (entries.length === 0) return [];
      return [{
        cls: entries[0].cupLabel || cup,
        data: {
          isQualifying: false,
          isRace: false,
          entries: entries.map(e => ({
            position: e.position,
            driverName: e.drivers.join(' · '),
            driverCode: `#${e.carNumber}`,
            team: e.car ? `${e.team} · ${e.car}` : e.team,
            time: e.time,
            gap: e.gap,
          })),
        },
      }];
    });
  }

  return [];
}

// F2/F3 practice and qualifying classifications (their races go through
// fetchRoundClassification like the other flat-feed series). The FIA junior
// series carry every session — practice, qualifying, both races — on the same
// per-round results page; these are the two non-race ones, keyed per round.
const FORMULA_SESSION_SERIES = new Set(['f2', 'f3']);

async function fetchFormulaNonRaceClassification(
  slug: string,
  season: number,
  round: number,
  sessionTitle: string,
): Promise<SessionClassification | null> {
  const name = sessionTitle.replace(/^.*?[-–—:]\s*/, '');
  const isQuali = /qualifying|superpole/i.test(name);
  const isPractice = /practice/i.test(name) || /^fp\s*\d/i.test(name);
  if (!isQuali && !isPractice) return null;
  const { qualifying, practice } =
    slug === 'f3' ? await fetchF3SessionResults(season) : await fetchF2SeasonResults(season);
  const list = isQuali ? qualifying : practice;
  return list?.find(r => r.round === round)?.data ?? null;
}

async function fetchRoundClassification(
  series: Series,
  round: number,
  sessionTitle: string,
): Promise<SessionClassification | null> {
  const slug = series.meta.slug;
  if (!RACE_SESSION_SERIES.has(slug) || !isRaceLikeTitle(sessionTitle)) return null;
  const source = await loadSnapshotSource(series);
  if (!source) return null;
  const pool: RaceResult[] = [...source.races, ...(source.extras ?? [])];
  const race = pickRaceForSession(pool.filter(r => r.round === round), sessionTitle);
  if (!race || race.results.length <= 1) return null;
  return {
    isQualifying: false,
    isRace: true,
    entries: race.results.map(e => ({
      position: e.position,
      driverName: e.driverName,
      driverCode: e.driverCode,
      team: e.team,
      time: e.time ?? e.status,
      points: e.points,
    })),
  };
}

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
  if (!ctx) return { title: 'Session not found' };
  const { title: weekendTitle } = weekendLabel(ctx.weekend, ctx.round);
  const base = `${ctx.series.meta.name} · ${weekendTitle} · ${ctx.session.title.replace(/^.*?-\s*/, '')}`;
  const title = base.length > 60 ? `${base.slice(0, 59)}…` : base;
  const hasFullClassification =
    ['f1', 'f2', 'f3', 'motogp', 'wsbk'].includes(ctx.slug);
  const description = `${ctx.session.title} at the ${ctx.series.meta.name} ${weekendTitle} — session time in your time zone${hasFullClassification ? ', full classification and results' : ''}.`;
  const path = `/series/${ctx.slug}/weekend/${ctx.round}/${ctx.sessionParam}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    ...withSocialMeta({ title, description, path }),
  };
}

// Compact label for the session rail — fans think in FP1 / QUALI / RACE.
function shortSessionLabel(title: string): string {
  const cleaned = title.replace(/^.*?[-–—:]\s*/, '').trim() || title;
  const m = cleaned.match(/^(?:free\s+)?practice\s*(\d)/i);
  if (m) return `FP${m[1]}`;
  if (/^fp\s*(\d)/i.test(cleaned)) return cleaned.toUpperCase().replace(/\s+/g, '');
  if (/sprint\s+(qualifying|shootout)/i.test(cleaned)) return 'SQ';
  if (/^sprint/i.test(cleaned)) return 'SPRINT';
  if (/qualifying|superpole/i.test(cleaned)) return 'QUALI';
  if (/warm[\s-]?up/i.test(cleaned)) return 'WARM-UP';
  if (/^race\s*(\d)/i.test(cleaned)) return cleaned.toUpperCase().replace(/\s+/g, ' ');
  if (/^race/i.test(cleaned)) return 'RACE';
  return cleaned.toUpperCase().slice(0, 14);
}

// The weekend's sessions in running order, each with its page href. Slug
// collisions within a weekend (two identically-titled sessions) resolve to
// the first occurrence — acceptable; titles are unique in practice.
function weekendSessionNav(
  weekend: Weekend,
  slug: string,
  round: number,
  currentUid: string,
) {
  const ordered = [...weekend.sessions].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );
  const items = ordered.map(s => ({
    uid: s.uid,
    label: shortSessionLabel(s.title),
    title: s.title,
    href: `/series/${slug}/weekend/${round}/${sessionSlug(s.title)}`,
    isCurrent: s.uid === currentUid,
  }));
  const idx = items.findIndex(i => i.isCurrent);
  return {
    items,
    prev: idx > 0 ? items[idx - 1] : null,
    next: idx >= 0 && idx < items.length - 1 ? items[idx + 1] : null,
  };
}

function SessionRail({ items }: { items: ReturnType<typeof weekendSessionNav>['items'] }) {
  return (
    <nav aria-label="Weekend sessions" className="mb-6 border-y border-border">
      <div className="flex overflow-x-auto scrollbar-none gap-5">
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
}: {
  data: SessionClassification;
  // Multi-class series render one table per class ("Hypercar", "LMGT3").
  heading?: string;
}) {
  return (
    <section className="border-y border-border py-4">
      <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-3">
        {heading}
      </h2>
      <ul className="divide-y divide-border/60">
        {data.entries.map(e => (
          <li key={`${e.position}-${e.driverName}`} className="flex items-baseline gap-3 py-2">
            <span className="w-6 text-text-faint text-sm font-mono tabular-nums text-right">
              {e.position ?? '–'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-text text-sm font-medium truncate">{e.driverName}</span>
                {e.driverCode ? (
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] font-semibold text-text-faint border border-border px-1.5 py-0.5">
                    {e.driverCode}
                  </span>
                ) : null}
              </div>
              <div className="text-text-muted text-xs truncate">{e.team}</div>
            </div>
            {data.isQualifying ? (
              <span className="hidden sm:flex items-baseline gap-3 font-mono text-[11px] tabular-nums text-text-muted">
                <span className="w-20 text-right">{e.q1 ?? ''}</span>
                <span className="w-20 text-right">{e.q2 ?? ''}</span>
                <span className="w-20 text-right text-text">{e.q3 ?? ''}</span>
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
  const { series, weekend, session, round, slug } = ctx;

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
  if (isPast) {
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
      if (classification || classClassifications.length > 0) {
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
  // moments). Resolve this session's OpenF1 key once; the Decoder summary +
  // Race Story data are server-rendered (SEO-visible), the Decoder traces fetch
  // client-side per pair.
  let decoderSummary: DecoderSummary | null = null;
  let raceStory: RaceStoryData | null = null;
  if (slug === 'f1' && isPast && !session.dateOnly) {
    const isQualifyingSession = /qualifying|superpole|shootout/i.test(sessionName);
    const isRaceSession = isRaceLikeTitle(session.title);
    if (isQualifyingSession || isRaceSession) {
      const { start, end } = weekendStartEnd(weekend);
      const candidates = await fetchOpenF1WeekendSessions(start, end);
      const match = matchOpenF1Session(candidates, sessionSlug(session.title), session.start);
      if (match && isQualifyingSession) {
        const summary = await buildDecoderSummary(match.session_key, 'f1');
        if (summary.laps.length > 0) decoderSummary = summary;
      } else if (match) {
        const story = await buildRaceStory(match.session_key, 'f1');
        if (story.stints.length > 0 || story.moments.length > 0) raceStory = story;
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

  return (
    <div
      className="relative max-w-2xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl 3xl:max-w-[2000px]! mx-auto p-4 md:p-6 lg:p-8 pb-16"
      style={{ '--tint': color, ['--series-color' as string]: color } as React.CSSProperties}
    >
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
              <span className="inline-flex items-center gap-1.5 text-[10px] tracking-[0.14em] px-2 py-0.5 bg-red-500/15 text-red-300">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 live-pulse" />
                live
              </span>
            </>
          )}
        </div>

        <h1 className="font-display text-4xl md:text-5xl font-extrabold uppercase tracking-wide leading-[0.95] text-text">
          {sessionName}
          <span style={{ color }}>.</span>
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
      </section>

      <SessionRail items={nav.items} />

      {sessionVid && (
        <VideoEmbed id={sessionVid} title={`${sessionName} — ${weekendTitle}`} />
      )}

      {classification ? (
        <ClassificationTable data={classification} />
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

      {decoderSummary && (
        <section className="mt-10">
          <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-4">
            Qualifying Decoder
          </h2>
          <QualifyingDecoder summary={decoderSummary} seriesColor={color} />
        </section>
      )}

      {raceStory && (
        <section className="mt-10">
          <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-4">
            Race Story
          </h2>
          <RaceStory data={raceStory} seriesColor={color} />
        </section>
      )}

      <SessionPager prev={nav.prev} next={nav.next} />
    </div>
  );
}
