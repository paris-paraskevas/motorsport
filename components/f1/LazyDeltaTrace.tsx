'use client';
import dynamic from 'next/dynamic';
import type { DriverTrace } from '@/lib/openf1/decoder';
import type { EnrichedDriver } from '@/lib/openf1/drivers';

// Defers recharts (~100 KB parsed) off the critical path, same as
// LazySeasonTrendChart. ssr:false needs a client module, hence this wrapper
// rather than a dynamic() call inside QualifyingDecoder's render of the view.
const Chart = dynamic(() => import('./DeltaTrace').then(m => m.DeltaTrace), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse border border-border bg-surface/40 md:h-80" />,
});

export function LazyDeltaTrace(props: {
  driverA: EnrichedDriver;
  driverB: EnrichedDriver;
  traceA: DriverTrace;
  traceB: DriverTrace;
}) {
  return <Chart {...props} />;
}
