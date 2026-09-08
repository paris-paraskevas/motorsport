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
import { seriesPublishedPostCount } from '@/lib/blog';
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

/** Whether a tab renders an empty state — a page that advertises content it has
 *  not got. Measured on prod 2026-08-28: **13 such pages were `index, follow`** —
 *  twelve series blog tabs reading "No DTM pieces published yet" and
 *  `/series/nls/standings` reading "Nothing here yet for this series." Thin,
 *  near-identical to each other, and promising data in the SERP snippet that the
 *  page does not deliver. Launch-checklist A4 asks for exactly this call, and
 *  0.334.8 already made it for the news tabs.
 *
 *  These are the only two empty states in the tab set, and each is detected at
 *  its own source rather than by sniffing rendered output:
 *   - `standings` — `StandingsTab` falls through to `PlaceholderTab` when the
 *     series has no `officialStandingsUrl`, which is a content-file fact.
 *   - `blog` — zero published posts, and ONLY when the database actually
 *     answered. See `seriesPublishedPostCount`: an unreachable Supabase must not
 *     read as "empty", or every blog tab noindexes itself on a build that could
 *     not see the data.
 *
 *  Fail-open by construction: anything unknown returns false and stays indexed.
 *  A tab flips back to indexable the moment it has content, on the next
 *  revalidation — nothing needs to be un-done by hand. */
export async function tabIsEmpty(slug: string, tab: TabKey, meta: { officialStandingsUrl?: string }): Promise<boolean> {
  if (tab === 'standings') return !meta.officialStandingsUrl;
  if (tab === 'blog') return (await seriesPublishedPostCount(slug)) === 0;
  return false;
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
      // The 15 news tabs are noindex'd. They are motorsport.com headline
      // aggregation by design — the page's own words are a heading and a
      // source label, and the substance belongs to whoever wrote it. That is
      // exactly the "no original content" family Google's low-value-content
      // verdict describes, and it is the one family the enrichment programme
      // cannot fix by writing more (the audit's own conclusion). `follow` stays
      // on so the outbound links still carry, and the tab remains fully usable
      // for readers — this removes it from the index, not from the site.
      // `follow` stays on in both cases: the page remains fully usable and its
      // outbound links still carry. This removes them from the index, not from
      // the site — the same call 0.334.8 made for the news tabs.
      ...(tab === 'news' || (await tabIsEmpty(slug, tab, meta))
        ? { robots: { index: false, follow: true } }
        : {}),
      // ownCard: `app/(app)/series/[slug]/opengraph-image.tsx` generates a
      // series-tinted card, inherited by every tab beneath it. An explicit
      // `images` here would beat the file convention (measured 2026-08-25), so
      // this flag is load-bearing, not decoration.
      ...withSocialMeta({ title, description, path: canonical, ownCard: true }),
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
          className="font-mono text-11 font-semibold uppercase tracking-[0.16em] text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
        >
          ← {series.meta.name}
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <span aria-hidden="true" className="h-9 w-[4px] shrink-0" style={{ backgroundColor: color }} />
          <h1 className="font-serif text-38 font-medium leading-none tracking-[-0.02em] text-text lg:text-46">
            {title}
          </h1>
        </div>
        <p className="mt-2 font-mono text-10 font-semibold uppercase tracking-[0.16em] text-text-muted">
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

      <div className="mt-8 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-border pt-3 font-mono text-10 font-semibold uppercase tracking-[0.14em]">
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
