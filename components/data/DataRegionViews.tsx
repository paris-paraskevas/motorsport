import { Fragment, type CSSProperties, type ReactNode } from 'react';
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
// Timeline (P2.2 B2) is APEX's Timeline report template drawn as a view of the
// region (the operator chose one region with a View setting, 2026-09-10): a
// race per entry on a rail, results only. Detail is APEX's Value Attribute
// Pairs - Column: a block per row, the column headers as the labels. The
// template components the views draw are named here (ContentRow, initials as
// Avatar, the chips as Badge); none is a column type, since no shape draws one
// as a table column. Server-rendered, imported dynamically from
// component-render.tsx as the Home pieces are. Every value is text React
// escapes (rule 4).

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

/** A row's share of the leader's points, a whole percent; the Table's bar and Detail's figure both read it. */
const shareOf = (row: PresetRow, leader: number): number | null => {
  const points = num(row.points);
  return leader > 0 && points !== null ? Math.round((points / leader) * 100) : null;
};

/** A column's value as the site draws it, without its cell: the chip, the anchor, the site's date, the gap against
 *  the leader, the share bar; the Table wraps it in a <td>, Detail in a <dd>. */
function cellValue(column: PresetColumn, row: PresetRow, leader: number): ReactNode {
  const v = row[column.key];
  switch (column.type) {
    case 'badge':
      return text(v) ? <span className={CHIP}>{text(v)}</span> : null;
    case 'gap': {
      const points = num(row.points);
      return points === null ? '' : points >= leader ? '—' : `−${leader - points}`;
    }
    case 'percent': {
      const share = shareOf(row, leader);
      const style: CSSProperties = { width: `${share === null ? 0 : Math.max(2, share)}%` };
      return (
        <span aria-hidden="true" className="block h-[6px] w-full bg-border">
          <span className={`block h-full ${row.position === 1 ? 'bg-text' : 'bg-border-strong'}`} style={style} />
        </span>
      );
    }
    case 'link': {
      const href = column.href ? text(row[column.href]) : '';
      return href ? (
        <Link href={href} className="underline-offset-4 hover:text-tint hover:underline">
          {text(v)}
        </Link>
      ) : (
        text(v)
      );
    }
    case 'date':
      return formatDate(v);
    default:
      return text(v);
  }
}

/** The Table cell's classes per column type: the site's standings tables. */
function tdClass(column: PresetColumn, row: PresetRow): string {
  switch (column.type) {
    case 'position':
      return `py-2 pr-3 text-right align-baseline font-mono tabular-nums ${row[column.key] === 1 ? 'text-brand font-bold' : 'text-text-faint'}`;
    case 'badge':
      return 'py-2 pr-3 align-baseline';
    case 'number':
      return `py-2 pl-3 text-right align-baseline font-mono text-13 tabular-nums ${column.key === 'points' ? 'font-semibold text-numeral' : 'text-text-faint'}`;
    case 'gap':
      return 'py-2 pl-3 text-right align-baseline font-mono text-13 tabular-nums text-text-faint';
    case 'percent':
      return 'py-2 pl-3 align-middle';
    case 'link':
      return 'py-2 pr-3 align-baseline font-condensed text-15 font-semibold text-text';
    case 'date':
      return 'py-2 pr-3 align-baseline text-xs text-text-muted';
    default:
      return column.key === 'name' ? 'py-2 pr-3 align-baseline font-condensed text-15 font-semibold text-text' : 'py-2 pr-3 align-baseline text-xs text-text-muted';
  }
}

function Cell({ column, row, leader }: { column: PresetColumn; row: PresetRow; leader: number }) {
  return <td className={tdClass(column, row)}>{cellValue(column, row, leader)}</td>;
}

/** The row's who, as the site's rows name it: the standings' name; the drivers on race and cup rows (GtWorldResultRow
 *  never falls back); the drivers or, failing them, the team on car rows (ImsaResultRow). */
function whoOf(shape: Shape, row: PresetRow): string {
  if (shape.source !== 'results') return text(row.name);
  return shape.key === 'car-rows' ? text(row.driver) || text(row.team) : text(row.driver);
}
/** A classification's winner: the position-1 row, else the first row as it came. */
const winnerOf = (entries: readonly PresetRow[]): PresetRow => entries.find(e => e.position === 1) ?? entries[0];
/** The site's WIN line (RowMeta): "driver — team", the team alone when the driver is blank. */
function winnerLabel(winner: PresetRow): string | null {
  const who = text(winner.driver);
  return who ? `${who} — ${text(winner.team)}` : text(winner.team) || null;
}
/** APEX Avatar, initials: the first person of a crew (before a comma or the site's dot), the first and last words' first letters. */
export function initials(who: string): string {
  const words = who.split(/[,·]/)[0].trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const pick = words.length === 1 ? [words[0]] : [words[0], words[words.length - 1]];
  return pick.map(w => w.charAt(0)).join('').toUpperCase();
}

