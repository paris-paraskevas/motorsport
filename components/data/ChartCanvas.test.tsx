// @vitest-environment jsdom
//
// The Chart's canvas (P2.11): Recharts 3.8 mounted in jsdom at a fixed size (renderToStaticMarkup draws its wrapper alone, the
// plan critic's probe): a path per visible line, the emphasised one thick, a hidden one absent; rectangles for bars, none for a
// null; the value axis with decimals for the gaps and integers for points; the axes' titles.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ChartCanvas } from './ChartCanvas';

const SERIES = [
  { key: 's0', label: 'Andrea Kimi Antonelli', stroke: '#ff0000' },
  { key: 's1', label: 'George Russell', stroke: '#00ff00', dash: '6 4' },
];
const POINTS = [
  { label: '1', title: 'Round 1 · Australian Grand Prix', s0: 25, s1: 18 },
  { label: '2', title: 'Round 2 · Chinese Grand Prix', s0: 43, s1: 43 },
  { label: '3', title: 'Round 3 · Japanese Grand Prix', s0: 68, s1: 58 },
];
const SIZE = { width: 600, height: 300 };
afterEach(cleanup);

describe('ChartCanvas', () => {
  it('draws a line per visible series, the emphasised one 3.5 wide, the hidden one not at all; the value axis in whole numbers', () => {
    const { container } = render(<ChartCanvas type="line" points={POINTS} series={SERIES} visible={['s0']} emphasised={['s0']} decimals={false} zero={true} xTitle="" yTitle="" size={SIZE} />);
    expect(container.querySelector('svg')).not.toBeNull();
    const curves = container.querySelectorAll('path.recharts-line-curve');
    expect(curves).toHaveLength(1);
    expect(curves[0].getAttribute('stroke')).toBe('#ff0000');
    expect(curves[0].getAttribute('stroke-width')).toBe('3.5');
    const ticks = [...container.querySelectorAll('.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value')].map(t => t.textContent ?? '');
    expect(ticks.length).toBeGreaterThan(2);
    expect(ticks.every(t => !/\./.test(t))).toBe(true);
    // Both visible: two curves, the second dashed and 2 wide.
    cleanup();
    const both = render(<ChartCanvas type="line" points={POINTS} series={SERIES} visible={['s0', 's1']} emphasised={[]} decimals={false} zero={true} xTitle="" yTitle="" size={SIZE} />).container;
    const two = both.querySelectorAll('path.recharts-line-curve');
    expect(two).toHaveLength(2);
    expect(two[1].getAttribute('stroke-dasharray')).toBe('6 4');
    expect(two[1].getAttribute('stroke-width')).toBe('2');
  });

  it('draws rectangles for bars, none for a null, a decimal value axis for the gaps, and the axes’ titles', () => {
    const { container } = render(
      <ChartCanvas
        type="bar"
        points={[
          { label: 'ANT', title: 'Kimi Antonelli', s0: null },
          { label: 'RUS', title: 'George Russell', s0: 0.1 },
          { label: 'LEC', title: 'Charles Leclerc', s0: 0.25 },
        ]}
        series={SERIES.slice(0, 1)}
        visible={['s0']}
        emphasised={[]}
        decimals={true}
        zero={true}
        xTitle="Driver"
        yTitle="Gap"
        size={SIZE}
      />,
    );
    expect(container.querySelectorAll('.recharts-bar-rectangle')).toHaveLength(2);
    const ticks = [...container.querySelectorAll('.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value')].map(t => t.textContent ?? '');
    expect(ticks.some(t => /\./.test(t))).toBe(true);
    expect(container.textContent).toContain('Driver');
    expect(container.textContent).toContain('Gap');
  });

  it('draws an area per visible series for Line with Area', () => {
    const { container } = render(<ChartCanvas type="area" points={POINTS} series={SERIES} visible={['s0', 's1']} emphasised={[]} decimals={false} zero={true} xTitle="" yTitle="" size={SIZE} />);
    expect(container.querySelectorAll('path.recharts-area-area')).toHaveLength(2);
    expect(container.querySelectorAll('path.recharts-area-curve')).toHaveLength(2);
  });
});
