'use client';
import { useMemo } from 'react';
import { OpenF1Attribution } from '@/components/f1/OpenF1Attribution';
import type { EnrichedDriver } from '@/lib/openf1/drivers';
import type {
  PracticeAnalysis as PracticeData,
  PracticeLongRun,
} from '@/lib/openf1/practice';

// Practice telemetry: a fastest-laps board (one-lap pace) + a long-run table
// (race-sim pace). Pure presentational shell — the page passes
// server-assembled `data`, so there's no client fetch. Renders null when the
// session has no lap/stint data (the page already guards on this, but a
// defensive check keeps the component safe if reused).

/** Lap seconds → "M:SS.mmm". Mirrors fmtLapShort in QualifyingDecoder. */
function fmtLap(s: number | null | undefined): string {
  if (s == null || !Number.isFinite(s)) return '—';
  const m = Math.floor(s / 60);
  const rem = s - m * 60;
  return `${m}:${rem.toFixed(3).padStart(6, '0')}`;
}

/** Gap to a reference lap, "+0.123" / "—" for the leader. */
function fmtGap(delta: number): string {
  if (!Number.isFinite(delta) || delta <= 0) return '—';
  return `+${delta.toFixed(3)}`;
}

// Tyre-compound chips use F1's broadcast colours so the long-run table reads at
// a glance: which tyre was a given run on. Unknown compound (the no-/stints
// fallback) gets a neutral chip.
const COMPOUND_STYLE: Record<string, { bg: string; fg: string }> = {
  SOFT: { bg: 'rgba(218,38,42,0.16)', fg: '#ff5b5f' },
  MEDIUM: { bg: 'rgba(243,191,47,0.16)', fg: '#f3bf2f' },
  HARD: { bg: 'rgba(230,230,230,0.12)', fg: '#e6e6e6' },
  INTERMEDIATE: { bg: 'rgba(67,178,98,0.16)', fg: '#4ec77a' },
  WET: { bg: 'rgba(48,128,209,0.18)', fg: '#5aa6ec' },
};

function CompoundChip({ compound }: { compound: string | null }) {
  const label = compound ? compound.slice(0, 4) : '—';
  const style = compound ? COMPOUND_STYLE[compound.toUpperCase()] : undefined;
  return (
    <span
      className="inline-flex items-center rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em]"
      style={
        style
          ? { backgroundColor: style.bg, color: style.fg }
          : { backgroundColor: 'var(--surface)', color: 'var(--text-faint)' }
      }
      title={compound ?? 'Compound unknown'}
    >
      {label}
    </span>
  );
}

function DriverDot({ colour }: { colour: string }) {
  return (
    <span
      className="h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: colour }}
      aria-hidden
    />
  );
}

export function PracticeAnalysis({
  data,
  seriesColor,
}: {
  data: PracticeData;
  seriesColor?: string;
}) {
  const driversById = useMemo(
    () => new Map<number, EnrichedDriver>(data.drivers.map(d => [d.number, d])),
    [data.drivers],
  );

  if (data.fastest.length === 0 && data.longRuns.length === 0) return null;

  const fallbackColour = 'var(--border-strong)';
  const fastestLap = data.fastest[0]?.lapDuration ?? 0;

  // Long-run table shows only drivers who actually strung a representative run
  // together (best != null); quali-sim-only drivers would be all-blank rows.
  const longRuns = data.longRuns.filter(lr => lr.best != null);
  // Reference for the long-run gap column: the quickest representative-stint
  // average across the field (longRuns is pre-sorted fastest-first).
  const bestLongRun = longRuns[0]?.best?.avgGreenPace ?? 0;

  return (
    <section
      className="space-y-8"
      style={seriesColor ? ({ '--brand': seriesColor } as React.CSSProperties) : undefined}
    >
      {data.fastest.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-display text-sm font-extrabold uppercase tracking-wide text-text">
              Fastest laps
            </h3>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint">
              One-lap pace · gap to P1
            </span>
          </div>

          <ol className="space-y-1.5">
            {data.fastest.map((e, i) => {
              const driver = driversById.get(e.driverNumber);
              const colour = driver?.teamColour ?? fallbackColour;
              // Bar inversely scaled to the gap: fastest fills the row, slower
              // laps recede. Floor the width so even the slowest shows a sliver.
              const widthPct =
                fastestLap > 0
                  ? Math.max(8, (fastestLap / e.lapDuration) * 100)
                  : 0;
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
                  <div className="relative hidden h-5 flex-1 overflow-hidden rounded-sm bg-surface sm:block">
                    <div
                      className="h-full rounded-sm transition-[width] duration-(--duration-base)"
                      style={{ width: `${widthPct}%`, backgroundColor: colour }}
                    />
                  </div>
                  <span className="w-[4.5rem] shrink-0 text-right font-mono text-xs font-semibold tabular-nums text-text">
                    {fmtLap(e.lapDuration)}
                  </span>
                  <span className="w-16 shrink-0 text-right font-mono text-[11px] tabular-nums text-text-faint">
                    {i === 0 ? '—' : fmtGap(e.lapDuration - fastestLap)}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {longRuns.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-display text-sm font-extrabold uppercase tracking-wide text-text">
              Long-run pace
            </h3>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint">
              Race-sim · avg green lap
            </span>
          </div>

          <ul className="divide-y divide-border/60">
            {longRuns.map((lr, i) => (
              <LongRunRow
                key={lr.driverNumber}
                run={lr}
                rank={i + 1}
                driver={driversById.get(lr.driverNumber)}
                bestAvg={bestLongRun}
                fallbackColour={fallbackColour}
              />
            ))}
          </ul>

          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
            Avg of clean green laps (in/out + traffic laps excluded). Lap count is
            the representative stint&rsquo;s clean laps.
          </p>
        </div>
      )}

      <OpenF1Attribution className="pt-1" />
    </section>
  );
}

function LongRunRow({
  run,
  rank,
  driver,
  bestAvg,
  fallbackColour,
}: {
  run: PracticeLongRun;
  rank: number;
  driver: EnrichedDriver | undefined;
  bestAvg: number;
  fallbackColour: string;
}) {
  const colour = driver?.teamColour ?? fallbackColour;
  const best = run.best; // guaranteed non-null by the caller's filter
  const avg = best?.avgGreenPace ?? null;
  const delta = avg != null && bestAvg > 0 ? avg - bestAvg : 0;
  return (
    <li className="flex items-center gap-2.5 py-2">
      <span className="w-5 shrink-0 text-right font-mono text-[11px] tabular-nums text-text-faint">
        {rank}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <DriverDot colour={colour} />
        <span className="font-display text-xs font-extrabold uppercase tracking-wide text-text">
          {driver?.code ?? `#${run.driverNumber}`}
        </span>
        <span className="truncate font-mono text-[11px] text-text-muted">
          {driver?.team ?? ''}
        </span>
      </span>
      {best?.compound ? (
        <span className="hidden shrink-0 sm:inline">
          <CompoundChip compound={best.compound} />
        </span>
      ) : null}
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
        {best?.greenLaps ?? 0} lap{(best?.greenLaps ?? 0) === 1 ? '' : 's'}
      </span>
      <span className="w-[4.5rem] shrink-0 text-right font-mono text-xs font-semibold tabular-nums text-text">
        {fmtLap(avg)}
      </span>
      <span className="hidden w-16 shrink-0 text-right font-mono text-[11px] tabular-nums text-text-faint sm:inline">
        {rank === 1 ? '—' : fmtGap(delta)}
      </span>
    </li>
  );
}
