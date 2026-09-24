import { Fragment, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import type { Preset, PresetColumn, PresetRow, Shape } from '@/lib/design/presets';
import { ageLabel } from '@/lib/date';
import { seriesInk } from '@/lib/site';
import { NextRaceCountdown } from '@/components/NextRaceCountdown';
import { sortHref, sortable, type ViewFilter, type ViewState } from '@/lib/design/view-state';
import { rowPasses } from '@/lib/design/presets';
import { DataRegionControls } from './DataRegionControls';
import { FollowedRows } from './FollowedRows';

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
// as a table column, save the image column (P2.24 A: a thumbnail in a cell,
// the picture in a card's Media box). The Lead story and The wire (P2.24 A)
// are Home's two boxes copied verbatim from components/HomeLead.tsx as
// templates over the posts and news shapes, so the flip (PR C) serves the same
// HTML; they become that markup's home when Home's pieces retire.
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
export function tableColumns(shape: Shape, preset: Preset, rows: readonly PresetRow[], cols?: readonly string[]): PresetColumn[] {
  const named = shape.columns.map(c => (c.key === 'name' ? { ...c, label: preset.nameLabel } : c));
  // A reader's allow-list (P2.3) is drawn as given, an empty column included: the reader chose it.
  if (cols) return named.filter(c => cols.includes(c.key));
  return named.filter(c => c.type === 'position' || c.type === 'gap' || c.type === 'percent' || c.type === 'link' || c.key === 'name' || rows.some(r => r[c.key] !== null && r[c.key] !== undefined && r[c.key] !== ''));
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
      if (!href) return text(v);
      // A column whose address leaves the site (the news title) opens in a new tab, as an external destination does.
      if (column.external)
        return (
          <a href={href} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:text-tint hover:underline">
            {text(v)}
          </a>
        );
      return (
        <Link href={href} className="underline-offset-4 hover:text-tint hover:underline">
          {text(v)}
        </Link>
      );
    }
    case 'date':
      return formatDate(v);
    case 'image': {
      // A thumbnail of the picture (P2.24 A); remote covers never went through next/image (HomeLead.tsx draws them the same way).
      const src = text(v);
      // eslint-disable-next-line @next/next/no-img-element
      return src ? <img src={src} alt="" width={1200} height={750} className="h-10 w-16 shrink-0 border border-border bg-surface object-cover" /> : null;
    }
    default:
      return text(v);
  }
}

/** A slot's value as text: a date column as the site's date, the rest as given (P2.24 A: a post's Published in a card's body). */
const slotText = (shape: Shape, row: PresetRow, key: string): string => (shape.columns.find(c => c.key === key)?.type === 'date' ? formatDate(row[key]) : text(row[key]));

/** A stamp's age at the render's instant, '' without a stamp. */
const ageOf = (v: unknown, now: Date | undefined): string => {
  const d = typeof v === 'string' && v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? ageLabel(d, now ?? new Date()) : '';
};

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
      // A results driver (P2.4 PR B) keeps the cell it had as text: the link adds the page, never a new look.
      return column.key === 'driver' ? 'py-2 pr-3 align-baseline text-xs text-text-muted' : 'py-2 pr-3 align-baseline font-condensed text-15 font-semibold text-text';
    case 'date':
      return 'py-2 pr-3 align-baseline text-xs text-text-muted';
    case 'image':
      return 'py-2 pr-3 align-middle';
    default:
      return column.key === 'name' ? 'py-2 pr-3 align-baseline font-condensed text-15 font-semibold text-text' : 'py-2 pr-3 align-baseline text-xs text-text-muted';
  }
}

function Cell({ column, row, leader }: { column: PresetColumn; row: PresetRow; leader: number }) {
  return <td className={tdClass(column, row)}>{cellValue(column, row, leader)}</td>;
}

/** The row's who, as the site's rows name it: the standings' name; the drivers on race and cup rows (GtWorldResultRow
 *  never falls back); the drivers or, failing them, the team on car rows (ImsaResultRow); the card's title on a shape
 *  without a name or a driver (the posts, the headlines; P2.24 A). */
