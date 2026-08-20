'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { ChevronDown } from 'lucide-react';
import type { SeasonTrendData } from '@/lib/season-trend';
import { seriesInk } from '@/lib/site';

// Frame/canvas split: this eagerly-loaded module owns the chart's entire
// layout footprint — fixed-height plot box, ranked points rail, chip legend —
// plus all interaction state, so the section's rendered size is final in the
// server HTML. Only the recharts canvas (./SeasonTrendChart, ~100 KB parsed)
// loads lazily: ssr:false keeps it out of the critical bundle, and the
// IntersectionObserver gate keeps the chunk unrequested until the plot box
// approaches the viewport — a hidden Standings sub-tab panel has no geometry,
// so an inactive tab never pays for a chart it isn't showing. The canvas
// paints strictly inside the reserved box; content below never shifts when it
// lands (PSI mobile CLS 0.134 on /series/f1/standings was exactly this shift).

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

export interface TrendLineStyle {
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
): Map<string, TrendLineStyle> {
  const styles = new Map<string, TrendLineStyle>();
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

// Pulse placeholder filling the reserved plot box — shown both before the
// canvas is requested and while its chunk is in flight. h-full: the box owns
// the height, so placeholder and mounted canvas occupy identical pixels.
function CanvasFallback() {
  return <div className="h-full w-full border border-border bg-surface/40 animate-pulse" />;
}

const Chart = dynamic(
  () => import('./SeasonTrendChart').then(m => m.SeasonTrendChart),
  {
    ssr: false,
    loading: () => <CanvasFallback />,
  },
);

export function LazySeasonTrendChart({
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

  // Request the recharts chunk only once the plot box nears the viewport
  // (rootMargin pre-fetches a screen early so the canvas is usually there by
  // the time the box scrolls in). A box inside a hidden tab panel never
  // intersects; un-hiding the panel gives it geometry and fires the observer,
  // which also guarantees ResponsiveContainer never mounts inside
  // display:none (the old 0-size measurement bug can't occur). No
  // no-IntersectionObserver fallback: the API is Baseline-widely-available
  // since 2019 and present in every browser Next 16 targets (chrome/edge/
  // firefox 111, safari 16.4 — node_modules/next/dist/docs supported-browsers),
  // so the branch was dead code, and setting state synchronously inside the
  // effect to serve it tripped react-hooks/set-state-in-effect.
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [nearViewport, setNearViewport] = useState(false);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          setNearViewport(true);
          io.disconnect();
        }
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

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
            desktop-only call): phone-fit height + tight axes. The box height is
            fixed per breakpoint and everything the canvas draws stays inside
            it. min-w-0 keeps the flex-basis measurement honest once the ranked
            rail sits alongside on lg+. */}
        <div ref={boxRef} className="h-64 sm:h-72 md:h-80 lg:flex-1 lg:min-w-0">
          {nearViewport ? (
            <Chart
              data={data}
              ranked={ranked}
              lineStyles={lineStyles}
              visible={visible}
              emphasize={emphasize}
            />
          ) : (
            <CanvasFallback />
          )}
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
