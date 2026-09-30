'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import { tilesFor, type MapFamily, type TileSet } from '@/lib/design/map-backgrounds';

// The Map's frame (P2.12): the Chart's split (./ChartFrame). This eager client piece owns the layout footprint (the box at the
// setting's height) and the tiles' family; the Leaflet canvas (./MapCanvas) loads through next/dynamic with ssr:false once the
// box nears the viewport, so the library rides in no route's chunk and a map inside a folded region or a hidden tab (a zero box
// Leaflet would draw grey) waits until it shows. The family is the root's `dark` class (components/theme/ThemeScript.tsx sets
// it before paint; the picker and the Theme Roller toggle it), read through a store so the read and its subscription are one;
// the server's snapshot is the light set, and the tiles are the canvas's alone, so the markup never depends on the theme. The
// places stand as a visually hidden list of links for readers without the picture and for the crawlers (the Chart's rule).

export type MapView = 'auto' | 'world';
export type MapNavigation = 'zoom' | 'none';
export interface MapMarker {
  lat: number;
  lon: number;
  title: string;
  body: string;
  /** The place's page; null draws the popup without Open. */
  href: string | null;
  /** The row's colour; null takes the theme's accent. */
  colour: string | null;
}
export interface MapData {
  /** The background's key in the catalogue. */
  background: string;
  light: TileSet;
  /** null: the light set for both families. */
  dark: TileSet | null;
  markers: MapMarker[];
  view: MapView;
  /** The box's height in pixels. */
  height: number;
  navigation: MapNavigation;
  scale: boolean;
  wheel: boolean;
}

// The Circuit Map's placeholder words, filling the reserved box before the canvas is requested and while its chunk is in flight.
function Fallback() {
  return (
    <div className="flex h-full w-full animate-pulse items-center justify-center border border-border bg-surface/40 font-mono text-11 uppercase tracking-[0.16em] text-text-faint" aria-hidden="true">
      Loading map…
    </div>
  );
}

const Canvas = dynamic(() => import('./MapCanvas').then(m => m.MapCanvas), { ssr: false, loading: () => <Fallback /> });

const subscribeFamily = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
};
const readFamily = (): MapFamily => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
const serverFamily = (): MapFamily => 'light';

export function MapFrame({ data }: { data: MapData }) {
  const family = useSyncExternalStore(subscribeFamily, readFamily, serverFamily);
  const tiles = tilesFor(data, family);

  // The canvas is requested once the box nears the viewport (the Chart's gate, its rootMargin a screen early); the observer's
  // callback sets the state, never the effect itself.
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div data-map-background={data.background} data-map-view={data.view}>
      <div ref={boxRef} data-map-box="" className="relative isolate w-full overflow-hidden border border-border" style={{ height: data.height }}>
        {near ? <Canvas tiles={tiles} markers={data.markers} view={data.view} navigation={data.navigation} scale={data.scale} wheel={data.wheel} /> : <Fallback />}
      </div>
      <ul className="sr-only">
        {data.markers.map((m, i) => (
          <li key={i}>
            {m.href !== null ? <a href={m.href}>{m.title}</a> : m.title}
            {m.body !== '' ? ` · ${m.body}` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}
