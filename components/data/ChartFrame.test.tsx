// @vitest-environment jsdom
//
// The Chart's frame (P2.11) in the browser: the reserved box at the height, the legend's chips toggling the series and the
// "+N more" fold, the emphasised series on whatever the cap, the canvas mounted once the box nears the viewport with the visible
// set, the data as a hidden table; no chips with one series.

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The canvas (Recharts) behind next/dynamic: a stand-in recording its props, so the frame's own behaviour is what is tested.
const canvasProps = vi.fn();
vi.mock('next/dynamic', () => ({
  default: () => (props: Record<string, unknown>) => {
    canvasProps(props);
    return <div data-canvas="yes" />;
  },
}));
import { ChartFrame, type ChartData } from './ChartFrame';

const DATA: ChartData = {
  type: 'line',
  series: [
    { key: 's0', label: 'Andrea Kimi Antonelli', team: 'Mercedes', last: 68 },
    { key: 's1', label: 'George Russell', team: 'Mercedes', last: 58 },
    { key: 's2', label: 'Isack Hadjar', team: 'RB F1 Team', last: 22 },
  ],
  points: [
    { label: '1', title: 'Round 1 · Australian Grand Prix', s0: 25, s1: 18, s2: 6 },
    { label: '2', title: 'Round 2 · Chinese Grand Prix', s0: 68, s1: 58, s2: 22 },
  ],
  decimals: false,
  zero: true,
  height: 320,
  legend: true,
  shown: 2,
  emphasised: [],
  xTitle: '',
  yTitle: '',
  colour: null,
  labelLabel: 'Round',
  valueLabel: 'Points',
};

let intersect: (() => void) | null = null;
beforeEach(() => {
  intersect = null;
  // jsdom has no IntersectionObserver; the stub keeps the callback so a test can bring the box into view.
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
});

describe('ChartFrame', () => {
  it('reserves the box at the height, lists the leaders as pressed chips with their last value and the emphasised series whatever the cap; the canvas mounts when the box nears the viewport with the visible set; a chip toggles its series', () => {
    render(<ChartFrame data={{ ...DATA, emphasised: ['s2'] }} />);
    const root = document.querySelector<HTMLElement>('[data-chart-type="line"]')!;
    expect(root.getAttribute('data-emphasis')).toBe('s2');
    expect(root.querySelector<HTMLElement>('[data-chart-box]')!.style.height).toBe('320px');
    expect(screen.getAllByRole('button', { pressed: true }).map(c => c.textContent)).toEqual(['Andrea Kimi Antonelli68', 'George Russell58', 'Isack Hadjar22']);
    expect(screen.queryByRole('button', { name: /more/ })).toBeNull();
    expect(canvasProps).not.toHaveBeenCalled();
    act(() => intersect!());
    expect(canvasProps).toHaveBeenCalled();
    expect(canvasProps.mock.calls[canvasProps.mock.calls.length - 1][0]).toMatchObject({ type: 'line', visible: ['s0', 's1', 's2'], emphasised: ['s2'], decimals: false, zero: true });
    fireEvent.click(screen.getByRole('button', { name: /George Russell/ }));
    expect(screen.getByRole('button', { name: /George Russell/ }).getAttribute('aria-pressed')).toBe('false');
    expect(canvasProps.mock.calls[canvasProps.mock.calls.length - 1][0]).toMatchObject({ visible: ['s0', 's2'] });
  });

  it('folds the series past the cap behind “+N more” and unfolds them; the hidden table carries every series and round; one series draws no chips', () => {
    render(<ChartFrame data={DATA} />);
    expect(screen.getAllByRole('button', { pressed: true }).map(c => c.textContent)).toEqual(['Andrea Kimi Antonelli68', 'George Russell58']);
    fireEvent.click(screen.getByRole('button', { name: '+1 more' }));
    expect(screen.getByRole('button', { name: /Isack Hadjar/ }).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse' }));
    expect(screen.queryByRole('button', { name: /Isack Hadjar/ })).toBeNull();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Round', 'Andrea Kimi Antonelli', 'George Russell', 'Isack Hadjar']);
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getAllByRole('row')[2].textContent).toBe('2685822');
    cleanup();
    render(<ChartFrame data={{ ...DATA, series: DATA.series.slice(0, 1), type: 'bar', colour: '#e10600' }} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(document.querySelector('[data-chart-type="bar"]')).not.toBeNull();
  });
});
