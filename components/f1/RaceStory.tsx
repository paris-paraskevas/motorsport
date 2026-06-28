'use client';
import { useMemo, useState } from 'react';
import { OpenF1Attribution } from '@/components/f1/OpenF1Attribution';
import { TeamRadioPlayer } from '@/components/f1/TeamRadioPlayer';
import type { EnrichedDriver } from '@/lib/openf1/drivers';
import type { Moment } from '@/lib/openf1/moments';
import type { RaceStoryData } from '@/lib/openf1/racestory';

// The race-session counterpart to the Qualifying Decoder: a tyre-strategy grid
// (one band-track per driver, scaled to the race distance) plus a unified
// chronological Moments timeline (flags, safety cars, penalties, overtakes, pit
// stops, team radio). Page passes `data` from a server-side buildRaceStory call,
// so there's no client fetch here — this is a pure presentational shell.

// Pirelli-ish dry/wet palette. `text: 'dark'` flips the band label to near-black
// for the light compounds (medium/hard) so it stays legible on a bright fill.
const COMPOUND: Record<string, { fill: string; text: 'light' | 'dark' }> = {
  SOFT: { fill: '#e8002d', text: 'light' },
  MEDIUM: { fill: '#f8d12e', text: 'dark' },
  HARD: { fill: '#ebebeb', text: 'dark' },
  INTERMEDIATE: { fill: '#43b02a', text: 'light' },
  WET: { fill: '#0067ad', text: 'light' },
};
const UNKNOWN_FILL = 'var(--border-strong)';

function compoundStyle(compound: string | null): { fill: string; text: 'light' | 'dark' } {
  const key = compound?.toUpperCase() ?? '';
  return COMPOUND[key] ?? { fill: UNKNOWN_FILL, text: 'light' };
}

function compoundInitial(compound: string | null): string {
  const key = compound?.toUpperCase() ?? '';
  return key ? key[0] : '?';
}

// Severity → left-rail dot colour. Alert maps to the shared --live red; notice
// to the medium-tyre amber; info to the faintest text token.
function severityColour(sev: Moment['severity']): string {
  if (sev === 'alert') return 'var(--live)';
  if (sev === 'notice') return '#f8d12e';
  return 'var(--text-faint)';
}

// Severity-coloured dot rather than a per-kind glyph — keeps the timeline
// dependency-free (no icon-set version risk; lucide's lazy icon resolution 500s
// on a name this version doesn't ship). The colour + the title carry the meaning.
function MomentDot({ moment }: { moment: Moment }) {
  return (
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{ backgroundColor: severityColour(moment.severity) }}
      aria-hidden
    />
  );
}

type FilterKey = 'key' | 'all' | 'radio';

// Default "Key" view = the actual story (flags, safety cars, penalties,
// investigations, red/yellow + radio). The routine 'info' moments — overtake /
// pit / DRS / green-flag spam, hundreds on a real race — only show under "All".
function matchesFilter(m: Moment, f: FilterKey): boolean {
  if (f === 'all') return true;
  if (f === 'radio') return m.kind === 'radio';
  return m.severity !== 'info';
}

// A real race emits 500+ moments; cap the rendered list (and scroll it) so a
// session page can't balloon to tens of thousands of pixels.
const MAX_VISIBLE = 80;

