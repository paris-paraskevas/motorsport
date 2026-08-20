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
} from 'recharts';
import type { SeasonTrendData } from '@/lib/season-trend';
import { seriesInk } from '@/lib/site';

const COLORS = [
  '#ff4136', // F1 red
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

// 2026 constructor colors, keyed by Jolpica `Constructor.name`. Broadcast-style
// hexes; the two newcomers have no official hex (operator-directed web check
// 2026-06-10): Cadillac runs a black-to-white monochrome livery → white reads
// on our near-black; Audi runs titanium/black/red → Audi Red #F50537, because
// titanium silver would be indistinguishable from Haas grey on this chart.
const F1_TEAM_COLORS: Record<string, string> = {
  'Red Bull': '#3671c6',
  Ferrari: '#e8002d',
  McLaren: '#ff8000',
  Mercedes: '#27f4d2',
  'Aston Martin': '#229971',
  'Alpine F1 Team': '#00a1e8',
  Williams: '#1868db',
  'RB F1 Team': '#6692ff',
  'Haas F1 Team': '#b6babd',
  Audi: '#f50537',
  'Cadillac F1 Team': '#ffffff',
};

interface LineStyle {
  stroke: string;
  dash?: string;
}

// Team color when we know the team; teammates share it with the second car
// dashed (broadcast convention). Unknown teams (non-F1 series) keep the
// rank-indexed palette. Every stroke goes through seriesInk: the broadcast
// hexes were tuned for the near-black theme (Mercedes teal ~1.3:1 on paper,
// Cadillac is literally white) — the per-theme ink mix leaves dark themes
// byte-identical (100%) and pulls light themes to legible ink (52%). The
// legend chips and ranked-rail dots read the same styles, so they follow.
// (Operator, 2026-08-20: "cant see the trajectory at all because mercedes
// colour is invisible on this theme".)
function buildLineStyles(
  ranked: Array<{ name: string; team?: string }>,
): Map<string, LineStyle> {
  const styles = new Map<string, LineStyle>();
  const seenPerTeam = new Map<string, number>();
  ranked.forEach((d, idx) => {
    const teamColor = d.team ? F1_TEAM_COLORS[d.team] : undefined;
    if (teamColor) {
      const seen = seenPerTeam.get(d.team!) ?? 0;
      seenPerTeam.set(d.team!, seen + 1);
      styles.set(d.name, { stroke: seriesInk(teamColor), dash: seen > 0 ? '6 4' : undefined });
    } else {
      styles.set(d.name, { stroke: seriesInk(pickColor(idx)) });
    }
  });
  return styles;
}

// Strip Wikipedia-style eligibility suffixes ("(i)", "(R)") from legend
// labels — they read as noise at chip size (NASCAR's 47-driver field).
function legendLabel(codeOrName: string): string {
  return codeOrName.replace(/\s*\((i|R)\)\s*$/i, '');
}

const DEFAULT_VISIBLE_COUNT = 6;

// Ranked points rail: enough rows to cover every charted line plus the chase
// pack without turning NASCAR's 47-driver field into a wall — the rest sits
// behind the same "+N more" expander pattern the chip legend uses.
const RANKED_LIST_VISIBLE_COUNT = 10;

export function SeasonTrendChart({
  data,
  drivers,
  totalsByDriver,
  emphasize,
}: SeasonTrendData & { emphasize?: string }) {
  const ranked = useMemo(
    () =>
      [...drivers].sort(
        (a, b) => (totalsByDriver[b.name] ?? 0) - (totalsByDriver[a.name] ?? 0),
      ),
    [drivers, totalsByDriver],
  );

  const [visible, setVisible] = useState<Set<string>>(() => {
    // Default to the top lines, but always include the emphasized line (the
    // team whose page this is) so its trajectory shows even when it's mid-pack.
    const init = new Set(ranked.slice(0, DEFAULT_VISIBLE_COUNT).map(d => d.name));
    if (emphasize) init.add(emphasize);
    return init;
  });
  const [legendExpanded, setLegendExpanded] = useState(false);
  const [listExpanded, setListExpanded] = useState(false);
  const lineStyles = useMemo(() => buildLineStyles(ranked), [ranked]);

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

  // Legend soup fix (audit + NASCAR's 47-driver field): collapsed by default to
  // the charted lines only — the top DEFAULT_VISIBLE_COUNT plus anything toggled
  // on, so every drawn line keeps its chip. The full standings table sits
  // directly below the chart, so a longer legend was redundant chrome that
  // buried the table on mobile (audit 2026-06-21). Everyone else is one tap away.
  const shown = legendExpanded
    ? ranked
    : ranked.filter((d, i) => i < DEFAULT_VISIBLE_COUNT || visible.has(d.name));
  const hiddenCount = ranked.length - shown.length;

  const listRows = listExpanded
    ? ranked
    : ranked.slice(0, RANKED_LIST_VISIBLE_COUNT);
  const listHiddenCount = ranked.length - listRows.length;

  return (
    <div className="space-y-3">
      <div className="lg:flex lg:items-start lg:gap-6">
        {/* Renders on every viewport (operator reversal of the 0.18.0
            desktop-only call): phone-fit height + tight axes. Keeping the
            container always-displayed also sidesteps the old 0-size
            ResponsiveContainer measurement bug — it only mis-measured inside
            display:none parents. min-w-0 keeps the flex-basis measurement
            honest once the ranked rail sits alongside on lg+. */}
        <div className="h-64 sm:h-72 md:h-80 lg:flex-1 lg:min-w-0">
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
              {/* No recharts <Legend> — the interactive chip legend below is
                  the only one. The built-in legend listed every line (47 names
                  on NASCAR) above the chips it duplicated (audit 2-5). */}
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
        </div>

        {/* Ranked season points — the chart's companion read-out (every driver,
            not just the charted top lines). Right rail on lg+, stacked below
            the chart on smaller viewports; same colour dots as the lines,
            capped behind a "+N more" expander like the chip legend. */}
        <div className="mt-3 lg:mt-0 lg:w-60 lg:shrink-0">
          <h3 className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] font-semibold text-text-faint">
            Points
          </h3>
          <ol className="divide-y divide-border/40" aria-label="Season points, ranked">
            {listRows.map((d, i) => (
              <li
                key={d.name}
                className="flex items-center gap-2 py-1 transition-colors duration-(--duration-fast) hover:bg-surface"
              >
                <span className="w-5 shrink-0 text-right font-mono text-[11px] tabular-nums text-text-faint">
                  {i + 1}
                </span>
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: lineStyles.get(d.name)!.stroke }}
                />
                <span className="flex-1 min-w-0 truncate text-sm text-text">
                  {legendLabel(d.name)}
                </span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-text-muted">
                  {totalsByDriver[d.name] ?? 0}
                </span>
              </li>
            ))}
          </ol>
          {listHiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setListExpanded(true)}
              className="mt-2 inline-flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-text transition-colors duration-(--duration-fast)"
            >
              Show all {ranked.length}
              <ChevronDown size={12} />
            </button>
          )}
          {listExpanded && ranked.length > RANKED_LIST_VISIBLE_COUNT && (
            <button
              type="button"
              onClick={() => setListExpanded(false)}
              className="mt-2 inline-flex items-center font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-text-faint hover:text-text transition-colors duration-(--duration-fast)"
            >
              Collapse
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {shown.map(d => {
          const on = visible.has(d.name);
          const colour = lineStyles.get(d.name)!.stroke;
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
        {legendExpanded && ranked.length > DEFAULT_VISIBLE_COUNT && (
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
