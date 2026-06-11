'use client';
import dynamic from 'next/dynamic';
import type { SeasonTrendData } from '@/lib/season-trend';

// Defers recharts (~100 KB parsed) off the critical path: the results tab
// streams its tables immediately and the chart hydrates in afterwards.
// ssr: false requires a client module, hence this wrapper instead of a
// dynamic() call inside the server-side ResultsTab.
const Chart = dynamic(
  () => import('./SeasonTrendChart').then(m => m.SeasonTrendChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 sm:h-72 md:h-80 border border-border bg-surface/40 animate-pulse" />
    ),
  },
);

export function LazySeasonTrendChart(props: SeasonTrendData) {
  return <Chart {...props} />;
}