export function RaceStory({
  data,
  seriesColor,
}: {
  data: RaceStoryData;
  seriesColor?: string;
}) {
  const driversById = useMemo(
    () => new Map<number, EnrichedDriver>(data.drivers.map(d => [d.number, d])),
    [data.drivers],
  );

  const [filter, setFilter] = useState<FilterKey>('key');

  const hasStints = data.stints.some(s => s.stints.length > 0);
  const hasRadio = data.moments.some(m => m.kind === 'radio');
  const totalLaps = data.totalLaps > 0 ? data.totalLaps : 1;

  const visibleMoments = useMemo(
    () => data.moments.filter(m => matchesFilter(m, filter)),
    [data.moments, filter],
  );
  const shownMoments = visibleMoments.slice(0, MAX_VISIBLE);

  return (
    <section
      className="space-y-8"
      // Per-series accent: re-point --brand so accents (radio player, filter
      // chips) pick up the series colour — same pattern as QualifyingDecoder.
      style={seriesColor ? ({ '--brand': seriesColor } as React.CSSProperties) : undefined}
    >
      {/* ── Tyre strategy ─────────────────────────────────────────────── */}
      {hasStints && (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-display text-sm font-extrabold uppercase tracking-wide text-text">
              Tyre strategy
            </h3>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint">
              {totalLaps} laps
            </span>
          </div>

          <div className="space-y-1.5">
            {data.stints.map(row => {
              const driver = driversById.get(row.driverNumber);
              if (row.stints.length === 0) return null;
              return (
                <div key={row.driverNumber} className="flex items-center gap-2.5">
                  <span className="flex w-16 shrink-0 items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: driver?.teamColour ?? UNKNOWN_FILL }}
                    />
                    <span className="font-display text-xs font-extrabold uppercase tracking-wide text-text">
                      {driver?.code ?? `#${row.driverNumber}`}
                    </span>
                  </span>

                  <div className="flex h-5 flex-1 overflow-hidden rounded-sm bg-surface">
                    {row.stints.map((band, i) => {
                      const laps = Math.max(0, band.lapEnd - band.lapStart + 1);
                      const widthPct = (laps / totalLaps) * 100;
                      const { fill, text } = compoundStyle(band.compound);
                      const label = `${band.compound ?? 'Unknown'} · L${band.lapStart}–${band.lapEnd}${
                        band.ageAtStart != null ? ` · ${band.ageAtStart}-lap-old tyre` : ''
                      }`;
                      return (
                        <div
                          key={i}
                          title={label}
                          className="flex h-full min-w-[1.25rem] items-center justify-center overflow-hidden border-r border-bg/40 last:border-r-0"
                          style={{ width: `${widthPct}%`, backgroundColor: fill }}
                        >
                          <span
                            className={`font-mono text-[10px] font-bold leading-none ${
                              text === 'dark' ? 'text-black/80' : 'text-white/90'
                            }`}
                          >
                            {compoundInitial(band.compound)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <TyreLegend />
        </div>
      )}

      {/* ── Moments timeline ──────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-display text-sm font-extrabold uppercase tracking-wide text-text">
            Moments
          </h3>
          {data.moments.length > 0 && (
            <div className="flex gap-1">
              <FilterChip active={filter === 'key'} onClick={() => setFilter('key')}>
                Key
              </FilterChip>
              <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
                All
              </FilterChip>
              {hasRadio && (
                <FilterChip active={filter === 'radio'} onClick={() => setFilter('radio')}>
                  Radio
                </FilterChip>
              )}
            </div>
          )}
        </div>

        {data.moments.length === 0 ? (
          <p className="font-mono text-sm text-text-muted">
            No race-control events recorded for this session.
          </p>
        ) : visibleMoments.length === 0 ? (
          <p className="font-mono text-xs text-text-faint">No moments match this filter.</p>
        ) : (
          <>
            <div className="max-h-[34rem] overflow-y-auto pr-1">
              <ol className="space-y-0">
                {shownMoments.map((m, i) => {
                  const driver = m.driverNumber != null ? driversById.get(m.driverNumber) : undefined;
                  return (
                    <li key={`${m.id}__${i}`} className="flex gap-3 py-2">
                      {/* Left rail: severity-coloured dot + connecting line. */}
                      <div className="flex w-4 shrink-0 flex-col items-center">
                        <span className="flex h-5 items-center justify-center">
                          <MomentDot moment={m} />
                        </span>
                        <span className="mt-1 w-px flex-1 bg-border" aria-hidden />
                      </div>

                      <div className="min-w-0 flex-1 pb-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="font-display text-sm font-bold text-text">{m.title}</span>
                          {driver && (
                            <span className="inline-flex items-center gap-1">
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: driver.teamColour }}
                              />
                              <span className="font-mono text-[11px] font-medium uppercase tracking-wide text-text-muted">
                                {driver.code}
                              </span>
                            </span>
                          )}
                          {m.lap != null && (
                            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint">
                              L{m.lap}
                            </span>
                          )}
                        </div>

                        {m.detail && (
                          <p className="mt-0.5 truncate font-mono text-xs text-text-muted">{m.detail}</p>
                        )}

                        {m.kind === 'radio' && m.audioUrl && (
                          <TeamRadioPlayer src={m.audioUrl} label={driver?.code} />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
            {visibleMoments.length > MAX_VISIBLE && (
              <p className="pt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint">
                Showing {MAX_VISIBLE} of {visibleMoments.length} — use the filters to narrow
              </p>
            )}
          </>
        )}
      </div>

      <OpenF1Attribution className="pt-2" />
    </section>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors duration-(--duration-fast) ${
        active
          ? 'border-border-strong bg-surface text-text'
          : 'border-border text-text-faint hover:border-border-strong hover:text-text-muted'
      }`}
    >
      {children}
    </button>
  );
}

function TyreLegend() {
  const entries: Array<{ label: string; compound: string }> = [
    { label: 'Soft', compound: 'SOFT' },
    { label: 'Medium', compound: 'MEDIUM' },
    { label: 'Hard', compound: 'HARD' },
    { label: 'Inter', compound: 'INTERMEDIATE' },
    { label: 'Wet', compound: 'WET' },
  ];
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
      {entries.map(e => (
        <span key={e.compound} className="inline-flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: compoundStyle(e.compound).fill }}
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
            {e.label}
          </span>
        </span>
      ))}
    </div>
  );
}
