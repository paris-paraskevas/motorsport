import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { listSeriesSlugs, loadSeries, loadSeriesMeta } from '@/lib/series';
import { seriesWithThreads } from '@/lib/threads';
import { resolveTab, labelForTab, describeTab, TabKey } from '@/lib/tabs';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbLd } from '@/lib/json-ld';
import { SITE_URL } from '@/lib/site';
import { withSocialMeta } from '@/lib/seo';
import { Series } from '@/lib/types';
import { SeriesTabs } from '@/components/SeriesTabs';
import { StaleBanner } from '@/components/StaleBanner';
import { CancelledRoundsBanner } from '@/components/CancelledRounds';
import { NextRaceCountdown } from '@/components/NextRaceCountdown';
import { CalendarTab } from '@/components/tabs/CalendarTab';
import { AboutTab } from '@/components/tabs/AboutTab';
import { HistoryTab } from '@/components/tabs/HistoryTab';
import { ChampionsTab } from '@/components/tabs/ChampionsTab';
import { StandingsTab } from '@/components/tabs/StandingsTab';
import { ResultsTab } from '@/components/tabs/ResultsTab';
import { DriversTab } from '@/components/tabs/DriversTab';
import { NewsTab } from '@/components/tabs/NewsTab';
import { PlaceholderTab } from '@/components/tabs/PlaceholderTab';

export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  const slugs = await listSeriesSlugs();
  return slugs.map(slug => ({ slug }));
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { tab: rawTab } = await searchParams;
  try {
    const meta = await loadSeriesMeta(slug);
    const tab = resolveTab(rawTab, meta.singleEvent);
    const { title, description } = describeTab(tab, meta.name, meta.season);
    // Canonical strategy: the calendar tab is the bare-path landing, so its
    // canonical collapses to /series/[slug]. Every other tab canonicals to its
    // own ?tab=X URL — distinct title + description make it a real indexable
    // page, not a duplicate. When B11 lands path-based tabs, this flips from
    // ?tab=X to /series/[slug]/[tab].
    const canonical =
      tab === 'calendar' ? `/series/${slug}` : `/series/${slug}?tab=${tab}`;
    return {
      title,
      description,
      alternates: { canonical },
      ...withSocialMeta({ title, description, path: canonical }),
    };
  } catch {
    return { title: 'Series not found' };
  }
}

function renderTab(activeTab: TabKey, series: Series) {
  switch (activeTab) {
    case 'calendar':
      return <CalendarTab series={series} />;
    case 'news':
      return <NewsTab series={series} />;
    case 'standings':
      return <StandingsTab series={series} />;
    case 'results':
      return <ResultsTab series={series} />;
    case 'drivers':
      return <DriversTab series={series} />;
    case 'about':
      return <AboutTab series={series} />;
    case 'history':
      return <HistoryTab series={series} />;
    case 'champions':
      return <ChampionsTab series={series} />;
    default:
      return <PlaceholderTab tabLabel={labelForTab(activeTab)} />;
  }
}

export default async function SeriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug } = await params;
  const { tab } = await searchParams;
  // Fetch the series and the "which series have threads?" set together — the
  // latter is fail-soft (empty set on any error / Supabase down), so it can
  // never slow or break the series page. settled, not awaited inline, so a slow
  // Supabase call doesn't block the (local-file) series load.
  const [seriesResult, threadSlugs] = await Promise.all([
    loadSeries(slug).then(
      s => ({ ok: true as const, series: s }),
      () => ({ ok: false as const, series: null }),
    ),
    seriesWithThreads(),
  ]);
  if (!seriesResult.ok) notFound();
  const series = seriesResult.series;
  const hasThreads = threadSlugs.has(slug);

  const activeTab = resolveTab(tab, series.meta.singleEvent);

  const color = series.meta.color;

  const now = new Date();
  const nextSession = [...series.sessions]
    .filter(s => !s.dateOnly && s.start > now)
    .sort((a, b) => a.start.getTime() - b.start.getTime())[0];

  return (
    <div
      className="relative max-w-2xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl 3xl:max-w-[2000px]! mx-auto p-4 md:p-6 lg:p-8 pb-16"
      style={
        {
          '--tint': color,
          '--series-color': color,
        } as React.CSSProperties
      }
    >
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', url: SITE_URL },
          { name: series.meta.name, url: `${SITE_URL}/series/${slug}` },
        ])}
      />
      {/* Hard series-color rule at the very top — the 2.0 accent treatment
          (flat surfaces; color lives in rules and type, not washes). */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 -z-10"
        style={{ backgroundColor: color }}
      />

      {/* Compact header: rule + display name + season, countdown right.
          Everything above the tab rail fits one phone viewport with room
          for content (the 9-tile grid this replaces did not). */}
      <header className="mb-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-stretch gap-3 min-w-0">
            <span aria-hidden="true" className="w-1 shrink-0 bg-tint" />
            <div className="min-w-0">
              <h1 className="font-display text-3xl md:text-4xl font-extrabold uppercase tracking-wide leading-none text-text truncate">
                {series.meta.name}
                <span className="text-tint">.</span>
                <span className="sr-only"> {series.meta.season} season</span>
              </h1>
              <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted tnum">
                {series.meta.season} season
              </div>
            </div>
          </div>
          {nextSession && (
            <div className="ml-auto">
              <NextRaceCountdown
                target={nextSession.start.toISOString()}
                label="Next session"
                color={color}
              />
            </div>
          )}
        </div>
        <StaleBanner configured={series.configured} stale={series.stale} />
        {hasThreads && (
          <div className="mt-3">
            <Link
              href={`/threads?series=${slug}`}
              className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted transition-colors hover:text-text"
            >
              <span aria-hidden="true" className="inline-block h-2 w-2 bg-tint" />
              {series.meta.name} threads →
            </Link>
          </div>
        )}
      </header>

      <CancelledRoundsBanner cancelledRounds={series.rounds?.cancelledRounds} />

      <SeriesTabs activeTab={activeTab} singleEvent={series.meta.singleEvent} />

      {/* Stream the tab body: header + rail paint immediately while the
          upstream fetches (standings/results scrapes) resolve. keyed so
          switching tabs re-suspends instead of showing the old tab. */}
      <Suspense key={activeTab} fallback={<TabLoading />}>
        {renderTab(activeTab, series)}
      </Suspense>
    </div>
  );
}

function TabLoading() {
  return (
    <div aria-busy="true" className="space-y-3">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="border-y border-border bg-surface/40 animate-pulse"
          style={{ height: i === 0 ? 96 : 64 }}
        />
      ))}
    </div>
  );
}