function whoOf(shape: Shape, row: PresetRow): string {
  if (shape.source === 'standings') return text(row.name);
  if (shape.source === 'results') return shape.key === 'car-rows' ? text(row.driver) || text(row.team) : text(row.driver);
  return text(row[shape.card.title]);
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
  /** The render's instant, for the age a stamp is given (P2.24 A); the clock when absent. */
  now?: Date;
  /** The series the Source names (its `series` parameter, R8), for a template whose words follow it; none across every series. */
  series?: string;
  /** The Interactive Report's controls (P2.3): present only where the region has them on and a state can arrive. */
  controls?: RegionControls;
  /** The highlight rules and the followed-series tint (P2.4); absent draws every row plain. */
  highlight?: RowHighlight;
  /** The region's id (P2.4): the wrapper `#region-<id>` the followed-series tint marks rows under. */
  region?: string;
  /** Master-detail (P2.4 PR C): this region's rows as the master, each a Show link into its detail's filter. */
  master?: MasterSelect;
  /** Master-detail (P2.4 PR C): this region as the detail, the value its master chose and the way back to every row. */
  showing?: DetailShowing;
}

/** A master's link per row (P2.4 PR C; APEX: Master Detail): the address that shows the row's value in the detail, the rest of
 *  the address kept (null for a row without a value); whether the detail shows it now; its words, "Show <value>". */
export interface MasterSelect {
  href(row: PresetRow): string | null;
  current(row: PresetRow): boolean;
  label(row: PresetRow): string;
}
/** A detail's line above its rows while its master's filter is on (P2.4 PR C): the value shown and the reset. */
export interface DetailShowing {
  value: string;
  reset: string;
}

/** The master's link for a row (P2.4 PR C): a plain anchor, never next/link, so no variant is prefetched; marked while the
 *  detail shows its value; nothing for a row without one. */
function SelectLink({ master, row }: { master: MasterSelect; row: PresetRow }) {
  const href = master.href(row);
  if (!href) return null;
  const current = master.current(row);
  return (
    <a href={href} rel="nofollow" aria-current={current ? 'true' : undefined} className={`shrink-0 font-mono text-10 font-semibold uppercase tracking-[0.14em] underline-offset-4 hover:underline ${current ? 'text-brand' : 'text-tint'}`}>
      {master.label(row)}
    </a>
  );
}

/** The detail's line (P2.4 PR C): the value its master chose, and Show all, the same address without that filter. */
function Showing({ showing }: { showing: DetailShowing }) {
  return (
    <p className="mb-3 font-mono text-10 uppercase tracking-[0.14em] text-text-muted">
      {`Showing ${showing.value} · `}
      <a href={showing.reset} rel="nofollow" className="underline-offset-4 hover:text-tint hover:underline">
        Show all
      </a>
    </p>
  );
}

/** What the Table and the Cards need to write their links and forms (P2.3): the visited path, this region's key prefix, the
 *  address's whole query (the other regions' states ride along), the bound state, and which controls are on. */
export interface RegionControls {
  href: string;
  key: string;
  others: string;
  state: ViewState;
  sortable: boolean;
  actions: boolean;
  /** The saved views (P2.3 PR B), when the Views menu is on: the Alternatives of this region and the one the address names. */
  views?: { current: string | null; list: { key: string; name: string }[] };
  /** The CSV route's address for the rows as shown (P2.3 PR B), when Download CSV is on. */
  download?: string;
}

/** The highlight rules of a region (P2.4; APEX: an Interactive Report's Highlight): the first rule a row meets styles it; with
 *  `followed`, every row carries its series for the tint the browser adds after the page loads (FollowedRows). */
export type HighlightStyle = 'brand' | 'emphasis' | 'muted';
export interface RowHighlight {
  rules: { filter: ViewFilter; style: HighlightStyle }[];
  followed: boolean;
}
const STYLE_CLASS: Record<HighlightStyle, string> = { brand: 'text-brand font-bold', emphasis: 'bg-surface-elevated font-semibold', muted: 'text-text-faint' };
/** The class of the first rule a row meets; undefined for none, so an element without a class today keeps none. */
const rowClass = (h: RowHighlight | undefined, shape: Shape, row: PresetRow): string | undefined => {
  const hit = h?.rules.find(r => rowPasses(row, r.filter, shape.columns));
  return hit ? STYLE_CLASS[hit.style] : undefined;
};
/** A class list without a trailing space when the highlight adds nothing: today's markup byte for byte. */
const join = (...parts: (string | undefined)[]): string => parts.filter(Boolean).join(' ');
/** The row's series for the followed-series tint; undefined without the toggle or a series on the row. */
const seriesOf = (h: RowHighlight | undefined, row: PresetRow): string | undefined => (h?.followed && text(row.series) ? text(row.series) : undefined);

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

