import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { loadSeries } from '@/lib/series';
import { sessionSlug, weekendFor, weekendLabel, weekendStartEnd } from '@/lib/weekend';
import { groupByDay, groupByWeekend } from '@/lib/group';
import { LocalTime } from '@/components/LocalTime';
import {
  isRaceLikeTitle,
  pickRaceForSession,
  CLASS_RESULT_SERIES,
  fetchClassClassifications,
} from '@/lib/results/session-classification';
import { loadSnapshotSource } from '@/components/weekend/WeekendStandingsSnapshot';
import { fetchStandingsBrief, isEligibleStandingsSeries } from '@/lib/standings/brief';
import type { RaceResult, Session } from '@/lib/types';
import { WeekendHero } from '@/components/weekend/WeekendHero';
import { circuitLayoutFor } from '@/lib/circuit-layout';
import { matchCircuitEntry, venueCandidates } from '@/lib/circuits';
import { WeekendWeatherStrip } from '@/components/weekend/WeekendWeatherStrip';
import { WeekendSchedule } from '@/components/weekend/WeekendSchedule';
import { WeekendTabs } from '@/components/weekend/WeekendTabs';
import { isBettingConfigured } from '@/lib/betting/client';
import { BETTABLE_SERIES } from '@/lib/betting/constants';
import { NEWS_SLUG_MAP } from '@/lib/news';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbLd, sportsEventLd } from '@/lib/json-ld';
import { SITE_URL, PAGE_WIDE } from '@/lib/site';
import { withSocialMeta } from '@/lib/seo';
import { Tv, ArrowUpRight, MapPin } from 'lucide-react';
import { VideoEmbed } from '@/components/VideoEmbed';
import { loadMedia, highlightForRound } from '@/lib/media';
import { loadF1Upgrades, loadCuratedDrivers } from '@/lib/series-content';
import { getTrackInfoByCircuitSlug } from '@/lib/information/registry';
import { WeekendUpgrades } from '@/components/weekend/WeekendUpgrades';

// ISR: weekend pages edge-cache (was force-dynamic — uncached, slow per hit).
// Everything here is cacheable — weather (KV), news, and the standings-snapshot
// fetchers all revalidate, and the snapshot excludes WEC's no-store live feed.
export const revalidate = 300;

// On-demand: generate + edge-cache on first request rather than prerendering
// every series×round at build (which would fan out weather/results fetches
// across ~200 weekends). The sitemap still enumerates them for crawlers.
export function generateStaticParams() {
  return [];
}

function parseRound(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string; round: string }> },
): Promise<Metadata> {
  const { slug, round: roundRaw } = await params;
  const round = parseRound(roundRaw);
  // Unknown rounds must notFound() HERE, not only in the page body: streamed
  // metadata flushes the 200 shell before the body's notFound() can set the
  // status, yielding a soft 404 (GSC 2026-08 weekend batch; same class as the
  // 0.160.0 blog regression).
  if (!round) notFound();
  let series;
  try {
    series = await loadSeries(slug);
  } catch {
    notFound();
  }
  const weekend = weekendFor(series, round);
  if (!weekend) notFound();
  const { title: label } = weekendLabel(weekend, round);
  const baseTitle = label === `Round ${round}`
    ? `${series.meta.name} · Round ${round}`
    : `${series.meta.name} · ${label} · Round ${round}`;
  // Google's title display caps around 60 chars and the layout appends
  // " — Paddock Tracker" (17 chars) so dynamic portion budget is ~43 chars.
  // Cap conservatively at 60 to leave room for the suffix without ellipsis
  // ever showing on common combinations.
  const fullTitle = baseTitle.length > 60 ? `${baseTitle.slice(0, 59)}…` : baseTitle;
  const description = `${series.meta.name} Round ${round} — ${label}. ${weekend.dateRangeLabel}. Schedule, weather, standings, news. Where to watch live.`;
  return {
    title: fullTitle,
    description,
    keywords: [
      series.meta.name,
      label,
      `${series.meta.name} ${weekend.dateRangeLabel}`,
      `${series.meta.name} schedule`,
      `${series.meta.name} round ${round}`,
      `${series.meta.name} where to watch`,
      `${series.meta.name} ${label} schedule`,
      `${series.meta.name} ${label} timetable`,
      `${series.meta.name} ${label} live stream`,
    ],
    alternates: { canonical: `/series/${slug}/weekend/${round}` },
    ...withSocialMeta({
      title: fullTitle,
      description,
      path: `/series/${slug}/weekend/${round}`,
    }),
  };
}

