import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { loadSeries, loadSeriesMeta } from '@/lib/series';
import { seriesWithThreads } from '@/lib/threads';
import { resolveTab, labelForTab, describeTab, type TabKey } from '@/lib/tabs';
import { topicForSeries } from '@/lib/information/topics';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbLd } from '@/lib/json-ld';
import { SITE_URL, PAGE_WIDE } from '@/lib/site';
import { withSocialMeta } from '@/lib/seo';
import { Series } from '@/lib/types';
import { SeriesTabs } from '@/components/SeriesTabs';
import { StaleBanner } from '@/components/StaleBanner';
import { NextRaceCountdown } from '@/components/NextRaceCountdown';
import { CalendarTab } from '@/components/tabs/CalendarTab';
import { AboutTab } from '@/components/tabs/AboutTab';
import { HistoryTab } from '@/components/tabs/HistoryTab';
import { ChampionsTab } from '@/components/tabs/ChampionsTab';
import { StandingsTab } from '@/components/tabs/StandingsTab';
import { ResultsTab } from '@/components/tabs/ResultsTab';
import { DriversTab } from '@/components/tabs/DriversTab';
import { NewsTab } from '@/components/tabs/NewsTab';
import { TracksTab } from '@/components/tabs/TracksTab';
import { PlaceholderTab } from '@/components/tabs/PlaceholderTab';

// Shared shell for the series page, rendered by BOTH route entries: the bare
// `/series/[slug]` (the calendar default) and the path-based `/series/[slug]/[tab]`
// (B11). Path-based tabs are why both routes are now statically ISR-cacheable —
// the old single `?tab=` page had to be `force-dynamic` (a searchParams read
// defeats prerendering). The active tab is resolved + validated by each route
// and passed in; this component never reads searchParams.

/** Canonical URL for a series tab: the calendar tab is the bare-path landing,
 *  every other tab canonicals to its own path segment. */
export function seriesTabCanonical(slug: string, tab: TabKey): string {
  return tab === 'calendar' ? `/series/${slug}` : `/series/${slug}/${tab}`;
}

/** Shared `generateMetadata` body for both route entries. `rawTab` is the path
 *  segment (or undefined for the bare calendar route); it's resolved + the
 *  per-tab title/description/canonical are produced from it. */
export async function seriesTabMetadata(slug: string, rawTab: string | undefined): Promise<Metadata> {
  try {
    const meta = await loadSeriesMeta(slug);
    const tab = resolveTab(rawTab, meta.singleEvent, slug);
    const { title, description } = describeTab(tab, meta.name, meta.season);
    const canonical = seriesTabCanonical(slug, tab);
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
    case 'tracks':
      return <TracksTab series={series} />;
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

export async function SeriesPageView({ slug, activeTab }: { slug: string; activeTab: TabKey }) {
  // Fetch the series and the "which series have threads?" set together — the
  // latter is fail-soft (empty set on any error / Supabase down), so it can
  // never slow or break the series page.
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

  const color = series.meta.color;

  const now = new Date();
  const nextSession = [...series.sessions]
    .filter(s => !s.dateOnly && s.start > now)
    .sort((a, b) => a.start.getTime() - b.start.getTime())[0];

  return (
    <div
      className={`relative ${PAGE_WIDE}`}
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
        {/* F1-only: the Telemetry & Analysis hub (Decoder + Race Story per round)
            isn't a series tab, so surface it here for mobile + desktop (0.114.1). */}
        {slug === 'f1' && (
          <div className="mt-3">
            <Link
              href="/f1/analysis"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface/60 px-3 py-1.5 transition-colors hover:bg-surface"
            >
              <span aria-hidden="true" className="inline-block h-3.5 w-[3px] shrink-0 bg-tint" />
              <span className="text-[13px] font-semibold text-text">F1 Telemetry &amp; Analysis</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint">
                Analysis &amp; Race Story →
              </span>
            </Link>
          </div>
        )}
      </header>

      <SeriesTabs slug={slug} activeTab={activeTab} singleEvent={series.meta.singleEvent} />

      <SeriesLearnMore slug={slug} name={series.meta.name} singleEvent={series.meta.singleEvent} />

      {/* Calendar tab only: subscribe to this series' schedule as a live ICS
          feed (/api/calendar/[slug]). Plain-language labels (operator feedback
          2026-07-03 — "Subscribe (webcal) · .ics" read as jargon): the primary
          webcal: link opens the device's calendar app and keeps itself updated;
          the https .ics link is the one-off-download fallback for clients (and
          desktops) that don't register the scheme. */}
      {activeTab === 'calendar' && (
        <div className="-mt-2 mb-4 flex justify-end">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
            <a
              href={`${SITE_URL.replace(/^https?:/, 'webcal:')}/api/calendar/${slug}.ics`}
              className="text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
            >
              Add to your calendar
            </a>
            {' · '}
            <a
              href={`/api/calendar/${slug}.ics`}
              className="transition-colors duration-(--duration-fast) hover:text-text-muted"
            >
              download file
            </a>
          </span>
        </div>
      )}

      {/* Stream the tab body: header + rail paint immediately while the
          upstream fetches (standings/results scrapes) resolve. keyed so
          switching tabs re-suspends instead of showing the old tab. */}
      <Suspense key={activeTab} fallback={<TabLoading />}>
        {renderTab(activeTab, series)}
      </Suspense>
    </div>
  );
}

// "Learn about <series>" — the editorial/reference content that moved off the
// tab rail (IA restructure Phase B). History + Rules now live in /information
// (the /series/<slug>/{about,history} tab routes stay live until Phase C
// redirects them); About/Champions/Drivers remain series routes for now.
function SeriesLearnMore({
  slug,
  name,
  singleEvent,
}: {
  slug: string;
  name: string;
  singleEvent?: boolean;
}) {
  const topic = topicForSeries(slug);
  const links: Array<{ label: string; href: string }> = [
    { label: 'About', href: `/series/${slug}/about` },
    { label: 'History', href: `/information/${topic}/the-history-of-${slug}` },
    { label: 'Rules', href: `/information/${topic}/${slug}-rules-explained` },
    { label: singleEvent ? 'Past winners' : 'Champions', href: `/series/${slug}/champions` },
    { label: 'Drivers', href: `/series/${slug}/drivers` },
  ];
  return (
    <section className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[11px] uppercase tracking-[0.14em]">
      <span className="text-text-faint">Learn about {name}:</span>
      {links.map(l => (
        <Link
          key={l.label}
          href={l.href}
          className="text-text-muted hover:text-tint transition-colors duration-(--duration-fast)"
        >
          {l.label}
        </Link>
      ))}
    </section>
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
