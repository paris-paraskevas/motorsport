'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { OpenF1Attribution } from '@/components/f1/OpenF1Attribution';
import { SectorBars } from '@/components/f1/SectorBars';
import { LazyDeltaTrace } from '@/components/f1/LazyDeltaTrace';
import { MinisectorMap } from '@/components/f1/MinisectorMap';
import { GhostLapReplay } from '@/components/f1/GhostLapReplay';
import { LazyGhostLap3D } from '@/components/f1/LazyGhostLap3D';
import type { DecoderSummary, DecoderTraces, DriverTrace, LapSummary } from '@/lib/openf1/decoder';
import type { EnrichedDriver } from '@/lib/openf1/drivers';

// Broadcast-grade two-driver qualifying comparison. Shell: defaults to the
// fastest two laps (pole vs P2), lets either slot swap to any driver with a lap,
// fetches telemetry traces for the chosen pair on demand, and renders four views
// — SectorBars from the (already-loaded) summary, and DeltaTrace / GhostLapReplay
// / MinisectorMap once traces arrive. Trace fetch mirrors WeekendBetting's
// useCallback-fetcher + active-cleanup-guard pattern.

// Pair the picker reasons about: a driver number with a confirmed lap.
function lapByNumber(summary: DecoderSummary): Map<number, LapSummary> {
  return new Map(summary.laps.map(l => [l.driverNumber, l]));
}

function driverByNumber(summary: DecoderSummary): Map<number, EnrichedDriver> {
  return new Map(summary.drivers.map(d => [d.number, d]));
}

