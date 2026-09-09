'use client';

import type { CSSProperties, ReactNode } from 'react';
import type { DataBand } from '@/lib/design/data-services';

// The Data workspace's shared shapes (operator's design brief, 2026-09-09: no
// rounded corners or coloured chips, columns split by lines, colour as a solid
// band or the figure itself, one idea per box, type big enough to read
// without effort). The status colours live on the workspace root: the bands
// are one colour in both modes, the text tones follow the console theme's
// color-scheme through light-dark().

export const TONE_VARS = {
  '--ok-bg': '#2e8b57',
  '--warn-bg': '#d98b1a',
  '--bad-bg': '#c94a42',
  '--off-bg': '#8a95a3',
  '--own-bg': '#5f6fa6',
  '--ok': 'light-dark(#1f7a4d, #5bbe93)',
  '--warn': 'light-dark(#b26a00, #e0b04a)',
  '--bad': 'light-dark(#a83a32, #e07a72)',
  '--off': 'light-dark(#6b7683, #8792a0)',
  '--own': 'light-dark(#4b5b8f, #a9b4e8)',
} as CSSProperties;

export const BTN =
  'inline-flex h-[34px] items-center gap-2 border border-border-strong bg-surface-elevated px-3 text-14 font-medium text-text transition-colors duration-(--duration-fast) hover:bg-(--edit-dim) disabled:cursor-default disabled:opacity-50';
export const BTN_PRIMARY = `${BTN} border-(--edit) text-(--edit)`;

export const toneColor = (band: DataBand): string => `var(--${band})`;
export const bandColor = (band: DataBand): string => `var(--${band}-bg)`;

/** A 10px square in the band's colour, before a word. */
export function Swatch({ band }: { band: DataBand }) {
  return <span aria-hidden className="mr-2 inline-block h-[10px] w-[10px] align-[-1px]" style={{ background: bandColor(band) }} />;
}

/** The solid label across the top of a card. */
export function Band({ band, children }: { band: DataBand; children: ReactNode }) {
  return (
    <div className="px-4 py-1.5 text-12 font-bold uppercase tracking-[0.08em] text-white" style={{ background: bandColor(band) }}>
      {children}
    </div>
  );
}

export interface StripCell {
  n: string;
  label: string;
  band: DataBand;
}

/** The "what's up" strip: one large coloured count per cell, a rule between cells, the band along the top. */
export function Strip({ cells, label }: { cells: StripCell[]; label: string }) {
  return (
    <div className="grid border border-border-strong bg-surface-elevated" style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }} role="group" aria-label={label}>
      {cells.map((c, i) => (
        <div key={i} className="grid gap-0.5 border-r border-border-strong px-4 py-3.5 last:border-r-0" style={{ boxShadow: `inset 0 4px 0 ${bandColor(c.band)}` }}>
          <span className="text-32 font-bold leading-[1.1] tabular-nums" style={{ color: toneColor(c.band) }}>
            {c.n}
          </span>
          <span className="text-14 text-text-muted">{c.label}</span>
        </div>
      ))}
    </div>
  );
}

export interface RuledTableProps {
  title?: ReactNode;
  cols: string[];
  /** Columns that hold figures are right-aligned with tabular digits. */
  numeric?: number[];
  rows: ReactNode[][];
  empty?: string;
}

/** One ruled table: header on the surface tone, lines between columns and rows, the whole row lit on hover. */
export function RuledTable({ title, cols, numeric = [], rows, empty = 'Nothing yet.' }: RuledTableProps) {
  return (
    <div className="border border-border-strong bg-surface-elevated">
      {title !== undefined && <div className="border-b border-border-strong bg-surface px-4 py-2.5 text-14 font-semibold text-text">{title}</div>}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-15">
          <thead>
            <tr>
              {cols.map((c, j) => (
                <th key={c} className={`border-b border-r border-border-strong bg-surface px-4 py-2.5 text-13 font-semibold text-text-muted last:border-r-0 ${numeric.includes(j) ? 'text-right' : 'text-left'}`}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="transition-colors duration-(--duration-fast) hover:bg-(--edit-dim)">
                {r.map((cell, j) => (
                  <td key={j} className={`border-b border-r border-border px-4 py-3 align-middle text-text last:border-r-0 [tr:last-child>&]:border-b-0 ${numeric.includes(j) ? 'text-right tabular-nums' : ''}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={cols.length} className="px-4 py-5 text-center text-15 text-text-faint">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `07:40Z · 9 Sep`, in UTC like every stamp the loader writes. */
export function when(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}Z · ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** `12 min ago`, `3 h ago`, `2 d ago`; `just now` under a minute. */
export function ago(iso: string | null | undefined, now: number): string {
  if (!iso) return '';
  const ms = now - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return '';
  const min = Math.round(ms / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

/** `4.2 s` between two stamps; a dash while the run is open. */
export function took(started: string | null, finished: string | null): string {
  if (!started || !finished) return '—';
  const ms = new Date(finished).getTime() - new Date(started).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  return ms < 10_000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms / 1000)} s`;
}
