import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
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
import type { RaceResult, RaceResultEntry, Session } from '@/lib/types';
import { circuitLayoutFor } from '@/lib/circuit-layout';
import { matchCircuitEntry, venueCandidates } from '@/lib/circuits';
import { WeekendWeatherStrip } from '@/components/weekend/WeekendWeatherStrip';
import { WeekendSchedule } from '@/components/weekend/WeekendSchedule';
import { WeekendTabs } from '@/components/weekend/WeekendTabs';
import { isBettingConfigured } from '@/lib/betting/client';
import { BETTABLE_SERIES } from '@/lib/betting/constants';
import { NEWS_SLUG_MAP, fetchNews } from '@/lib/news';
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
import { NextRaceCountdown } from '@/components/NextRaceCountdown';
import { publishedPostsForSeries } from '@/lib/blog';

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

// Points-scoring depth per series, for the report's default rows (panel 3a):
// "Default is the points-scoring positions for the series — 10 in Formula 1,
// 15 in MotoGP, per class in WEC and IMSA."
function pointsPositions(slug: string): number {
  return slug === 'motogp' || slug === 'wsbk' ? 15 : 10;
}

const RETIRED_RE = /\b(dnf|dns|dsq|dq|ret|retired|withdrew|wd|accident|not classified|nc)\b/i;

// Panel 3b: the preview rail's "Going in" factbox — the championship's top
// three as the weekend starts. Network fetch, so it streams behind Suspense.
async function GoingIn({ slug, season }: { slug: string; season: number }) {
  if (!isEligibleStandingsSeries(slug)) return null;
  const brief = await fetchStandingsBrief(slug, season).catch(() => null);
  if (!brief || brief.top.length === 0) return null;
  return (
    <div>
      <div className="border-b border-text pb-1">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">Going in</span>
      </div>
      <ul>
        {brief.top.slice(0, 3).map(row => (
          <li key={row.position} className="flex items-baseline gap-3 border-b border-border py-1.5">
            <span className="w-4 shrink-0 text-right font-mono text-[11px] tabular-nums text-text-faint">{row.position}</span>
            <span className="min-w-0 flex-1 truncate font-serif text-[15px] font-semibold text-text">{row.name}</span>
            <span className="shrink-0 font-mono text-[12px] font-semibold tabular-nums text-text">{row.points}</span>
          </li>
        ))}
      </ul>
      <Link
        href={`/series/${slug}/standings`}
        className="mt-1 inline-block font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-brand hover:underline"
      >
        Full table →
      </Link>
    </div>
  );
}

