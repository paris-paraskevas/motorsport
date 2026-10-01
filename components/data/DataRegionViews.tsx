import { Fragment, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronDown, ExternalLink } from 'lucide-react';
import type { Preset, PresetColumn, PresetRow, Shape } from '@/lib/design/presets';
import { ageLabel } from '@/lib/date';
import { SITE_URL, seriesInk } from '@/lib/site';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbLd } from '@/lib/json-ld';
import type { Crumb, SiblingPage } from '@/lib/design/breadcrumb';
import { HourlyForecastRows } from '@/components/weekend/HourlyForecastRows';
import { weatherLabel, type DayTile, type SessionTile } from '@/lib/weather';
import { NextRaceCountdown } from '@/components/NextRaceCountdown';
import { LocalTime } from '@/components/LocalTime';
import { sortHref, sortable, type ViewFilter, type ViewState } from '@/lib/design/view-state';
import { rowPasses } from '@/lib/design/presets';
import { DataRegionControls } from './DataRegionControls';
import { FollowedRows, FollowedScope } from './FollowedRows';
import { commonsSrcSet, commonsThumb } from '@/lib/commons-thumb';
import { ChartFrame, type ChartData } from './ChartFrame';
import { MapFrame, type MapData } from './MapFrame';
import { countryName } from '@/lib/nationalities';
import { CURRENT_SEASON } from '@/lib/design/sources';

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
      // It names the row it belongs to (R13, the SEO check of 2026-09-27: every image on the home carried an empty alt).
      const src = text(v);
      // eslint-disable-next-line @next/next/no-img-element
      return src ? <img src={commonsThumb(src, 250)} alt={text(row.name ?? row.title ?? row.driver)} width={1200} height={750} loading="lazy" className="h-10 w-16 shrink-0 border border-border bg-surface object-cover" /> : null;
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
  /** The rows the Rows count cut (R18), for a view that says how many more there are: the List's foot. */
  more?: readonly PresetRow[];
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
                          <img src={commonsThumb(media, 120)} alt={title} width={1200} height={750} loading="lazy" className="h-9 w-9 object-cover" />
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

