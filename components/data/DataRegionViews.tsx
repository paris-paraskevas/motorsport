import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import type { Preset, PresetColumn, PresetRow, Shape } from '@/lib/design/presets';

// The Data region's views (the components programme, P2.2). The Table draws a
// preset's rows as the site's standings tables do (components/tabs/StandingsTab.tsx,
// DriversTable and ConstructorsTable): the same classes, drawn afresh here so
// the renderer's graph never pulls the tabs and their fifteen fetchers (the
// bundle regression component-render.tsx's header records). Cards is APEX
// Cards' Grid layout over the shape's slot mapping. List (P2.2 B1) is the
// Rounds layout for a results shape, the round-grouped accordion the site's
// results panels draw (ResultsTab.tsx: SeasonResultsPanel, the IMSA, WEC and
// GT World panels), and a compact list for a standings shape; ours, APEX's
// Classic Report has no such view and its Content Row column is the nearest.
// Server-rendered, imported dynamically from component-render.tsx as the Home
// pieces are. Every value is text React escapes (rule 4).

const HEADING = 'font-display text-sm font-extrabold uppercase tracking-wide text-text mb-3';
const RIGHT: ReadonlySet<PresetColumn['type']> = new Set(['position', 'number', 'gap']);
const CHIP = 'border border-border px-1.5 py-0.5 font-mono text-10 font-semibold uppercase tracking-[0.12em] text-text-faint';
/** The site's winners-only rule (ResultsTab.tsx RoundRow): one entry whose status is the winner's is a flat row, not a fold. */
const WINNER = /^(race\s+)?winner$/i;

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const text = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
/** The site's date (ResultsTab.tsx formatDate): day, short month, year, in UTC. */
const formatDate = (v: unknown): string => {
  const d = typeof v === 'string' && v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';
};

/** The columns a table draws: the shape's, the name column labelled as the
 *  preset says, and a text, badge, number or date column whose every value is
 *  empty left out, as the site drops Team and Wins when a feed carries none. */
export function tableColumns(shape: Shape, preset: Preset, rows: readonly PresetRow[]): PresetColumn[] {
  return shape.columns
    .map(c => (c.key === 'name' ? { ...c, label: preset.nameLabel } : c))
    .filter(c => c.type === 'position' || c.type === 'gap' || c.type === 'percent' || c.type === 'link' || c.key === 'name' || rows.some(r => r[c.key] !== null && r[c.key] !== undefined && r[c.key] !== ''));
}

/** The leader's points, the reference for the gap and the share columns. */
const leaderPoints = (rows: readonly PresetRow[]) => rows.reduce((m, r) => Math.max(m, num(r.points) ?? 0), 0);

