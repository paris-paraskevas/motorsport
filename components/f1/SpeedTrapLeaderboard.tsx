'use client';
import { useMemo } from 'react';
import { OpenF1Attribution } from '@/components/f1/OpenF1Attribution';
import type { EnrichedDriver } from '@/lib/openf1/drivers';
import type { SpeedTrapLeaderboard as SpeedTrapData } from '@/lib/openf1/speed-traps';

// Top speed-trap reading per driver, ranked fastest first, as a horizontal
// bar board. Pure presentational shell — the page passes server-assembled
// `data`, so there's no client fetch. Renders null when the session has no
// trap data (the page already guards on this, but a defensive check keeps the
// component safe if reused).

function DriverDot({ colour }: { colour: string }) {
  return (
    <span
      className="h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: colour }}
      aria-hidden
    />
  );
}

export function SpeedTrapLeaderboard({
  data,
  seriesColor,
}: {
  data: SpeedTrapData;
  seriesColor?: string;
}) {
  const driversById = useMemo(
    () => new Map<number, EnrichedDriver>(data.drivers.map(d => [d.number, d])),
    [data.drivers],
  );

  if (data.entries.length === 0) return null;

  const max = data.entries[0].topSpeed; // entries are pre-sorted fastest first
  const fallbackColour = 'var(--border-strong)';

  return (
    <section
      className="space-y-3"
      style={seriesColor ? ({ '--brand': seriesColor } as React.CSSProperties) : undefined}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-sm font-extrabold uppercase tracking-wide text-text">
          Speed trap
        </h3>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint">
          Top speed · km/h
        </span>
      </div>

      <ol className="space-y-1.5">
        {data.entries.map((e, i) => {
          const driver = driversById.get(e.driverNumber);
          const colour = driver?.teamColour ?? fallbackColour;
          // Bar scaled to the fastest reading; floor the width so even the
          // slowest still shows a visible sliver.
          const widthPct = max > 0 ? Math.max(8, (e.topSpeed / max) * 100) : 0;
          return (
            <li key={e.driverNumber} className="flex items-center gap-2.5">
              <span className="w-5 shrink-0 text-right font-mono text-[11px] tabular-nums text-text-faint">
                {i + 1}
              </span>
              <span className="flex w-16 shrink-0 items-center gap-1.5">
                <DriverDot colour={colour} />
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
              <span className="w-20 shrink-0 text-right font-mono text-xs font-semibold tabular-nums text-text">
                {Math.round(e.topSpeed)}
                <span className="ml-1 text-[10px] font-normal text-text-faint">km/h</span>
              </span>
            </li>
          );
        })}
      </ol>

      <OpenF1Attribution className="pt-2" />
    </section>
  );
}
