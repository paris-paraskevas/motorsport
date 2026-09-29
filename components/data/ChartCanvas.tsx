'use client';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import type { ChartPoint, ChartType } from './ChartFrame';

// The Chart's canvas (P2.11): SeasonTrendChart's Recharts plot generalised to a line, bars or an area per series over labels,
// with the site's grid, ticks and tooltip. ChartFrame loads it through next/dynamic with ssr:false, so Recharts rides in a
// chunk of its own, requested only where a Chart is drawn. In the browser the chart fills the frame's box (Recharts 3's
// `responsive`); the tests hand a fixed size. No Recharts Legend: the frame's chips are the legend, the standings chart's rule.
// Animation off, so the markup is the same twice over.

export interface CanvasSeries {
  key: string;
  label: string;
  stroke: string;
  dash?: string;
}

export interface ChartCanvasProps {
  type: ChartType;
  points: readonly ChartPoint[];
  series: readonly CanvasSeries[];
  /** The series drawn (the frame's toggles); the rest are mounted hidden, so a toggle never remounts the plot. */
  visible: readonly string[];
  /** The series drawn thick (the page's own driver or team). */
  emphasised: readonly string[];
  /** Whether a value has decimals (a qualifying's gaps): the value axis then allows them. */
  decimals: boolean;
  /** The value axis from zero; off, from the lowest value drawn. */
  zero: boolean;
  xTitle: string;
  yTitle: string;
  /** A fixed size (the tests); absent, the chart fills its box. */
  size?: { width: number; height: number };
}

const TICK = { fontSize: 10, fill: 'var(--text-muted)' };
const TOOLTIP_STYLE = {
  contentStyle: { background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: 'var(--text)', fontWeight: 600 },
  itemStyle: { color: 'var(--text-muted)' },
};

export function ChartCanvas({ type, points, series, visible, emphasised, decimals, zero, xTitle, yTitle, size }: ChartCanvasProps) {
  const width = (key: string) => (emphasised.includes(key) ? 3.5 : 2);
  const shown = (key: string) => visible.includes(key);
  const title = (label: unknown) => points.find(p => p.label === String(label))?.title ?? String(label);
  // Responsive, the wrapper measures its own box (Recharts 3's ResponsiveDiv), so it is sized to the frame's box by CSS.
  const sizing = size ? { width: size.width, height: size.height } : { responsive: true, style: { width: '100%', height: '100%' } };
  const margin = { top: 6, right: 12, bottom: xTitle ? 18 : 6, left: yTitle ? 10 : 0 };
  const data = [...points];
  const axes = (
    <>
      <CartesianGrid stroke="var(--border)" vertical={false} />
      <XAxis
        dataKey="label"
        stroke="var(--text-faint)"
        tick={TICK}
        tickLine={false}
        minTickGap={14}
        label={xTitle ? { value: xTitle, position: 'insideBottom', offset: -12, fontSize: 10, fill: 'var(--text-muted)' } : undefined}
      />
      {/* tickCount and whole numbers as the standings chart draws them; decimals only where a value has them (a gap in seconds). */}
      <YAxis
        stroke="var(--text-faint)"
        tick={TICK}
        tickLine={false}
        width={decimals ? 44 : 32}
        tickCount={8}
        allowDecimals={decimals}
        domain={[zero ? 0 : 'auto', 'auto']}
        label={yTitle ? { value: yTitle, angle: -90, position: 'insideLeft', offset: 4, fontSize: 10, fill: 'var(--text-muted)' } : undefined}
      />
      <Tooltip {...TOOLTIP_STYLE} labelFormatter={title} />
    </>
  );
  if (type === 'bar') {
    return (
      <BarChart data={data} margin={margin} {...sizing}>
        {axes}
        {series.map(s => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.stroke} hide={!shown(s.key)} isAnimationActive={false} />
        ))}
      </BarChart>
    );
  }
  if (type === 'area') {
    return (
      <AreaChart data={data} margin={margin} {...sizing}>
        {axes}
        {series.map(s => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.stroke}
            strokeDasharray={s.dash}
            strokeWidth={width(s.key)}
            fill={s.stroke}
            fillOpacity={0.12}
            dot={false}
            hide={!shown(s.key)}
            connectNulls
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
    );
  }
  return (
    <LineChart data={data} margin={margin} {...sizing}>
      {axes}
      {series.map(s => (
        <Line
          key={s.key}
          type="monotone"
          dataKey={s.key}
          name={s.label}
          stroke={s.stroke}
          strokeDasharray={s.dash}
          strokeWidth={width(s.key)}
          // The standings chart's markers: a dot at every point, the active one ringed in the page background.
          dot={{ r: 2.5, strokeWidth: 0, fill: s.stroke }}
          activeDot={{ r: 5, stroke: 'var(--bg)', strokeWidth: 2, fill: s.stroke }}
          hide={!shown(s.key)}
          connectNulls
          isAnimationActive={false}
        />
      ))}
    </LineChart>
  );
}
