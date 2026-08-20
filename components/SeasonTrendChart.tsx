'use client';
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { SeasonTrendData } from '@/lib/season-trend';
import type { TrendLineStyle } from './LazySeasonTrendChart';

// The recharts canvas behind LazySeasonTrendChart — deliberately nothing but
// the plot. Layout (the reserved fixed-height box, ranked rail, chip legend)
// and all interaction state live in the eager frame, so this chunk can arrive
// late without moving anything on the page: it fills 100% of whatever box the
// frame reserved. Loaded only via next/dynamic (ssr:false) from the frame.
export function SeasonTrendChart({
  data,
  ranked,
  lineStyles,
  visible,
  emphasize,
}: {
  data: SeasonTrendData['data'];
  /** Standings order (points desc) — the frame's sort, reused as line order. */
  ranked: SeasonTrendData['drivers'];
  lineStyles: ReadonlyMap<string, TrendLineStyle>;
  visible: ReadonlySet<string>;
  emphasize?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 6, right: 12, bottom: 6, left: 0 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="round"
          stroke="var(--text-faint)"
          tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
          tickLine={false}
          minTickGap={14}
        />
        {/* tickCount trades the recharts default (5) for a denser scale —
            on NASCAR's 0–600+ range five ticks left ~150pt jumps that made
            mid-pack lines unreadable against the grid. Integer ticks only;
            points are integers in every series we chart. */}
        <YAxis
          stroke="var(--text-faint)"
          tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
          tickLine={false}
          width={28}
          tickCount={8}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: 'var(--text)', fontWeight: 600 }}
          itemStyle={{ color: 'var(--text-muted)' }}
          labelFormatter={(label) => {
            const round = Number(label);
            const point = data.find(d => d.round === round);
            return point ? `R${round} · ${point.raceName}` : `R${round}`;
          }}
        />
        {/* No recharts <Legend> — the frame's interactive chip legend is the
            only one. The built-in legend listed every line (47 names on
            NASCAR) above the chips it duplicated (audit 2-5). */}
        {ranked.map(d => {
          const style = lineStyles.get(d.name)!;
          return (
            <Line
              key={d.name}
              type="monotone"
              dataKey={d.name}
              stroke={style.stroke}
              strokeDasharray={style.dash}
              strokeWidth={visible.has(d.name) ? (d.name === emphasize ? 3.5 : 2) : 0}
              // Always-visible point markers at every round (operator
              // 2026-06-11); hover grows the active one and rings it in
              // the page background so it pops against crossing lines.
              dot={{ r: 2.5, strokeWidth: 0, fill: style.stroke }}
              activeDot={{ r: 5, stroke: 'var(--bg)', strokeWidth: 2, fill: style.stroke }}
              hide={!visible.has(d.name)}
              connectNulls
            />
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
}
