// @vitest-environment jsdom
//
// The Map's canvas (P2.12): react-leaflet stood in by components recording their props (Leaflet needs a laid-out document), so
// what is tested is ours: the family's tiles and attribution, a marker per place in its colour with the popup's title, body and
// Open, the fit to the markers for Automatic or the world for World, the zoom control, the wheel and the scale bar by the settings.

import { cleanup, render, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

const fitBounds = vi.fn();
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, center, zoom, minZoom, maxZoom, zoomControl, scrollWheelZoom }: { children: ReactNode; center: unknown; zoom: number; minZoom: number; maxZoom: number; zoomControl: boolean; scrollWheelZoom: boolean }) => (
    <div data-map-container data-center={JSON.stringify(center)} data-zoom={zoom} data-min-zoom={minZoom} data-max-zoom={maxZoom} data-zoom-control={String(zoomControl)} data-wheel={String(scrollWheelZoom)}>
      {children}
    </div>
  ),
  TileLayer: ({ url, attribution, maxZoom }: { url: string; attribution: string; maxZoom: number }) => <div data-tile data-url={url} data-attribution={attribution} data-max-zoom={maxZoom} />,
  CircleMarker: ({ children, center, pathOptions }: { children: ReactNode; center: unknown; pathOptions: { color?: string; className?: string } }) => (
    <div data-marker data-center={JSON.stringify(center)} data-color={pathOptions.color ?? ''} data-class={pathOptions.className ?? ''}>
      {children}
    </div>
  ),
  Popup: ({ children }: { children: ReactNode }) => <div data-popup>{children}</div>,
  ScaleControl: () => <div data-scale />,
  useMap: () => ({ fitBounds }),
}));
import { MapCanvas } from './MapCanvas';

const MARKERS = [
  { lat: 45.6, lon: 9.3, title: 'Monza', body: 'Italy', href: '/information/tracks/monza', colour: '#ff4136' },
  { lat: 50.4, lon: 5.9, title: 'Spa', body: '', href: null, colour: null },
];
const TILES = { url: 'https://dark.example/{z}/{y}/{x}', attribution: 'Tiles © Esri', maxZoom: 16 };
afterEach(() => {
  cleanup();
  fitBounds.mockReset();
});

describe('MapCanvas', () => {
  it('draws the family’s tiles, a marker per place in its colour with the popup’s title, body and Open, fits the bounds for Automatic, the scale bar when on, the wheel off when off', () => {
    const { container } = render(<MapCanvas tiles={TILES} markers={MARKERS} view="auto" navigation="zoom" scale={true} wheel={false} />);
    const tile = container.querySelector('[data-tile]')!;
    expect(tile.getAttribute('data-url')).toBe('https://dark.example/{z}/{y}/{x}');
    expect(tile.getAttribute('data-attribution')).toBe('Tiles © Esri');
    expect(tile.getAttribute('data-max-zoom')).toBe('16');
    const markers = [...container.querySelectorAll<HTMLElement>('[data-marker]')];
    expect(markers).toHaveLength(2);
    expect(markers[0].getAttribute('data-center')).toBe('[45.6,9.3]');
    expect(markers[0].getAttribute('data-color')).toBe('#ff4136');
    expect(markers[0].getAttribute('data-class')).toBe('');
    // No colour of its own: the theme's accent through the class app/globals.css styles (a var() cannot fill Leaflet's attributes).
    expect(markers[1].getAttribute('data-color')).toBe('');
    expect(markers[1].getAttribute('data-class')).toBe('map-marker-accent');
    expect(markers[0].textContent).toContain('Monza');
    expect(markers[0].textContent).toContain('Italy');
    expect(within(markers[0]).getByRole('link', { name: 'Open' }).getAttribute('href')).toBe('/information/tracks/monza');
    expect(within(markers[1]).queryByRole('link')).toBeNull();
    expect(fitBounds).toHaveBeenCalledWith(
      [
        [45.6, 5.9],
        [50.4, 9.3],
      ],
      expect.objectContaining({ padding: [24, 24] }),
    );
    const c = container.querySelector('[data-map-container]')!;
    expect(c.getAttribute('data-zoom-control')).toBe('true');
    expect(c.getAttribute('data-wheel')).toBe('false');
    expect(c.getAttribute('data-max-zoom')).toBe('16');
    expect(container.querySelector('[data-scale]')).not.toBeNull();
  });

  it('opens on the world for World (the Circuit Map’s centre and zoom), without the zoom control or the scale bar when off', () => {
    const { container } = render(<MapCanvas tiles={TILES} markers={MARKERS} view="world" navigation="none" scale={false} wheel={true} />);
    const c = container.querySelector('[data-map-container]')!;
    expect(c.getAttribute('data-center')).toBe('[20,0]');
    expect(c.getAttribute('data-zoom')).toBe('2');
    expect(c.getAttribute('data-min-zoom')).toBe('2');
    expect(c.getAttribute('data-zoom-control')).toBe('false');
    expect(c.getAttribute('data-wheel')).toBe('true');
    expect(fitBounds).not.toHaveBeenCalled();
    expect(container.querySelector('[data-scale]')).toBeNull();
  });
});
