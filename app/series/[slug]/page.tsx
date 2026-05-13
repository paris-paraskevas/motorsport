import { notFound } from 'next/navigation';
import { listSeriesSlugs, loadSeries } from '@/lib/series';
import { resolveTab, labelForTab, TabKey } from '@/lib/tabs';
import { Series } from '@/lib/types';
import { SeriesTabs } from '@/components/SeriesTabs';
import { StaleBanner } from '@/components/StaleBanner';
import { SeriesBadge } from '@/components/SeriesBadge';
import { CalendarTab } from '@/components/tabs/CalendarTab';
import { AboutTab } from '@/components/tabs/AboutTab';
import { HistoryTab } from '@/components/tabs/HistoryTab';
import { ChampionsTab } from '@/components/tabs/ChampionsTab';
import { StandingsTab } from '@/components/tabs/StandingsTab';
import { PlaceholderTab } from '@/components/tabs/PlaceholderTab';

export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  const slugs = await listSeriesSlugs();
  return slugs.map(slug => ({ slug }));
}

function renderTab(activeTab: TabKey, series: Series) {
  switch (activeTab) {
    case 'calendar':
      return <CalendarTab series={series} />;
    case 'about':
      return <AboutTab series={series} />;
    case 'history':
      return <HistoryTab series={series} />;
    case 'champions':
      return <ChampionsTab series={series} />;
    case 'standings':
      return <StandingsTab series={series} />;
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
  let series;
  try {
    series = await loadSeries(slug);
  } catch {
    notFound();
  }

  const activeTab = resolveTab(tab);

  return (
    <div className="max-w-2xl lg:max-w-5xl mx-auto p-4 md:p-6 lg:p-8 pb-16">
      <header className="mb-4">
        <div className="mb-2">
          <SeriesBadge name={series.meta.name} color={series.meta.color} />
        </div>
        <h1 className="text-zinc-100 text-2xl font-bold tracking-tight">
          {series.meta.season} season
        </h1>
        <StaleBanner configured={series.configured} stale={series.stale} />
      </header>

      <SeriesTabs color={series.meta.color} activeTab={activeTab} />

      <div className="mt-6">{renderTab(activeTab, series)}</div>
    </div>
  );
}