/** The card's slots as the renderer resolves them (APEX Cards: Title, Subtitle, Body, Icon Initials, Badge): a column key per slot, media '' for none. */
export interface CardSlots {
  title: string;
  subtitle?: string;
  body: string;
  media: string;
  badge: string;
}
/** Where an action zone sends a row: an address and whether it leaves the site; null when it resolves to nothing for that row. */
export type Zone = (row: PresetRow) => { href: string; external: boolean } | null;
/** The five action zones (APEX Cards › Actions: Full Card, Title, Subtitle, Media, Button) and the button's words. */
export interface CardActions {
  fullCard: Zone;
  title: Zone;
  subtitle: Zone;
  media: Zone;
  button: Zone;
  buttonLabel: string;
}
const NOWHERE: Zone = () => null;
const NO_ACTIONS: CardActions = { fullCard: NOWHERE, title: NOWHERE, subtitle: NOWHERE, media: NOWHERE, button: NOWHERE, buttonLabel: 'Open' };
/** The site's Button (components/page/RowPageView.tsx) at a card's size. */
const CARD_BUTTON = 'inline-flex min-h-9 items-center bg-text px-4 font-mono text-10 font-semibold uppercase tracking-[0.14em] text-bg transition-colors duration-(--duration-fast) hover:bg-text-muted';
const ZONE_LINK = 'underline-offset-4 hover:text-tint hover:underline';

export interface DataRegionViewProps {
  heading: string;
  /** h1 when the region is the first showing in the Body, as every component's heading is. */
  level: 'h1' | 'h2';
  shape: Shape;
  preset: Preset;
  rows: readonly PresetRow[];
  /** The Cards view's slots and zones (P2.2 B3); the shape's own mapping and no zone when absent. */
  card?: CardSlots;
  actions?: CardActions;
}

/** A zone's link around a part of the card, or the part alone; an external address leaves the site in a new tab, as the
 *  Button region does. A part without words of its own (the avatar, hidden from assistive technology) names its link. */
