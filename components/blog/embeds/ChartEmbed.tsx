import type { ReactNode } from 'react';
import { loadSeries } from '@/lib/series';
import { loadSnapshotSource } from '@/components/weekend/WeekendStandingsSnapshot';
import { buildSeasonTrendData, type SeasonTrendData } from '@/lib/season-trend';
import { LazySeasonTrendChart } from '@/components/LazySeasonTrendChart';

// A season-trend chart embedded in a blog post — the same cumulative-points
// line the Standings tab draws, from the same results feed (loadSnapshotSource).
// Only series whose feed carries championship-canonical per-round points
// (`pointsExact`) can draw an HONEST line; the rest (WEC/IMSA/GTWC/NLS/ADAC and
// any winners-only feed) return null from the loader and fall back to a note
// rather than a misleading chart — the cross-series invariant pinned in
// CHANGELOG.md.

type ChartData =
  | { kind: 'ok'; name: string; trend: SeasonTrendData }
  | { kind: 'unavailable'; name: string }
  | { kind: 'empty'; name: string }
  | { kind: 'error' };

// Data-loading is isolated in this helper so the fail-soft try/catch wraps only
// the fetch — never JSX construction (which React renders lazily, outside the
// catch; react-hooks/error-boundaries). An embed must never throw out of the
// post render, so every failure resolves to a discriminated result.
async function loadChartData(slug: string): Promise<ChartData> {
  try {
    const series = await loadSeries(slug);
    const source = await loadSnapshotSource(series);
    if (!source || !source.pointsExact) return { kind: 'unavailable', name: series.meta.name };
    const trend = buildSeasonTrendData(source.races, source.extras ?? []);
    if (trend.data.length === 0) return { kind: 'empty', name: series.meta.name };
    return { kind: 'ok', name: series.meta.name, trend };
  } catch {
    return { kind: 'error' };
  }
}

export async function ChartEmbed({ series: slug }: { series?: string }) {
  if (!slug) return <EmbedNote>Chart embed needs a <code>series</code>.</EmbedNote>;
  const data = await loadChartData(slug);
  switch (data.kind) {
    case 'unavailable':
      return <EmbedNote>A season-trend chart isn’t available for {data.name}.</EmbedNote>;
    case 'empty':
      return <EmbedNote>No {data.name} results yet this season.</EmbedNote>;
    case 'error':
      return <EmbedNote>This chart couldn’t load.</EmbedNote>;
    case 'ok':
      return (
        <figure className="rounded-xl border border-border bg-surface/40 p-4">
          <figcaption className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-text-faint">
            {data.name} · championship trend
          </figcaption>
          <LazySeasonTrendChart {...data.trend} />
        </figure>
      );
  }
}

// Muted fallback used by every embed for a missing arg / unavailable data /
// error / unknown type. Shared (second consumer: BlogEmbed) and dependency-free
// so it stays server-renderable.
export function EmbedNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-border bg-surface/40 px-4 py-3 text-sm text-text-faint">
      {children}
    </p>
  );
}
