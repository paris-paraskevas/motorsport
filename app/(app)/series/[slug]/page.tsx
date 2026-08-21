import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { loadSeries } from '@/lib/series';
import { groupByWeekend } from '@/lib/group';
import { weekendLabel } from '@/lib/weekend';
import { fetchStandingsBrief, isEligibleStandingsSeries } from '@/lib/standings/brief';
import { fetchLatestPodium, homeResultsSupported } from '@/lib/home-results';
import { seriesTabMetadata } from '@/components/SeriesPageView';
import { NextRaceCountdown } from '@/components/NextRaceCountdown';
import { StaleBanner } from '@/components/StaleBanner';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbLd } from '@/lib/json-ld';
import { SITE_URL, PAGE_WIDE } from '@/lib/site';
import { topicForSeries, aboutGuideForSeries, pointsGuideForSeries } from '@/lib/information/topics';
import { seriesHasTracksTab } from '@/lib/tabs';
import type { Weekend } from '@/lib/types';

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return seriesTabMetadata(slug, undefined);
}

export function generateStaticParams() {
  return [];
}

// The series landing, reimagined (design handoff §4.6, panels 4a/4b): three
// blocks — where the title stands, what just happened / what's next, then the
// whole season as one list (relocated and cancelled rounds say so in the row
// rather than vanishing). The old four navigation layers are gone; the tab
// pages survive as routes, reached from the reference row at the foot. 4b's
// rule: the template keeps its blocks and swaps only what the series actually
// has (no standings block for a single-event series, link-outs where a feed
// carries no flat podium).

function SectionRule({ label, right }: { label: string; right?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4 border-b border-text pb-1">
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">{label}</span>
      {right !== undefined && (
        <span className="text-right font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">{right}</span>
      )}
    </div>
  );
}

function fmtRange(w: Weekend): string {
  return w.dateRangeLabel;
}

