import type { CSSProperties } from 'react';
import type { Preset, PresetColumn, PresetRow, Shape } from '@/lib/design/presets';

// The Data region's views (the components programme, P2.2). The Table draws a
// preset's rows as the site's standings tables do (components/tabs/StandingsTab.tsx,
// DriversTable and ConstructorsTable): the same classes, drawn afresh here so
// the renderer's graph never pulls the tabs and their fifteen fetchers (the
// bundle regression component-render.tsx's header records). Cards is APEX
// Cards' Grid layout over the shape's slot mapping. Server-rendered, imported
// dynamically from component-render.tsx as the Home pieces are. Every value is
// text React escapes (rule 4).

const HEADING = 'font-display text-sm font-extrabold uppercase tracking-wide text-text mb-3';
const RIGHT: ReadonlySet<PresetColumn['type']> = new Set(['position', 'number', 'gap']);

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const text = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

/** The columns a table draws: the shape's, the name column labelled as the
 *  preset says, and a text, badge or number column whose every value is empty
 *  left out, as the site drops Team and Wins when a feed carries none. */
export function tableColumns(shape: Shape, preset: Preset, rows: readonly PresetRow[]): PresetColumn[] {
  return shape.columns
    .map(c => (c.key === 'name' ? { ...c, label: preset.nameLabel } : c))
    .filter(c => c.type === 'position' || c.type === 'gap' || c.type === 'percent' || c.key === 'name' || rows.some(r => r[c.key] !== null && r[c.key] !== undefined && r[c.key] !== ''));
}

/** The leader's points, the reference for the gap and the share columns. */
const leaderPoints = (rows: readonly PresetRow[]) => rows.reduce((m, r) => Math.max(m, num(r.points) ?? 0), 0);

function Cell({ column, row, leader }: { column: PresetColumn; row: PresetRow; leader: number }) {
  const v = row[column.key];
  switch (column.type) {
    case 'position':
      return <td className={`py-2 pr-3 text-right align-baseline font-mono tabular-nums ${v === 1 ? 'text-brand font-bold' : 'text-text-faint'}`}>{text(v)}</td>;
    case 'badge':
      return (
        <td className="py-2 pr-3 align-baseline">
          {text(v) ? <span className="border border-border px-1.5 py-0.5 font-mono text-10 font-semibold uppercase tracking-[0.12em] text-text-faint">{text(v)}</span> : null}
        </td>
      );
    case 'number':
      return <td className={`py-2 pl-3 text-right align-baseline font-mono text-13 tabular-nums ${column.key === 'points' ? 'font-semibold text-numeral' : 'text-text-faint'}`}>{text(v)}</td>;
    case 'gap': {
      const points = num(row.points);
      return <td className="py-2 pl-3 text-right align-baseline font-mono text-13 tabular-nums text-text-faint">{points === null ? '' : points >= leader ? '—' : `−${leader - points}`}</td>;
    }
    case 'percent': {
      const points = num(row.points);
      const width = leader > 0 && points !== null ? Math.max(2, Math.round((points / leader) * 100)) : 0;
      const style: CSSProperties = { width: `${width}%` };
      return (
        <td className="py-2 pl-3 align-middle">
          <span aria-hidden="true" className="block h-[6px] w-full bg-border">
            <span className={`block h-full ${row.position === 1 ? 'bg-text' : 'bg-border-strong'}`} style={style} />
          </span>
        </td>
      );
    }
    default:
      return column.key === 'name' ? (
        <td className="py-2 pr-3 align-baseline font-condensed text-15 font-semibold text-text">{text(v)}</td>
      ) : (
        <td className="py-2 pr-3 align-baseline text-xs text-text-muted">{text(v)}</td>
      );
  }
}

export interface DataRegionViewProps {
  heading: string;
  /** h1 when the region is the first showing in the Body, as every component's heading is. */
  level: 'h1' | 'h2';
  shape: Shape;
  preset: Preset;
  rows: readonly PresetRow[];
}

export function DataRegionTable({ heading, level, shape, preset, rows }: DataRegionViewProps) {
  const H = level;
  const columns = tableColumns(shape, preset, rows);
  const leader = leaderPoints(rows);
  return (
    <section className="border-y border-border py-4">
      <H className={HEADING}>{heading}</H>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{heading}</caption>
          <thead>
            <tr className="border-b border-border font-mono text-10 uppercase tracking-[0.14em] text-text-faint">
              {columns.map(c => (
                <th key={c.key} scope="col" className={`py-2 font-normal ${RIGHT.has(c.type) ? 'pl-3 text-right' : 'pr-3 text-left'}${c.type === 'position' ? ' w-10' : c.type === 'percent' ? ' w-24' : ''}`}>
                  {c.type === 'percent' ? <span className="sr-only">{c.label}</span> : c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((r, i) => (
              <tr key={`${text(r.position)}-${text(r.name)}-${i}`}>
                {columns.map(c => (
                  <Cell key={c.key} column={c} row={r} leader={leader} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function DataRegionCards({ heading, level, shape, rows }: DataRegionViewProps) {
  const H = level;
  const slot = shape.card;
  return (
    <section className="border-y border-border py-4">
      <H className={HEADING}>{heading}</H>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r, i) => (
          <li key={`${text(r.position)}-${text(r[slot.title])}-${i}`} className="border border-border bg-surface/40 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className={`font-mono text-11 tabular-nums ${r[slot.badge] === 1 ? 'text-brand font-bold' : 'text-text-faint'}`}>{text(r[slot.badge])}</span>
              <span className="font-mono text-13 font-semibold tabular-nums text-numeral">{text(r[slot.body])}</span>
            </div>
            <div className="mt-1 font-condensed text-15 font-semibold text-text">{text(r[slot.title])}</div>
            {slot.subtitle && text(r[slot.subtitle]) ? <div className="text-xs text-text-muted">{text(r[slot.subtitle])}</div> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