export function DataRegionList({ heading, level, shape, rows, highlight, region, master, showing, more }: DataRegionViewProps) {
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
        {more && more.length > 0 && <MoreFoot shape={shape} more={more} />}
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
  // The cover at the size its box needs (R13 PR C): the 960 bucket, the 500 one for a phone and 1280 for a sharp desktop, the
  // browser choosing by the box's share of the page; a cover on another host is drawn as it is.
  const coverSet = commonsSrcSet(cover, [500, 960, 1280]);
  const seriesName = text(lead.seriesName);
  const colour = text(lead.colour);
  const age = ageOf(lead.published, now);
  const minutes = num(lead.minutes);
  const more = rows.slice(1);
  return (
    <section aria-label="Latest from the blog" className="border-[1.5px] border-text bg-surface-elevated shadow-lg">
      <div className="grid lg:grid-cols-[minmax(0,46%)_1fr]">
        {/* Redundant link: aria-hidden + tabIndex -1 so the picture stays clickable for a mouse without announcing a duplicate
            of the headline link beside it. The cover names its story (R13): the words serve crawlers and image search alone. */}
        <Link href={href} aria-hidden="true" tabIndex={-1} className="block border-b-[1.5px] border-text lg:border-b-0 lg:border-r-[1.5px]">
          {cover ? (
            // 8/5 = 1.6:1, the operator's call: tall and dominant rather than a letterbox; width/height carry the same ratio so
            // the reserved box matches the CSS one and nothing shifts before Tailwind lands; object-cover crops the source.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={commonsThumb(cover, 960)} srcSet={coverSet || undefined} sizes={coverSet ? '(min-width: 1024px) 46vw, 100vw' : undefined} alt={text(lead.title)} width={1200} height={750} fetchPriority="high" className="aspect-[8/5] h-full w-full object-cover" />
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
                    {/* The thumbnail is deliberately small beside the band's own cover; no cover, no thumbnail and the title spans the row.
                        It names its story (R13); a reader hears the title twice, beside the span, the common trade. */}
                    <Link href={text(s.link)} className="flex items-center gap-3 border-b border-border py-2 font-serif text-16 font-semibold leading-snug text-text-muted transition-colors duration-(--duration-fast) last:border-b-0 hover:text-text">
                      {text(s.hero) && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={commonsThumb(text(s.hero), 250)} alt={text(s.title)} width={1200} height={630} loading="lazy" className="aspect-[1200/630] w-[104px] shrink-0 border border-border bg-surface object-cover" />
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

/** The News page's list as the template of the news source (P2.5 PR C; the route file's rows, moved as they were): the section
 *  named by the region's heading, drawn without a rule or a heading of its own (the page's heading stands above it); the reader's
 *  Everything and Yours only chips while they follow series (FollowedScope, in the browser after the page loads; the rows carry
 *  their series for it); two columns from md, each headline an external link with the series' colour bar, the title at h2 as the
 *  route drew it, "Series · source" (the source alone for a series the reader did not know) and its age. Without rows, the
 *  route's box: linked out to the source. */
export function DataRegionHeadlines({ heading, rows, now, region }: DataRegionViewProps) {
  return (
    <section aria-label={heading}>
      {region && <FollowedScope region={region} />}
      {rows.length === 0 ? (
        <div className="border border-border bg-surface/40 p-6 text-center md:p-8">
          <div className="mb-1 text-base font-medium text-text">No stories</div>
          <div className="mx-auto mb-5 max-w-xs text-sm text-text-faint">Latest stories are unavailable right now.</div>
          <a
            href="https://www.motorsport.com/"
            target="_blank"
            rel="nofollow noopener noreferrer"
            className="inline-flex items-center gap-1.5 border border-border px-3 py-1.5 font-mono text-xs font-medium text-text-muted transition-colors duration-(--duration-fast) hover:border-border-strong hover:text-text"
          >
            Visit official site
            <ExternalLink size={12} />
          </a>
        </div>
      ) : (
        <div className="border-t border-text md:columns-2 md:gap-10">
          {rows.map((r, i) => {
            const seriesName = text(r.seriesName);
            const source = text(r.source);
            const published = text(r.published);
            return (
              <a
                key={`${text(r.link)}-${i}`}
                href={text(r.link)}
                target="_blank"
                rel="nofollow noopener noreferrer"
                data-series={text(r.series) || undefined}
                className="group flex items-baseline gap-3 border-b border-border py-2.5 transition-colors duration-(--duration-fast) hover:bg-surface md:break-inside-avoid"
              >
                <span aria-hidden="true" className="relative top-[2px] h-3.5 w-[3px] shrink-0 self-start" style={{ backgroundColor: text(r.colour) || undefined }} />
                <span className="min-w-0 flex-1">
                  <h2 className="font-serif text-17 font-semibold leading-snug text-text group-hover:underline">{text(r.title)}</h2>
                  <span className="mt-0.5 block font-mono text-9 uppercase tracking-[0.12em] text-text-faint">{seriesName ? `${seriesName} · ${source}` : source}</span>
                </span>
                {published && (
                  <time dateTime={published} className="shrink-0 font-mono text-10 tabular-nums text-text-faint">
                    {ageOf(r.published, now)}
                  </time>
                )}
              </a>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** A Metric card (P2.7): the figure's label, whether it is a column's value or the count of rows, the columns of the value, the
 *  description and the trend, and the rule naming its row (the first without one). */
export interface MetricCard {
  label: string;
  figure: 'value' | 'count';
  value: string;
  description: string;
  trend: string;
  row?: ViewFilter;
}

/** Metric cards (P2.7; APEX 26.1's Metric Card theme component, "a single key value alongside a label and supporting details"):
 *  a card per figure over the preset's rows, the figure a column of the first row or of the first row its rule names, drawn as the
 *  Table draws the type (a share as its whole percent, since the Table's bar carries no words; a link column as its words alone,
 *  since a card carries no link in this slot), a dash where no row passes; the
 *  description beneath as the column reads, a number with its column's label in lower case (302 pts); the trend's sign and size
 *  after the figure, a reader hearing up, down or level; the
 *  count of the preset's rows for a count card; a name column's default label the preset's own (Driver, Co-Driver, Constructor).
 *  The site's box for each, the columns per row from md; the rule above when a heading is set, its words the page's h1 when the
 *  region is the first showing in the Body. */
export function DataRegionMetrics({ heading, level, shape, nameLabel, rows, cards, columns }: { heading: string; level: 'h1' | 'h2'; shape: Shape; nameLabel: string; rows: readonly PresetRow[]; cards: readonly MetricCard[]; columns: number }) {
  const leader = leaderPoints(rows);
  const column = (key: string) => shape.columns.find(c => c.key === key);
  const figureOf = (col: PresetColumn, row: PresetRow): ReactNode => {
    if (col.type === 'percent') {
      const share = shareOf(row, leader);
      return share === null ? '—' : `${share}%`;
    }
    if (col.type === 'link') return text(row[col.key]) || '—';
    const drawn = cellValue(col, row, leader);
    return drawn === '' || drawn === null || drawn === undefined ? '—' : drawn;
  };
  const grid = columns === 2 ? 'md:grid-cols-2' : columns === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3';
  return (
    <section aria-label={heading || 'Metrics'}>
      {heading &&
        (level === 'h1' ? (
          <div className="mb-3 flex items-baseline justify-between border-b border-text pb-1">
            <h1 className="font-mono text-10 font-semibold uppercase tracking-[0.18em] text-text-muted">{heading}</h1>
          </div>
        ) : (
          <SectionRule label={heading} />
        ))}
      <div className={`grid gap-3 ${grid}`}>
        {cards.map((c, i) => {
          const row = c.row ? rows.find(r => rowPasses(r, c.row!, shape.columns)) : rows[0];
          const col = c.figure === 'value' ? column(c.value) : undefined;
          const label = c.label || (c.figure === 'count' ? 'Rows' : col?.key === 'name' ? nameLabel : (col?.label ?? c.value));
          const figure: ReactNode = c.figure === 'count' ? rows.length : row && col ? figureOf(col, row) : '—';
          const description = c.description && row ? column(c.description) : undefined;
          const trend = c.trend && row ? num(row[c.trend]) : null;
          return (
            <div key={`${c.figure}-${c.value}-${i}`} className="border-[1.5px] border-text bg-surface-elevated p-4 shadow-lg">
              <span className="block font-mono text-10 font-semibold uppercase tracking-[0.18em] text-text-muted">{label}</span>
              <span className="mt-1 flex flex-wrap items-baseline gap-x-2">
                <span className="font-serif text-30 font-semibold leading-none tabular-nums text-text md:text-36">{figure}</span>
                {trend !== null && (
                  <span className="font-mono text-12 tabular-nums text-text-faint">
                    <span aria-hidden="true">{trend > 0 ? '▲' : trend < 0 ? '▼' : '—'}</span>
                    <span className="sr-only">{trend > 0 ? 'up' : trend < 0 ? 'down' : 'level'}</span> {Math.abs(trend)}
                  </span>
                )}
              </span>
              {description && row && (
                <span className="mt-1 block font-mono text-11 text-text-faint">
                  {figureOf(description, row)}
                  {(description.type === 'number' || description.type === 'gap' || description.type === 'percent') && ` ${description.label.toLowerCase()}`}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** What the Countdown draws (P2.8): the next session as lib/weekend.ts nextSessionAcross found it, its times already
 *  formatted where the server can (the track's, in the circuit's zone), the reader's left to LocalTime on the client. */
export interface CountdownData {
  seriesName: string;
  colour: string;
  round: number;
  weekendTitle: string;
  weekendHref: string;
  dates: string;
  session: { title: string; href: string; startIso: string; endIso: string; venueTime: string | null } | null;
}

/** The Countdown (P2.8; ours: APEX has no countdown component): a box with the series' colour as its rule, the eyebrow
 *  naming the series and the round, the weekend's title and the session's name as links to their pages (words alone with
 *  the links off), one line of times (the reader's through LocalTime, the track's when the circuit's zone is known), and
 *  NextRaceCountdown's digits, which read LIVE between the session's start and end. A weekend whose remaining sessions carry
 *  no clock draws its dates and "times to be confirmed" with no digits; nothing to come draws one line, never a hole. First in
 *  the Body, the heading is the page's h1, or the weekend's title is when there is no heading, so the page never lacks one. */
export function DataRegionCountdown({ heading, level, data, links, every }: { heading: string; level: 'h1' | 'h2'; data: CountdownData | null; links: boolean; every: boolean }) {
  const rule = heading ? (
    level === 'h1' ? (
      <div className="mb-3 flex items-baseline justify-between border-b border-text pb-1">
        <h1 className="font-mono text-10 font-semibold uppercase tracking-[0.18em] text-text-muted">{heading}</h1>
      </div>
    ) : (
      <SectionRule label={heading} />
    )
  ) : null;
  // First in the Body without a heading, the one line is the page's h1 as the weekend's title would be (the reviewer's finding).
  const Empty = level === 'h1' && !heading ? 'h1' : 'p';
  if (!data) {
    return (
      <section aria-label={heading || 'Countdown'}>
        {rule}
        <Empty className="font-serif text-15 italic text-text-muted">{every ? 'No session to come.' : 'Season complete.'}</Empty>
      </section>
    );
  }
  const Title = level === 'h1' && !heading ? 'h1' : 'span';
  const name = (label: string, href: string) => (links ? <Link href={href} className="hover:underline">{label}</Link> : label);
  return (
    <section aria-label={heading || 'Countdown'}>
      {rule}
      {/* The site's box (Metric cards, This weekend): the outline and the shadow; the series' colour as the eyebrow's bar. */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-[1.5px] border-text bg-surface-elevated p-4 shadow-lg">
        <div className="min-w-0">
          <span className="flex items-center gap-2 font-mono text-10 font-semibold uppercase tracking-[0.18em] text-text-muted">
            <span aria-hidden="true" className="h-3.5 w-[3px] shrink-0" style={{ backgroundColor: data.colour }} />
            {data.seriesName} · Round {data.round}
          </span>
          <Title className="mt-1 block font-serif text-22 font-semibold leading-tight text-text md:text-26">{name(data.weekendTitle, data.weekendHref)}</Title>
          {data.session ? (
            <>
              <span className="mt-1 block font-serif text-17 font-semibold leading-tight text-text">{name(data.session.title, data.session.href)}</span>
              <span className="mt-1 block font-mono text-12 text-text-muted">
                <LocalTime instant={Date.parse(data.session.startIso)} />
                {data.session.venueTime && ` · ${data.session.venueTime} at the track`}
              </span>
            </>
          ) : (
            <span className="mt-1 block font-mono text-12 text-text-muted">{data.dates} · times to be confirmed</span>
          )}
        </div>
        {data.session && <NextRaceCountdown target={data.session.startIso} label={data.dates} color={data.colour} liveUntil={data.session.endIso} />}
      </div>
    </section>
  );
}

export interface WeatherData {
  seriesName: string;
  colour: string;
  round: number;
  weekendTitle: string;
  circuitName: string;
  view: 'sessions' | 'daily';
  sessions: readonly SessionTile[];
  days: readonly DayTile[];
}

/** The Weather (P2.14): the forecast at the track for a weekend as the weekend strip draws it, a tile per session with the
 *  hours it runs in, or a tile per venue-local day with the day's forecast and the sessions of the day under it, each with the
 *  reading of its hour. The eyebrow names the series, the round and the weekend (the page's h1 when first in the Body without
 *  a heading); the foot names the source and the circuit. Without a forecast one line, never a hole. */
export function DataRegionWeather({ heading, level, data, every, weekendTitle }: { heading: string; level: 'h1' | 'h2'; data: WeatherData | null; every: boolean; weekendTitle: string | null }) {
  const words = data?.view === 'daily' ? 'Weather by day' : 'Weather by session';
  const rule =
    heading && level === 'h1' ? (
      <div className="mb-3 flex items-baseline justify-between border-b border-text pb-1">
        <h1 className="font-mono text-10 font-semibold uppercase tracking-[0.18em] text-text-muted">{heading}</h1>
      </div>
    ) : (
      <SectionRule label={heading || words} right={data ? 'venue-local time' : undefined} />
    );
  const Title = level === 'h1' && !heading ? 'h1' : 'p';
  if (!data) {
    return (
      <section aria-label={heading || 'Weather'}>
        {rule}
        <Title className="font-serif text-15 italic text-text-muted">{weekendTitle ? `No forecast for ${weekendTitle} yet.` : every ? 'No weekend to come.' : 'Season complete.'}</Title>
      </section>
    );
  }
  const wet = (p: number) => (p >= 30 ? 'text-sky-700 dark:text-sky-300' : 'text-text-faint');
  return (
    <section aria-label={heading || 'Weather'}>
      {rule}
      <div className="mb-3 flex items-center gap-2">
        <span aria-hidden="true" className="h-3.5 w-[3px] shrink-0" style={{ backgroundColor: data.colour }} />
        <Title className="font-mono text-10 font-semibold uppercase tracking-[0.18em] text-text-muted">
          {data.seriesName} · Round {data.round} · {data.weekendTitle}
        </Title>
      </div>
      {data.view === 'sessions' ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.sessions.map(tile => (
            <div key={tile.key} className="border border-border p-3">
              <div className="font-mono text-11 font-semibold uppercase tracking-[0.12em] text-text">{tile.label}</div>
              <div className="mt-0.5 font-mono text-10 uppercase tracking-[0.1em] text-text-faint">{tile.when}</div>
              {tile.hours.length > 0 ? (
                <HourlyForecastRows hours={[...tile.hours]} className="mt-2" />
              ) : (
                tile.day && (
                  <div className="mt-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl" aria-hidden="true">{weatherLabel(tile.day.weatherCode).emoji}</span>
                      <span className="font-mono text-base font-semibold tabular-nums text-text">{Math.round(tile.day.maxC)}°</span>
                      <span className="font-mono text-sm tabular-nums text-text-faint">{Math.round(tile.day.minC)}°</span>
                    </div>
                    <div className="mt-1 truncate text-xs text-text-muted">{weatherLabel(tile.day.weatherCode).label}</div>
                    {tile.day.precipProb >= 30 && <div className={`mt-1 font-mono text-11 tabular-nums ${wet(tile.day.precipProb)}`}>{Math.round(tile.day.precipProb)}% rain</div>}
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.days.map(day => (
            <div key={day.date} data-day={day.date} className="border border-border p-3">
              <div className="font-mono text-11 font-semibold uppercase tracking-[0.12em] text-text">{day.label}</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-xl" aria-hidden="true">{weatherLabel(day.daily.weatherCode).emoji}</span>
                <span className="font-mono text-base font-semibold tabular-nums text-text">{Math.round(day.daily.maxC)}°</span>
                <span className="font-mono text-sm tabular-nums text-text-faint">{Math.round(day.daily.minC)}°</span>
                <span className={`font-mono text-11 tabular-nums ${wet(day.daily.precipProb)}`}>{Math.round(day.daily.precipProb)}%</span>
              </div>
              <div className="mt-1 truncate text-xs text-text-muted">{weatherLabel(day.daily.weatherCode).label}</div>
              <ul className="mt-2">
                {day.sessions.map(s => (
                  <li key={s.key} className="flex items-baseline gap-2 border-b border-border py-1 last:border-b-0">
                    <span className="min-w-0 truncate font-mono text-11 font-semibold uppercase tracking-[0.12em] text-text">{s.label}</span>
                    <span className="shrink-0 font-mono text-11 tabular-nums text-text-faint">{s.hour ?? 'TBC'}</span>
                    {s.reading && (
                      <>
                        <span className="shrink-0 text-13" aria-hidden="true">{weatherLabel(s.reading.weatherCode).emoji}</span>
                        <span className="shrink-0 font-mono text-12 font-semibold tabular-nums text-text">{Math.round(s.reading.tempC)}°</span>
                        <span className={`shrink-0 font-mono text-11 tabular-nums ${wet(s.reading.precipProb)}`}>{Math.round(s.reading.precipProb)}%</span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 text-10 uppercase tracking-[0.14em] text-text-faint">{`Source: Open-Meteo · ${data.circuitName} · venue-local time`}</div>
    </section>
  );
}

/** One fact of the venue (P2.15): the track page's rows, Country · Type · Length · Turns · Opened. */
export interface CircuitFact {
  label: string;
  value: string;
}
export interface CircuitData {
  seriesName: string;
  colour: string;
  round: number;
  weekendTitle: string;
  /** The circuit's name (content/circuits.json). */
  name: string;
  /** The round's curated venue or the feed's location, as the weekend page prints it; null when neither is known. */
  place: string | null;
  facts: readonly CircuitFact[];
  /** The curated drawing with the credit its licence asks; null where none is curated. */
  layout: { svg: string; source: string; license: string; sourceUrl: string } | null;
  /** The map with its one marker; null when switched off. */
  map: MapData | null;
  /** The circuit guide's page when the hub has one; null otherwise. */
  guide: string | null;
}

/** The Circuit (P2.15; ours by name, the round's venue): the eyebrow as the Weather's (the page's h1 when first in the Body
 *  without a heading), the circuit's name in the rail's serif with the place beneath, the drawing and the map side by side from
 *  md up (stacked on a phone), the facts as the track page's rows, the link to the circuit guide. Without a venue one line, never
 *  a hole. */
export function DataRegionCircuit({ heading, level, data, every, weekendTitle }: { heading: string; level: 'h1' | 'h2'; data: CircuitData | null; every: boolean; weekendTitle: string | null }) {
  const words = 'The venue';
  const rule =
    heading && level === 'h1' ? (
      <div className="mb-3 flex items-baseline justify-between border-b border-text pb-1">
        <h1 className="font-mono text-10 font-semibold uppercase tracking-[0.18em] text-text-muted">{heading}</h1>
      </div>
    ) : (
      <SectionRule label={heading || words} />
    );
  const Title = level === 'h1' && !heading ? 'h1' : 'p';
  if (!data) {
    return (
      <section aria-label={heading || words}>
        {rule}
        <Title className="font-serif text-15 italic text-text-muted">{weekendTitle ? `No venue known for ${weekendTitle} yet.` : every ? 'No weekend to come.' : 'Season complete.'}</Title>
      </section>
    );
  }
  return (
    <section aria-label={heading || words}>
      {rule}
      <div className="mb-2 flex items-center gap-2">
        <span aria-hidden="true" className="h-3.5 w-[3px] shrink-0" style={{ backgroundColor: data.colour }} />
        <Title className="font-mono text-10 font-semibold uppercase tracking-[0.18em] text-text-muted">
          {data.seriesName} · Round {data.round} · {data.weekendTitle}
        </Title>
      </div>
      <p className="font-serif text-17 font-semibold leading-tight text-text">{data.name}</p>
      {data.place !== null && <p className="font-mono text-9 uppercase tracking-[0.12em] text-text-faint">{data.place}</p>}
      {(data.layout || data.map) && (
        <div className={`mt-3 grid gap-4${data.layout && data.map ? ' md:grid-cols-2' : ''}`}>
          {data.layout && (
            <figure className="m-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={data.layout.svg} alt={`${data.name} track layout`} width={500} height={500} className="h-auto w-full max-w-[320px]" />
              <figcaption className="mt-1 font-mono text-8 uppercase tracking-[0.12em] text-text-faint">
                Circuit map ·{' '}
                <a href={data.layout.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-text-muted">
                  {data.layout.source} ({data.layout.license})
                </a>
              </figcaption>
            </figure>
          )}
          {data.map && <MapFrame data={data.map} />}
        </div>
      )}
      {data.facts.length > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {data.facts.map(f => (
            <div key={f.label}>
              <dt className="font-mono text-10 font-semibold uppercase tracking-[0.16em] text-text-faint">{f.label}</dt>
              <dd className="mt-1 font-medium text-text">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {data.guide !== null && (
        <Link href={data.guide} className="mt-3 inline-block font-mono text-9 font-semibold uppercase tracking-[0.14em] text-brand hover:underline">
          Circuit guide →
        </Link>
      )}
    </section>
  );
}

/** The Chart (P2.11; APEX: the Chart region): the heading's rule (the page's h1 when first in the Body, as the Metric cards), the
 *  client frame drawing the plot, its legend and the data as a hidden table, and a foot in the site's eyebrow naming what is
 *  drawn by what and the series highlighted (the team page's own words). Without rows one line, never a hole. */
export function DataRegionChart({ heading, level, data, foot }: { heading: string; level: 'h1' | 'h2'; data: ChartData | null; foot: string }) {
  return (
    <section aria-label={heading}>
      {level === 'h1' ? (
        <div className="mb-3 flex items-baseline justify-between border-b border-text pb-1">
          <h1 className="font-mono text-10 font-semibold uppercase tracking-[0.18em] text-text-muted">{heading}</h1>
        </div>
      ) : (
        <SectionRule label={heading} />
      )}
      {data ? (
        <>
          <ChartFrame data={data} />
          <div className="mt-2 font-mono text-10 uppercase tracking-[0.14em] text-text-faint">{foot}</div>
        </>
      ) : (
        <p className="font-serif text-15 italic text-text-muted">No data yet.</p>
      )}
    </section>
  );
}

/** The Map (P2.12; APEX: the Map region): the heading's rule (the page's h1 when first), the client frame drawing the markers
 *  on the background's tiles with the places as a hidden list of links, and a foot in the site's eyebrow counting the markers
 *  and naming the background. Without a place one line, never a hole. */
export function DataRegionMap({ heading, level, data, foot }: { heading: string; level: 'h1' | 'h2'; data: MapData | null; foot: string }) {
  return (
    <section aria-label={heading}>
      {level === 'h1' ? (
        <div className="mb-3 flex items-baseline justify-between border-b border-text pb-1">
          <h1 className="font-mono text-10 font-semibold uppercase tracking-[0.18em] text-text-muted">{heading}</h1>
        </div>
      ) : (
        <SectionRule label={heading} />
      )}
      {data ? (
        <>
          <MapFrame data={data} />
          <div className="mt-2 font-mono text-10 uppercase tracking-[0.14em] text-text-faint">{foot}</div>
        </>
      ) : (
        <p className="font-serif text-15 italic text-text-muted">No places yet.</p>
      )}
    </section>
  );
}

/** The separators the Breadcrumb offers (P2.17; APEX: the template's Between Level), by the setting's key. */
export const BREADCRUMB_SEPARATORS: Readonly<Record<string, string>> = { chevron: '›', slash: '/', arrow: '→' };

/** The Breadcrumb (P2.17; APEX: the Breadcrumb region): the trail as a nav with a list in the site's eyebrow (the series tab's
 *  back link), the pages above as links, the page itself in words with aria-current, a separator between; the trail's
 *  BreadcrumbList with it unless the page's own code prints one. Fewer than two crumbs draw nothing: no trail to show, and
 *  Google's floor for a BreadcrumbList. */
export function DataRegionBreadcrumb({ crumbs, separator, structured }: { crumbs: readonly Crumb[]; separator: string; structured: boolean }) {
  if (crumbs.length < 2) return null;
  const glyph = BREADCRUMB_SEPARATORS[separator] ?? BREADCRUMB_SEPARATORS.chevron;
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-11 font-semibold uppercase tracking-[0.16em] text-text-muted">
        {crumbs.map((c, i) => (
          <li key={c.href} className="flex items-center gap-x-2">
            {i > 0 && <span aria-hidden="true" className="text-text-faint">{glyph}</span>}
            {c.current ? (
              <span aria-current="page" className="text-text">{c.label}</span>
            ) : (
              <Link href={c.href} className="transition-colors duration-(--duration-fast) hover:text-text">
                {c.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
      {structured && <JsonLd data={breadcrumbLd(crumbs.map(c => ({ name: c.label, url: c.href === '/' ? SITE_URL : `${SITE_URL}${c.href}` })))} />}
    </nav>
  );
}

/** The Tabs over sibling pages (P2.10; ours: the series tabs stay one page per tab, so the strip links them): a nav of links in
 *  the weekend tabs' look, the current page marked. Fewer than two links draw nothing. */
export function DataRegionPageTabs({ pages }: { pages: readonly SiblingPage[] }) {
  if (pages.length < 2) return null;
  return (
    <nav aria-label="Pages" className="mb-5 flex flex-wrap gap-x-5 gap-y-2 border-b border-border font-mono text-11 uppercase tracking-[0.16em]">
      {pages.map(p => (
        <Link
          key={p.href}
          href={p.href}
          aria-current={p.current ? 'page' : undefined}
          className={`-mb-px border-b-2 pb-2 transition-colors duration-(--duration-fast) ${p.current ? 'border-brand text-text' : 'border-transparent text-text-muted hover:text-text'}`}
        >
          {p.label}
        </Link>
      ))}
    </nav>
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
        <div className="min-w-0">
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

/** The List's foot for the rows the Rows count cut (R18): "+ n more"; a title tally names the teams and, when every one of
 *  them holds a single title, says so, as the operator's design does. */
function MoreFoot({ shape, more }: { shape: Shape; more: readonly PresetRow[] }) {
  const n = more.length;
  const words =
    shape.key === 'title-rows'
      ? `+ ${n} more ${n === 1 ? 'team' : 'teams'}${more.every(r => num(r.titles) === 1) ? ` with one title ${n === 1 ? 'more' : 'each'}` : ''}`
      : `+ ${n} more`;
  return <p className="mt-2 font-mono text-11 text-text-faint">{words.replace(' with one title more', ', one title')}</p>;
}

// R18: the champions page's two templates, ours (the operator's Claude Design page of the Formula 2 champions, 2026-10-01):
// the newest season as a card with its tiles, and the seasons by decade as a ruled table from lg and as cards below it,
// over the Champions source's honour-rows shape alone; the site's faces, the Appearance corners (rounded-lg), as the operator
// chose on the 1st ("B"). Every value is text React escapes.
const CHIP_LINK = 'shrink-0 rounded-lg border border-border px-3 py-1 font-mono text-11 font-semibold uppercase tracking-[0.12em] text-text hover:border-brand';
const TILE_LABEL = 'mt-0.5 font-mono text-10 font-semibold uppercase tracking-[0.14em] text-text-faint';
const ordinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};
const linkOr = (href: string, label: string, cls: string) => (href ? <Link href={href} className={cls}>{label}</Link> : <span className={cls}>{label}</span>);

export function DataRegionReigning({ heading, level, rows, series }: DataRegionViewProps) {
  const r = rows[0];
  if (!r) return null;
  const H = level;
  const profile = text(r.profile);
  const team = text(r.team);
  const code = text(r.nationality);
  const country = code ? (countryName(code) ?? code) : '';
  const margin = num(r.margin);
  const runnerUp = text(r.runnerUp);
  const tiles: { value: string; label: string; brand?: true }[] = [];
  if (num(r.points) !== null) tiles.push({ value: text(r.points), label: 'Points' });
  if (num(r.wins) !== null) tiles.push({ value: text(r.wins), label: 'Wins' });
  if (num(r.podiums) !== null) tiles.push({ value: text(r.podiums), label: 'Podiums' });
  if (margin !== null && runnerUp) tiles.push({ value: `+${margin}`, label: `Over ${runnerUp}`, brand: true });
  const teams = text(r.teamsChampion);
  const run = num(r.teamsRun) ?? 0;
  const runWords = run === 2 ? 'a second title in a row' : run === 3 ? 'a third title in a row' : run > 3 ? `${ordinal(run)} title in a row` : null;
  return (
    <section aria-label={heading} className="flex h-full min-w-0 flex-col gap-6 rounded-lg border border-border bg-surface p-5 md:p-7">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-sm bg-brand px-2 py-1 font-mono text-10 font-bold uppercase tracking-[0.14em] text-bg">{heading}</span>
        {num(r.year) !== null && <span className="font-mono text-12 text-text-muted">{text(r.year)} season</span>}
      </div>
      <div>
        <H className="font-serif text-34 font-medium leading-none tracking-[-0.02em] text-text md:text-40">{linkOr(profile, text(r.driver), 'hover:text-brand')}</H>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-15 text-text-muted">
          {country && <span>{country}</span>}
          {team && linkOr(text(r.teamPage), team, 'underline decoration-border underline-offset-4 hover:text-text')}
          {r.rookie === true && <span>Rookie season</span>}
        </div>
      </div>
      {tiles.length > 0 && (
        // The strip holds as many columns as tiles, so a tile left out leaves no hole; on phones two per row, an odd last one the
        // full width. Each tile is its term then its value (dt, dd), the value drawn on top.
        <dl
          className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-[repeat(var(--tiles),minmax(0,1fr))] [&>:last-child:nth-child(odd)]:col-span-2 sm:[&>:last-child:nth-child(odd)]:col-span-1"
          style={{ '--tiles': tiles.length } as CSSProperties}
        >
          {tiles.map(t => (
            <div key={t.label} className="flex flex-col-reverse bg-surface-elevated px-4 py-3">
              <dt className={TILE_LABEL}>{t.label}</dt>
              <dd className={`font-mono text-26 font-semibold tabular-nums ${t.brand ? 'text-brand' : 'text-text'}`}>{t.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {teams && (
        <p className="text-sm text-text-muted">
          Teams’ champion: {linkOr(text(r.teamsChampionPage), teams, 'font-semibold text-text hover:text-brand')}
          {runWords ? `, ${runWords}.` : '.'}
        </p>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-3">
        {profile && (
          <Link href={profile} className="rounded-lg bg-brand px-4 py-2.5 font-mono text-11 font-semibold uppercase tracking-[0.14em] text-bg hover:bg-brand/90">
            Driver profile
          </Link>
        )}
        {series && (
          <Link href={`/series/${series}/standings`} className="rounded-lg border border-border-strong px-4 py-2.5 font-mono text-11 font-semibold uppercase tracking-[0.14em] text-text hover:border-text">
            {CURRENT_SEASON} title race →
          </Link>
        )}
      </div>
    </section>
  );
}

export function DataRegionHonours({ heading, level, rows, region }: DataRegionViewProps) {
  if (rows.length === 0) return null;
  const H = level;
  const prefix = region || 'honours';
  // The decades in the order the rows arrive (newest first), each with its seasons.
  const decades = new Map<string, PresetRow[]>();
  for (const r of rows) {
    const d = text(r.decade) || 'Undated';
    decades.set(d, [...(decades.get(d) ?? []), r]);
  }
  // The era change: the first row whose era differs from the row before it; the rows from it on raced under the older name.
  let eraAt: PresetRow | null = null;
  let eraBefore: PresetRow | null = null;
  for (let i = 1; i < rows.length; i++) {
    if (text(rows[i].era) && text(rows[i].era) !== text(rows[i - 1].era)) {
      eraAt = rows[i];
      eraBefore = rows[i - 1];
      break;
    }
  }
  const olderEra = eraAt ? text(eraAt.era) : '';
  const eraShort = olderEra.replace(/ Series$| Championship$/, '');
  const count = (n: number) => `${n} ${n === 1 ? 'season' : 'seasons'}`;
  const stat = (r: PresetRow) => [num(r.points) !== null ? `${text(r.points)} pts` : null, num(r.wins) !== null ? `${text(r.wins)} ${num(r.wins) === 1 ? 'win' : 'wins'}` : null, num(r.margin) !== null ? `+${text(r.margin)}` : null].filter(Boolean).join(' · ');
  const nth = (r: PresetRow) => (num(r.teamsTitles) !== null ? `${ordinal(num(r.teamsTitles)!)} title` : '');
  const who = (r: PresetRow, cls: string) => linkOr(text(r.profile), text(r.driver), cls);
  const teamOf = (r: PresetRow) => (text(r.teamPage) ? <Link href={text(r.teamPage)} className="hover:text-text">{text(r.team)}</Link> : text(r.team));
  const teamsOf = (r: PresetRow) => (text(r.teamsChampionPage) ? <Link href={text(r.teamsChampionPage)} className="hover:text-text">{text(r.teamsChampion)}</Link> : text(r.teamsChampion));
  // The table from lg (at md the names were cut, the review of the 1st), the cards below it.
  const COLS = 'lg:grid-cols-[3.5rem_minmax(0,1.5fr)_3.75rem_3rem_4rem_minmax(0,1fr)_minmax(0,1.1fr)]';
  const eraRow =
    eraAt && eraBefore ? (
      <div id={`${prefix}-era`} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 bg-surface-elevated px-5 py-3 scroll-mt-28">
        <span className="font-mono text-10 font-bold uppercase tracking-[0.14em] text-brand">Era change</span>
        <span className="text-sm font-semibold text-text">{`${text(eraBefore.year)}: ${olderEra} becomes the ${text(eraBefore.era)}`}</span>
        <span className="text-13 text-text-muted">{`Seasons below raced as ${olderEra}`}</span>
      </div>
    ) : null;
  return (
    <section aria-label={heading} className="min-w-0">
      <H className="sr-only">{heading}</H>
      {/* The Jump-to bar sticks under the fixed header (the tab rail's precedent); the chips scroll inside it, so the bar itself never sits in an overflow box. */}
      <nav aria-label="Jump to" className="sticky top-14 z-20 -mx-4 border-y border-border bg-bg/95 backdrop-blur-xl md:-mx-6 lg:-mx-8">
        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap px-4 py-2 scrollbar-none md:px-6 lg:px-8">
          <span className="mr-1 font-mono text-10 font-semibold uppercase tracking-[0.14em] text-text-faint">Jump to</span>
          {[...decades.keys()].map(d => (
            <a key={d} href={`#${prefix}-${d}`} className={CHIP_LINK}>
              {d}
            </a>
          ))}
          {eraRow && (
            <a href={`#${prefix}-era`} className={CHIP_LINK}>
              {eraShort} era
            </a>
          )}
          <span className="ml-auto pl-3 font-mono text-11 text-text-faint">{count(rows.length)}</span>
        </div>
      </nav>
      {[...decades.entries()].map(([decade, seasons]) => (
        <section key={decade} id={`${prefix}-${decade}`} className="pt-8 scroll-mt-20">
          <div className="mb-3 flex flex-wrap items-baseline gap-3">
            <h3 className="font-serif text-26 font-medium leading-tight text-text">{decade}</h3>
            <span className="font-mono text-11 text-text-faint">{count(seasons.length)}</span>
          </div>
          <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border">
            <div className={`hidden gap-4 bg-surface-elevated px-5 py-2 font-mono text-10 font-semibold uppercase tracking-[0.14em] text-text-faint lg:grid ${COLS}`}>
              <span>Year</span>
              <span>Champion</span>
              <span className="text-right">Pts</span>
              <span className="text-right">Wins</span>
              <span className="text-right">Margin</span>
              <span>Runner-up</span>
              <span>Teams’ champion</span>
            </div>
            {seasons.map(r => (
              <Fragment key={text(r.year)}>
                {eraAt === r && eraRow}
                <div className={`hidden items-center gap-4 bg-surface px-5 py-4 transition-colors duration-(--duration-fast) hover:bg-surface-elevated lg:grid ${COLS}`}>
                  <span className="font-mono text-15 font-semibold tabular-nums text-brand">{text(r.year)}</span>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      {who(r, 'truncate font-serif text-16 font-semibold text-text hover:text-brand')}
                      {text(r.nationality) && <span className="shrink-0 font-mono text-10 text-text-faint">{text(r.nationality)}</span>}
                    </div>
                    <div className="mt-0.5 text-13 text-text-muted">{teamOf(r)}</div>
                  </div>
                  <span className="text-right font-mono text-15 font-semibold tabular-nums text-text">{text(r.points)}</span>
                  <span className="text-right font-mono text-15 tabular-nums text-text">{text(r.wins)}</span>
                  <span className="text-right font-mono text-15 tabular-nums text-text-muted">{num(r.margin) !== null ? `+${text(r.margin)}` : ''}</span>
                  <div className="min-w-0">
                    <div className="truncate text-sm text-text">{text(r.runnerUp)}</div>
                    {num(r.runnerUpPoints) !== null && <div className="mt-0.5 font-mono text-11 text-text-faint">{`${text(r.runnerUpPoints)} pts`}</div>}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm text-text">{teamsOf(r)}</div>
                    {nth(r) && <div className="mt-0.5 font-mono text-11 text-text-faint">{nth(r)}</div>}
                  </div>
                </div>
                <div className="grid gap-3 bg-surface p-4 lg:hidden">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-mono text-15 font-semibold tabular-nums text-brand">{text(r.year)}</span>
                    <span className="font-mono text-11 tabular-nums text-text-muted">{stat(r)}</span>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-baseline gap-2">
                      {who(r, 'font-serif text-18 font-semibold text-text')}
                      {text(r.nationality) && <span className="font-mono text-10 text-text-faint">{text(r.nationality)}</span>}
                    </div>
                    <div className="mt-0.5 text-sm text-text-muted">{teamOf(r)}</div>
                  </div>
                  <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 border-t border-dashed border-border pt-3 text-13">
                    {text(r.runnerUp) && (
                      <>
                        <dt className="font-mono text-10 font-semibold uppercase tracking-[0.12em] text-text-faint">Runner-up</dt>
                        <dd className="text-text">
                          {text(r.runnerUp)}
                          {num(r.runnerUpPoints) !== null && <span className="text-text-faint">{` · ${text(r.runnerUpPoints)} pts`}</span>}
                        </dd>
                      </>
                    )}
                    {text(r.teamsChampion) && (
                      <>
                        <dt className="font-mono text-10 font-semibold uppercase tracking-[0.12em] text-text-faint">Teams’</dt>
                        <dd className="text-text">
                          {teamsOf(r)}
                          {nth(r) && <span className="text-text-faint">{` · ${nth(r)}`}</span>}
                        </dd>
                      </>
                    )}
                  </dl>
                </div>
              </Fragment>
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}