export function DataRegionTable({ heading, level, shape, preset, rows, controls, highlight, region, master, showing }: DataRegionViewProps) {
  const H = level;
  const columns = tableColumns(shape, preset, rows, controls?.state.cols);
  const leader = leaderPoints(rows);
  return (
    <section className="border-y border-border py-4">
      <H className={HEADING}>{heading}</H>
      {controls && (controls.actions || controls.views || controls.download) && <DataRegionControls controls={controls} shape={shape} shown={columns} nameLabel={preset.nameLabel} sortLinks={false} />}
      {highlight?.followed && region && <FollowedRows region={region} />}
      {showing && <Showing showing={showing} />}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{heading}</caption>
          <thead>
            <tr className="border-b border-border font-mono text-10 uppercase tracking-[0.14em] text-text-faint">
              {master && (
                <th scope="col" className="py-2 pr-3 font-normal">
                  <span className="sr-only">Show</span>
                </th>
              )}
              {columns.map(c => {
                const label = c.type === 'percent' ? <span className="sr-only">{c.label}</span> : c.label;
                // A sortable heading (P2.3) is a link toggling its column ascending → descending → as designed; the sorted one says so.
                const sorted = controls?.state.sort?.column === c.key ? controls.state.sort : undefined;
                const link = controls?.sortable === true && sortable(c);
                return (
                  <th key={c.key} scope="col" {...(sorted ? { 'aria-sort': sorted.desc ? ('descending' as const) : ('ascending' as const) } : {})} className={`py-2 font-normal ${c.type === 'position' ? 'w-10 pr-3 text-right' : RIGHT.has(c.type) ? 'pl-3 text-right' : 'pr-3 text-left'}${c.type === 'percent' ? ' w-24' : ''}`}>
                    {link && controls ? (
                      <a href={sortHref(controls.href, controls.state, c.key, controls.key, controls.others)} rel="nofollow" className="underline-offset-4 hover:text-tint hover:underline">
                        {label}
                        {sorted && <span aria-hidden="true">{sorted.desc ? ' ▼' : ' ▲'}</span>}
                      </a>
                    ) : (
                      label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((r, i) => (
              <tr key={`${text(r.position)}-${text(r.name)}-${i}`} className={rowClass(highlight, shape, r)} data-series={seriesOf(highlight, r)}>
                {master && (
                  <td className="py-2 pr-3 align-baseline">
                    <SelectLink master={master} row={r} />
                  </td>
                )}
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

/** APEX Cards' Grid layout: the slots the renderer resolved (the shape's own mapping by default), the Media as the picture of
 *  an image column (P2.24 A) or the initials of its column's text (APEX Icon Initials), and the action zones. Full Card set
 *  and resolved for a row makes that card one link named after its title, and its other zones stand down: no link inside a
 *  link. A zone that resolves to nothing for a row draws that part plain. */
export function DataRegionCards({ heading, level, shape, preset, rows, card, actions, controls, highlight, region, master, showing }: DataRegionViewProps) {
  const H = level;
  const slot: CardSlots = card ?? { ...shape.card, media: shape.card.media ?? '' };
  const act = actions ?? NO_ACTIONS;
  const picture = shape.columns.find(c => c.key === slot.media)?.type === 'image';
  return (
    <section className="border-y border-border py-4">
      <H className={HEADING}>{heading}</H>
      {controls && (controls.actions || controls.views || controls.download) && <DataRegionControls controls={controls} shape={shape} shown={shape.columns} nameLabel={preset.nameLabel} sortLinks />}
      {highlight?.followed && region && <FollowedRows region={region} />}
      {showing && <Showing showing={showing} />}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r, i) => {
          const title = slotText(shape, r, slot.title);
          const subtitle = slot.subtitle ? slotText(shape, r, slot.subtitle) : '';
          const full = act.fullCard(r);
          const zone = (z: Zone) => (full ? null : z(r));
          const button = zone(act.button);
          const media = text(r[slot.media]);
          const body = (
            <>
              <div className="flex items-baseline justify-between gap-3">
                {/* The leader's colour belongs to the position; a badge from another column (the wins, the car) is plain. */}
                <span className={`font-mono text-11 tabular-nums ${slot.badge === 'position' && r.position === 1 ? 'text-brand font-bold' : 'text-text-faint'}`}>{slotText(shape, r, slot.badge)}</span>
                <span className="font-mono text-13 font-semibold tabular-nums text-numeral">{slotText(shape, r, slot.body)}</span>
              </div>
              <div className="mt-1 flex items-start gap-3">
                {slot.media ? (
                  <Zoned to={zone(act.media)} label={title}>
                    <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center bg-surface font-mono text-11 font-semibold tracking-[0.08em] text-text-muted">
                      {/* A picture column draws its picture, an empty box without one; any other column its initials. */}
                      {picture ? (
                        media ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={media} alt="" width={1200} height={750} className="h-9 w-9 object-cover" />
                        ) : null
                      ) : (
                        initials(media)
                      )}
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
            <li key={`${text(r.position)}-${title}-${i}`} className={join('border border-border bg-surface/40 p-4', rowClass(highlight, shape, r))} data-series={seriesOf(highlight, r)}>
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
              {master && (
                <div className="mt-3">
                  <SelectLink master={master} row={r} />
                </div>
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
export function ContentRow({ shape, row, highlight }: { shape: Shape; row: PresetRow; highlight?: RowHighlight }) {
  const who = whoOf(shape, row);
  const line = shape.key === 'race-rows' ? text(row.team) : `${text(row.team)}${text(row.vehicle) ? ` · ${text(row.vehicle)}` : ''}`;
  const right = shape.key === 'race-rows' ? text(row.time) || text(row.status) : shape.key === 'car-rows' ? text(row.gap) || text(row.status) : text(row.gap) || text(row.time);
  return (
    <li className={join('flex items-baseline gap-3 py-2 break-inside-avoid', rowClass(highlight, shape, row))} data-series={seriesOf(highlight, row)}>
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
function RoundGroup({ shape, entries, highlight, master }: { shape: Shape; entries: readonly PresetRow[]; highlight?: RowHighlight; master?: MasterSelect }) {
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
      {/* Master-detail (P2.4 PR C): in a season list the race is the row, so its fold carries the Show link, its first entry's value. */}
      {master && <SelectLink master={master} row={first} />}
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
          <ContentRow key={`${text(e.position)}-${text(e.driver)}-${text(e.car)}-${i}`} shape={shape} row={e} highlight={highlight} />
        ))}
      </ul>
    </details>
  );
}

export function DataRegionList({ heading, level, shape, rows, highlight, region, master, showing }: DataRegionViewProps) {
  const H = level;
  if (shape.source !== 'results') {
    // A standings shape's compact list: the position, the name, the points; a shape without them (the posts, the headlines;
    // P2.24 A) its card's badge, title and body, a date as the site's.
    const { badge, title, body } = shape.card;
    return (
      <section className="border-y border-border py-4">
        <H className={HEADING}>{heading}</H>
        {highlight?.followed && region && <FollowedRows region={region} />}
        {showing && <Showing showing={showing} />}
        <ul className="divide-y divide-border/60">
          {rows.map((r, i) => (
            <li key={`${slotText(shape, r, badge)}-${slotText(shape, r, title)}-${i}`} className={join('flex items-baseline gap-3 py-2', rowClass(highlight, shape, r))} data-series={seriesOf(highlight, r)}>
              {master && <SelectLink master={master} row={r} />}
              <span className={`w-6 text-right font-mono text-sm tabular-nums ${badge === 'position' && r.position === 1 ? 'text-brand font-bold' : 'text-text-faint'}`}>{slotText(shape, r, badge)}</span>
              <span className="min-w-0 flex-1 truncate font-condensed text-15 font-semibold text-text">{slotText(shape, r, title)}</span>
              <span className="w-10 text-right font-mono text-13 font-semibold tabular-nums text-numeral">{slotText(shape, r, body)}</span>
            </li>
          ))}
        </ul>
      </section>
    );
  }
  return (
    <section className="border-y border-border py-4">
      <H className={HEADING}>{heading}</H>
      {highlight?.followed && region && <FollowedRows region={region} />}
      {showing && <Showing showing={showing} />}
      <ul className="divide-y divide-border/60">
        {[...groupRows(shape, rows).entries()].map(([k, entries]) => (
          <li key={k} className="py-1">
            <RoundGroup shape={shape} entries={entries} highlight={highlight} master={master} />
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
  // The who heads the block, so its column leaves the pairs: the name, the driver, a post's title (the card's title column).
  const whoKey = shape.card.title;
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

/** The site's section rule (components/HomeLead.tsx SectionRule, copied for The wire): the label, and words at the right. */
function SectionRule({ label, right }: { label: string; right?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between border-b border-text pb-1">
      <span className="font-mono text-10 font-semibold uppercase tracking-[0.18em] text-text-muted">{label}</span>
      {right !== undefined && <span className="font-mono text-10 uppercase tracking-[0.14em] text-text-faint">{right}</span>}
    </div>
  );
}

/** Home's Lead story (components/HomeLead.tsx HomeLeadStory) as the template of the posts source (P2.24 A): the first row
 *  leads, its cover a redundant link (the typographic panel with the series' name, or Paddock, without one), the eyebrow
 *  (the region's heading, the age, the series' bar and name, the read time), the title at the region's heading level, the
 *  summary, the button; the rows that follow are More reading, with a thumbnail where a cover exists. Nothing without rows.
 *  Home's markup verbatim, so the flip (PR C) serves the same HTML; the links are the row's link column. */
export function DataRegionLeadStory({ heading, level, rows, now }: DataRegionViewProps) {
  const lead = rows[0];
  if (!lead) return null;
  const H = level;
  const href = text(lead.link);
  const cover = text(lead.hero);
  const seriesName = text(lead.seriesName);
  const colour = text(lead.colour);
  const age = ageOf(lead.published, now);
  const minutes = num(lead.minutes);
  const more = rows.slice(1);
  return (
    <section aria-label="Latest from the blog" className="border-[1.5px] border-text bg-surface-elevated shadow-lg">
      <div className="grid lg:grid-cols-[minmax(0,46%)_1fr]">
        {/* Redundant link: aria-hidden + tabIndex -1 so the picture stays clickable for a mouse without announcing a duplicate
            of the headline link beside it. */}
        <Link href={href} aria-hidden="true" tabIndex={-1} className="block border-b-[1.5px] border-text lg:border-b-0 lg:border-r-[1.5px]">
          {cover ? (
            // 8/5 = 1.6:1, the operator's call: tall and dominant rather than a letterbox; width/height carry the same ratio so
            // the reserved box matches the CSS one and nothing shifts before Tailwind lands; object-cover crops the source.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" width={1200} height={750} fetchPriority="high" className="aspect-[8/5] h-full w-full object-cover" />
          ) : (
            // No cover: a typographic panel rather than a broken box.
            <span className="flex aspect-[8/5] items-end bg-surface p-4">
              <span className="font-mono text-28 font-bold uppercase leading-none tracking-[-0.02em] text-text-faint lg:text-38">{seriesName || 'Paddock'}</span>
            </span>
          )}
        </Link>
        {/* Vertically centred from lg up, where the grid is two columns and the image's 8/5 ratio drives the row height. */}
        <div className="flex min-w-0 flex-col p-[18px] lg:justify-center lg:p-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-10 font-bold uppercase tracking-[0.2em] text-brand">{heading}</span>
            {age && <span className="font-mono text-10 uppercase tracking-[0.16em] text-text-faint">{age}</span>}
            {seriesName && (
              <>
                <span aria-hidden="true" className="h-3.5 w-[3px] shrink-0" style={{ backgroundColor: colour || undefined }} />
                <span className="font-mono text-10 font-semibold uppercase tracking-[0.16em]" style={{ color: colour ? seriesInk(colour) : undefined }}>
                  {seriesName}
                </span>
              </>
            )}
            {minutes !== null && <span className="font-mono text-10 uppercase tracking-[0.16em] text-text-faint">{minutes} min read</span>}
          </div>
          {/* Fluid type, not breakpoint steps: the page has no max width; the ch-based measure rides the font-size. */}
          <H className="mt-3 font-serif text-[clamp(30px,2.7vw,72px)] font-semibold leading-[1.06] text-text lg:max-w-[20ch]">
            <Link href={href} className="decoration-2 underline-offset-4 hover:underline">
              {text(lead.title)}
            </Link>
          </H>
          <p className="mt-3 line-clamp-3 font-serif text-[clamp(17px,0.85vw,22px)] leading-snug text-text-muted lg:max-w-[56ch]">{text(lead.summary)}</p>
          <Link href={href} className="mt-5 inline-flex min-h-11 items-center self-start bg-text px-5 font-mono text-11 font-semibold uppercase tracking-[0.14em] text-bg transition-colors duration-(--duration-fast) hover:bg-text-muted">
            Read the story →
          </Link>
          {/* Further reading fills the space the 8/5 cover leaves beside it; xl and up only, below that the column is full. */}
          {more.length > 0 && (
            <div className="mt-8 hidden border-t border-border pt-4 xl:block">
              <span className="block font-mono text-10 font-semibold uppercase tracking-[0.18em] text-text-muted">More reading</span>
              <ul className="mt-2">
                {more.map((s, i) => (
                  <li key={`${text(s.slug)}-${i}`}>
                    {/* The thumbnail is deliberately small beside the band's own cover; no cover, no thumbnail and the title spans the row. */}
                    <Link href={text(s.link)} className="flex items-center gap-3 border-b border-border py-2 font-serif text-16 font-semibold leading-snug text-text-muted transition-colors duration-(--duration-fast) last:border-b-0 hover:text-text">
                      {text(s.hero) && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={text(s.hero)} alt="" width={1200} height={630} className="aspect-[1200/630] w-[104px] shrink-0 border border-border bg-surface object-cover" />
                      )}
                      <span className="min-w-0 flex-1">{text(s.title)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** Home's wire (components/HomeLead.tsx HomeWire) as the template of the news source (P2.24 A): the section named by the
 *  region's heading, the rule with Home's words, each headline an external link with the series' colour bar, "Series · source"
 *  (the source alone for a series the reader did not know) and its age. Nothing without rows. Home's markup verbatim, for the
 *  flip's parity. */
export function DataRegionWire({ heading, rows, now }: DataRegionViewProps) {
  if (rows.length === 0) return null;
  return (
    <section aria-label={heading}>
      <SectionRule label={heading} right="Reported elsewhere · linked out" />
      <ul>
        {rows.map((r, i) => {
          const seriesName = text(r.seriesName);
          const source = text(r.source);
          return (
            <li key={`${text(r.link)}-${i}`}>
              <a href={text(r.link)} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-baseline gap-3 border-b border-border py-2 transition-colors duration-(--duration-fast) hover:bg-surface">
                <span aria-hidden="true" className="relative top-[2px] h-3.5 w-[3px] shrink-0 self-start" style={{ backgroundColor: text(r.colour) || undefined }} />
                <span className="min-w-0 flex-1">
                  <span className="block font-serif text-16 font-semibold leading-snug text-text">{text(r.title)}</span>
                  <span className="block font-mono text-10 uppercase tracking-[0.14em] text-text-faint">{seriesName ? `${seriesName} · ${source}` : source}</span>
                </span>
                <span className="shrink-0 font-mono text-11 tabular-nums text-text-faint">{ageOf(r.published, now)}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Home's What's next (components/HomeLead.tsx HomeWhatsNext) as the template of the weekends source (P2.24 B1): the section
 *  named by the region's heading, the rule with Home's words (the series' name in place of All series when the Source names one,
 *  R8), each weekend a link to its page with the series' bar, the title and the series' name; the first row still to start at the
 *  render's instant carries the countdown (the client component Home's piece uses), every other its dates. Nothing without rows.
 *  Home's markup verbatim, for the flip's parity. */
export function DataRegionComingWeekends({ heading, rows, now, series }: DataRegionViewProps) {
  if (rows.length === 0) return null;
  const at = (now ?? new Date()).getTime();
  // Every row a named Source read is that series', so the first row's name is the Source's.
  const right = series ? text(rows[0].seriesName) || series : 'All series';
  return (
    <section aria-label={heading} className="min-w-0">
      <SectionRule label={heading} right={right} />
      <ul>
        {rows.map((r, i) => {
          const start = typeof r.start === 'string' && r.start ? new Date(r.start) : null;
          const target = i === 0 && start && !Number.isNaN(start.getTime()) && start.getTime() > at ? start.toISOString() : null;
          const colour = text(r.colour) || undefined;
          return (
            <li key={`${text(r.series)}-${text(r.weekend)}`}>
              <Link href={text(r.weekend)} className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border py-2 transition-colors duration-(--duration-fast) hover:bg-surface">
                <span aria-hidden="true" className="h-3.5 w-[3px] shrink-0" style={{ backgroundColor: colour }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-serif text-16 font-semibold leading-tight text-text">{text(r.title)}</span>
                  <span className="block font-mono text-10 uppercase tracking-[0.14em] text-text-faint">{text(r.seriesName)}</span>
                </span>
                {target ? <NextRaceCountdown target={target} label={text(r.dates)} color={colour} /> : <span className="shrink-0 font-mono text-11 uppercase tracking-[0.12em] text-text-muted">{text(r.dates)}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Home's headline for a result (components/HomeLead.tsx headlineFor, copied for the Podium): no article before a round or a rally. */
function headlineFor(winner: string, raceName: string): string {
  const article = /^(round|rally|rallye)\b/i.test(raceName) ? '' : 'the ';
  return `${winner} wins ${article}${raceName}`;
}

/** A results row as Home's podium entry (lib/home-results.ts PodiumEntry): a sportscar entry (a car number) is named by its
 *  team, its crew the detail and the timing gap its time; a flat entry by its driver, the team the detail, its time as the
 *  feed carries it. */
function podiumEntry(row: PresetRow): { name: string; detail?: string; time?: string } {
  if (text(row.car)) return { name: text(row.team) || text(row.driver) || `Car #${text(row.car)}`, detail: text(row.driver) || `#${text(row.car)}`, time: text(row.gap) || undefined };
  return { name: text(row.driver), detail: text(row.team) || undefined, time: text(row.time) || undefined };
}

/** Home's Latest result (components/HomeLead.tsx HomeLatestResult) as the template of the results source (P2.24 B2): the rows
 *  are the newest race's podium (the preset's rule), the series' facts on each; the section is named by the region's heading;
 *  the headline is the page's h1 when the region is first, an h2 a size down otherwise (Home's compact, a lead above); the
 *  winning margin is second's time when it reads as a gap, else the winner's detail; champion mode when the season is complete
 *  and the champion known. Nothing without a winner. Home's markup verbatim, for the flip's parity; the report link is the row's
 *  weekend column, none when the round has no page (a link column, never a typed address). */
export function DataRegionPodium({ heading, level, rows }: DataRegionViewProps) {
  const winner = rows.find(r => r.position === 1);
  const first = rows[0];
  if (!winner || !first) return null;
  const win = podiumEntry(winner);
  const second = rows.find(r => r.position === 2);
  const secondTime = second ? podiumEntry(second).time : undefined;
  // Only a value that reads as a gap is a margin (winner rows carry total time; some feeds carry status strings instead).
  const margin = secondTime && secondTime.startsWith('+') ? secondTime : undefined;
  const seriesName = text(first.seriesName);
  const colour = text(first.colour) || undefined;
  const raceName = text(first.race);
  const raceDate = typeof first.date === 'string' && first.date ? new Date(first.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
  const championName = first.final === true && text(first.champion) ? text(first.champion) : null;
  const href = text(first.weekend);
  const compact = level !== 'h1';
  const ResultHeading = level;
  return (
    <section aria-label={heading} className="border-[1.5px] border-text bg-surface-elevated shadow-lg p-[18px] lg:p-5">
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="h-3.5 w-[3px] shrink-0" style={{ backgroundColor: colour }} />
            <span className="font-mono text-10 font-semibold uppercase tracking-[0.16em]" style={{ color: colour ? seriesInk(colour) : undefined }}>
              {seriesName}
            </span>
            <span className="font-mono text-10 uppercase tracking-[0.16em] text-text-faint">
              Round {text(first.round)} · {raceDate}
            </span>
          </div>
          {championName && <p className="mt-3 font-mono text-12 font-bold uppercase tracking-[0.2em] text-brand">Season complete</p>}
          {/* Demoted to h2 and a size down when a lead is above it, so the two headlines do not compete for the same rank. */}
          <ResultHeading className={`${championName ? 'mt-1.5' : 'mt-3'} font-serif font-semibold leading-[1.1] text-text ${compact ? 'text-24 lg:text-30' : 'text-30 lg:text-40'}`}>
            {championName ? `${championName} is ${seriesName} champion` : headlineFor(win.name, raceName)}
          </ResultHeading>
          {championName ? (
            <p className="mt-2 font-serif text-17 leading-snug text-text-muted">
              {headlineFor(win.name, raceName)}
              {margin ? ` — winning margin ${margin}` : ''}.
            </p>
          ) : (
            <p className="mt-2 font-mono text-11 tabular-nums text-text-muted">
              {margin ? (
                <>
                  Winning margin <span className="text-text">{margin}</span>
                </>
              ) : (
                win.detail
              )}
            </p>
          )}
          {href && (
            <Link href={href} className="mt-4 inline-block font-mono text-10 font-semibold uppercase tracking-[0.16em] text-brand hover:underline">
              Full weekend report →
            </Link>
          )}
        </div>
        <div>
          <div className="flex items-baseline justify-between border-b border-text pb-1">
            {/* In champion mode the h1 is about the title, so the podium must name its race itself (operator annotation, 2026-08-20). */}
            <span className="min-w-0 truncate font-mono text-10 font-semibold uppercase tracking-[0.18em] text-text-muted">{championName ? `${raceName} · Classification` : 'Classification'}</span>
          </div>
          <ul>
            {rows.map((r, i) => {
              const entry = podiumEntry(r);
              return (
                <li key={`${text(r.position)}-${i}`} className="flex items-baseline gap-3 border-b border-border py-2">
                  <span className="w-4 shrink-0 text-right font-mono text-11 tabular-nums text-text-faint">{text(r.position)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-serif text-16 font-semibold leading-tight text-text">{entry.name}</span>
                    {entry.detail && <span className="block truncate font-mono text-10 uppercase tracking-[0.12em] text-text-faint">{entry.detail}</span>}
                  </span>
                  {entry.time && <span className="shrink-0 font-mono text-11 tabular-nums text-text-muted">{entry.time}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** Home's What it changed (components/HomeLead.tsx HomeWhatChanged) as the template of the standings source (P2.24 B2): the
 *  rows are the drivers by position (the preset's rule), the leader first; the rule names the region's heading and the series'
 *  championship, final when the season is complete; the headline the leader's lead over the second row (none with one row);
 *  the race winner's row bold with the brand bar, the leader's bar the text colour, the gap column from small screens up.
 *  Nothing without rows. Home's markup verbatim, for the flip's parity; the headline stays an h2, as Home's is. */
export function DataRegionLeader({ heading, rows }: DataRegionViewProps) {
  const leader = rows[0];
  if (!leader) return null;
  const leaderPoints = num(leader.points) ?? 0;
  const secondPoints = rows[1] ? num(rows[1].points) : null;
  const gapToSecond = secondPoints === null ? null : leaderPoints - secondPoints;
  const seasonComplete = leader.final === true;
  const leaderName = text(leader.name);
  return (
    <section aria-label={heading} className="min-w-0">
      <SectionRule label={heading} right={`${text(leader.seriesName)} · ${seasonComplete ? 'Final standings' : "Drivers' championship"}`} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,300px)_1fr]">
        <div>
          <h2 className="font-serif text-22 font-semibold leading-snug text-text lg:text-26">
            {seasonComplete
              ? gapToSecond !== null
                ? `${leaderName} takes the title by ${gapToSecond} ${gapToSecond === 1 ? 'point' : 'points'}`
                : `${leaderName} is champion`
              : gapToSecond !== null
                ? `${leaderName} leads by ${gapToSecond} ${gapToSecond === 1 ? 'point' : 'points'}`
                : `${leaderName} leads the championship`}
          </h2>
        </div>
        <ul>
          {rows.map((row, i) => {
            const points = num(row.points) ?? 0;
            const isWinner = row.winner === true;
            const width = leaderPoints > 0 ? Math.max(2, Math.round((points / leaderPoints) * 100)) : 0;
            return (
              <li key={`${text(row.position)}-${i}`} className="flex items-center gap-3 border-b border-border py-1.5">
                <span className="w-4 shrink-0 text-right font-mono text-11 tabular-nums text-text-faint">{text(row.position)}</span>
                <span className={`w-28 shrink-0 truncate text-sm sm:w-36 ${isWinner ? 'font-semibold text-text' : 'text-text-muted'}`}>{text(row.name)}</span>
                <span aria-hidden="true" className="h-[6px] min-w-0 flex-1 bg-border">
                  <span className={`block h-full ${isWinner ? 'bg-brand' : row.position === 1 ? 'bg-text' : 'bg-border-strong'}`} style={{ width: `${width}%` }} />
                </span>
                <span className="w-10 shrink-0 text-right font-mono text-12 font-semibold tabular-nums text-text">{text(row.points)}</span>
                <span className="hidden w-10 shrink-0 text-right font-mono text-11 tabular-nums text-text-faint sm:block">{row.position === 1 ? '—' : `−${leaderPoints - points}`}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
