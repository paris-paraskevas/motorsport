'use client';

import 'leaflet/dist/leaflet.css';

import { useMemo, useRef, useState } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import { MapContainer, TileLayer, CircleMarker, Popup, LayersControl } from 'react-leaflet';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import type { MapTrack } from './TracksMap';

// Category → marker colour. Series categories reuse the site's own series accent
// colours (content/series/<slug>/meta.json) so the map matches the rest of the
// app; the remaining descriptive categories get a distinct, sensible hue.
const CATEGORY_COLOR: Record<string, string> = {
  f1: '#ff4136', // Formula 1 (series meta)
  f2: '#38bdf8', // Formula 2 (series meta)
  f3: '#818cf8', // Formula 3 (series meta)
  motogp: '#fb923c', // MotoGP (series meta)
  wsbk: '#f59e0b', // WorldSBK (series meta)
  nascar: '#a3e635', // NASCAR Cup (series meta)
  indycar: '#f43f5e', // IndyCar (series meta)
  endurance: '#3b82f6', // FIA WEC (series meta)
  gt: '#a855f7', // GT World Challenge (series meta)
  wrc: '#eab308', // WRC (series meta)
  rally: '#d97706', // generic rally (amber-600, distinct from WRC)
  supercars: '#22d3ee', // cyan-400
  karting: '#ec4899', // pink-500
  historic: '#a8a29e', // stone-400 (neutral heritage)
  hillclimb: '#14b8a6', // teal-500
};
const DEFAULT_COLOR = '#94a3b8'; // slate-400

/** A track's colour comes from its first (primary) category. */
function colorFor(categories: string[]): string {
  const primary = categories[0];
  return (primary && CATEGORY_COLOR[primary]) || DEFAULT_COLOR;
}

export default function TracksMapInner({ tracks }: { tracks: MapTrack[] }) {
  const mapRef = useRef<LeafletMap>(null);

  // Categories present, most-common first, for the filter chips.
  const categories = useMemo(() => {
    const count = new Map<string, number>();
    for (const t of tracks) for (const c of t.categories) count.set(c, (count.get(c) ?? 0) + 1);
    return [...count.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([c]) => c);
  }, [tracks]);

  // Category filter — every category on by default; toggling one hides markers
  // whose primary/secondary categories are all switched off.
  const [active, setActive] = useState<Set<string>>(() => new Set(categories));
  const allActive = active.size === categories.length;
  const toggleCategory = (c: string) =>
    setActive((cur) => {
      const next = new Set(cur);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  // Select-all / clear toggle (mirrors the calendar filters): one click flips
  // between every category and none, so isolating one category is clear-then-pick
  // instead of unticking the rest.
  const toggleAll = () => setActive(allActive ? new Set() : new Set(categories));

  const visible = useMemo(
    () => tracks.filter((t) => t.categories.some((c) => active.has(c))),
    [tracks, active],
  );

  // Search — filter by name or country; selecting a result (or Enter) flies there.
  const [query, setQuery] = useState('');
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return tracks
      .filter((t) => t.name.toLowerCase().includes(q) || t.country.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, tracks]);

  const flyTo = (t: MapTrack) => {
    mapRef.current?.flyTo([t.lat, t.lng], 12, { duration: 1.2 });
    setQuery('');
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className="relative z-[1000] w-full max-w-md">
        <label htmlFor="circuit-search" className="sr-only">
          Search circuits by name or country
        </label>
        <div className="relative">
          <Search
            size={15}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-faint"
          />
          <input
            id="circuit-search"
            type="text"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && matches[0]) {
                e.preventDefault();
                flyTo(matches[0]);
              } else if (e.key === 'Escape') {
                setQuery('');
              }
            }}
            placeholder="Search circuits…"
            className="w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-9 text-sm text-text placeholder:text-text-faint transition-colors duration-(--duration-fast) focus:border-border-strong focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-faint transition-colors hover:text-text"
            >
              <X size={15} />
            </button>
          )}
        </div>
        {matches.length > 0 && (
          <ul className="absolute top-full left-0 mt-1 w-full overflow-hidden rounded-xl border border-border bg-surface-elevated shadow-lg">
            {matches.map((t) => (
              <li key={t.slug}>
                <button
                  type="button"
                  onClick={() => flyTo(t)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text transition-colors hover:bg-surface"
                >
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: colorFor(t.categories) }}
                  />
                  <span className="truncate font-medium">{t.name}</span>
                  <span className="ml-auto shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint">
                    {t.country}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Category filter chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={toggleAll}
          aria-pressed={allActive}
          className="inline-flex items-center rounded-full border border-border-strong px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-text transition-colors duration-(--duration-fast) hover:bg-surface"
        >
          {allActive ? 'Clear' : 'Select all'}
        </button>
        <span aria-hidden="true" className="mx-0.5 h-4 w-px shrink-0 bg-border" />
        {categories.map((c) => {
          const on = active.has(c);
          return (
            <button
              key={c}
              type="button"
              onClick={() => toggleCategory(c)}
              aria-pressed={on}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors duration-(--duration-fast) ${
                on ? 'border-border-strong text-text' : 'border-border text-text-faint opacity-60'
              }`}
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: CATEGORY_COLOR[c] ?? DEFAULT_COLOR }}
              />
              {c}
            </button>
          );
        })}
      </div>

      {/* Map. `isolate` gives the container its own stacking context so Leaflet's
          internal z-index stack (controls sit at z-index 1000) can't leak out and
          paint over fixed app UI — the Race Engineer launcher (z-40) and the
          sticky header. Leaflet leaves .leaflet-container at z-index:auto, which
          is not a stacking context, so without this those z-1000 values escape. */}
      <MapContainer
        ref={mapRef}
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        worldCopyJump
        scrollWheelZoom
        className="isolate h-[70vh] min-h-[520px] w-full overflow-hidden rounded-lg border border-border"
      >
        {/* Base-layer switcher (top-right): Standard OSM + free satellite/terrain,
            all key-less. Esri World Imagery uses {z}/{y}/{x} order (not OSM's
            {z}/{x}/{y}); OpenTopoMap is the terrain option. */}
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Map">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              attribution='Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Terrain">
            <TileLayer
              attribution='&copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA) &copy; OpenStreetMap contributors'
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
        </LayersControl>
        {visible.map((t) => {
          const color = colorFor(t.categories);
          return (
            <CircleMarker
              key={t.slug}
              center={[t.lat, t.lng]}
              radius={6}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.85, weight: 1.5 }}
            >
              <Popup>
                <span className="block text-sm font-semibold text-text">{t.name}</span>
                <span className="block text-xs text-text-muted">{t.country}</span>
                <Link
                  href={`/information/tracks/${t.slug}`}
                  className="mt-1 inline-block text-xs font-semibold text-tint hover:underline"
                >
                  View circuit →
                </Link>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-faint">
        Showing {visible.length} of {tracks.length} circuits
      </p>
    </div>
  );
}
