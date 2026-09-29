'use client';
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import Link from 'next/link';
import { CircleMarker, MapContainer, Popup, ScaleControl, TileLayer, useMap } from 'react-leaflet';
import type { TileSet } from '@/lib/design/map-backgrounds';
import type { MapMarker, MapNavigation, MapView } from './MapFrame';

// The Map's canvas (P2.12): the Circuit Map's Leaflet (components/information/TracksMapInner.tsx) generalised to the frame's
// markers on the family's tile set. MapFrame loads it through next/dynamic with ssr:false, so Leaflet and react-leaflet ride in
// a chunk of their own, requested only where a Map is drawn (the study's lesson: nothing reached from the page frame). The world
// view is the Circuit Map's (20,0 at zoom 2, the world copied across the date line); Automatic fits the markers once through
// useMap, since the container reads its centre at mount alone. react-leaflet follows a changed tile URL (the family's swap) but
// not a changed attribution, which the one attribution a background's two sets share sidesteps. A marker without a colour of
// its own takes the theme's accent through a class (app/globals.css): Leaflet writes a marker's colours as presentation
// attributes, where a var() cannot go.

export interface MapCanvasProps {
  tiles: TileSet;
  markers: readonly MapMarker[];
  view: MapView;
  navigation: MapNavigation;
  scale: boolean;
  wheel: boolean;
}

/** The Circuit Map's opening view. */
const WORLD: [number, number] = [20, 0];
const WORLD_ZOOM = 2;
/** Automatic's margin inside the box, and the ceiling one or two close markers would otherwise zoom past. */
const FIT = { padding: [24, 24] as [number, number], maxZoom: 12 };

function Fit({ markers }: { markers: readonly MapMarker[] }) {
  const map = useMap();
  useEffect(() => {
    if (markers.length === 0) return;
    let south = Infinity;
    let west = Infinity;
    let north = -Infinity;
    let east = -Infinity;
    for (const m of markers) {
      south = Math.min(south, m.lat);
      north = Math.max(north, m.lat);
      west = Math.min(west, m.lon);
      east = Math.max(east, m.lon);
    }
    map.fitBounds(
      [
        [south, west],
        [north, east],
      ],
      FIT,
    );
  }, [map, markers]);
  return null;
}

export function MapCanvas({ tiles, markers, view, navigation, scale, wheel }: MapCanvasProps) {
  return (
    <MapContainer center={WORLD} zoom={WORLD_ZOOM} minZoom={WORLD_ZOOM} maxZoom={tiles.maxZoom} worldCopyJump scrollWheelZoom={wheel} zoomControl={navigation === 'zoom'} className="h-full w-full">
      <TileLayer url={tiles.url} attribution={tiles.attribution} maxZoom={tiles.maxZoom} />
      {view === 'auto' && <Fit markers={markers} />}
      {scale && <ScaleControl position="bottomleft" />}
      {markers.map((m, i) => (
        <CircleMarker key={`${i}:${m.lat},${m.lon}`} center={[m.lat, m.lon]} radius={6} pathOptions={m.colour !== null ? { color: m.colour, fillColor: m.colour, fillOpacity: 0.85, weight: 1.5 } : { className: 'map-marker-accent', fillOpacity: 0.85, weight: 1.5 }}>
          <Popup>
            <div className="text-13 font-semibold leading-tight text-text">{m.title}</div>
            {m.body !== '' && <div className="mt-0.5 text-12 text-text-muted">{m.body}</div>}
            {m.href !== null && (
              <Link href={m.href} className="mt-1.5 inline-block font-mono text-10 uppercase tracking-[0.14em]">
                Open
              </Link>
            )}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