function Cell({ column, row, leader }: { column: PresetColumn; row: PresetRow; leader: number }) {
  const v = row[column.key];
  switch (column.type) {
    case 'position':
      return <td className={`py-2 pr-3 text-right align-baseline font-mono tabular-nums ${v === 1 ? 'text-brand font-bold' : 'text-text-faint'}`}>{text(v)}</td>;
    case 'badge':
      return <td className="py-2 pr-3 align-baseline">{text(v) ? <span className={CHIP}>{text(v)}</span> : null}</td>;
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
    case 'link': {
      const href = column.href ? text(row[column.href]) : '';
      return (
        <td className="py-2 pr-3 align-baseline font-condensed text-15 font-semibold text-text">
          {href ? (
            <Link href={href} className="underline-offset-4 hover:text-tint hover:underline">
              {text(v)}
            </Link>
          ) : (
            text(v)
          )}
        </td>
      );
    }
    case 'date':
      return <td className="py-2 pr-3 align-baseline text-xs text-text-muted">{formatDate(v)}</td>;
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
                <th key={c.key} scope="col" className={`py-2 font-normal ${c.type === 'position' ? 'w-10 pr-3 text-right' : RIGHT.has(c.type) ? 'pl-3 text-right' : 'pr-3 text-left'}${c.type === 'percent' ? ' w-24' : ''}`}>
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

/** The fold a results row belongs to: a race of a round (race-rows), a class of a round (car-rows), a cup of a race (cup-rows, by the race's id). */
function groupKey(shape: Shape, r: PresetRow): string {
  return shape.key === 'cup-rows' ? `${text(r.raceId)}|${text(r.class)}` : shape.key === 'car-rows' ? `${text(r.round)}|${text(r.class)}` : `${text(r.round)}|${text(r.race)}`;
}

/** The site's RaceTitle: the race, linked to its weekend page when one is live. */
function RaceTitle({ name, href }: { name: string; href: string | null }) {
  const cls = 'font-display text-15 font-bold uppercase tracking-wide leading-snug text-text';
  if (!href) return <span className={cls}>{name}</span>;
  return (
    <Link href={href} className={`${cls} underline-offset-4 hover:text-tint hover:underline`}>
      {name}
    </Link>
  );
}

/** The site's RowMeta: the date, and the winner in the brand colour. */
function Meta({ date, winner }: { date: string; winner: string | null }) {
  if (!date && !winner) return null;
  return (
    <div className="mt-0.5 font-mono text-10 uppercase tracking-[0.14em] text-text-faint sm:truncate">
      {date}
      {date && winner ? ' · ' : null}
      {winner ? (
        <>
          <span className="font-semibold text-brand">WIN</span> <span className="normal-case text-text-muted">{winner}</span>
        </>
      ) : null}
    </div>
  );
}

/** One classified entry, as the site's ResultRow, ImsaResultRow and GtWorldResultRow draw it. */
function EntryRow({ shape, row }: { shape: Shape; row: PresetRow }) {
  const who = shape.key === 'race-rows' ? text(row.driver) : text(row.driver) || text(row.team);
  const chip = shape.key === 'race-rows' ? text(row.code) : text(row.car) ? `#${text(row.car)}` : '';
  const line = shape.key === 'race-rows' ? text(row.team) : `${text(row.team)}${text(row.vehicle) ? ` · ${text(row.vehicle)}` : ''}`;
  const right = shape.key === 'race-rows' ? text(row.time) || text(row.status) : shape.key === 'car-rows' ? text(row.gap) || text(row.status) : text(row.gap) || text(row.time);
  return (
    <li className="flex items-baseline gap-3 py-2 break-inside-avoid">
      <span className="w-6 text-right font-mono text-sm tabular-nums text-text-faint">{text(row.position)}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate font-condensed text-15 font-semibold text-text">{who}</span>
          {chip ? <span className={CHIP}>{chip}</span> : null}
        </div>
        <div className="truncate text-xs text-text-muted">{line}</div>
      </div>
      <span className={`truncate text-right font-mono text-13 tabular-nums text-text-muted ${shape.key === 'race-rows' ? 'w-20' : 'w-24'}`}>{right}</span>
      {shape.key === 'race-rows' ? <span className="w-10 text-right font-mono text-13 font-semibold tabular-nums text-numeral">{text(row.points)}</span> : null}
    </li>
  );
}

/** A fold of the Rounds layout: the chip, the title, the meta line, the entries; a winners-only round flat. */
function RoundGroup({ shape, entries }: { shape: Shape; entries: readonly PresetRow[] }) {
  const first = entries[0];
  const round = num(first.round);
  const title = shape.key === 'race-rows' ? text(first.race) : `${text(first.race)} — ${text(first.class)}`;
  const winner = entries.find(e => e.position === 1) ?? first;
  const who = text(winner.driver);
  const winnerLabel = who ? `${who} — ${text(winner.team)}` : text(winner.team) || null;
  const head: ReactNode = (
    <>
      <span className="w-9 shrink-0 pt-1 text-right font-mono text-11 font-semibold tabular-nums text-tint">{round === null ? '·' : `R${round}`}</span>
      <div className="min-w-0 flex-1">
        <RaceTitle name={title} href={text(first.weekend) || null} />
        <Meta date={formatDate(first.date)} winner={winnerLabel} />
      </div>
    </>
  );
  if (entries.length === 1 && WINNER.test(text(first.status))) return <div className="flex items-start gap-3 py-2.5">{head}</div>;
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-start gap-3 py-2.5 transition-colors duration-(--duration-fast) hover:bg-surface [&::-webkit-details-marker]:hidden">
        {head}
        <ChevronDown size={16} className="mt-1 shrink-0 text-text-faint transition-transform group-open:rotate-180" />
      </summary>
      <ul className="ml-2 mt-2 mb-2 divide-y divide-border/60 border-l border-border/60 pl-3 sm:ml-9 sm:columns-2 sm:gap-x-10">
        {entries.map((e, i) => (
          <EntryRow key={`${text(e.position)}-${text(e.driver)}-${text(e.car)}-${i}`} shape={shape} row={e} />
        ))}
      </ul>
    </details>
  );
}

export function DataRegionList({ heading, level, shape, rows }: DataRegionViewProps) {
  const H = level;
  if (shape.source !== 'results') {
    // A standings shape's compact list: the position, the name, the points.
    return (
      <section className="border-y border-border py-4">
        <H className={HEADING}>{heading}</H>
        <ul className="divide-y divide-border/60">
          {rows.map((r, i) => (
            <li key={`${text(r.position)}-${text(r.name)}-${i}`} className="flex items-baseline gap-3 py-2">
              <span className={`w-6 text-right font-mono text-sm tabular-nums ${r.position === 1 ? 'text-brand font-bold' : 'text-text-faint'}`}>{text(r.position)}</span>
              <span className="min-w-0 flex-1 truncate font-condensed text-15 font-semibold text-text">{text(r.name)}</span>
              <span className="w-10 text-right font-mono text-13 font-semibold tabular-nums text-numeral">{text(r.points)}</span>
            </li>
          ))}
        </ul>
      </section>
    );
  }
  // The folds in the order the rows arrive: presetRows has put the newest round first and a race's rows together.
  const groups = new Map<string, PresetRow[]>();
  for (const r of rows) {
    const k = groupKey(shape, r);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return (
    <section className="border-y border-border py-4">
      <H className={HEADING}>{heading}</H>
      <ul className="divide-y divide-border/60">
        {[...groups.entries()].map(([k, entries]) => (
          <li key={k} className="py-1">
            <RoundGroup shape={shape} entries={entries} />
          </li>
        ))}
      </ul>
    </section>
  );
}
