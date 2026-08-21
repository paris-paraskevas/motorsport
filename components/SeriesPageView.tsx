import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { loadSeries, loadSeriesMeta } from '@/lib/series';
import { resolveTab, labelForTab, describeTab, seriesSubPages, type TabKey } from '@/lib/tabs';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbLd } from '@/lib/json-ld';
import { SITE_URL, PAGE_WIDE } from '@/lib/site';
import { withSocialMeta } from '@/lib/seo';
import { Series } from '@/lib/types';
import { StaleBanner } from '@/components/StaleBanner';
import { AboutTab } from '@/components/tabs/AboutTab';
import { HistoryTab } from '@/components/tabs/HistoryTab';
import { ChampionsTab } from '@/components/tabs/ChampionsTab';
import { StandingsTab } from '@/components/tabs/StandingsTab';
import { ResultsTab } from '@/components/tabs/ResultsTab';
import { DriversTab } from '@/components/tabs/DriversTab';
import { NewsTab } from '@/components/tabs/NewsTab';
import { BlogTab } from '@/components/tabs/BlogTab';
import { TracksTab } from '@/components/tabs/TracksTab';
import { PlaceholderTab } from '@/components/tabs/PlaceholderTab';

// The series sub-pages' shared Paper shell (Round-3 ⑤–⑦, operator 2026-08-20:
// "these pages still havent changed. change NOW. its drivers, standings,
// results, champions and rounds"). Rendered ONLY by `/series/[slug]/[tab]` —
// the bare `/series/[slug]` is the reimagined landing (its own page.tsx) and
// the `calendar` tab 301s there, so this shell never renders a calendar. The
// pre-Paper register (display-caps masthead, Learn-about grid, tab strip) is
// gone; each sub-page stands alone under a serif masthead with a breadcrumb
// up and a mono cross-link foot.

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
    case 'news':
      return <NewsTab series={series} />;
    case 'blog':
      return <BlogTab series={series} />;
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

/** The sub-page's serif title — the page is about its subject, not the series
 *  name (that's the breadcrumb). Single-event honours rolls read "Past winners". */
function tabTitle(tab: TabKey, singleEvent: boolean | undefined, season: number): string {
  if (tab === 'champions') return singleEvent ? 'Past winners' : 'Champions';
  if (tab === 'tracks') return `${season} circuits`;
  if (tab === 'results') return `${season} results`;
  if (tab === 'drivers') return `The ${season} grid`;
  return labelForTab(tab);
}

export async function SeriesPageView({ slug, activeTab }: { slug: string; activeTab: TabKey }) {
  const series = await loadSeries(slug).catch(() => null);
  if (!series) notFound();

  const color = series.meta.color;
  const title = tabTitle(activeTab, series.meta.singleEvent, series.meta.season);

  // Sibling sub-pages for the foot: every sub-page except this one; the
  // calendar entry doubles as "Season overview" (the reimagined landing).
  const siblings = [
    ...seriesSubPages(series.meta).map(s =>
      s.key === 'calendar' ? { ...s, label: 'Season overview' } : s,
    ),
    { key: 'news' as TabKey, label: 'News', href: `/series/${slug}/news` },
  ].filter(s => s.key !== activeTab);

  return (
    <div
      className={PAGE_WIDE}
      style={
        {
          '--tint': color, '--tint-fill': color,
          '--series-color': color,
        } as React.CSSProperties
      }
    >
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', url: SITE_URL },
          { name: series.meta.name, url: `${SITE_URL}/series/${slug}` },
          { name: title, url: `${SITE_URL}${seriesTabCanonical(slug, activeTab)}` },
        ])}
      />

      <header className="mb-6 border-b border-border pb-5">
        <Link
          href={`/series/${slug}`}
          className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
        >
          ← {series.meta.name}
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <span aria-hidden="true" className="h-9 w-[4px] shrink-0" style={{ backgroundColor: color }} />
          <h1 className="font-serif text-[38px] font-medium leading-none tracking-[-0.02em] text-text lg:text-[46px]">
            {title}
          </h1>
        </div>
        <p className="mt-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
          {series.meta.name} · {series.meta.season} season
        </p>
        <StaleBanner configured={series.configured} stale={series.stale} />
      </header>

      {/* Stream the tab body: the masthead paints immediately while the
          upstream fetches (standings/results) resolve. Keyed so switching
          sub-pages re-suspends instead of showing the old one. */}
      <Suspense key={activeTab} fallback={<TabLoading />}>
        {renderTab(activeTab, series)}
      </Suspense>

      <div className="mt-8 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-border pt-3 font-mono text-[10px] font-semibold uppercase tracking-[0.14em]">
        <span className="text-text-faint">More {series.meta.name}</span>
        {siblings.map(s => (
          <Link key={s.key} href={s.href} className="inline-flex min-h-6 items-center text-brand hover:underline">
            {s.label}
          </Link>
        ))}
      </div>
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