function Zoned({ to, className, label, children }: { to: ReturnType<Zone>; className?: string; label?: string; children: ReactNode }) {
  if (!to) return <>{children}</>;
  if (to.external)
    return (
      <a href={to.href} target="_blank" rel="noopener noreferrer" className={className} aria-label={label}>
        {children}
      </a>
    );
  return (
    <Link href={to.href} className={className} aria-label={label}>
      {children}
    </Link>
  );
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

/** APEX Cards' Grid layout: the slots the renderer resolved (the shape's own mapping by default), the Media as the initials
 *  of its column's text (APEX Icon Initials), and the action zones. Full Card set and resolved for a row makes that card one
 *  link named after its title, and its other zones stand down: no link inside a link. A zone that resolves to nothing for a
 *  row draws that part plain. */
export function DataRegionCards({ heading, level, shape, rows, card, actions }: DataRegionViewProps) {
  const H = level;
  const slot: CardSlots = card ?? { ...shape.card, media: '' };
  const act = actions ?? NO_ACTIONS;
  return (
    <section className="border-y border-border py-4">
      <H className={HEADING}>{heading}</H>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r, i) => {
          const title = text(r[slot.title]);
          const subtitle = slot.subtitle ? text(r[slot.subtitle]) : '';
          const full = act.fullCard(r);
          const zone = (z: Zone) => (full ? null : z(r));
          const button = zone(act.button);
          const body = (
            <>
              <div className="flex items-baseline justify-between gap-3">
                {/* The leader's colour belongs to the position; a badge from another column (the wins, the car) is plain. */}
                <span className={`font-mono text-11 tabular-nums ${slot.badge === 'position' && r.position === 1 ? 'text-brand font-bold' : 'text-text-faint'}`}>{text(r[slot.badge])}</span>
                <span className="font-mono text-13 font-semibold tabular-nums text-numeral">{text(r[slot.body])}</span>
              </div>
              <div className="mt-1 flex items-start gap-3">
                {slot.media ? (
                  <Zoned to={zone(act.media)} label={title}>
                    <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center bg-surface font-mono text-11 font-semibold tracking-[0.08em] text-text-muted">
                      {initials(text(r[slot.media]))}
                    </span>
                  </Zoned>
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="font-condensed text-15 font-semibold text-text">
                    <Zoned to={zone(act.title)} className={ZONE_LINK}>
                      {title}
                    </Zoned>
                  </div>
                  {subtitle ? (
                    <div className="text-xs text-text-muted">
                      <Zoned to={zone(act.subtitle)} className={ZONE_LINK}>
                        {subtitle}
                      </Zoned>
                    </div>
                  ) : null}
                </div>
              </div>
              {button ? (
                <div className="mt-3">
                  <Zoned to={button} className={CARD_BUTTON}>
                    {act.buttonLabel}
                  </Zoned>
                </div>
              ) : null}
            </>
          );
          return (
            <li key={`${text(r.position)}-${title}-${i}`} className="border border-border bg-surface/40 p-4">
              {full ? (
                full.external ? (
                  <a href={full.href} target="_blank" rel="noopener noreferrer" className="block" aria-label={title}>
                    {body}
                  </a>
                ) : (
                  <Link href={full.href} className="block" aria-label={title}>
                    {body}
                  </Link>
                )
              ) : (
                body
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The fold a results row belongs to: a race of a round (race-rows), a class of a round (car-rows), a cup of a race (cup-rows, by the race's id). */
function groupKey(shape: Shape, r: PresetRow): string {
  return shape.key === 'cup-rows' ? `${text(r.raceId)}|${text(r.class)}` : shape.key === 'car-rows' ? `${text(r.round)}|${text(r.class)}` : `${text(r.round)}|${text(r.race)}`;
}
/** The folds in the order the rows arrive: presetRows has put the newest round first and a race's rows together. */
function groupRows(shape: Shape, rows: readonly PresetRow[]): Map<string, PresetRow[]> {
  const groups = new Map<string, PresetRow[]>();
  for (const r of rows) {
    const k = groupKey(shape, r);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return groups;
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

/** APEX Content Row, the template component (a title, a chip, a description, a misc value, a badge), drawn as the
 *  site's ResultRow, ImsaResultRow and GtWorldResultRow draw one classified entry: the who, the driver's code where
 *  one exists or the car's number always (a bare # when the export has none, as the site's rows keep the box), the
 *  team and the vehicle, the time or the gap or the status, the points on race rows. */
export function ContentRow({ shape, row }: { shape: Shape; row: PresetRow }) {
  const who = whoOf(shape, row);
  const line = shape.key === 'race-rows' ? text(row.team) : `${text(row.team)}${text(row.vehicle) ? ` · ${text(row.vehicle)}` : ''}`;
  const right = shape.key === 'race-rows' ? text(row.time) || text(row.status) : shape.key === 'car-rows' ? text(row.gap) || text(row.status) : text(row.gap) || text(row.time);
  return (
    <li className="flex items-baseline gap-3 py-2 break-inside-avoid">
      <span className="w-6 text-right font-mono text-sm tabular-nums text-text-faint">{text(row.position)}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate font-condensed text-15 font-semibold text-text">{who}</span>
          {shape.key === 'race-rows' ? text(row.code) ? <span className={CHIP}>{text(row.code)}</span> : null : <span className={CHIP}>{`#${text(row.car)}`}</span>}
        </div>
        <div className="truncate text-xs text-text-muted">{line}</div>
      </div>
      <span className={`truncate text-right font-mono text-13 tabular-nums text-text-muted ${shape.key === 'race-rows' ? 'w-20' : 'w-24'}`}>{right}</span>
      {shape.key === 'race-rows' ? <span className="w-10 text-right font-mono text-13 font-semibold tabular-nums text-numeral">{text(row.points)}</span> : null}
    </li>
  );
}

/** The fold's title: the race, and the class or cup for the class families. */
const groupTitle = (shape: Shape, first: PresetRow): string => (shape.key === 'race-rows' ? text(first.race) : `${text(first.race)} — ${text(first.class)}`);

/** A fold of the Rounds layout: the chip, the title, the meta line, the entries; a winners-only round flat, on the
 *  flat series alone (the site's RoundRow; its class and cup cards never collapse). */
function RoundGroup({ shape, entries }: { shape: Shape; entries: readonly PresetRow[] }) {
  const first = entries[0];
  const round = num(first.round);
  const winner = winnerOf(entries);
  const head: ReactNode = (
    <>
      <span className="w-9 shrink-0 pt-1 text-right font-mono text-11 font-semibold tabular-nums text-tint">{round === null ? '·' : `R${round}`}</span>
      <div className="min-w-0 flex-1">
        <RaceTitle name={groupTitle(shape, first)} href={text(first.weekend) || null} />
        <Meta date={formatDate(first.date)} winner={winnerLabel(winner)} />
      </div>
    </>
  );
  if (shape.key === 'race-rows' && entries.length === 1 && WINNER.test(text(first.status))) return <div className="flex items-start gap-3 py-2.5">{head}</div>;
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-start gap-3 py-2.5 transition-colors duration-(--duration-fast) hover:bg-surface [&::-webkit-details-marker]:hidden">
        {head}
        <ChevronDown size={16} className="mt-1 shrink-0 text-text-faint transition-transform group-open:rotate-180" />
      </summary>
      <ul className="ml-2 mt-2 mb-2 divide-y divide-border/60 border-l border-border/60 pl-3 sm:ml-9 sm:columns-2 sm:gap-x-10">
        {entries.map((e, i) => (
          <ContentRow key={`${text(e.position)}-${text(e.driver)}-${text(e.car)}-${i}`} shape={shape} row={e} />
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
  return (
    <section className="border-y border-border py-4">
      <H className={HEADING}>{heading}</H>
      <ul className="divide-y divide-border/60">
        {[...groupRows(shape, rows).entries()].map(([k, entries]) => (
          <li key={k} className="py-1">
            <RoundGroup shape={shape} entries={entries} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** APEX's Timeline, the Classic Report template ("a timeline of actions"; a theme component too since 23.1), drawn as
 *  a view of the region: one entry per race, or per race and class, newest first as presetRows orders them; a marker
 *  on a rail, the date (the round chip when the fetcher gives none, "·" without a round), the title linked to the
 *  weekend page, the WIN line, the winner's initials (Avatar). Results shapes only: a standings row has no date. */
export function DataRegionTimeline({ heading, level, shape, rows }: DataRegionViewProps) {
  const H = level;
  return (
    <section className="border-y border-border py-4">
      <H className={HEADING}>{heading}</H>
      <ol className="ml-2 border-l border-border pl-6 sm:ml-4">
        {[...groupRows(shape, rows).entries()].map(([k, entries]) => {
          const first = entries[0];
          const round = num(first.round);
          const date = formatDate(first.date);
          const winner = winnerOf(entries);
          const avatar = initials(text(winner.driver));
          return (
            <li key={k} className="relative py-3">
              <span aria-hidden="true" className="absolute top-[1.15rem] -left-[1.85rem] h-2.5 w-2.5 rounded-full border-2 border-bg bg-tint" />
              <div className="flex items-start gap-3">
                {/* The avatar's box stays when a winner has no name (a team-only entry), so the entries keep one left edge. */}
                <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center bg-surface font-mono text-11 font-semibold tracking-[0.08em] text-text-muted">
                  {avatar}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-10 uppercase tracking-[0.14em] text-text-faint">{date || (round === null ? '·' : `R${round}`)}</div>
                  <RaceTitle name={groupTitle(shape, first)} href={text(first.weekend) || null} />
                  <Meta date="" winner={winnerLabel(winner)} />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** APEX's Value Attribute Pairs - Column, the Classic Report template whose labels are the column headers: one block
 *  per row, headed by the position and the row's who, then the shape's other columns as label and value pairs drawn as
 *  the Table draws them (the share as a figure). Rows applies as it does to the Table. */
export function DataRegionDetail({ heading, level, shape, preset, rows }: DataRegionViewProps) {
  const H = level;
  const whoKey = shape.source === 'results' ? 'driver' : 'name';
  const columns = tableColumns(shape, preset, rows).filter(c => c.type !== 'position' && c.key !== whoKey);
  const leader = leaderPoints(rows);
  return (
    <section className="border-y border-border py-4">
      <H className={HEADING}>{heading}</H>
      <ol className="divide-y divide-border/60">
        {rows.map((r, i) => (
          <li key={`${text(r.position)}-${whoOf(shape, r)}-${i}`} className="py-3">
            <div className="flex items-baseline gap-3">
              <span className={`w-6 text-right font-mono text-sm tabular-nums ${r.position === 1 ? 'text-brand font-bold' : 'text-text-faint'}`}>{text(r.position)}</span>
              <span className="min-w-0 flex-1 truncate font-condensed text-15 font-semibold text-text">{whoOf(shape, r)}</span>
            </div>
            <dl className="mt-2 ml-9 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
              {columns.map(c => (
                <Fragment key={c.key}>
                  <dt className="pt-0.5 font-mono text-10 uppercase tracking-[0.14em] text-text-faint">{c.label}</dt>
                  <dd className={`m-0 ${c.type === 'number' || c.type === 'gap' || c.type === 'percent' ? 'font-mono text-13 tabular-nums' : ''} ${c.key === 'points' ? 'font-semibold text-numeral' : 'text-text-muted'}`}>
                    {c.type === 'percent' ? (shareOf(r, leader) === null ? '' : `${shareOf(r, leader)}%`) : cellValue(c, r, leader)}
                  </dd>
                </Fragment>
              ))}
            </dl>
          </li>
        ))}
      </ol>
    </section>
  );
}
