// Sector-by-sector comparison of two drivers' fastest qualifying laps. Pure +
// summary-only (no traces, no recharts) so it renders the instant the picker
// resolves a pair. Lap time + S1/S2/S3, CSS bars sized to each sector's share
// of the slower lap, and a per-sector gap badge tinted to the faster driver.
import type { EnrichedDriver } from '@/lib/openf1/drivers';
import type { LapSummary } from '@/lib/openf1/decoder';

// Lap: m:ss.SSS (1:23.456). Sector: ss.SSS (23.456) — sectors are always <2min.
function fmtLap(s: number | null | undefined): string {
  if (s == null || !Number.isFinite(s)) return '—';
  const m = Math.floor(s / 60);
  const rem = s - m * 60;
  return `${m}:${rem.toFixed(3).padStart(6, '0')}`;
}

function fmtSector(s: number | null | undefined): string {
  if (s == null || !Number.isFinite(s)) return '—';
  return s.toFixed(3);
}

// Signed gap, the way a broadcast renders it: +0.123 / −0.045. The faster
// side's badge is tinted; nulls (missing sector) yield no comparison.
function fmtGap(delta: number): string {
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
  return `${sign}${Math.abs(delta).toFixed(3)}`;
}

const SECTOR_LABELS = ['S1', 'S2', 'S3'] as const;

export function SectorBars({
  driverA,
  driverB,
  lapA,
  lapB,
}: {
  driverA: EnrichedDriver;
  driverB: EnrichedDriver;
  lapA: LapSummary;
  lapB: LapSummary;
}) {
  const rows = SECTOR_LABELS.map((label, i) => {
    const a = lapA.sectors[i];
    const b = lapB.sectors[i];
    const both = a != null && Number.isFinite(a) && b != null && Number.isFinite(b);
    // delta = B − A (positive → A is faster here). Bars are scaled to the
    // slower of the two so the longer bar fills the track.
    const delta = both ? (b as number) - (a as number) : null;
    const max = both ? Math.max(a as number, b as number) : null;
    const aPct = both && max ? ((a as number) / max) * 100 : a != null ? 100 : 0;
    const bPct = both && max ? ((b as number) / max) * 100 : b != null ? 100 : 0;
    const aFaster = delta != null && delta > 0;
    const bFaster = delta != null && delta < 0;
    return { label, a, b, delta, aPct, bPct, aFaster, bFaster };
  });

  return (
    <div className="space-y-4">
      {/* Lap-time header: each driver's full lap, faster one tinted. */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <DriverHead driver={driverA} lapTime={lapA.lapTime} faster={lapA.lapTime <= lapB.lapTime} align="left" />
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint">vs</span>
        <DriverHead driver={driverB} lapTime={lapB.lapTime} faster={lapB.lapTime < lapA.lapTime} align="right" />
      </div>

      {/* Per-sector rows: A bar (mirrored right-to-left) · label + gap · B bar. */}
      <div className="space-y-2.5">
        {rows.map(r => (
          <div key={r.label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="flex items-center justify-end gap-2">
              <span className="font-mono text-xs tabular-nums text-text-muted">{fmtSector(r.a)}</span>
              <div className="h-2 flex-1 max-w-[8rem] overflow-hidden rounded-sm bg-surface">
                <div
                  className="ml-auto h-full rounded-sm transition-[width] duration-(--duration-base)"
                  style={{
                    width: `${r.aPct}%`,
                    backgroundColor: r.aFaster ? driverA.teamColour : 'var(--border-strong)',
                  }}
                />
              </div>
            </div>

            <div className="flex min-w-[4.5rem] flex-col items-center">
              <span className="font-display text-xs font-bold uppercase tracking-wide text-text">{r.label}</span>
              {r.delta != null && (
                <span
                  className="font-mono text-[11px] font-semibold tabular-nums"
                  style={{ color: r.aFaster ? driverA.teamColour : r.bFaster ? driverB.teamColour : 'var(--text-faint)' }}
                  // gap is expressed from the faster driver's perspective
                >
                  {r.aFaster ? fmtGap(-r.delta) : fmtGap(r.delta)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 max-w-[8rem] overflow-hidden rounded-sm bg-surface">
                <div
                  className="h-full rounded-sm transition-[width] duration-(--duration-base)"
                  style={{
                    width: `${r.bPct}%`,
                    backgroundColor: r.bFaster ? driverB.teamColour : 'var(--border-strong)',
                  }}
                />
              </div>
              <span className="font-mono text-xs tabular-nums text-text-muted">{fmtSector(r.b)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DriverHead({
  driver,
  lapTime,
  faster,
  align,
}: {
  driver: EnrichedDriver;
  lapTime: number;
  faster: boolean;
  align: 'left' | 'right';
}) {
  return (
    <div className={`flex flex-col ${align === 'right' ? 'items-end text-right' : 'items-start text-left'}`}>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: driver.teamColour }} />
        <span className="font-display text-sm font-extrabold uppercase tracking-wide text-text">{driver.code}</span>
      </span>
      <span
        className="font-mono text-lg font-bold tabular-nums"
        style={{ color: faster ? driver.teamColour : 'var(--text-muted)' }}
      >
        {fmtLap(lapTime)}
      </span>
    </div>
  );
}