// Round-2 ⑦: the preview surfaces the series wire on the page — five rows in
// the main column ("bring news here"), with the full feed one link away. The
// News tab keeps the complete list. Network fetch, so it streams.
async function PreviewNews({ slug }: { slug: string }) {
  const items = (await fetchNews(slug).catch(() => [])).slice(0, 5);
  if (items.length === 0) return null;
  return (
    <section aria-label="News" className="mt-8">
      <div className="mb-1 flex items-baseline justify-between border-b border-text pb-1">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
          The wire
        </span>
        <Link
          href={`/series/${slug}/news`}
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-brand hover:underline"
        >
          All news →
        </Link>
      </div>
      <ul>
        {items.map(item => {
          let host = 'source';
          try {
            host = new URL(item.link).hostname.replace(/^www\./, '');
          } catch {
            /* keep fallback */
          }
          return (
            <li key={item.link}>
              <a
                href={item.link}
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="flex min-h-10 flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-border py-2 transition-colors duration-(--duration-fast) hover:bg-surface"
              >
                <span className="min-w-0 flex-1 font-serif text-[15px] font-semibold leading-snug text-text">
                  {item.title}
                </span>
                <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-text-faint">
                  {host} ·{' '}
                  {item.pubDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// Panel 3a: the report's blog rail — original writing about this championship.
async function FromTheBlog({ slug }: { slug: string }) {
  const posts = await publishedPostsForSeries(slug, 3).catch(() => []);
  if (posts.length === 0) return null;
  return (
    <div className="mt-5 border-t border-border pt-3">
      <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">From the blog</span>
      <ul>
        {posts.map(p => (
          <li key={p.slug} className="mt-2">
            <Link href={`/blog/${p.slug}`} className="group block">
              <span className="block font-serif text-[15px] font-semibold leading-snug text-text group-hover:text-brand transition-colors duration-(--duration-fast)">
                {p.title}
              </span>
              {(p.publishedAt ?? p.publishAt) && (
                <span className="block font-mono text-[9px] uppercase tracking-[0.12em] text-text-faint">
                  {new Date((p.publishedAt ?? p.publishAt)!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BodySkeleton() {
  return (
    <div aria-busy="true" className="mt-2">
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} className="mt-2 animate-pulse border-y border-border bg-surface/40" style={{ height: i === 0 ? 96 : 52 }} />
      ))}
    </div>
  );
}

// ── The report body (finished weekends): everything that needs the network —
// the leading classification, the standings delta, the blog rail — streams in
// behind one Suspense boundary; the masthead above it renders from the shell.
async function ReportBody({
  series,
  weekend,
  slug,
  round,
  eventName,
  weekendTitleLabel,
  raceSession,
  sessionLinkBase,
  circuitLayout,
  circuitMatch,
  trackInfoSlug,
  venueLocation,
  nextRound,
  raceHighlight,
  upgrades,
}: {
  series: Awaited<ReturnType<typeof loadSeries>>;
  weekend: NonNullable<ReturnType<typeof weekendFor>>;
  slug: string;
  round: number;
  eventName: string;
  weekendTitleLabel: string;
  raceSession: Session | undefined;
  sessionLinkBase: string | undefined;
  circuitLayout: Awaited<ReturnType<typeof circuitLayoutFor>>;
  circuitMatch: Awaited<ReturnType<typeof matchCircuitEntry>>;
  trackInfoSlug: string | undefined;
  venueLocation: string | undefined;
  nextRound: ReturnType<typeof weekendFor>;
  raceHighlight: string | undefined;
  upgrades: Awaited<ReturnType<typeof loadF1Upgrades>>;
}) {
  const watch = series.meta.watch;

  let raceEntries: RaceResult['results'] = [];
  let classBlocks: Awaited<ReturnType<typeof fetchClassClassifications>> = [];
  const raceHref = raceSession
    ? `/series/${slug}/weekend/${round}/${sessionSlug(raceSession.title)}`
    : null;
  if (raceSession) {
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
  const brief = isEligibleStandingsSeries(slug)
    ? await fetchStandingsBrief(slug, series.meta.season).catch(() => null)
    : null;
  const leaderPoints = brief?.top[0]?.points ?? 0;
  const daysGrouped = groupByDay(weekend.sessions);

  // Panel 3a: default rows = the series' points-scoring positions; the full
  // field one tap away, stated as "N classified · M retired · Show all T ↓".
  const flatLead = raceEntries.slice(0, pointsPositions(slug));
  const flatRest = raceEntries.slice(pointsPositions(slug));
  const retiredCount = raceEntries.filter(e => RETIRED_RE.test(e.status)).length;
  const classifiedCount = raceEntries.length - retiredCount;
  const primaryClass = classBlocks[0] ?? null;
  const classLead = primaryClass ? primaryClass.data.entries.slice(0, 10) : [];
  const classRest = primaryClass ? primaryClass.data.entries.slice(10) : [];

  const flatRow = (e: RaceResultEntry) => (
    <li key={`${e.position}-${e.driverName}`} className={`flex items-baseline gap-3 border-b border-border py-1.5 ${e.position === 1 ? 'bg-surface-elevated font-semibold' : ''}`}>
      <span className="w-5 shrink-0 text-right font-mono text-[11px] tabular-nums text-text-faint">{e.position}</span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm ${e.position === 1 ? 'font-serif text-[16px] font-semibold' : ''} text-text`}>{e.driverName}</span>
        <span className="block truncate font-mono text-[9px] uppercase tracking-[0.1em] text-text-faint">{e.team}</span>
      </span>
      <span className={`shrink-0 font-mono text-[11px] tabular-nums ${RETIRED_RE.test(e.status) ? 'text-brand' : 'text-text-muted'}`}>
        {e.position === 1 ? e.time ?? '' : e.time ?? e.status}
      </span>
      <span className="w-8 shrink-0 text-right font-mono text-[12px] font-semibold tabular-nums text-text">{e.points}</span>
    </li>
  );

  const classRow = (e: (typeof classLead)[number]) => (
    <li key={`${e.position}-${e.driverName}`} className={`flex items-baseline gap-3 border-b border-border py-1.5 ${e.position === 1 ? 'bg-surface-elevated font-semibold' : ''}`}>
      <span className="w-5 shrink-0 text-right font-mono text-[11px] tabular-nums text-text-faint">{e.position}</span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm ${e.position === 1 ? 'font-serif text-[16px] font-semibold' : ''} text-text`}>{e.driverName}</span>
        <span className="block truncate font-mono text-[9px] uppercase tracking-[0.1em] text-text-faint">
          {[e.driverCode, e.team].filter(Boolean).join(' · ')}
        </span>
      </span>
      <span className="shrink-0 font-mono text-[11px] tabular-nums text-text-muted">
        {e.position === 1 ? e.time ?? '' : e.gap ?? e.time ?? ''}
      </span>
    </li>
  );

  return (
    <>
      {winner && (
        <p className="-mt-3 mb-5 font-mono text-[11px] tabular-nums text-text-muted">
          {winner.driverName} wins
          {margin ? <> · winning margin <span className="text-text">{margin}</span></> : null}
        </p>
      )}

      <div>
        {/* The result that leads. */}
        {(raceEntries.length > 0 || classBlocks.length > 0) && (
          <section aria-label="Classification" className="border-[1.5px] border-text bg-surface-elevated p-[18px] lg:p-5">
            <div className="flex items-baseline justify-between border-b border-text pb-1">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                Classification{primaryClass ? ` · ${primaryClass.cls}` : ''}
              </span>
              {raceHref && (
                <Link href={raceHref} className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-brand hover:underline">
                  Race page →
                </Link>
              )}
            </div>
            {raceEntries.length > 0 ? (
              <>
                <ul>{flatLead.map(flatRow)}</ul>
                {flatRest.length > 0 && (
                  <details className="group">
                    <summary className="flex cursor-pointer select-none flex-wrap items-baseline gap-x-4 gap-y-1 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted [&::-webkit-details-marker]:hidden">
                      <span>
                        {classifiedCount} classified{retiredCount > 0 ? ` · ${retiredCount} retired` : ''}
                      </span>
                      <span className="text-brand group-open:hidden">Show all {raceEntries.length} ↓</span>
                      <span className="hidden text-brand group-open:inline">Show fewer</span>
                    </summary>
                    <ul>{flatRest.map(flatRow)}</ul>
                  </details>
                )}
              </>
            ) : (
              <>
                <ul>{classLead.map(classRow)}</ul>
                {classRest.length > 0 && (
                  <details className="group">
                    <summary className="flex cursor-pointer select-none items-baseline gap-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted [&::-webkit-details-marker]:hidden">
                      <span className="text-brand group-open:hidden">All {primaryClass!.data.entries.length} cars ↓</span>
                      <span className="hidden text-brand group-open:inline">Show fewer</span>
                    </summary>
                    <ul>{classRest.map(classRow)}</ul>
                  </details>
                )}
              </>
            )}
            <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.14em] text-text-faint">
              Default is the points-scoring positions for the series — 10 in Formula 1, 15 in MotoGP, per class in WEC and IMSA
            </p>
            {classBlocks.length > 1 && raceHref && (
              <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-text-faint">
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
                <img src={circuitLayout.svg} alt={`${circuitMatch?.circuit.name ?? weekendTitleLabel} track layout`} width={500} height={500} className="h-auto w-full max-w-[240px]" />
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
            <Suspense fallback={null}>
              <FromTheBlog slug={slug} />
            </Suspense>
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
          <section id="technical-file" className="mt-9">
            <WeekendUpgrades data={upgrades} />
          </section>
        )}
      </div>
    </>
  );
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
  // show the curated per-stage overall classification (0.229.0). Passed straight
  // to the Schedule so each session ROW links to its page.
  const sessionLinkBase = ['f1', 'f2', 'f3', 'formula-e', 'indycar', 'motogp', 'wsbk', 'nascar-cup', 'wec', 'imsa', 'gt-world', 'wrc'].includes(slug)
    ? `/series/${slug}/weekend/${round}`
    : undefined;

  // Circuit-layout schematic — resolved by the round's venue/name via the shared
  // circuit matcher. ISR-safe (fs reads); gracefully null when not curated.
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

  const raceSession = [...weekend.sessions]
    .filter(s => isRaceLikeTitle(s.title))
    .sort((a, b) => b.start.getTime() - a.start.getTime())[0];

  // The round that follows this one — the report rail's Next round block and
  // the footer line on both layouts. Local ICS grouping, shell-safe.
  const nextRound = (() => {
    try {
      return (
        groupByWeekend(series.sessions, now, series.rounds).find(
          w => !w.isPast && weekendStartEnd(w).start.getTime() > end.getTime(),
        ) ?? null
      );
    } catch {
      return null;
    }
  })();

  // Preview: the first session still to run (timed), for the countdown card.
  const firstUpcoming = [...weekend.sessions]
    .filter(s => !s.dateOnly && s.start.getTime() > now.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime())[0];
  const firstSession = [...weekend.sessions].sort((a, b) => a.start.getTime() - b.start.getTime())[0];
  const bettable = (BETTABLE_SERIES as readonly string[]).includes(slug) && isBettingConfigured();

  // Panel 3a/3b footer line: only items that actually exist for this weekend.
  const footerItems: React.ReactNode[] = [];
  if (upgrades) {
    footerItems.push(
      <a key="tech" href="#technical-file" className="inline-flex min-h-6 items-center text-text-muted hover:text-text transition-colors duration-(--duration-fast)">
        Technical file · {upgrades.teams.length} teams filed
      </a>,
    );
  }
  if (!isPast && bettable && raceSession && !raceSession.dateOnly) {
    footerItems.push(
      <span key="bets" className="text-text-muted">
        Predictions close <LocalTime instant={raceSession.start.getTime()} />
      </span>,
    );
  }
  if (NEWS_SLUG_MAP[slug] != null) {
    footerItems.push(
      <Link key="news" href={`/series/${slug}/news`} className="inline-flex min-h-6 items-center text-text-muted hover:text-text transition-colors duration-(--duration-fast)">
        News for this series →
      </Link>,
    );
  }
  if (nextRound) {
    footerItems.push(
      <Link key="next" href={`/series/${slug}/weekend/${nextRound.round}`} className="inline-flex min-h-6 items-center text-brand hover:text-text transition-colors duration-(--duration-fast)">
        Next round: {nextRound.roundName ?? weekendLabel(nextRound, nextRound.round).title} →
      </Link>,
    );
  }

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
      <div
        className="absolute top-0 left-0 right-0 h-px -z-10"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />

      {/* Shared serif masthead (panel 3a/3b: the preview reads like the report). */}
      <header className="mb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="h-3.5 w-[3px] shrink-0" style={{ backgroundColor: color }} />
            <Link
              href={`/series/${slug}`}
              className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors duration-(--duration-fast) hover:text-text"
              style={{ color: 'var(--tint)' }}
            >
              {series.meta.name}
            </Link>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint">
              Round {round} · {weekend.dateRangeLabel}
            </span>
          </div>
          {roundMeta?.rescheduleNote && (
            <span className="border border-brand px-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-brand">
              {roundMeta.rescheduleNote}
            </span>
          )}
        </div>
        <h1 className="mt-2 font-serif text-[34px] font-medium leading-[1.05] tracking-[-0.02em] text-text lg:text-[44px]">
          {weekendTitleLabel}
        </h1>
      </header>

      {!isPast ? (
        /* ── PREVIEW (§4.7 / panel 3b): the plan for the weekend — schedule
           first, the countdown + calendar + championship state in the rail,
           no empty results table. ── */
        <>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0">
              <WeekendTabs
                scheduleSlot={
                  <>
                    {/* Round-2 ⑦: the schedule and a LARGE circuit map share
                        the main width on big screens (the rail's 240px map
                        "seems really small" — operator). Below xl the map
                        stays in the rail. */}
                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,400px)]">
                      <div className="min-w-0">
                        <WeekendSchedule weekend={weekend} color={color} sessionLinkBase={sessionLinkBase} />
                      </div>
                      {circuitLayout && (
                        <figure className="hidden xl:block">
                          {/* The desktop LCP element (PSI 2026-08-20 measured
                              2.59 s of resource-load DELAY on a 3 KB file, i.e.
                              pure late discovery). fetchPriority pulls it
                              forward; the intrinsic 500x500 (every circuit SVG
                              is square, checked across all 21) gives the box an
                              aspect ratio before the file lands. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={circuitLayout.svg}
                            alt={`${circuitMatch?.circuit.name ?? weekendTitleLabel} track layout`}
                            width={500}
                            height={500}
                            fetchPriority="high"
                            className="h-auto w-full"
                          />
                          <figcaption className="mt-1 text-center font-mono text-[9px] uppercase tracking-[0.12em] text-text-faint">
                            {circuitMatch?.circuit.name ?? 'Circuit map'} ·{' '}
                            <a href={circuitLayout.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-text-muted">
                              {circuitLayout.source} ({circuitLayout.license})
                            </a>
                          </figcaption>
                        </figure>
                      )}
                    </div>
                    <Suspense fallback={<div className="h-10 animate-pulse bg-surface/40" />}>
                      <WeekendWeatherStrip weekend={weekend} />
                    </Suspense>
                    {NEWS_SLUG_MAP[slug] != null && (
                      <Suspense fallback={null}>
                        <PreviewNews slug={slug} />
                      </Suspense>
                    )}
                  </>
                }
                slug={slug}
                round={round}
                isPast={isPast}
                showBets={bettable}
                showNews={NEWS_SLUG_MAP[slug] != null}
              />
            </div>

            <aside className="space-y-6">
              {/* First-session countdown card (3b). */}
              {(firstUpcoming ?? firstSession) && (
                <div className="border-[1.5px] border-text bg-surface-elevated p-4">
                  <span className="block border-b border-text pb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                    First session
                  </span>
                  {firstUpcoming ? (
                    <>
                      <div className="mt-2">
                        <NextRaceCountdown
                          target={firstUpcoming.start.toISOString()}
                          label={firstUpcoming.title.replace(/^.*?[-–—:]\s*/, '').trim() || firstUpcoming.title}
                          color={color}
                        />
                      </div>
                      <p className="mt-1 font-mono text-[11px] tabular-nums text-text-muted">
                        <LocalTime instant={firstUpcoming.start.getTime()} />
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 font-serif text-[17px] font-semibold text-text">
                      {(firstSession!.title.replace(/^.*?[-–—:]\s*/, '').trim() || firstSession!.title) + ' · TBC'}
                    </p>
                  )}
                </div>
              )}

              {/* Add to calendar (3b) — the same per-series feed the series page
                  subscribes to; webcal for calendar apps, .ics as the fallback. */}
              <div>
                <a
                  href={`${SITE_URL.replace(/^https?:/, 'webcal:')}/api/calendar/${slug}.ics`}
                  data-heatmap-id="weekend:add-to-calendar"
                  className="inline-flex min-h-[38px] items-center border border-border-strong px-4 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text transition-colors duration-(--duration-fast) hover:bg-surface"
                >
                  Add to calendar
                </a>
                <a
                  href={`/api/calendar/${slug}.ics`}
                  className="ml-3 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint hover:text-text-muted"
                >
                  .ics
                </a>
              </div>

              <Suspense
                fallback={
                  <div aria-busy="true">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="mt-2 h-8 animate-pulse border-b border-border bg-surface/40" />
                    ))}
                  </div>
                }
              >
                <GoingIn slug={slug} season={series.meta.season} />
              </Suspense>

              {/* The venue, with the map (3b). */}
              {(circuitLayout || circuitMatch) && (
                <div>
                  <div className="border-b border-text pb-1">
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">The venue</span>
                  </div>
                  {/* Below xl only — on big screens the map renders LARGE in
                      the main column (round-2 ⑦). */}
                  {circuitLayout && (
                    <div className="mt-2 xl:hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={circuitLayout.svg} alt={`${circuitMatch?.circuit.name ?? weekendTitleLabel} track layout`} width={500} height={500} className="h-auto w-full max-w-[240px]" />
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
                  {trackInfoSlug && circuitMatch && (
                    <Link
                      href={`/information/tracks/${trackInfoSlug}`}
                      className="mt-1 inline-flex items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-brand hover:underline"
                    >
                      <MapPin size={11} />
                      About {circuitMatch.circuit.name}
                      <ArrowUpRight size={10} className="opacity-60" />
                    </Link>
                  )}
                  {watch && (
                    <div className="mt-4 border-t border-border pt-3">
                      <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">Where to watch</span>
                      <a
                        href={watch.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted hover:text-text"
                      >
                        <Tv size={12} />
                        Watch live on {watch.service}
                        <ArrowUpRight size={10} className="opacity-60" />
                      </a>
                    </div>
                  )}
                </div>
              )}
            </aside>
          </div>

          {/* The technical file, when teams have already filed for this round. */}
          {upgrades && (
            <section id="technical-file" className="mt-9">
              <WeekendUpgrades data={upgrades} />
            </section>
          )}
        </>
      ) : (
        /* ── REPORT (§4.7 / panel 3a): the result leads; the weekend re-told as
           the story's spine; venue facts + the blog in the rail; upgrades
           demoted to an appendix at the foot. Heavy fetches stream in. ── */
        <Suspense fallback={<BodySkeleton />}>
          <ReportBody
            series={series}
            weekend={weekend}
            slug={slug}
            round={round}
            eventName={eventName}
            weekendTitleLabel={weekendTitleLabel}
            raceSession={raceSession}
            sessionLinkBase={sessionLinkBase}
            circuitLayout={circuitLayout}
            circuitMatch={circuitMatch}
            trackInfoSlug={trackInfoSlug}
            venueLocation={venueLocation}
            nextRound={nextRound}
            raceHighlight={raceHighlight}
            upgrades={upgrades}
          />
        </Suspense>
      )}

      {/* Panel 3a/3b footer line — only what exists for this weekend. */}
      {footerItems.length > 0 && (
        <div className="mt-10 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-text pt-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em]">
          {footerItems.map((item, i) => (
            <span key={i} className="flex items-baseline gap-x-3">
              {i > 0 && <span aria-hidden="true" className="text-border-strong">·</span>}
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
