'use client';
import { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { computeDelta, type DriverTrace } from '@/lib/openf1/delta';
import type { EnrichedDriver } from '@/lib/openf1/drivers';

// Headline analytical view: both drivers' speed traces (left axis, km/h) over
// lap distance, plus the cumulative time delta (right axis, seconds) as a
// filled-feel line. Positive delta = driver B behind A, so a rising curve marks
// where A is pulling away. Inner chart only — LazyDeltaTrace owns the dynamic
// import so recharts stays off the critical bundle (matches LazySeasonTrendChart).

interface Row {
  d: number;
  speedA: number | null;
  speedB: number | null;
  delta: number | null;
}

// Speed is sampled at the raw telemetry distances; delta is resampled evenly by
// computeDelta. Merge both onto one distance axis by bucketing delta points to
// the nearest speed sample, so the tooltip lines up. We key rows by the union of
// distances, preferring the (denser) telemetry grid for speed fidelity.
function buildRows(a: DriverTrace, b: DriverTrace): Row[] {
  const delta = computeDelta(a, b);
  // Fast lookup of cumulative delta at an arbitrary distance.
  const deltaAt = (d: number): number | null => {
    if (delta.length === 0) return null;
    if (d <= delta[0].d) return delta[0].delta;
    for (let i = 1; i < delta.length; i++) {
      if (delta[i].d >= d) {
        const p0 = delta[i - 1];
        const p1 = delta[i];
        const span = p1.d - p0.d || 1;
        return p0.delta + ((d - p0.d) / span) * (p1.delta - p0.delta);
      }
    }
    return delta[delta.length - 1].delta;
  };
  const speedAt = (tel: DriverTrace['telemetry'], d: number): number | null => {
    if (tel.length === 0) return null;
    if (d <= tel[0].d) return tel[0].speed;
    for (let i = 1; i < tel.length; i++) {
      if (tel[i].d >= d) return tel[i].speed;
    }
    return tel[tel.length - 1].speed;
  };

  // Sample on an even grid over the shared distance — keeps row count bounded
  // and both speed lines defined across the whole x-domain.
  const lastD = (tel: DriverTrace['telemetry']) => (tel.length ? tel[tel.length - 1].d : 0);
  const maxD = Math.min(lastD(a.telemetry), lastD(b.telemetry));
  if (maxD <= 0) return [];
  const N = 300;
  const rows: Row[] = [];
  for (let i = 0; i <= N; i++) {
    const d = (maxD * i) / N;
    rows.push({
      d: Math.round(d),
      speedA: speedAt(a.telemetry, d),
      speedB: speedAt(b.telemetry, d),
      delta: deltaAt(d),
    });
  }
  return rows;
}

export function DeltaTrace({
  driverA,
  driverB,
  traceA,
  traceB,
}: {
  driverA: EnrichedDriver;
  driverB: EnrichedDriver;
  traceA: DriverTrace;
  traceB: DriverTrace;
}) {
  const rows = useMemo(() => buildRows(traceA, traceB), [traceA, traceB]);

  if (rows.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center border border-border bg-surface/40 text-center text-sm text-text-faint sm:h-72 md:h-80">
        Telemetry unavailable for this session.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-display text-sm font-bold uppercase tracking-wide text-text">
          Speed &amp; cumulative delta
        </h3>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
          delta &gt; 0 → {driverA.code} ahead
        </span>
      </div>
      <div className="h-72 md:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 6, right: 8, bottom: 6, left: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="d"
              type="number"
              domain={[0, 'dataMax']}
              stroke="var(--text-faint)"
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              tickLine={false}
              tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}km`}
              minTickGap={28}
            />
            {/* Left: speed (km/h). */}
            <YAxis
              yAxisId="speed"
              stroke="var(--text-faint)"
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              tickLine={false}
              width={32}
              domain={['dataMin - 10', 'dataMax + 10']}
              tickFormatter={(v: number) => `${Math.round(v)}`}
            />
            {/* Right: cumulative delta (s). */}
            <YAxis
              yAxisId="delta"
              orientation="right"
              stroke="var(--text-faint)"
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              tickLine={false}
              width={40}
              tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}s`}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: 'var(--text)', fontWeight: 600 }}
              itemStyle={{ color: 'var(--text-muted)' }}
              labelFormatter={(label) => `${(Number(label) / 1000).toFixed(2)} km`}
              formatter={(value, name) => {
                if (value == null) return ['—', name as string];
                if (name === 'delta') {
                  const v = Number(value);
                  return [`${v > 0 ? '+' : ''}${v.toFixed(3)} s`, 'Delta'];
                }
                return [`${Math.round(Number(value))} km/h`, name as string];
              }}
            />
            {/* Zero-delta baseline so the gap line's crossings read clearly. */}
            <ReferenceLine yAxisId="delta" y={0} stroke="var(--border-strong)" strokeDasharray="3 3" />
            <Line
              yAxisId="speed"
              type="monotone"
              dataKey="speedA"
              name={driverA.code}
              stroke={driverA.teamColour}
              strokeWidth={1.75}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              yAxisId="speed"
              type="monotone"
              dataKey="speedB"
              name={driverB.code}
              stroke={driverB.teamColour}
              strokeWidth={1.75}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            {/* Delta on top, brand-tinted + thicker — it's the lede. */}
            <Line
              yAxisId="delta"
              type="monotone"
              dataKey="delta"
              name="delta"
              stroke="var(--brand)"
              strokeWidth={2.5}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {/* Compact legend — the two speed traces + the delta line. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-text-muted">
        <LegendChip colour={driverA.teamColour} label={`${driverA.code} speed`} />
        <LegendChip colour={driverB.teamColour} label={`${driverB.code} speed`} />
        <LegendChip colour="var(--brand)" label="Cumulative delta" thick />
      </div>
    </div>
  );
}

function LegendChip({ colour, label, thick }: { colour: string; label: string; thick?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block w-4 rounded-full"
        style={{ backgroundColor: colour, height: thick ? 3 : 2 }}
      />
      {label}
    </span>
  );
}
