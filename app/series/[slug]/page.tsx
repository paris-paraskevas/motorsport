import { notFound } from 'next/navigation';
import { listSeriesSlugs, loadSeries } from '@/lib/series';
import { resolveTab, labelForTab } from '@/lib/tabs';
import { SeriesTabs } from '@/components/SeriesTabs';
import { StaleBanner } from '@/components/StaleBanner';
import { SeriesBadge } from '@/components/SeriesBadge';
import { CalendarTab } from '@/components/tabs/CalendarTab';
import { PlaceholderTab } from '@/components/tabs/PlaceholderTab';

export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  const slugs = await listSeriesSlugs();
  return slugs.map(slug => ({ slug }));
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
    <div className="max-w-2xl mx-auto p-4 pb-16">
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

      <div className="mt-6">
        {activeTab === 'calendar' ? (
          <CalendarTab series={series} />
        ) : (
          <PlaceholderTab tabLabel={labelForTab(activeTab)} />
        )}
      </div>
    </div>
  );
}
