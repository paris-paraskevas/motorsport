'use client';
import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
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

// Strip Wikipedia-style eligibility suffixes ("(i)", "(R)") from legend
// labels — they read as noise at chip size (NASCAR's 47-driver field).
function legendLabel(codeOrName: string): string {
  return codeOrName.replace(/\s*\((i|R)\)\s*$/i, '');
}

const LEGEND_COLLAPSED_COUNT = 12;

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
  const [legendExpanded, setLegendExpanded] = useState(false);

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

  // Legend soup fix (audit + NASCAR's 47-driver field): collapsed by default
  // to the championship's sharp end, one tap away from everyone.
  const shown = legendExpanded ? ranked : ranked.slice(0, LEGEND_COLLAPSED_COUNT);
  const hiddenCount = ranked.length - shown.length;

  return (
    <div className="space-y-3">
      {/* The chart itself is desktop-only (locked 2c decision): at phone
          widths recharts renders an unreadable 0-ish-size plot; the ranked
          legend chips below carry the points data for mobile. */}
      <div className="hidden sm:block h-72 md:h-80">
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
        {shown.map(d => {
          const idx = ranked.indexOf(d);
          const on = visible.has(d.name);
          const colour = pickColor(idx);
          return (
            <button
              key={d.name}
              type="button"
              onClick={() => toggle(d.name)}
              className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-medium px-2.5 py-1 border transition-colors duration-(--duration-fast) ${
                on
                  ? 'border-border-strong text-text bg-surface'
                  : 'border-border text-text-faint hover:text-text-muted hover:border-border-strong'
              }`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: on ? colour : 'var(--border-strong)' }}
              />
              {legendLabel(d.code ?? d.name)}
              <span className="tabular-nums opacity-70">{totalsByDriver[d.name] ?? 0}</span>
            </button>
          );
        })}
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setLegendExpanded(true)}
            className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] px-2.5 py-1 border border-border text-text-muted hover:text-text hover:border-border-strong transition-colors duration-(--duration-fast)"
          >
            +{hiddenCount} more
            <ChevronDown size={12} />
          </button>
        )}
        {legendExpanded && ranked.length > LEGEND_COLLAPSED_COUNT && (
          <button
            type="button"
            onClick={() => setLegendExpanded(false)}
            className="inline-flex items-center font-mono text-[11px] font-semibold uppercase tracking-[0.12em] px-2.5 py-1 border border-border text-text-faint hover:text-text transition-colors duration-(--duration-fast)"
          >
            Collapse
          </button>
        )}
      </div>
    </div>
  );
}
