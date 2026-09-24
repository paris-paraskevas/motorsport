import 'server-only';
import { cache, type ReactNode } from 'react';
import { firstBodyRegion, isLegacyBody, type ComponentRegion, type PageDocument } from './page-document';
import { findComponent, type SettingValue } from './components';
import { parseSourceRef, type SourceRef } from './sources';
import { SHAPES, findPreset, presetRows, rowPasses } from './presets';
import type { SourceProvenance } from './source-read';
import type { PageRow } from './pages';
import { resolveDestination, type PageDestinations } from './destinations';
import type { CardActions, CardSlots, DetailShowing, HighlightStyle, MasterSelect, RegionControls, RowHighlight } from '@/components/data/DataRegionViews';
import { VALUE_MAX, applySavedView, bindViewState, encodeViewState, filterOps, parseRule, parseViewState, viewStateHref, type ViewState } from './view-state';

// The server half of the component catalogue (lib/design/components.ts): how
// each component is drawn. A renderer takes the region's settings and the
// context (which page and address, whether this is the first component in
// the Body, so it carries the page's h1) and answers a node or nothing. Every
// renderer fails soft on its own: a component that throws draws nothing and
// the page stands.
//
// The Live band reads the live model (loadLiveModel, once per request: the
// weekends under way, ranked as Home ranks them); the Calendar component reads
// its family's assembly the same way; the fact the race-weekend conditions
// need comes from the same live model (raceWeekendNow). Home's six components
// left in P2.24 C: the parser upgrades a stored one to its Data-region or
// Live-band equivalent before anything is rendered.
//
// THE IMPORTS ARE DYNAMIC ON PURPOSE. This file is reached from
// page-frame.tsx, which every code route imports; a static import of an
// assembly (the series loader, the content bundle, the news and blog readers)
// would pull that whole graph into every route's chunk and it did: the first
// build of R2b measured 58 MiB against 42 MiB before (the Worker's ceiling is
// 64 MiB). Loaded on demand, a graph is one shared chunk, read only when a
// page actually carries the component.

const home = () => import('@/lib/home-model');
const pieces = () => import('@/components/HomeLead');
const calendar = () => import('./families/calendar');
const calendarView = () => import('@/components/calendar/CalendarView');
const sourceRead = () => import('./source-read');
const dataViews = () => import('@/components/data/DataRegionViews');
const savedViews = () => import('./views');

export interface RenderContext {
  /** The registry pattern or literal path of the page. */
  path: string;
  /** The address's parts for a pattern page (`slug`, `round`); empty for a literal one. */
  params: Readonly<Record<string, string>>;
  /** The page itself, for components that draw its name or title; its id when the caller has one (the saved views belong to a page, P2.3 PR B). */
  page: Pick<PageRow, 'path' | 'name' | 'title'> & { id?: string | null };
  /** The region's id (P2.3 PR B): what a saved view names. */
  region: string;
  /** This component is the first region showing in the Body: it carries the page's h1. */
  first: boolean;
  /** The Source the region picked (P2.1), read against the sources its definition declares; null when none. */
  source: SourceRef | null;
  /** The live row pages a card's zone may name (P2.2 B3), as the frame reads them for Buttons; {} when the caller loads
   *  none. A promise, so only the renderer that reads it waits for it. */
  pages: Promise<PageDestinations>;
  /** The render's instant, one for every region, so the age labels agree across them (P2.24 A); the tests fix it. */
  now: Date;
  /** Tells the Debug trace what a source read answered (P2.1). */
  onSourceRead?: (p: SourceProvenance) => void;
  /** The visited address, for the links a component writes (P2.3); the path when the caller names none. */
  href: string;
  /** The reader's state as the address carries it (P2.3), every region reading its own keys; undefined where none can arrive
   *  (a framed code route), so no control is drawn. */
  view?: string;
  /** This region's key prefix for the state: '' when it is the document's one region with controls, `r.<id>.` when there are
   *  several; null when the region has no controls on or no state can arrive. */
  controlsKey: string | null;
  /** Master-detail (P2.4 PR C): the region this one's rows filter, as its key, its key prefix and its state from the address
   *  bound to its shape; only where a state can arrive and the document names a Data region that carries the key. */
  master?: { key: string; prefix: string; state: ViewState };
  /** The keys its masters write into this region's filter (P2.4 PR C), for its "Showing <value> · Show all" line. */
  detailKeys?: string[];
}

type Renderer = (settings: Readonly<Record<string, SettingValue>>, ctx: RenderContext) => Promise<ReactNode> | ReactNode;