export function QualifyingDecoder({
  summary,
  seriesColor,
}: {
  summary: DecoderSummary;
  seriesColor?: string;
}) {
  const laps = useMemo(() => lapByNumber(summary), [summary]);
  const driversById = useMemo(() => driverByNumber(summary), [summary]);

  // Only drivers that BOTH have a lap and a known driver row are selectable.
  const selectable = useMemo(
    () => summary.laps.filter(l => driversById.has(l.driverNumber)).map(l => l.driverNumber),
    [summary.laps, driversById],
  );

  // Default = fastest two (summary.laps is pre-sorted fastest-first).
  const [aNum, setANum] = useState<number | null>(selectable[0] ?? null);
  const [bNum, setBNum] = useState<number | null>(selectable[1] ?? selectable[0] ?? null);

  const [traces, setTraces] = useState<DecoderTraces | null>(null);
  const [loading, setLoading] = useState(false);
  const [ghost3d, setGhost3d] = useState(false);

  // Fetch only — returns the payload, never sets state, matching WeekendBetting
  // so the effect body stays setState-free.
  const fetchTraces = useCallback(
    async (a: number, b: number): Promise<DecoderTraces | null> => {
      try {
        const res = await fetch(
          `/api/f1/decoder/trace?session=${summary.sessionKey}&drivers=${a},${b}`,
        );
        if (!res.ok) return null;
        return (await res.json()) as DecoderTraces;
      } catch {
        return null;
      }
    },
    [summary.sessionKey],
  );

  useEffect(() => {
    if (aNum == null || bNum == null) return;
    let active = true;
    setLoading(true);
    fetchTraces(aNum, bNum).then(d => {
      if (!active) return;
      setTraces(d);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [aNum, bNum, fetchTraces]);

  if (selectable.length === 0) {
    return (
      <section className="space-y-3">
        <p className="font-mono text-sm text-text-muted">
          No qualifying laps available for this session yet.
        </p>
        <OpenF1Attribution />
      </section>
    );
  }

  const driverA = aNum != null ? driversById.get(aNum) : undefined;
  const driverB = bNum != null ? driversById.get(bNum) : undefined;
  const lapA = aNum != null ? laps.get(aNum) : undefined;
  const lapB = bNum != null ? laps.get(bNum) : undefined;

  // Match the fetched traces back to the chosen slots (the API sorts traces
  // fastest-first, so we can't assume index order maps to A/B).
  const traceFor = (n: number | null): DriverTrace | undefined =>
    n == null ? undefined : traces?.traces.find(t => t.driverNumber === n);
  const traceA = traceFor(aNum);
  const traceB = traceFor(bNum);

  const samePick = aNum != null && aNum === bNum;
  const tracesReady = !loading && traceA && traceB && !samePick;
  // A driver with a lap but no telemetry samples → car_data gap for that session.
  const telemetryMissing =
    !loading &&
    traces != null &&
    (!traceA || !traceB || traceA.telemetry.length === 0 || traceB.telemetry.length === 0);

  return (
    <section
      className="space-y-6"
      // Per-series accent: re-point --brand so the delta line + chip accents
      // pick up the series colour (same pattern as the weekend page's --tint).
      style={seriesColor ? ({ '--brand': seriesColor } as React.CSSProperties) : undefined}
    >
      {/* Two-slot picker. Each slot is a chip row of selectable drivers; the
          other slot's pick is disabled to avoid a self-comparison. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <DriverSlot
          label="Driver A"
          selected={aNum}
          disabledNum={bNum}
          options={selectable}
          driversById={driversById}
          laps={laps}
          onSelect={setANum}
        />
        <DriverSlot
          label="Driver B"
          selected={bNum}
          disabledNum={aNum}
          options={selectable}
          driversById={driversById}
          laps={laps}
          onSelect={setBNum}
        />
      </div>

      {samePick && (
        <p className="font-mono text-xs text-text-faint">Pick two different drivers to compare.</p>
      )}

      {/* SectorBars: summary-only, renders immediately. */}
      {driverA && driverB && lapA && lapB && !samePick && (
        <div className="border border-border bg-surface/40 p-4">
          <SectorBars driverA={driverA} driverB={driverB} lapA={lapA} lapB={lapB} />
        </div>
      )}

      {/* Trace-backed views. Skeletons while loading, graceful note if a session
          lacks car_data. */}
      {!samePick && (
        <div className="space-y-6">
          {loading ? (
            <>
              <div className="h-72 animate-pulse border border-border bg-surface/40 md:h-80" />
              <div className="h-64 animate-pulse border border-border bg-surface/40" />
            </>
          ) : telemetryMissing ? (
            <p className="flex h-24 items-center justify-center border border-border bg-surface/40 text-center text-sm text-text-faint">
              Telemetry unavailable for this session — sector comparison shown above.
            </p>
          ) : tracesReady && driverA && driverB && traceA && traceB ? (
            <>
              <LazyDeltaTrace driverA={driverA} driverB={driverB} traceA={traceA} traceB={traceB} />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint">
                    Replay
                  </span>
                  <div className="flex gap-1">
                    {([['2D', false], ['Onboard', true]] as const).map(([label, is3d]) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setGhost3d(is3d)}
                        aria-pressed={ghost3d === is3d}
                        className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors duration-(--duration-fast) ${
                          ghost3d === is3d
                            ? 'border-border-strong bg-surface text-text'
                            : 'border-border text-text-faint hover:border-border-strong hover:text-text-muted'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {ghost3d ? (
                  <LazyGhostLap3D driverA={driverA} driverB={driverB} traceA={traceA} traceB={traceB} circuit={traces?.circuit} />
                ) : (
                  <GhostLapReplay driverA={driverA} driverB={driverB} traceA={traceA} traceB={traceB} />
                )}
              </div>
              <MinisectorMap
                driverA={driverA}
                driverB={driverB}
                traceA={traceA}
                traceB={traceB}
                sectorsA={lapA?.sectors}
                sectorsB={lapB?.sectors}
              />
            </>
          ) : null}
        </div>
      )}

      <OpenF1Attribution className="pt-2" />
    </section>
  );
}

function DriverSlot({
  label,
  selected,
  disabledNum,
  options,
  driversById,
  laps,
  onSelect,
}: {
  label: string;
  selected: number | null;
  disabledNum: number | null;
  options: number[];
  driversById: Map<number, EnrichedDriver>;
  laps: Map<number, LapSummary>;
  onSelect: (n: number) => void;
}) {
  const current = selected != null ? driversById.get(selected) : undefined;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint">{label}</span>
        {current && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: current.teamColour }} />
            <span className="font-display text-sm font-extrabold uppercase tracking-wide text-text">{current.code}</span>
            <span className="font-mono text-[11px] text-text-muted">{current.team}</span>
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map(n => {
          const d = driversById.get(n);
          if (!d) return null;
          const on = n === selected;
          const disabled = n === disabledNum;
          const lap = laps.get(n);
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(n)}
              title={d.name + (lap ? ` · ${fmtLapShort(lap.lapTime)}` : '')}
              className={`inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-[11px] font-medium transition-colors duration-(--duration-fast) ${
                on
                  ? 'border-border-strong bg-surface text-text'
                  : disabled
                    ? 'cursor-not-allowed border-border text-text-faint/40'
                    : 'border-border text-text-faint hover:border-border-strong hover:text-text-muted'
              }`}
              style={on ? { borderColor: d.teamColour } : undefined}
            >
              {d.headshotUrl ? (
                // Plain <img>, not next/image: OpenF1 headshots are arbitrary
                // remote hosts and next.config has no images.remotePatterns, so
                // next/image would throw "hostname not configured". A 20px
                // decorative avatar gains nothing from the optimizer anyway.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={d.headshotUrl}
                  alt=""
                  width={20}
                  height={20}
                  loading="lazy"
                  decoding="async"
                  className="h-5 w-5 rounded-full object-cover"
                />
              ) : (
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.teamColour }} />
              )}
              {d.code}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function fmtLapShort(s: number): string {
  if (!Number.isFinite(s)) return '—';
  const m = Math.floor(s / 60);
  const rem = s - m * 60;
  return `${m}:${rem.toFixed(3).padStart(6, '0')}`;
}
