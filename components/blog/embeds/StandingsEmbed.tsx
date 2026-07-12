import { loadSeries } from '@/lib/series';
import { loadSnapshotSource } from '@/components/weekend/WeekendStandingsSnapshot';
import { buildStandingsAtRound } from '@/lib/season-trend';
import type { DriverStanding } from '@/lib/types';
import { EmbedNote } from './ChartEmbed';

// A drivers'-standings snapshot embedded in a blog post. Built from the SAME
// results feed as the chart (loadSnapshotSource → buildStandingsAtRound), so it
// stays consistent with the chart-total invariant. Gated on `pointsExact` — the
// same flag the drivers-page trend uses to decide the results carry canonical
// per-round points; where it's false (endurance / owner-points series), the
// results-cumulated table could disagree with the official standings, so we show
// a note rather than risk a wrong table (RULE #1). Fail-soft on every path.

type StandingsData =
  | { kind: 'ok'; name: string; through: number; drivers: DriverStanding[] }
  | { kind: 'unavailable'; name: string }
  | { kind: 'empty'; name: string }
  | { kind: 'error' };

const MAX_ROWS = 10;

async function loadStandingsData(slug: string): Promise<StandingsData> {
  try {
    const series = await loadSeries(slug);
    const source = await loadSnapshotSource(series);
    if (!source || !source.pointsExact) return { kind: 'unavailable', name: series.meta.name };
    const table = buildStandingsAtRound(source.races, Number.POSITIVE_INFINITY, source.extras);
    if (table.drivers.length === 0) return { kind: 'empty', name: series.meta.name };
    return { kind: 'ok', name: series.meta.name, through: table.throughRound, drivers: table.drivers };
  } catch {
    return { kind: 'error' };
  }
}

export async function StandingsEmbed({ series: slug }: { series?: string }) {
  if (!slug) return <EmbedNote>Standings embed needs a <code>series</code>.</EmbedNote>;
  const data = await loadStandingsData(slug);
  switch (data.kind) {
    case 'unavailable':
      return <EmbedNote>A live standings table isn’t available for {data.name}.</EmbedNote>;
    case 'empty':
      return <EmbedNote>No {data.name} standings yet this season.</EmbedNote>;
    case 'error':
      return <EmbedNote>These standings couldn’t load.</EmbedNote>;
    case 'ok': {
      const rows = data.drivers.slice(0, MAX_ROWS);
      const hidden = data.drivers.length - rows.length;
      return (
        <figure className="rounded-xl border border-border bg-surface/40 p-4">
          <figcaption className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-text-faint">
            {data.name} · drivers’ standings{data.through > 0 ? ` · through round ${data.through}` : ''}
          </figcaption>
          <ol className="divide-y divide-border/40">
            {rows.map(d => (
              <li key={d.driverName} className="flex items-center gap-3 py-1.5">
                <span className="w-5 shrink-0 text-right font-mono text-[11px] tabular-nums text-text-faint">
                  {d.position}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-text">{d.driverName}</span>
                {d.team ? (
                  <span className="hidden max-w-[40%] truncate text-xs text-text-faint sm:block">{d.team}</span>
                ) : null}
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-text-muted">{d.points}</span>
              </li>
            ))}
          </ol>
          {hidden > 0 && (
            <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-text-faint">+{hidden} more</p>
          )}
        </figure>
      );
    }
  }
}
