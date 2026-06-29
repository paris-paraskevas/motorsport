'use client';
import { useMemo } from 'react';
import { OpenF1Attribution } from '@/components/f1/OpenF1Attribution';
import type { EnrichedDriver } from '@/lib/openf1/drivers';
import type { OvertakesBoard as OvertakesData } from '@/lib/openf1/overtakes';

// Overtakes completed per driver, ranked most first, plus the race total. Pure
// presentational shell — the page passes server-assembled `data`. Renders null
// when OpenF1 recorded no overtakes for the session.

export function OvertakesBoard({
  data,
  seriesColor,
}: {
  data: OvertakesData;
  seriesColor?: string;
}) {
  const driversById = useMemo(
    () => new Map<number, EnrichedDriver>(data.drivers.map(d => [d.number, d])),
    [data.drivers],
  );

  if (data.entries.length === 0) return null;

  const max = data.entries[0].overtakes; // entries pre-sorted most first
  const fallbackColour = 'var(--border-strong)';

  return (
    <section
      className="space-y-3"
      style={seriesColor ? ({ '--brand': seriesColor } as React.CSSProperties) : undefined}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-sm font-extrabold uppercase tracking-wide text-text">
          Overtakes
        </h3>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint">
          {data.totalOvertakes} in the race
        </span>
      </div>

      <ol className="space-y-1.5">
        {data.entries.map((e, i) => {
          const driver = driversById.get(e.driverNumber);
          const colour = driver?.teamColour ?? fallbackColour;
          const widthPct = max > 0 ? Math.max(8, (e.overtakes / max) * 100) : 0;
          return (
            <li key={e.driverNumber} className="flex items-center gap-2.5">
              <span className="w-5 shrink-0 text-right font-mono text-[11px] tabular-nums text-text-faint">
                {i + 1}
              </span>
              <span className="flex w-16 shrink-0 items-center gap-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: colour }}
                  aria-hidden
                />
                <span className="font-display text-xs font-extrabold uppercase tracking-wide text-text">
                  {driver?.code ?? `#${e.driverNumber}`}
                </span>
              </span>
              <div className="relative h-5 flex-1 overflow-hidden rounded-sm bg-surface">
                <div
                  className="h-full rounded-sm transition-[width] duration-(--duration-base)"
                  style={{ width: `${widthPct}%`, backgroundColor: colour }}
                />
              </div>
              <span className="w-10 shrink-0 text-right font-mono text-xs font-semibold tabular-nums text-text">
                {e.overtakes}
              </span>
            </li>
          );
        })}
      </ol>

      <OpenF1Attribution className="pt-2" />
    </section>
  );
}
