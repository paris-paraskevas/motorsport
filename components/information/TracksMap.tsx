'use client';

import dynamic from 'next/dynamic';

/** Minimal, serialisable track shape passed from the server page into the map.
 *  Kept flat (no nested location) so it crosses the server→client boundary cleanly. */
export interface MapTrack {
  slug: string;
  name: string;
  country: string;
  countryCode?: string;
  lat: number;
  lng: number;
  categories: string[];
}

// Leaflet reads `window` at import time, so the map must never render on the
// server. Next 16 forbids `dynamic(..., { ssr: false })` inside a Server
// Component, so this thin Client wrapper owns the dynamic import; the server
// page just renders <TracksMap>.
const TracksMapInner = dynamic(() => import('./TracksMapInner'), {
  ssr: false,
  // Reserve the map's exact height up-front so the page doesn't shift when the
  // chunk loads (CLS): same h-[70vh] min-h-[520px] as the real container.
  loading: () => (
    <div
      className="flex h-[70vh] min-h-[520px] w-full items-center justify-center rounded-lg border border-border bg-surface"
      aria-hidden="true"
    >
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-faint">
        Loading map…
      </span>
    </div>
  ),
});

export function TracksMap({ tracks }: { tracks: MapTrack[] }) {
  return <TracksMapInner tracks={tracks} />;
}
