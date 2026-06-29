'use client';
import { useMemo } from 'react';
import { OpenF1Attribution } from '@/components/f1/OpenF1Attribution';
import type { EnrichedDriver } from '@/lib/openf1/drivers';
import type { PitStopLeague as PitStopData } from '@/lib/openf1/pit-league';

// Fastest stationary pit stop per driver, ranked quickest first, with each
// driver's stop count. Pure presentational shell — the page passes
// server-assembled `data`. Renders null when the session has no pit data.

function fmtStop(s: number): string {
  return `${s.toFixed(2)}s`;
}

export function PitStopLeague({
  data,
  seriesColor,
}: {
  data: PitStopData;
  seriesColor?: string;
}) {
  const driversById = useMemo(
    () => new Map<number, EnrichedDriver>(data.drivers.map(d => [d.number, d])),
    [data.drivers],
  );

  if (data.entries.length === 0) return null;

  const fastest = data.entries[0].fastestStop; // entries pre-sorted fastest first
  const fallbackColour = 'var(--border-strong)';

  return (
    <section
      className="space-y-3"
      style={seriesColor ? ({ '--brand': seriesColor } as React.CSSProperties) : undefined}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-sm font-extrabold uppercase tracking-wide text-text">
          Pit-stop league
        </h3>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint">
          Fastest stop
        </span>
      </div>

      <ol className="divide-y divide-border/60">
        {data.entries.map((e, i) => {
          const driver = driversById.get(e.driverNumber);
          const colour = driver?.teamColour ?? fallbackColour;
          const delta = e.fastestStop - fastest; // gap to the fastest stop
          return (
            <li key={e.driverNumber} className="flex items-center gap-2.5 py-2">
              <span className="w-5 shrink-0 text-right font-mono text-[11px] tabular-nums text-text-faint">
                {i + 1}
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: colour }}
                  aria-hidden
                />
                <span className="font-display text-xs font-extrabold uppercase tracking-wide text-text">
                  {driver?.code ?? `#${e.driverNumber}`}
                </span>
                <span className="truncate font-mono text-[11px] text-text-muted">
                  {driver?.team ?? ''}
                </span>
              </span>
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
                {e.stopCount} stop{e.stopCount === 1 ? '' : 's'}
              </span>
              <span className="w-16 shrink-0 text-right font-mono text-xs font-semibold tabular-nums text-text">
                {fmtStop(e.fastestStop)}
              </span>
              <span className="hidden w-16 shrink-0 text-right font-mono text-[11px] tabular-nums text-text-faint sm:inline">
                {i === 0 ? '—' : `+${delta.toFixed(2)}`}
              </span>
            </li>
          );
        })}
      </ol>

      <OpenF1Attribution className="pt-2" />
    </section>
  );
}
