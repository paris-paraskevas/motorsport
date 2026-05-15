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
import { ResultsTab } from '@/components/tabs/ResultsTab';
import { DriversTab } from '@/components/tabs/DriversTab';
import { TeamsTab } from '@/components/tabs/TeamsTab';
import { RulesTab } from '@/components/tabs/RulesTab';
import { NewsTab } from '@/components/tabs/NewsTab';
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
    case 'news':
      return <NewsTab series={series} />;
    case 'standings':
      return <StandingsTab series={series} />;
    case 'results':
      return <ResultsTab series={series} />;
    case 'drivers':
      return <DriversTab series={series} />;
    case 'teams':
      return <TeamsTab series={series} />;
    case 'rules':
      return <RulesTab series={series} />;
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
  let series;
  try {
    series = await loadSeries(slug);
  } catch {
    notFound();
  }

  const activeTab = resolveTab(tab);

  const color = series.meta.color;

  return (
    <div
      className="relative max-w-2xl lg:max-w-5xl mx-auto p-4 md:p-6 lg:p-8 pb-16"
      style={
        {
          '--series-color': color,
        } as React.CSSProperties
      }
    >
      {/* Series-color wash — subtle, only at top, only on this page */}
      <div
        className="absolute inset-x-0 top-0 h-72 -z-10 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 80% 100% at 50% 0%, ${color}1f 0%, transparent 70%)`,
        }}
      />
      {/* Hairline color accent at the very top */}
      <div
        className="absolute top-0 left-0 right-0 h-px -z-10"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />

      <header className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: color, boxShadow: `0 0 14px ${color}` }}
          />
          <span
            className="text-[11px] uppercase tracking-[0.18em] font-semibold"
            style={{ color }}
          >
            {series.meta.name}
          </span>
        </div>
        <h1 className="text-zinc-50 text-3xl md:text-4xl font-bold tracking-tight leading-tight">
          <span className="tnum">{series.meta.season}</span>{' '}
          <span className="text-zinc-400 font-medium">season</span>
        </h1>
        <StaleBanner configured={series.configured} stale={series.stale} />
      </header>

      <SeriesTabs color={color} activeTab={activeTab} />

      <div>{renderTab(activeTab, series)}</div>
    </div>
  );
}
