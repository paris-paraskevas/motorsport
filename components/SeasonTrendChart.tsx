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
  Legend,
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

  return (
    <div className="space-y-3">
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
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="line" />
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
      <div className="flex flex-wrap gap-1.5">
        {ranked.map((d, idx) => {
          const on = visible.has(d.name);
          const colour = pickColor(idx);
          return (
            <button
              key={d.name}
              type="button"
              onClick={() => toggle(d.name)}
              className={`inline-flex items-center gap-1.5 text-[11px] font-medium rounded-full px-2.5 py-1 border transition-colors duration-(--duration-fast) ${
                on
                  ? 'border-border-strong text-text bg-surface'
                  : 'border-border text-text-faint hover:text-text-muted hover:border-border-strong'
              }`}
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