export default async function WeekendPage({
  params,
}: {
  params: Promise<{ slug: string; round: string }>;
}) {
  const { slug, round: roundRaw } = await params;
  const round = parseRound(roundRaw);
  if (!round) notFound();

  let series;
  try {
    series = await loadSeries(slug);
  } catch {
    notFound();
  }

  const weekend = weekendFor(series, round);
  if (!weekend) notFound();

  const now = new Date();
  const { start, end } = weekendStartEnd(weekend);
  const isPast = end.getTime() < now.getTime();
  const color = series.meta.color;
  // Watch link + race highlights. loadMedia is an fs read (no fetch), so this
  // stays ISR-safe. The headline clip shows once the weekend is in the past.
  const media = await loadMedia(slug);
  const raceHighlight = isPast ? highlightForRound(media, round) : undefined;
  // Per-weekend car upgrades (F1 only) from the curated FIA Car Presentation
  // data — fs read, ISR-safe. Null when this round has no curated entry.
  const upgrades = slug === 'f1' ? await loadF1Upgrades(round) : null;
  const watch = series.meta.watch;
  const { title: weekendTitleLabel } = weekendLabel(weekend, round);
  const eventName =
    weekendTitleLabel === `Round ${round}`
      ? `${series.meta.name} Round ${round}`
      : `${series.meta.name} — ${weekendTitleLabel}`;

  // Per-session result pages: F1 via OpenF1; the listed series carry race-session
  // classifications; WEC/IMSA/GT World render per-class tables; WRC stage pages
  // show the curated per-stage overall classification (0.229.0). Others stay
  // unlinked. Passed straight to the Schedule so each session ROW links to its
  // page — no separate "Sessions" list (it duplicated the timetable).
  const sessionLinkBase = ['f1', 'f2', 'f3', 'formula-e', 'indycar', 'motogp', 'wsbk', 'nascar-cup', 'wec', 'imsa', 'gt-world', 'wrc'].includes(slug)
    ? `/series/${slug}/weekend/${round}`
    : undefined;

  // Circuit-layout schematic for the hero (F1 2026 calendar in v1, from f1db) —
  // resolved by the round's venue/name via the shared circuit matcher. ISR-safe
  // (fs reads); gracefully null for circuits we haven't curated a map for.
  // roundMeta first: a curated `venue` overrides name-based circuit resolution,
  // and both the map and the structured-data lookup below need it.
  const roundMeta = series.rounds?.rounds?.find((r) => r.round === round);
  const venueCandidateList = venueCandidates({
    venue: roundMeta?.venue,
    location: weekend.sessions.find(s => s.location)?.location,
    title: weekendTitleLabel,
  });
  const circuitLayout = await circuitLayoutFor(...venueCandidateList);

  // SportsEvent structured-data enrichment (SEO): resolve the venue's circuit
  // (address/geo) and the series' curated teams (performers). Both fs reads,
  // ISR-safe; gracefully partial when a venue or roster isn't curated.
  const venueLocation = roundMeta?.venue ?? weekend.sessions.find(s => s.location)?.location;
  const circuitMatch = await matchCircuitEntry(...venueCandidateList);
  // Deep-link the venue to its /information circuit profile when one exists —
  // those pages are otherwise reachable only from the tracks index + search.
  const trackInfoSlug = circuitMatch
    ? (await getTrackInfoByCircuitSlug()).get(circuitMatch.slug)
    : undefined;
  // Rally / multi-venue rounds have no single circuit; fall back to the round's
  // curated host country (rounds.json) so SportsEvent still emits an address.
  // (roundMeta is resolved above, where the venue override is applied.)
  const roster = await loadCuratedDrivers(slug);
  const eventDescription =
    `Round ${round} of the ${series.meta.season} ${series.meta.name} season` +
    (weekend.roundName ? `, the ${weekend.roundName}` : '') +
    (venueLocation ? ` at ${venueLocation}` : '') +
    '.';

  // Per-session sub-events for the weekend SportsEvent — the schedule + start
  // times search can surface. Timed sessions only (TBC/dateOnly have no instant).
  const sessionEvents = [...weekend.sessions]
    .filter((s) => !s.dateOnly)
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .map((s) => ({
      name: s.title.replace(/^.*?[-–—:]\s*/, '').trim() || s.title,
      startDate: s.start,
      endDate: s.end,
      url: `${SITE_URL}/series/${slug}/weekend/${round}/${sessionSlug(s.title)}`,
    }));

  // ── Report data (finished weekends only — the preview never fetches results).
  // The race classification comes from the same season feeds the results tab
  // renders (design handoff §4.7: the result LEADS the report).
  const raceSession = isPast
    ? [...weekend.sessions]
        .filter(s => isRaceLikeTitle(s.title))
        .sort((a, b) => b.start.getTime() - a.start.getTime())[0]
    : undefined;
  let raceEntries: RaceResult['results'] = [];
  let classBlocks: Awaited<ReturnType<typeof fetchClassClassifications>> = [];
  const raceHref = raceSession
    ? `/series/${slug}/weekend/${round}/${sessionSlug(raceSession.title)}`
    : null;
  if (isPast && raceSession) {
    if (CLASS_RESULT_SERIES.has(slug)) {
      classBlocks = await fetchClassClassifications(series, round, raceSession.title).catch(() => []);
    } else {
      const source = await loadSnapshotSource(series).catch(() => null);
      if (source) {
        const pool: RaceResult[] = [...source.races, ...(source.extras ?? [])];
        const race = pickRaceForSession(pool.filter(r => r.round === round), raceSession.title);
        if (race && race.results.length > 1) raceEntries = race.results;
      }
    }
  }
  const winner = raceEntries[0] ?? classBlocks[0]?.data.entries[0] ?? null;
  const margin =
    raceEntries[1]?.time?.startsWith('+') ? raceEntries[1].time
    : classBlocks[0]?.data.entries[1]?.gap?.startsWith('+') ? classBlocks[0].data.entries[1].gap
    : null;
  const brief =
    isPast && isEligibleStandingsSeries(slug)
      ? await fetchStandingsBrief(slug, series.meta.season).catch(() => null)
      : null;
  const leaderPoints = brief?.top[0]?.points ?? 0;
  const nextRound = isPast
    ? (() => {
        try {
          return (
            groupByWeekend(series.sessions, now, series.rounds).find(
              w => !w.isPast && w.sessions.some(x => x.end >= now),
            ) ?? null
          );
        } catch {
          return null;
        }
      })()
    : null;
  const daysGrouped = isPast ? groupByDay(weekend.sessions) : [];

  return (
    <div
      className={`relative ${PAGE_WIDE}`}
      style={{
        '--tint': color, '--tint-fill': color,
        ['--series-color' as string]: color,
      } as React.CSSProperties}
    >
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', url: SITE_URL },
          { name: series.meta.name, url: `${SITE_URL}/series/${slug}` },
          {
            name: eventName,
            url: `${SITE_URL}/series/${slug}/weekend/${round}`,
          },
        ])}
      />
      <JsonLd
        data={sportsEventLd({
          weekend,
          series,
          slug,
          round,
          title: eventName,
          startDate: start,
          endDate: end,
          description: eventDescription,
          organizerUrl: series.meta.officialSite ?? `${SITE_URL}/series/${slug}`,
          performers: roster?.teams.map(t => t.name) ?? [],
          addressCountry: circuitMatch?.circuit.countryCode ?? roundMeta?.countryCode,
          venue: circuitMatch?.circuit.name,
          geo: circuitMatch
            ? { lat: circuitMatch.circuit.lat, lon: circuitMatch.circuit.lon }
            : undefined,
          subEvents: sessionEvents,
          previousStartDate: weekend.previousStartDate,
          cancelled: roundMeta?.cancelled,
          watch,
        })}
      />
      {/* Radial wash retired with the rest of the app's (2c-3 precedent);
          the series-color hairline below is a hard rule — on-language. */}
      <div
        className="absolute top-0 left-0 right-0 h-px -z-10"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />

      {!isPast ? (
        /* ── PREVIEW (design handoff §4.7 / panel 3b): the plan for the
           weekend — schedule first, venue + watching around it, no empty
           results table. Composition unchanged from the shipped preview. ── */
        <>
          <WeekendHero
            weekend={weekend}
            round={round}
            seriesSlug={series.meta.slug}
            seriesName={series.meta.name}
            color={color}
            circuitLayout={circuitLayout}
          />

          {trackInfoSlug && circuitMatch && (
            <div className="mb-8">
              <Link
                href={`/information/tracks/${trackInfoSlug}`}
                className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted hover:text-brand transition-colors duration-(--duration-fast)"
              >
                <MapPin size={13} />
                About {circuitMatch.circuit.name}
                <ArrowUpRight size={12} className="opacity-60" />
              </Link>
            </div>
          )}

          {watch && (
            <section className="mb-8 border-y border-border py-4">
              <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-3">
                Where to watch
              </h2>
              <a
                href={watch.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted hover:text-brand transition-colors duration-(--duration-fast)"
              >
                <Tv size={13} />
                Watch live on {watch.service}
                <ArrowUpRight size={12} className="opacity-60" />
              </a>
            </section>
          )}

          <WeekendTabs
            scheduleSlot={
              <>
                <WeekendSchedule weekend={weekend} color={color} sessionLinkBase={sessionLinkBase} />
                <WeekendWeatherStrip weekend={weekend} />
              </>
            }
            slug={slug}
            round={round}
            isPast={isPast}
            showBets={(BETTABLE_SERIES as readonly string[]).includes(slug) && isBettingConfigured()}
            showNews={NEWS_SLUG_MAP[slug] != null}
          />
        </>
      ) : (
        /* ── REPORT (design handoff §4.7 / panel 3a): the result leads; the
           weekend re-told as the story's spine; venue facts in the rail;
           upgrades demoted to an appendix at the foot. ── */
        <>
          <header className="mb-6">
            <div className="flex items-center gap-2.5">
              <span aria-hidden="true" className="h-3.5 w-[3px] shrink-0" style={{ backgroundColor: color }} />
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--tint)' }}>
                {series.meta.name}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint">
                Round {round} · {weekend.dateRangeLabel}
              </span>
            </div>
            <h1 className="mt-2 font-serif text-[34px] font-medium leading-[1.05] tracking-[-0.02em] text-text lg:text-[44px]">
              {weekendTitleLabel}
            </h1>
            {winner && (
              <p className="mt-2 font-mono text-[11px] tabular-nums text-text-muted">
                {winner.driverName} wins
                {margin ? <> · winning margin <span className="text-text">{margin}</span></> : null}
              </p>
            )}
          </header>

          <div>
            {/* The result that leads. */}
            {(raceEntries.length > 0 || classBlocks.length > 0) && (
              <section aria-label="Classification" className="border-[1.5px] border-text bg-surface-elevated p-[18px] lg:p-5">
                <div className="flex items-baseline justify-between border-b border-text pb-1">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                    Classification{classBlocks.length > 0 ? ` · ${classBlocks[0].cls}` : ''}
                  </span>
                  {raceHref && (
                    <Link href={raceHref} className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-brand hover:underline">
                      Full field →
                    </Link>
                  )}
                </div>
                <ul>
                  {(raceEntries.length > 0
                    ? raceEntries.slice(0, 10).map(e => ({
                        key: `${e.position}-${e.driverName}`,
                        pos: e.position,
                        name: e.driverName,
                        sub: e.team,
                        right: e.position === 1 ? e.time ?? '' : e.time ?? e.status,
                        pts: e.points,
                      }))
                    : classBlocks[0].data.entries.slice(0, 10).map(e => ({
                        key: `${e.position}-${e.driverName}`,
                        pos: e.position,
                        name: e.driverName,
                        sub: [e.driverCode, e.team].filter(Boolean).join(' · '),
                        right: e.position === 1 ? e.time ?? '' : e.gap ?? e.time ?? '',
                        pts: undefined as number | undefined,
                      }))
                  ).map(row => (
                    <li key={row.key} className={`flex items-baseline gap-3 border-b border-border py-1.5 ${row.pos === 1 ? 'bg-surface-elevated font-semibold' : ''}`}>
                      <span className="w-5 shrink-0 text-right font-mono text-[11px] tabular-nums text-text-faint">{row.pos}</span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-sm ${row.pos === 1 ? 'font-serif text-[16px] font-semibold' : ''} text-text`}>{row.name}</span>
                        <span className="block truncate font-mono text-[9px] uppercase tracking-[0.1em] text-text-faint">{row.sub}</span>
                      </span>
                      <span className="shrink-0 font-mono text-[11px] tabular-nums text-text-muted">{row.right}</span>
                      {row.pts != null && (
                        <span className="w-8 shrink-0 text-right font-mono text-[12px] font-semibold tabular-nums text-text">{row.pts}</span>
                      )}
                    </li>
                  ))}
                </ul>
                {classBlocks.length > 1 && raceHref && (
                  <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.14em] text-text-faint">
                    {classBlocks.slice(1).map(b => b.cls).join(' · ')} — per-class tables on the{' '}
                    <Link href={raceHref} className="text-brand hover:underline">race page</Link>
                  </p>
                )}
              </section>
            )}

            <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
              {/* How the weekend went — the sessions as the story's spine. */}
              <section aria-label="How the weekend went">
                <div className="mb-1 flex items-baseline justify-between border-b border-text pb-1">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                    How the weekend went
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
                    Each session has its own result
                  </span>
                </div>
                {daysGrouped.map(day => (
                  <div key={day.label}>
                    <div className="pt-3 pb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-faint">
                      {day.label}
                    </div>
                    {day.sessions.map((s: Session) => {
                      const decisive = isRaceLikeTitle(s.title) || /qualifying|superpole|hyperpole|shootout|pole/i.test(s.title);
                      const isTheRace = raceSession != null && s.uid === raceSession.uid;
                      const label = s.title.replace(/^.*?[-–—:|]\s*/, '').trim() || s.title;
                      const href = sessionLinkBase ? `${sessionLinkBase}/${sessionSlug(s.title)}` : null;
                      const inner = (
                        <>
                          <span className="w-12 shrink-0 font-mono text-[11px] tabular-nums text-text-muted">
                            {s.dateOnly ? 'TBC' : <LocalTime instant={s.start.getTime()} />}
                          </span>
                          <span className={`min-w-0 flex-1 truncate font-serif text-[15px] ${decisive ? 'font-semibold text-text' : 'text-text-muted'}`}>
                            {label}
                          </span>
                          {isTheRace && winner && (
                            <span className="hidden shrink-0 font-mono text-[10px] tabular-nums text-text-muted sm:block">
                              {winner.driverName}{margin ? ` · ${margin}` : ''}
                            </span>
                          )}
                          {href && (
                            <span className="shrink-0 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-brand">
                              Result →
                            </span>
                          )}
                        </>
                      );
                      const rowClass = `flex min-h-10 items-baseline gap-3 border-b border-border py-1.5 ${
                        isTheRace ? 'border-[1.5px] border-text bg-surface-elevated px-2' : ''
                      }`;
                      return href ? (
                        <Link key={s.uid} href={href} className={`${rowClass} transition-colors duration-(--duration-fast) hover:bg-surface`}>
                          {inner}
                        </Link>
                      ) : (
                        <div key={s.uid} className={rowClass}>{inner}</div>
                      );
                    })}
                  </div>
                ))}
              </section>

              {/* The venue rail. */}
              <aside>
                <div className="mb-1 border-b border-text pb-1">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">The venue</span>
                </div>
                {circuitLayout && (
                  <div className="mt-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={circuitLayout.svg} alt={`${circuitMatch?.circuit.name ?? weekendTitleLabel} track layout`} className="h-auto w-full max-w-[240px]" />
                    <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.12em] text-text-faint">
                      Circuit map ·{' '}
                      <a href={circuitLayout.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-text-muted">
                        {circuitLayout.source} ({circuitLayout.license})
                      </a>
                    </p>
                  </div>
                )}
                {circuitMatch && (
                  <p className="mt-2 font-serif text-[17px] font-semibold leading-tight text-text">{circuitMatch.circuit.name}</p>
                )}
                {venueLocation && (
                  <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-text-faint">{venueLocation}</p>
                )}
                {trackInfoSlug && (
                  <Link href={`/information/tracks/${trackInfoSlug}`} className="mt-1 inline-block font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-brand hover:underline">
                    Circuit guide →
                  </Link>
                )}
                {watch && (
                  <div className="mt-5 border-t border-border pt-3">
                    <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">Where to watch</span>
                    <a href={watch.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted hover:text-text">
                      Highlights on {watch.service} →
                    </a>
                  </div>
                )}
                {nextRound && (
                  <div className="mt-5 border-t border-border pt-3">
                    <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">Next round</span>
                    <p className="mt-1 font-serif text-[17px] font-semibold leading-tight text-text">
                      {nextRound.roundName ?? weekendLabel(nextRound, nextRound.round).title}
                    </p>
                    <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-text-faint">
                      Round {nextRound.round} · {nextRound.dateRangeLabel}
                    </p>
                    <Link href={`/series/${slug}/weekend/${nextRound.round}`} className="mt-1 inline-block font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-brand hover:underline">
                      Preview →
                    </Link>
                  </div>
                )}
                <div className="mt-5 border-t border-border pt-3">
                  <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">Season context</span>
                  <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-text-faint">
                    Round {round} of the {series.meta.season} season
                  </p>
                  <Link href={`/series/${slug}/news`} className="mt-1 inline-block font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-text-muted hover:text-text">
                    News for this series →
                  </Link>
                </div>
              </aside>
            </div>

            {/* What it changed. */}
            {brief && brief.top.length > 0 && (
              <section aria-label="What it changed" className="mt-9">
                <div className="mb-3 flex items-baseline justify-between border-b border-text pb-1">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">What it changed</span>
                  <Link href={`/series/${slug}/standings`} className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-brand hover:underline">
                    Full standings →
                  </Link>
                </div>
                <ul>
                  {brief.top.map(row => {
                    const width = leaderPoints > 0 ? Math.max(2, Math.round((row.points / leaderPoints) * 100)) : 0;
                    const isWinner = winner != null && row.name === winner.driverName;
                    return (
                      <li key={row.position} className="flex items-center gap-3 border-b border-border py-1.5">
                        <span className="w-4 shrink-0 text-right font-mono text-[11px] tabular-nums text-text-faint">{row.position}</span>
                        <span className={`w-32 shrink-0 truncate text-sm sm:w-40 ${isWinner ? 'font-semibold text-text' : 'text-text-muted'}`}>{row.name}</span>
                        <span aria-hidden="true" className="h-[6px] min-w-0 flex-1 bg-border">
                          <span className={`block h-full ${isWinner ? 'bg-brand' : row.position === 1 ? 'bg-text' : 'bg-border-strong'}`} style={{ width: `${width}%` }} />
                        </span>
                        <span className="w-10 shrink-0 text-right font-mono text-[12px] font-semibold tabular-nums text-text">{row.points}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* Highlights, where curated. */}
            {raceHighlight && (
              <section className="mt-9">
                <div className="mb-3 border-b border-text pb-1">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">Highlights</span>
                </div>
                <VideoEmbed id={raceHighlight} title={`${eventName} race highlights`} />
              </section>
            )}

            {/* The technical file — an appendix, not a headline (§4.7). */}
            {upgrades && (
              <section className="mt-9">
                <WeekendUpgrades data={upgrades} />
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}
