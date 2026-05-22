'use client';
import { useMemo, useState } from 'react';
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

const COLORS = [
  '#e10600', // F1 red
  '#27f4d2', // teal
  '#fcd34d', // yellow
  '#a78bfa', // purple
  '#fb923c', // orange
  '#34d399', // green
  '#60a5fa', // blue
  '#f87171', // pink-red
  '#94a3b8', // grey
  '#facc15', // gold
];

function pickColor(idx: number): string {
  return COLORS[idx % COLORS.length];
}

export function SeasonTrendChart({ data, drivers, totalsByDriver }: SeasonTrendData) {
  const ranked = useMemo(
    () =>
      [...drivers].sort(
        (a, b) => (totalsByDriver[b.name] ?? 0) - (totalsByDriver[a.name] ?? 0),
      ),
    [drivers, totalsByDriver],
  );

  const [visible, setVisible] = useState<Set<string>>(
    () => new Set(ranked.slice(0, 6).map(d => d.name)),
  );

  const toggle = (name: string) => {
    const next = new Set(visible);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setVisible(next);
  };

  if (data.length === 0 || drivers.length === 0) {
    return (
      <div className="text-text-faint text-sm text-center py-8">
        No trend data yet — first race results will populate this.
      </div>
    );
  }

  // A "trend" needs at least two rounds to draw a line. With only one
  // round run, recharts stacks every driver as a dot at x=1 with empty
  // grid space around — visually noisy and not informative. Render the
  // totals chip strip alone (it's the canonical leaderboard) and let the
  // chart frame come back in once a second round lands.
  const showChart = data.length >= 2;

  return (
    <div className="space-y-3">
      {showChart ? (
        <div className="h-72 md:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 12, bottom: 6, left: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="round"
                stroke="var(--text-faint)"
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                tickLine={false}
              />
              <YAxis
                stroke="var(--text-faint)"
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                tickLine={false}
                width={32}
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
              {/* recharts' default <Legend> is intentionally omitted — the
                  toggle-able totals chip strip below is the canonical
                  legend (also serves as a leaderboard), so the default
                  legend just duplicated the names without adding interactivity. */}
              {ranked.map((d, idx) => (
                <Line
                  key={d.name}
                  type="monotone"
                  dataKey={d.name}
                  stroke={pickColor(idx)}
                  strokeWidth={visible.has(d.name) ? 2 : 0}
                  dot={false}
                  activeDot={{ r: 4 }}
                  hide={!visible.has(d.name)}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {ranked.map((d, idx) => {
          const on = visible.has(d.name);
          const colour = pickColor(idx);
          return (
            <button
              key={d.name}
              type="button"
              onClick={() => toggle(d.name)}
              disabled={!showChart}
              className={`inline-flex items-center gap-1.5 text-[11px] font-medium rounded-full px-2.5 py-1 border transition-colors duration-(--duration-fast) ${
                on
                  ? 'border-border-strong text-text bg-surface'
                  : 'border-border text-text-faint hover:text-text-muted hover:border-border-strong'
              } ${showChart ? '' : 'cursor-default'}`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: on ? colour : 'var(--border-strong)' }}
              />
              {d.code ?? d.name}
              <span className="tabular-nums font-mono opacity-70">{totalsByDriver[d.name] ?? 0}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
