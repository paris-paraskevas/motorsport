'use client';
import dynamic from 'next/dynamic';
import type { DriverTrace } from '@/lib/openf1/delta';
import type { EnrichedDriver } from '@/lib/openf1/drivers';
import type { Circuit } from '@/lib/openf1/track';

// Defers three.js + @react-three/fiber + @react-three/drei (hundreds of KB
// parsed) off the critical path, same wrapper pattern as LazyDeltaTrace.
// ssr:false needs a client module boundary, so the heavy view loads ONLY when
// this component mounts — keeping three/drei off the home + Decoder-shell bundle.
const View = dynamic(() => import('./GhostLap3D').then(m => m.GhostLap3D), {
  ssr: false,
  loading: () => <div className="h-80 animate-pulse rounded-md border border-border bg-surface/40 md:h-[28rem]" />,
});

export function LazyGhostLap3D(props: {
  driverA: EnrichedDriver;
  driverB: EnrichedDriver;
  traceA: DriverTrace;
  traceB: DriverTrace;
  circuit?: Circuit | null;
}) {
  return <View {...props} />;
}