// The championship table needs the standings feed — a network fetch — so it
// streams behind Suspense while the locally-derived shell paints at once.
async function ChampionshipBlock({
  slug,
  season,
  complete,
  seasonOver,
}: {
  slug: string;
  season: number;
  complete: number;
  seasonOver: boolean;
}) {
  const brief = isEligibleStandingsSeries(slug)
    ? await fetchStandingsBrief(slug, season).catch(() => null)
    : null;
  const leaderPoints = brief?.top[0]?.points ?? 0;
  if (!brief || brief.top.length === 0) {
    return (
      <>
        <SectionRule label="Standings" />
        <p className="text-sm text-text-muted">
          The championship table lives on its own page for this series.
        </p>
        <div className="mt-2">
          <Link
            href={`/series/${slug}/standings`}
            className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-brand hover:underline"
          >
            Standings →
          </Link>
        </div>
      </>
    );
  }
  return (
    <>
      <SectionRule
        label={seasonOver ? "Final drivers' championship" : "Drivers' championship"}
        right={seasonOver ? 'season complete' : `after ${complete} rounds`}
      />
      {seasonOver && (
        <p className="mb-3 border-l-[3px] border-brand bg-surface-elevated px-3 py-2 font-serif text-[19px] leading-snug text-text">
          <span className="font-semibold">{brief.leader.name}</span> is the {season} champion.
        </p>
      )}
      <ul>
        {brief.top.map(row => {
          const width = leaderPoints > 0 ? Math.max(2, Math.round((row.points / leaderPoints) * 100)) : 0;
          return (
            <li key={row.position} className="flex items-center gap-3 border-b border-border py-1.5">
              <span className="w-4 shrink-0 text-right font-mono text-[11px] tabular-nums text-text-faint">
                {row.position}
              </span>
              <span className="w-32 shrink-0 truncate text-sm text-text sm:w-40">{row.name}</span>
              <span aria-hidden="true" className="h-[6px] min-w-0 flex-1 bg-border">
                <span
                  className={`block h-full ${row.position === 1 ? 'bg-text' : 'bg-border-strong'}`}
                  style={{ width: `${width}%` }}
                />
              </span>
              <span className="w-10 shrink-0 text-right font-mono text-[12px] font-semibold tabular-nums text-text">
                {row.points}
              </span>
              <span className="hidden w-10 shrink-0 text-right font-mono text-[11px] tabular-nums text-text-faint sm:block">
                {row.position === 1 ? '—' : `−${leaderPoints - row.points}`}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-2">
        <Link
          href={`/series/${slug}/standings`}
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-brand hover:underline"
        >
          Full table →
        </Link>
      </div>
    </>
  );
}

// The last round's winner + margin, from the results feed (network) — streams
// behind its own tiny Suspense; renders nothing for feeds with no flat podium.
async function LastPodiumLine({ slug, round }: { slug: string; round: number }) {
  const podium = homeResultsSupported(slug) ? await fetchLatestPodium(slug).catch(() => null) : null;
  if (!podium || podium.round !== round || !podium.podium[0]) return null;
  return (
    <p className="mt-0.5 font-mono text-[11px] tabular-nums text-text-muted">
      {podium.podium[0].name.split(' ').slice(-1)[0]}
      {podium.podium[1]?.time?.startsWith('+') ? ` · ${podium.podium[1].time}` : ''}
    </p>
  );
}

export default async function SeriesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let series;
  try {
    series = await loadSeries(slug);
  } catch {
    notFound();
  }
  const meta = series.meta;
  const now = new Date();
  const color = meta.color;

  const weekends = (() => {
    try {
      return groupByWeekend(series.sessions, now, series.rounds);
    } catch {
      return [] as Weekend[];
    }
  })();
  const complete = weekends.filter(w => w.isPast).length;
  const nextW = weekends.find(w => !w.isPast && w.sessions.some(x => x.end >= now));
  const lastW = [...weekends].reverse().find(w => w.isPast);
  const nextSession = nextW
    ? [...nextW.sessions].filter(s => !s.dateOnly && s.start > now).sort((a, b) => a.start.getTime() - b.start.getTime())[0]
    : undefined;
  // Every round run and none left → the page says "season complete" out loud:
  // masthead, championship heading, champion callout (feedback board, 2026-08-20).
  const seasonOver = !nextW && !meta.singleEvent && weekends.length > 0;

  // The network fetches (standings brief, latest podium) live in Suspense
  // islands below — this segment's loading.tsx is gone (its skeleton flushed a
  // 200 shell that soft-404'd every dead URL under /series/[slug]; the 0.291.0
  // fold-in), so the shell renders from local ICS data only and the islands
  // stream in.

  const cancelled = series.rounds?.cancelledRounds ?? [];
  const roundMetaByRound = new Map((series.rounds?.rounds ?? []).map(r => [r.round, r]));

  // The reference row (4a foot): the tab pages + guides, stated once.
  const topic = topicForSeries(slug);
  const refs: Array<{ label: string; href: string; blurb: string }> = [
    { label: 'Drivers', href: `/series/${slug}/drivers`, blurb: `The ${meta.season} grid` },
    {
      label: meta.singleEvent ? 'Past winners' : 'Champions',
      href: `/series/${slug}/champions`,
      blurb: 'Year by year',
    },
    // Standings + Results join the row (operator, 2026-08-20: make them "more
    // easily accessible" from the landing); single-event series have neither.
    ...(!meta.singleEvent
      ? [
          { label: 'Standings', href: `/series/${slug}/standings`, blurb: 'The full table' },
          { label: 'Results', href: `/series/${slug}/results`, blurb: 'Round by round' },
        ]
      : []),
    // The calendar, pre-filtered to this series (operator annotation,
    // 2026-08-20: "a calendar tab here that takes you to /calendar with only
    // [this series'] sessions showing on filters") — the ?s= deep link the
    // filter box reads.
    { label: 'Calendar', href: `/calendar?s=${slug}`, blurb: 'This series only' },
    // Our own writing about this series (operator, 2026-08-21). The tab pages
    // reach it through seriesSubPages, but this landing builds its own row, so
    // without an entry here the series' base page never links to it.
    { label: 'Blog', href: `/series/${slug}/blog`, blurb: 'Our writing' },
    { label: 'Rules', href: `/information/${topic}/${slug}-rules-explained`, blurb: 'How it works' },
    ...(pointsGuideForSeries(slug) ? [{ label: 'Points', href: pointsGuideForSeries(slug)!, blurb: 'How scoring works' }] : []),
    { label: 'History', href: `/information/${topic}/the-history-of-${slug}`, blurb: 'Origins & eras' },
    { label: 'About', href: aboutGuideForSeries(slug) ?? `/series/${slug}/about`, blurb: 'Overview' },
    ...(seriesHasTracksTab(slug) ? [{ label: 'Circuits', href: `/series/${slug}/tracks`, blurb: `${meta.season} venues` }] : []),
    { label: 'News', href: `/series/${slug}/news`, blurb: 'The wire' },
    ...(slug === 'f1' ? [{ label: 'Analysis', href: '/f1/analysis', blurb: 'Telemetry & race story' }] : []),
  ];

  return (
    <div
      className={PAGE_WIDE}
      style={{ '--tint': color, '--tint-fill': color, '--series-color': color } as React.CSSProperties}
    >
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', url: SITE_URL },
          { name: meta.name, url: `${SITE_URL}/series/${slug}` },
        ])}
      />
      <div>
        {/* ── Where the title stands: name, season state, the next-session clock. ── */}
        <header className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="h-9 w-[4px] shrink-0" style={{ backgroundColor: color }} />
              <h1 className="truncate font-serif text-[40px] font-medium leading-none tracking-[-0.02em] text-text lg:text-[50px]">
                {meta.name}
              </h1>
            </div>
            <p className="mt-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
              {seasonOver && <span className="text-[11px] text-brand">Season complete · </span>}
              {meta.season} season
              {weekends.length > 0 && !meta.singleEvent
                ? ` · ${weekends.length} rounds${seasonOver ? '' : ` · ${complete} complete`}`
                : ''}
              {meta.singleEvent ? ' · one race a year' : ''}
            </p>
          </div>
          {nextSession && nextW && (
            <div className="text-right">
              <NextRaceCountdown
                target={nextSession.start.toISOString()}
                label={`Next · ${nextW.roundName ?? weekendLabel(nextW, nextW.round).title}`}
                color={color}
              />
            </div>
          )}
        </header>
        <StaleBanner configured={series.configured} stale={series.stale} />

        {/* ── Block 1: the championship + last/next rail. ── */}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section aria-label="Championship">
            {meta.singleEvent ? (
              <>
                <SectionRule label="The event" />
                <p className="font-serif text-[19px] leading-snug text-text">
                  One race a year — no championship at all. Past winners carry the history.
                </p>
                <div className="mt-2">
                  <Link
                    href={`/series/${slug}/champions`}
                    className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-brand hover:underline"
                  >
                    Past winners →
                  </Link>
                </div>
              </>
            ) : (
              <Suspense
                fallback={
                  <div aria-busy="true">
                    <SectionRule label={seasonOver ? "Final drivers' championship" : "Drivers' championship"} />
                    {[0, 1, 2, 3, 4].map(i => (
                      <div key={i} className="h-8 animate-pulse border-b border-border bg-surface/40" />
                    ))}
                  </div>
                }
              >
                <ChampionshipBlock slug={slug} season={meta.season} complete={complete} seasonOver={seasonOver} />
              </Suspense>
            )}
          </section>

          <aside>
            {lastW && (
              <div className="mb-5">
                <SectionRule label="Last round" />
                <p className="font-serif text-[19px] font-semibold leading-tight text-text">
                  {lastW.roundName ?? weekendLabel(lastW, lastW.round).title}
                </p>
                <Suspense fallback={null}>
                  <LastPodiumLine slug={slug} round={lastW.round} />
                </Suspense>
                <Link
                  href={`/series/${slug}/weekend/${lastW.round}`}
                  className="mt-1 inline-block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-brand hover:underline"
                >
                  Report →
                </Link>
              </div>
            )}
            {nextW && (
              <div className="mb-5">
                <SectionRule label="Next round" />
                <p className="font-serif text-[19px] font-semibold leading-tight text-text">
                  {nextW.roundName ?? weekendLabel(nextW, nextW.round).title}
                </p>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
                  {fmtRange(nextW)}
                </p>
                <Link
                  href={`/series/${slug}/weekend/${nextW.round}`}
                  className="mt-1 inline-block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-brand hover:underline"
                >
                  Preview →
                </Link>
              </div>
            )}
            {seasonOver && (
              <div className="mb-5">
                <SectionRule label="Season" />
                <p className="font-serif text-[17px] leading-snug text-text">
                  Complete — all {weekends.length} rounds run.
                </p>
              </div>
            )}
            <div className="border-t border-border pt-3">
              <a
                href={`${SITE_URL.replace(/^https?:/, 'webcal:')}/api/calendar/${slug}.ics`}
                className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
              >
                Subscribe to the calendar →
              </a>
              <a
                href={`/api/calendar/${slug}.ics`}
                className="ml-4 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint hover:text-text-muted"
              >
                .ics
              </a>
            </div>
          </aside>
        </div>

        {/* ── Block 2: the whole season as one list — no month paging. ── */}
        {weekends.length > 0 && (
          <section aria-label="The season" className="mt-9">
            <SectionRule label="The season" right="every round, one list" />
            <div className="lg:columns-2 lg:gap-10">
              {weekends.map(w => {
                const isNext = nextW != null && w.round === nextW.round && !w.isPast;
                const rm = roundMetaByRound.get(w.round);
                const relocated = rm?.rescheduleNote
                  ? (/relocated to ([^,]+)/i.exec(rm.rescheduleNote)?.[1] ?? 'relocated').toUpperCase()
                  : null;
                return (
                  <Link
                    key={w.key}
                    href={`/series/${slug}/weekend/${w.round}`}
                    className={`flex min-h-11 items-center gap-3 border-b border-border py-1.5 transition-colors duration-(--duration-fast) hover:bg-surface lg:break-inside-avoid ${
                      isNext ? 'border-[1.5px] border-text bg-surface-elevated px-2' : ''
                    }`}
                  >
                    <span className="w-6 shrink-0 text-right font-mono text-[11px] tabular-nums text-text-faint">
                      {w.round >= 1 ? w.round : '–'}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-serif text-[16px] font-semibold text-text">
                      {w.roundName ?? weekendLabel(w, w.round).title}
                    </span>
                    {relocated && (
                      <span className="shrink-0 border border-brand px-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-brand">
                        {relocated}
                      </span>
                    )}
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-text-muted">{fmtRange(w)}</span>
                    {/* Hidden on phones: the whole row is the tap target, and
                        the 74px this frees stops race names truncating at 375px. */}
                    <span
                      className={`hidden w-[74px] shrink-0 text-right font-mono text-[9px] font-semibold uppercase tracking-[0.12em] sm:block ${
                        w.isPast ? 'text-brand' : isNext ? 'text-text' : 'text-text-faint'
                      }`}
                    >
                      {w.isPast ? 'Report →' : isNext ? 'Preview →' : 'Scheduled'}
                    </span>
                  </Link>
                );
              })}
            </div>
            {cancelled.map(c => (
              <div key={c.originalRound} className="mt-4 border-l-[3px] border-brand bg-surface-elevated px-4 py-3">
                <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-brand">
                  Cancelled
                </span>
                <p className="mt-1 text-sm leading-snug text-text">
                  <span className="font-serif font-semibold">{c.name}</span>
                  {' — was '}
                  {(() => {
                    const s = new Date(c.originalStartDate);
                    const e = new Date(c.originalEndDate);
                    const month = new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' });
                    return month.format(s) === month.format(e)
                      ? `${s.getUTCDate()}–${e.getUTCDate()} ${month.format(e)}`
                      : `${s.getUTCDate()} ${month.format(s)} – ${e.getUTCDate()} ${month.format(e)}`;
                  })()}
                  {` as round ${c.originalRound}`}
                  {c.reason ? `, cancelled owing to the ${c.reason.replace(/^the /i, '')}` : ''}
                  {'.'}
                  {c.rescheduleStatus ? ` A replacement is ${c.rescheduleStatus.replace(/^under/i, 'under')}.` : ''}
                </p>
              </div>
            ))}
          </section>
        )}

        {/* ── Block 3: the reference row — tabs demoted to where a reader goes
            deliberately (§4.6: "tabs are secondary navigation below the content";
            any tab the series does not support is simply absent). ── */}
        <section aria-label="Reference" className="mt-9">
          <SectionRule label="Reference" />
          <div className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4 lg:grid-cols-8">
            {refs.map(l => (
              <Link
                key={l.label}
                href={l.href}
                className="group flex flex-col gap-0.5 bg-surface-elevated px-3 py-2.5 transition-colors duration-(--duration-fast) hover:bg-surface"
              >
                <span className="font-serif text-[15px] font-semibold text-text">{l.label}</span>
                <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-text-faint">{l.blurb}</span>
              </Link>
            ))}
            {Array.from({ length: (8 - (refs.length % 8)) % 8 }, (_, i) => (
              <div
                key={`fill-${i}`}
                aria-hidden="true"
                className={`bg-surface-elevated ${i < (2 - (refs.length % 2)) % 2 ? 'block' : 'hidden'} ${
                  i < (4 - (refs.length % 4)) % 4 ? 'sm:block' : 'sm:hidden'
                } lg:block`}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