const num = (v: SettingValue | undefined, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const str = (v: SettingValue | undefined): string => (typeof v === 'string' ? v.trim() : '');

/** The Live band (P2.9): every series as Home ranks them, with the Also racing row unless it is off; or one series' weekend
 *  alone, its box from every live box whether Home features it or not; nothing when no weekend is under way. This weekend,
 *  Home's piece, draws it at the defaults. */
async function drawLiveBand(settings: Readonly<Record<string, SettingValue>>): Promise<ReactNode> {
  const [{ loadLiveModel }, { HomeThisWeekend }] = await Promise.all([home(), pieces()]);
  const model = await loadLiveModel();
  const slug = str(settings.series);
  if (!slug) return <HomeThisWeekend liveWeekends={model.liveWeekends} alsoRacing={settings.also === false ? [] : model.alsoRacing} />;
  const box = model.liveAll.find(w => w.seriesSlug === slug);
  return box ? <HomeThisWeekend liveWeekends={[box]} alsoRacing={[]} /> : null;
}

const RENDERERS: Readonly<Record<string, Renderer>> = {
  'page.heading'(settings, ctx) {
    const text = str(settings.text) || ctx.page.title || ctx.page.name;
    // The site's masthead, as the pages the code drew had it (the Calendar's, moved as it was).
    return (
      <header>
        <h1 className="font-serif text-34 font-medium leading-none tracking-[-0.02em] text-text md:text-40">{text}</h1>
      </header>
    );
  },
  async 'calendar.month'() {
    const [{ loadCalendarModel }, { CalendarView }] = await Promise.all([calendar(), calendarView()]);
    const m = await loadCalendarModel();
    return <CalendarView items={m.items} roundByKey={m.roundByKey} roundNames={m.roundNames} serverNow={m.serverNow} />;
  },
  // The Live band (P2.9); This weekend, Home's retired piece, upgrades to it on read (P2.24 C).
  'series.live': settings => drawLiveBand(settings),
  // The Data region (P2.2): one of the site's named shapes over the region's Source. Nothing without a Source
  // (APEX: a report without one renders nothing; the designer's Messages say so).
  async 'data.region'(settings, ctx) {
    if (!ctx.source) return null;
    const preset = findPreset(str(settings.preset));
    if (!preset) return null;
    const shape = SHAPES[preset.shape];
    // The reader's state (P2.3): this region's keys, bound to the shape; none where no control is on or no state can arrive.
    let state = ctx.controlsKey !== null && ctx.view !== undefined ? bindViewState(parseViewState(ctx.view, ctx.controlsKey).value, shape) : undefined;
    // The address's own state for this region, before a saved view joins it (P2.4 PR C): the detail's reset builds on it.
    const urlState = state;
    // The saved views (P2.3 PR B): ?view=<key> names one of this region's Alternatives, whose definition becomes the state under
    // the address's own parameters; an unknown key is the Primary. The list is read only when a key arrives or the Views menu is on.
    let viewsMenu: RegionControls['views'];
    if (state && ctx.page.id && (state.view !== undefined || settings.views === true)) {
      const list = await (await savedViews()).loadViewsFor(ctx.page.id, ctx.region);
      const saved = state.view !== undefined ? list.find(v => v.key === state!.view) : undefined;
      const { view: asked, ...merged } = applySavedView(state, saved ? saved.definition : null);
      state = bindViewState(saved ? { ...merged, view: asked } : merged, shape);
      if (settings.views === true) viewsMenu = { current: saved?.key ?? null, list: list.map(v => ({ key: v.key, name: v.name })) };
    }
    const download = state && settings.download === true ? `/api/data/csv?page=${encodeURIComponent(ctx.href)}&region=${encodeURIComponent(ctx.region)}${(s => (s ? `&${s}` : ''))(encodeViewState({ ...state, view: undefined }))}` : undefined;
    const controls: RegionControls | undefined = state && ctx.controlsKey !== null && ctx.view !== undefined ? { href: ctx.href, key: ctx.controlsKey, others: ctx.view, state, sortable: settings.sortable === true, actions: settings.actions === true, views: viewsMenu, download } : undefined;
    const [{ readSource }, views] = await Promise.all([sourceRead(), dataViews()]);
    const read = await readSource(ctx.source);
    ctx.onSourceRead?.(read.provenance);
    // The Lead story's pin (P2.24 A): the post whose slug is named leads, from every row the Source read, the rest following
    // it; none by that slug and the newest leads, as Home's pin falls back.
    const pinned = str(settings.pinned);
    const lead = pinned ? read.rows.find(r => r.slug === pinned) : undefined;
    const ordered = lead ? [lead, ...read.rows.filter(r => r !== lead)] : read.rows;
    const rows = presetRows(ordered, preset, num(settings.rows, 10), state);
    // The Card slots and the action zones (P2.2 B3): a slot names a column of the shape, else the preset's own; a zone follows
    // a link column of the row (`row:<key>`, the address the column's href names, leaving the site when the column does) or a
    // destination, external ones leaving the site. The pages are awaited here alone, so the other regions never wait for them.
    const pages = await ctx.pages;
    const card: CardSlots = {
      title: str(settings.cardTitle) || shape.card.title,
      subtitle: str(settings.cardSubtitle) || shape.card.subtitle,
      body: str(settings.cardBody) || shape.card.body,
      media: str(settings.cardMedia) || shape.card.media || '',
      badge: str(settings.cardBadge) || shape.card.badge,
    };
    const zone = (key: string): CardActions['fullCard'] => {
      const v = str(settings[key]);
      if (!v) return () => null;
      if (v.startsWith('row:')) {
        const column = shape.columns.find(c => c.key === v.slice(4) && c.type === 'link');
        return row => {
          const href = column?.href ? row[column.href] : null;
          return typeof href === 'string' && href ? { href, external: column?.external === true } : null;
        };
      }
      const d = resolveDestination(v, pages);
      const to = d && d.kind !== 'action' ? { href: d.href, external: d.kind === 'external' } : null;
      return () => to;
    };
    const actions: CardActions = { fullCard: zone('actionFullCard'), title: zone('actionTitle'), subtitle: zone('actionSubtitle'), media: zone('actionMedia'), button: zone('actionButton'), buttonLabel: str(settings.actionButtonLabel) || 'Open' };
    // The highlight rules (P2.4): the first rule a row meets styles it; a rule the shape cannot read is left out; the
    // followed-series tint marks each row with its series for the browser. Nothing when none is set: the markup stays as today.
    const rules = ([1, 2, 3] as const).flatMap(n => {
      const text = str(settings[`highlight${n}`]);
      if (!text) return [];
      const rule = parseRule(text);
      if (typeof rule === 'string') return [];
      const column = shape.columns.find(c => c.key === rule.column);
      if (!column || !filterOps(column).includes(rule.op)) return [];
      const style = str(settings[`highlight${n}Style`]);
      return [{ filter: rule, style: (style === 'emphasis' || style === 'muted' ? style : 'brand') as HighlightStyle }];
    });
    const followed = settings.highlightFollowed === true;
    const highlight: RowHighlight | undefined = rules.length > 0 || followed ? { rules, followed } : undefined;
    // Master-detail (P2.4 PR C): each row a Show link writing its value into the detail's filter in the address, the detail's
    // own sort, columns and view kept as sortHref keeps them; the detail's line names the value shown and resets that alone.
    const m = ctx.master;
    const master: MasterSelect | undefined = m
      ? {
          href: row => {
            const v = row[m.key];
            // A value the vocabulary cannot carry (over VALUE_MAX) would be dropped when the address is read: no link, as for no value.
            if (v === null || v === undefined || v === '' || String(v).length > VALUE_MAX) return null;
            const filters = [...m.state.filters.filter(f => f.column !== m.key), { column: m.key, op: 'eq' as const, value: String(v) }];
            return viewStateHref(ctx.href, { ...m.state, filters }, m.prefix, ctx.view ?? '');
          },
          // Marked as the filter reads it (rowPasses compares a number column by number), so "01" marks round 1.
          current: row => m.state.filters.some(f => f.column === m.key && f.op === 'eq' && rowPasses(row, f, shape.columns)),
          label: row => `Show ${String(row[m.key])}`,
        }
      : undefined;
    const keys = ctx.detailKeys ?? [];
    const shown = keys.length > 0 && urlState ? urlState.filters.find(f => keys.includes(f.column) && f.op === 'eq') : undefined;
    const showing: DetailShowing | undefined =
      shown && urlState && ctx.controlsKey !== null ? { value: shown.value, reset: viewStateHref(ctx.href, { ...urlState, filters: urlState.filters.filter(f => f !== shown) }, ctx.controlsKey, ctx.view ?? '') } : undefined;
    const series = ctx.source.params.series;
    const props = { heading: str(settings.heading) || preset.name, level: ctx.first ? ('h1' as const) : ('h2' as const), shape, preset, rows, card, actions, now: ctx.now, series: typeof series === 'string' && series ? series : undefined, controls, highlight, region: ctx.region, master, showing };
    // Timeline stands on the results' dates (the parser refuses it elsewhere); a stored one on a standings shape draws the table.
    // Home's boxes as templates (P2.24 A) stand on their own shapes the same way; the Podium and the Leader (P2.24 B2) on one
    // shape of their source each (the podium rows, the driver rows), since Results and Standings have several.
    const View =
      settings.view === 'cards'
        ? views.DataRegionCards
        : settings.view === 'list'
          ? views.DataRegionList
          : settings.view === 'timeline' && shape.source === 'results'
            ? views.DataRegionTimeline
            : settings.view === 'detail'
              ? views.DataRegionDetail
              : settings.view === 'lead-story' && shape.source === 'posts'
                ? views.DataRegionLeadStory
                : settings.view === 'wire' && shape.source === 'news'
                  ? views.DataRegionWire
                  : settings.view === 'coming-weekends' && shape.source === 'weekends'
                    ? views.DataRegionComingWeekends
                    : settings.view === 'podium' && shape.key === 'podium-rows'
                      ? views.DataRegionPodium
                      : settings.view === 'leader' && shape.key === 'driver-rows'
                        ? views.DataRegionLeader
                        : views.DataRegionTable;
    return <View {...props} />;
  },
};

/** Whether a component key has a renderer here. */
export function canRender(key: string): boolean {
  return key in RENDERERS;
}

/** What each component reads, as the Debug panel names it (P1.9): `content:`
 *  the bundle deployed with the site, `db:` a table read live, `snapshot:<prefix>`
 *  and `kv:<prefix>` the loader's tiers, whose run and phases the panel joins by
 *  prefix (lib/source-snapshot's meta). Declared beside the renderers, since a
 *  read cannot be attributed to a component at run time; a Data region's Source
 *  read is reported on top (P2.1). */
export const READS: Readonly<Record<string, readonly string[]>> = {
  'page.heading': [],
  'calendar.month': ['content:series'],
  'series.live': ['content:series'],
  // The Data region reads its Source: the standings' two tiers, the results' snapshots, the posts table and the news aggregate
  // (P2.24 A), the series' names and colours from the bundle, and the calendar feeds for the weekends (P2.24 B1).
  'data.region': ['db:standing_current', 'snapshot:standings:', 'snapshot:results:', 'snapshot:f1:', 'db:post', 'snapshot:news:aggregate:', 'content:series', 'live:ics'],
};

/** What the Debug trace asks of a render (P1.9): each component's timing and outcome. */
export interface RenderHooks {
  onRendered?: (id: string, component: string, ms: number, ok: boolean) => void;
  /** A component's Source read (P2.1): what came back and from which tier. */
  onSourceRead?: (id: string, p: SourceProvenance) => void;
}

/** What a renderer is told about the page: the pattern or path, the address's parts, the row. */
export interface RenderPage {
  path: string;
  params?: Readonly<Record<string, string>>;
  page?: Pick<PageRow, 'path' | 'name' | 'title'> & { id?: string | null };
  /** The live row pages the document's buttons and zones name (P2.2 B3), as the frame loads them; a promise keeps the
   *  render parallel, each region awaiting it inside its own try. */
  pages?: PageDestinations | Promise<PageDestinations>;
  /** The render's instant (P2.24 A); the frame leaves it to the clock, the tests fix it. */
  now?: Date;
  /** The visited address (P2.3), for the links the controls write; the path when absent. */
  href?: string;
  /** The reader's state as the address carries it (P2.3): '' for a plain address a state may reach; undefined where none can
   *  (a framed code route), which keeps every control off the page. */
  view?: string;
}

/**
 * Draw every component region of a document (the transitional body excepted:
 * the frame places the code's body itself), by region id. The first region
 * showing in the Body is told so, for the h1. A renderer that throws yields
 * nothing for its region and nothing else is affected.
 */
export async function renderComponents(doc: PageDocument, where: RenderPage, hooks?: RenderHooks): Promise<Record<string, ReactNode>> {
  const out: Record<string, ReactNode> = {};
  // The first page-level region showing in the Body (P1.4: never a sub region).
  const firstInBody = firstBodyRegion(doc)?.id ?? null;
  const regions = doc.regions.filter((r): r is ComponentRegion => r.kind === 'component' && !isLegacyBody(r));
  const page = where.page ?? { path: where.path, name: '', title: null };
  // The pages as one promise every region shares; a renderer that reads them awaits it inside its own try, the rest never wait.
  const pages = Promise.resolve(where.pages ?? {});
  const now = where.now ?? new Date();
  // The regions with the Interactive Report's controls on (P2.3), decided from the declared document — never from what a
  // condition shows — so a link addresses the same region for every visitor: one such region reads the bare keys, several
  // read their own under `r.<id>.`; nowhere a state can arrive, none draws a control.
  // Master-detail (P2.4 PR C): a Data region naming another Data region of the document as its Detail region, by a column both
  // shapes carry. A detail reads its keys whatever its menus and its view, since a results region opens in the List view.
  const ROW_VIEWS = ['table', 'cards', 'list'];
  const dataRegions = regions.filter(r => r.component === 'data.region');
  const shapeOf = (r: ComponentRegion) => {
    const preset = findPreset(str(r.settings.preset));
    return preset ? SHAPES[preset.shape] : null;
  };
  const pairs = dataRegions.flatMap(master => {
    const key = str(master.settings.detailKey);
    const detail = dataRegions.find(d => d.id === str(master.settings.detailRegion) && d !== master);
    const shape = detail ? shapeOf(detail) : null;
    const carries = shape !== null && shapeOf(master)?.columns.some(c => c.key === key) === true && shape.columns.some(c => c.key === key);
    // A template (the Podium, the Leader, the Timeline, Home's boxes) draws no Show link and no Showing line: only a Table, Cards
    // or List can be a detail, or a master (a stored Detail region outlives a View change; its attributes hide with the View).
    const drawn = detail ? ROW_VIEWS.includes(str(detail.settings.view) || 'table') && ROW_VIEWS.includes(str(master.settings.view) || 'table') : false;
    return detail && shape && key && carries && drawn ? [{ master, detail, key, shape }] : [];
  });
  const details = new Set(pairs.map(p => p.detail));
  const withControls = regions.filter(r => r.component === 'data.region' && (details.has(r) || ((r.settings.sortable === true || r.settings.actions === true || r.settings.views === true || r.settings.download === true) && ['table', 'cards'].includes(str(r.settings.view) || 'table'))));
  const controlsKey = (r: ComponentRegion): string | null => (where.view === undefined || !withControls.includes(r) ? null : withControls.length > 1 ? `r.${r.id}.` : '');
  // A master's view of its detail: the detail's key prefix and its state from the address, bound to the detail's shape; none
  // where no state can arrive. A detail knows the key its master writes, for its line.
  const masterOf = (r: ComponentRegion): RenderContext['master'] => {
    const p = pairs.find(x => x.master === r);
    const prefix = p ? controlsKey(p.detail) : null;
    return p && prefix !== null && where.view !== undefined ? { key: p.key, prefix, state: bindViewState(parseViewState(where.view, prefix).value, p.shape) } : undefined;
  };
  const detailKeysOf = (r: ComponentRegion): string[] | undefined => {
    const keys = pairs.filter(x => x.detail === r).map(x => x.key);
    return keys.length ? keys : undefined;
  };
  await Promise.all(
    regions.map(async r => {
      const render = RENDERERS[r.component];
      if (!render) {
        hooks?.onRendered?.(r.id, r.component, 0, false);
        return;
      }
      const t = performance.now();
      // The Source (P2.1): the region's pick against the sources its definition declares; the code's list, since a row cannot add one.
      const spec = findComponent(r.component);
      const source = r.source && spec?.sources?.length ? parseSourceRef(r.source, spec.sources).value : null;
      const onSourceRead = hooks?.onSourceRead ? (p: SourceProvenance) => hooks.onSourceRead?.(r.id, p) : undefined;
      try {
        out[r.id] = await render(r.settings, { path: where.path, params: where.params ?? {}, page, first: r.id === firstInBody, source, pages, now, onSourceRead, href: where.href ?? where.path, view: where.view, controlsKey: controlsKey(r), region: r.id, master: masterOf(r), detailKeys: detailKeysOf(r) });
        hooks?.onRendered?.(r.id, r.component, Math.round((performance.now() - t) * 10) / 10, true);
      } catch {
        out[r.id] = null;
        hooks?.onRendered?.(r.id, r.component, Math.round((performance.now() - t) * 10) / 10, false);
      }
    }),
  );
  return out;
}

/** Whether a race weekend is under way now: a weekend with a box or a row on
 *  Home's live band, the fact the conditions Race weekend and Between weekends
 *  (ours, P2.6) decide on. Once per request. */
export const raceWeekendNow = cache(async (): Promise<boolean> => {
  try {
    const { loadLiveModel } = await home();
    const model = await loadLiveModel();
    return model.liveWeekends.length > 0 || model.alsoRacing.length > 0;
  } catch {
    return false;
  }
});
