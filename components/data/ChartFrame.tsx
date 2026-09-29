'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { ChevronDown } from 'lucide-react';
import { buildLineStyles } from '@/components/LazySeasonTrendChart';
import { seriesInk } from '@/lib/site';
import type { CanvasSeries } from './ChartCanvas';

// The Chart's frame (P2.11): LazySeasonTrendChart's split without its points rail. This eager client piece owns the layout
// footprint (the box at the setting's height, the chip legend) and the state (which series are drawn); the Recharts canvas
// (./ChartCanvas) loads through next/dynamic with ssr:false once the box nears the viewport, so the library rides in no route's
// chunk and a page never pays for a chart it is not showing. The strokes are the standings chart's (buildLineStyles: the F1 team
// colours with teammates dashed, the rank palette otherwise, every one through seriesInk); a single series takes the rows' own
// series colour when they share one. The data stands as a visually hidden table for readers without the picture and for the
// crawlers (APEX: the accessibility layer).

export type ChartType = 'line' | 'bar' | 'area';
export interface ChartSeries {
  /** `s0`, `s1`… (a Recharts dataKey with a dot would read as a path); the label beside. */
  key: string;
  label: string;
  /** The feed's team for the series' rows, for the F1 team colours. */
  team?: string;
  /** The series' last value, the legend's figure and the rank. */
  last: number | null;
}
export type ChartPoint = { label: string; title: string } & Record<string, string | number | null>;
export interface ChartData {
  type: ChartType;
  /** Ranked by the last value, the leaders first. */
  series: ChartSeries[];
  /** One per label, the series' values under their keys. */
  points: ChartPoint[];
  decimals: boolean;
  zero: boolean;
  /** The box's height in pixels. */
  height: number;
  legend: boolean;
  /** How many series are drawn at first. */
  shown: number;
  /** The keys drawn thick and always shown. */
  emphasised: string[];
  xTitle: string;
  yTitle: string;
  /** A single series' colour, the rows' shared series colour; null for the brand's. */
  colour: string | null;
  labelLabel: string;
  valueLabel: string;
}

// Pulse placeholder filling the reserved box, shown before the canvas is requested and while its chunk is in flight.
function Fallback() {
  return <div className="h-full w-full border border-border bg-surface/40 animate-pulse" />;
}

const Canvas = dynamic(() => import('./ChartCanvas').then(m => m.ChartCanvas), { ssr: false, loading: () => <Fallback /> });

const CHIP = 'inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-11 font-medium transition-colors duration-(--duration-fast)';
const FOLD = 'inline-flex items-center gap-1 border border-border px-2.5 py-1 font-mono text-11 font-semibold uppercase tracking-[0.12em] transition-colors duration-(--duration-fast)';

export function ChartFrame({ data }: { data: ChartData }) {
  const { series, shown, emphasised } = data;
  // The leaders up to the cap, and the emphasised series whatever the cap (the team page's own line is always drawn).
  const [visible, setVisible] = useState<Set<string>>(() => new Set([...series.slice(0, shown).map(s => s.key), ...emphasised]));
  const [expanded, setExpanded] = useState(false);
  const styles = useMemo(() => {
    const built = buildLineStyles(series.map(s => ({ name: s.key, team: s.team })));
    if (series.length === 1 && data.colour) built.set(series[0].key, { stroke: seriesInk(data.colour) });
    return built;
  }, [series, data.colour]);
  const stroke = (key: string) => styles.get(key)?.stroke ?? 'var(--brand-fill)';

  // The canvas is requested once the box nears the viewport (LazySeasonTrendChart's gate, its rootMargin a screen early); the
  // observer's callback sets the state, never the effect itself.
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const toggle = (key: string) => {
    const next = new Set(visible);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setVisible(next);
  };
  // The legend folded to the drawn series (the standings chart's rule): the leaders up to the cap and anything toggled on.
  const chips = expanded ? series : series.filter((s, i) => i < shown || visible.has(s.key));
  const hidden = series.length - chips.length;
  const canvasSeries: CanvasSeries[] = series.map(s => ({ key: s.key, label: s.label, stroke: stroke(s.key), dash: styles.get(s.key)?.dash }));

  return (
    <div data-chart-type={data.type} data-decimals={data.decimals ? 'true' : 'false'} data-emphasis={emphasised.join(' ')} className="space-y-3">
      <div ref={boxRef} data-chart-box="" className="w-full" style={{ height: data.height }}>
        {near ? (
          <Canvas type={data.type} points={data.points} series={canvasSeries} visible={[...visible]} emphasised={emphasised} decimals={data.decimals} zero={data.zero} xTitle={data.xTitle} yTitle={data.yTitle} />
        ) : (
          <Fallback />
        )}
      </div>
      {data.legend && series.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map(s => {
            const on = visible.has(s.key);
            return (
              <button
                key={s.key}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(s.key)}
                className={`${CHIP} ${on ? 'border-border-strong bg-surface text-text' : 'border-border text-text-faint hover:border-border-strong hover:text-text-muted'}`}
              >
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: on ? stroke(s.key) : 'var(--border-strong)' }} />
                {s.label}
                <span className="tabular-nums opacity-70">{s.last ?? ''}</span>
              </button>
            );
          })}
          {hidden > 0 && (
            <button type="button" aria-expanded={false} onClick={() => setExpanded(true)} className={`${FOLD} text-text-muted hover:border-border-strong hover:text-text`}>
              +{hidden} more
              <ChevronDown size={12} />
            </button>
          )}
          {expanded && series.length > shown && (
            <button type="button" aria-expanded={true} onClick={() => setExpanded(false)} className={`${FOLD} text-text-faint hover:text-text`}>
              Collapse
            </button>
          )}
        </div>
      )}
      <table className="sr-only">
        <thead>
          <tr>
            <th scope="col">{data.labelLabel}</th>
            {series.map(s => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.points.map(p => (
            <tr key={p.label}>
              <td>{p.label}</td>
              {series.map(s => (
                <td key={s.key}>{p[s.key] ?? ''}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
