// @vitest-environment jsdom
//
// The Map's frame (P2.12) in the browser: the box at the height, the markers as a hidden list of links, the canvas mounted once
// the box nears the viewport with the family's tiles, the dark set once the root turns dark (the theme's class), the light set
// kept for a background without a dark set.

import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The canvas (Leaflet) behind next/dynamic: a stand-in recording its props, so the frame's own behaviour is what is tested.
const canvasProps = vi.fn();
vi.mock('next/dynamic', () => ({
  default: () => (props: Record<string, unknown>) => {
    canvasProps(props);
    return <div data-canvas="yes" />;
  },
}));
import { MapFrame, type MapData } from './MapFrame';

const DATA: MapData = {
  background: 'canvas',
  light: { url: 'https://light.example/{z}/{y}/{x}', attribution: 'Light', maxZoom: 16 },
  dark: { url: 'https://dark.example/{z}/{y}/{x}', attribution: 'Dark', maxZoom: 16 },
  markers: [
    { lat: 45.6, lon: 9.3, title: 'Monza', body: 'Italy', href: '/information/tracks/monza', colour: '#ff4136' },
    { lat: 50.4, lon: 5.9, title: 'Spa', body: '', href: null, colour: null },
  ],
  view: 'auto',
  height: 520,
  navigation: 'zoom',
  scale: false,
  wheel: true,
};
const last = () => canvasProps.mock.calls[canvasProps.mock.calls.length - 1][0] as Record<string, unknown>;

let intersect: (() => void) | null = null;
beforeEach(() => {
  intersect = null;
  document.documentElement.classList.remove('dark');
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        intersect = () => cb([{ isIntersecting: true }]);
      }
      observe = vi.fn();
      disconnect = vi.fn();
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  canvasProps.mockReset();
  document.documentElement.classList.remove('dark');
});

describe('MapFrame', () => {
  it('reserves the box at the height, lists the markers as hidden links, mounts the canvas on intersection with the light tiles, and hands it the dark set once the root turns dark', async () => {
    render(<MapFrame data={DATA} />);
    const root = document.querySelector<HTMLElement>('[data-map-background="canvas"]')!;
    expect(root.getAttribute('data-map-view')).toBe('auto');
    expect(root.querySelector<HTMLElement>('[data-map-box]')!.style.height).toBe('520px');
    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('listitem').map(li => li.textContent)).toEqual(['Monza · Italy', 'Spa']);
    expect(within(list).getByRole('link', { name: 'Monza' }).getAttribute('href')).toBe('/information/tracks/monza');
    expect(canvasProps).not.toHaveBeenCalled();
    act(() => intersect!());
    expect(last()).toMatchObject({ tiles: DATA.light, view: 'auto', navigation: 'zoom', scale: false, wheel: true, markers: DATA.markers });
    act(() => {
      document.documentElement.classList.add('dark');
    });
    await waitFor(() => expect(last().tiles).toEqual(DATA.dark));
  });

  it('starts on the dark set when the root is dark at mount, and keeps the light set for a background without a dark set', () => {
    document.documentElement.classList.add('dark');
    render(<MapFrame data={{ ...DATA, dark: null }} />);
    act(() => intersect!());
    expect(last().tiles).toEqual(DATA.light);
    cleanup();
    canvasProps.mockReset();
    render(<MapFrame data={DATA} />);
    act(() => intersect!());
    expect(last().tiles).toEqual(DATA.dark);
  });
});
