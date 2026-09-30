import 'server-only';
import { cache, type ReactNode } from 'react';
import { firstBodyRegion, isLegacyBody, tabsOf, type ComponentRegion, type PageDocument } from './page-document';
import { CALENDAR_FACETS, findComponent, type SettingValue } from './components';
import { parseSourceRef, type SourceRef } from './sources';
import { SHAPES, findPreset, numeric, presetRows, rowPasses, type PresetRow } from './presets';
import { DEFAULT_MAP_BACKGROUND, fillKey, findMapBackground, type TileSet } from './map-backgrounds';
import type { SourceProvenance } from './source-read';
import type { PageRow } from './pages';
import { resolveDestination, type PageDestinations } from './destinations';
import { namesMatch } from '@/lib/slug';
import type { ChartData } from '@/components/data/ChartFrame';
import type { MapData, MapMarker } from '@/components/data/MapFrame';
import type { CardActions, CardSlots, DetailShowing, HighlightStyle, MasterSelect, MetricCard, RegionControls, RowHighlight } from '@/components/data/DataRegionViews';
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
const calendarGrid = () => import('@/lib/calendar-grid');
const dataFilters = () => import('@/components/data/DataRegionFilters');
// The Countdown (P2.8) reads the series' sessions, the weekend rule and the circuits the same way: on demand.
const seriesLib = () => import('@/lib/series');
const weekendLib = () => import('@/lib/weekend');
const circuitsLib = () => import('@/lib/circuits');
// The Breadcrumb (P2.17) reads its trail's label sources the same way, behind its own module.
const breadcrumbLib = () => import('./breadcrumb');
// The Tabs strip (P2.10), a client piece, on demand as the views are.
const regionTabs = () => import('@/components/page/RegionTabs');
// The Weather (P2.14) reads the site's one forecast reader and the Weather build option the same way.
const weatherLib = () => import('@/lib/weather');
const buildOptionsLib = () => import('./build-options');
// The Chart (P2.11) resolves its emphasis through the site's rosters on demand, as the Breadcrumb's labels do.
const people = () => import('@/lib/people');

import type { Facet } from '@/components/data/DataRegionFilters';
import type { Series, Weekend } from '@/lib/types';
import { formatLocal } from '@/lib/date';
import type { SourceRead as SourceReadResult } from './source-read';
import { facetValues, type PresetRow as FacetRow, type Shape as FacetShape } from './presets';

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
  /** The region's Source read (P2.5), shared with a Filters region that targets it: one read per request for both. */
  read?: () => Promise<SourceReadResult>;
  /** A Filters region's target (P2.5): its keys' prefix, its shape, its state from the address, and its rows after the preset's own rule. */
  filters?: { prefix: string; shape: Pick<FacetShape, 'columns'>; state: ViewState; rows: () => Promise<FacetRow[]> };
  /** The tabs a Tabs region lists (P2.10; APEX: Region Display Selector): the page-level regions of its position with Region
   *  Display Selector on, in the document's order, each by its title (its id when untitled) with its icon; only for a Tabs region. */
  tabs?: readonly { id: string; label: string; icon?: string }[];
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
    // The site's masthead, as the pages the code drew had it (the Calendar's, moved as it was): the page's h1 when the region is
    // the first showing in the Body, an h2 of the same look otherwise (R13: Home's eight section headings drew eight h1s).
    const H = ctx.first ? 'h1' : 'h2';
    return (
      <header>
        <H className="font-serif text-34 font-medium leading-none tracking-[-0.02em] text-text md:text-40">{text}</H>
      </header>
    );
  },
  // The calendar narrows by a Filters region's picks (P2.5 PR B): the series by name and the sessions by kind, read from the
  // address under its own keys; none where no state can arrive, and the calendar draws every session as before.
  async 'calendar.month'(settings, ctx) {
    const [{ loadCalendarModel }, { CalendarView }] = await Promise.all([calendar(), calendarView()]);
    const m = await loadCalendarModel();
    const state = ctx.controlsKey !== null && ctx.view !== undefined ? bindViewState(parseViewState(ctx.view, ctx.controlsKey).value, { columns: CALENDAR_FACETS }) : undefined;
    const picks = (column: string): string[] | null => {
      const values = (state?.filters ?? []).filter(f => f.column === column && (f.op === 'in' || f.op === 'eq')).flatMap(f => (f.op === 'in' ? f.value.split(',').map(s => s.trim()).filter(s => s !== '') : [f.value]));
      return values.length > 0 ? values : null;
    };
    return <CalendarView items={m.items} roundByKey={m.roundByKey} roundNames={m.roundNames} serverNow={m.serverNow} seriesNames={picks('seriesName')} sessionKinds={picks('sessionType')} />;
  },
  // The Live band (P2.9); This weekend, Home's retired piece, upgrades to it on read (P2.24 C).
  'series.live': settings => drawLiveBand(settings),
  // The Countdown (P2.8; ours: APEX has no countdown component): the next session of one series or the nearest across every
  // series (lib/weekend.ts nextSessionAcross, Home's rule: a session under way reads LIVE until its end), its weekend and its
  // start where the reader is and at the track (the circuit through the curated round venue first, as the weekend page
  // resolves it; the zone from content/circuits.json). A series whose feed fails contributes nothing; nothing to come draws a
  // line. The view is DataRegionCountdown.
  async 'series.countdown'(settings, ctx) {
    const [{ loadAllSeries, loadSeries }, { nextSessionAcross }, views] = await Promise.all([seriesLib(), weekendLib(), dataViews()]);
    const slug = str(settings.series);
    let list: Series[] = [];
    try {
      list = slug ? [await loadSeries(slug)] : await loadAllSeries();
    } catch {
      list = [];
    }
    const next = nextSessionAcross(list, ctx.now);
    const heading = str(settings.heading);
    const level = ctx.first ? 'h1' : 'h2';
    const links = settings.link !== false;
    if (!next) return <views.DataRegionCountdown heading={heading} level={level} data={null} links={links} every={!slug} />;
    let venueTime: string | null = null;
    if (settings.venueTime !== false && next.session) {
      const { matchCircuit, venueCandidates } = await circuitsLib();
      const circuit = await matchCircuit(...venueCandidates({ venue: next.weekend.venue, location: next.weekend.location, title: next.weekend.title })).catch(() => null);
      if (circuit?.tz) {
        // The site's own zone formatter (lib/date.ts formatLocal, LocalTime's fallback), in the circuit's zone; an unknown
        // zone throws and leaves the reader's time alone.
        try {
          venueTime = formatLocal(next.session.start, circuit.tz);
        } catch {
          venueTime = null;
        }
      }
    }
    const data = {
      seriesName: next.series.name,
      colour: next.series.color,
      round: next.weekend.round,
      weekendTitle: next.weekend.title,
      weekendHref: next.weekend.href,
      dates: next.weekend.dateRangeLabel,
      session: next.session
        ? { title: next.session.title, href: `${next.weekend.href}/${next.session.slug}`, startIso: next.session.start.toISOString(), endIso: next.session.end.toISOString(), venueTime }
        : null,
    };
    return <views.DataRegionCountdown heading={heading} level={level} data={data} links={links} every={!slug} />;
  },
  // The Weather (P2.14): the forecast at the track for the page's weekend (a weekend or a session page, its address's parts)
  // or the series' next (one series, or the nearest across every series, the Countdown's rule), by venue-local time through
  // the site's one reader; the curated venue first, the weekend page's rule; nothing when the Weather build option is
  // excluded, as the two code pieces; one line without a forecast.
  async 'series.weather'(settings, ctx) {
    // The switch first: an excluded option loads nothing else (the reviewer's note).
    const { isBuildOptionIncluded } = await buildOptionsLib();
    if (!(await isBuildOptionIncluded('weather'))) return null;
    const [{ loadAllSeries, loadSeries }, { weekendFor, nextSessionAcross, weekendLabel, shortSessionLabel }, { matchCircuit, venueCandidates }, weather, views] = await Promise.all([
      seriesLib(),
      weekendLib(),
      circuitsLib(),
      weatherLib(),
      dataViews(),
    ]);
    const slug = str(settings.series);
    const heading = str(settings.heading);
    const level = ctx.first ? 'h1' : 'h2';
    const view: 'sessions' | 'daily' = str(settings.view) === 'daily' ? 'daily' : 'sessions';
    const rows = Math.min(8, Math.max(2, Number(settings.hours) || 4));
    const onWeekendPage = ctx.path === '/series/[slug]/weekend/[round]' || ctx.path === '/series/[slug]/weekend/[round]/[session]';
    let series: Series | null = null;
    let weekend: Weekend | null = null;
    try {
      if (onWeekendPage && ctx.params.slug && ctx.params.round) {
        series = await loadSeries(ctx.params.slug);
        weekend = weekendFor(series, Number(ctx.params.round), ctx.now);
      } else {
        const list = slug ? [await loadSeries(slug)] : await loadAllSeries();
        const next = nextSessionAcross(list, ctx.now);
        series = next ? (list.find(s => s.meta.slug === next.series.slug) ?? null) : null;
        weekend = series && next ? weekendFor(series, next.weekend.round, ctx.now) : null;
      }
    } catch {
      series = null;
      weekend = null;
    }
    if (!series || !weekend) return <views.DataRegionWeather heading={heading} level={level} data={null} every={!slug} weekendTitle={null} />;
    const title = weekendLabel(weekend, weekend.round).title;
    const round = series.rounds?.rounds?.find(r => r.round === weekend.round);
    const circuit = await matchCircuit(...venueCandidates({ venue: round?.venue, location: weekend.sessions.find(s => s.location)?.location, title })).catch(() => null);
    const forecast = circuit ? await weather.fetchWeather(circuit.lat, circuit.lon).catch(() => null) : null;
    const sessions = forecast && view === 'sessions' ? weather.sessionTiles(weekend.sessions, forecast, rows, shortSessionLabel) : [];
    const days = forecast && view === 'daily' ? weather.dayTiles(weekend.sessions, forecast, shortSessionLabel) : [];
    if (!circuit || !forecast || (sessions.length === 0 && days.length === 0)) {
      return <views.DataRegionWeather heading={heading} level={level} data={null} every={!slug} weekendTitle={title} />;
    }
    const data = { seriesName: series.meta.name, colour: series.meta.color, round: weekend.round, weekendTitle: title, circuitName: circuit.name, view, sessions, days };
    return <views.DataRegionWeather heading={heading} level={level} data={data} every={!slug} weekendTitle={title} />;
  },
  // The Breadcrumb (P2.17): the trail from the pattern and the address's parts the frame or the catch-all hands over, the
  // row for a page made in the designer; its BreadcrumbList unless the page's own code prints one (OWN_BREADCRUMB_LD).
  async 'page.breadcrumb'(settings, ctx) {
    const [{ breadcrumbTrail, ownsBreadcrumbLd }, views] = await Promise.all([breadcrumbLib(), dataViews()]);
    const crumbs = await breadcrumbTrail({ path: ctx.path, params: ctx.params, page: ctx.page }, { home: settings.home !== false, current: settings.current !== false });
    // Home, or one crumb: no trail to show (and Google's floor for a BreadcrumbList is two).
    if (crumbs.length < 2) return null;
    return <views.DataRegionBreadcrumb crumbs={crumbs} separator={str(settings.separator) || 'chevron'} structured={!ownsBreadcrumbLd(ctx.path)} />;
  },
  // Tabs (P2.10; APEX: Region Display Selector): over the page's opting regions (the context lists them, in order) the client
  // strip that shows one at a time or scrolls to each and remembers the choice under the page's address; over the sibling pages
  // a nav of links (ours). Fewer than two tabs or links: nothing.
  async 'page.tabs'(settings, ctx) {
    if (str(settings.over) === 'pages') {
      const [{ siblingPages }, views] = await Promise.all([breadcrumbLib(), dataViews()]);
      const pages = await siblingPages({ path: ctx.path, params: ctx.params, page: ctx.page });
      return pages.length < 2 ? null : <views.DataRegionPageTabs pages={pages} />;
    }
    const tabs = ctx.tabs ?? [];
    if (tabs.length < 2) return null;
    const [{ RegionTabs }, { fillPattern }] = await Promise.all([regionTabs(), breadcrumbLib()]);
    const remember = str(settings.remember);
    return (
      <RegionTabs
        tabs={tabs}
        mode={str(settings.mode) === 'scroll' ? 'scroll' : 'single'}
        showAll={settings.showAll !== false}
        remember={remember === 'visit' || remember === 'no' ? remember : 'browser'}
        storageKey={`paddock:tabs:${fillPattern(ctx.path, ctx.params)}:${ctx.region}`}
        icons={settings.icons === true}
      />
    );
  },
  // Metric cards (P2.7; APEX 26.1: the Metric Card theme component): the preset's rows read as the Data region reads them (the
  // shared read where a Filters region has it), every row the preset keeps (a count card counts them); each card a column of the
  // first row, or of the first row its rule names, or the count; the view draws the figures as the Table draws its cells. Nothing
  // without a card naming a value or a count (APEX: a report without rows).
  async 'data.metrics'(settings, ctx) {
    if (!ctx.source) return null;
    const preset = findPreset(str(settings.preset));
    if (!preset) return null;
    const shape = SHAPES[preset.shape];
    const cards = ([1, 2, 3, 4] as const).flatMap((n): MetricCard[] => {
      const figure = str(settings[`card${n}Figure`]) === 'count' ? ('count' as const) : ('value' as const);
      // A count card carries its label alone: a value, a description, a trend or a row left from before it was a count are not read.
      if (figure === 'count') return [{ label: str(settings[`card${n}Label`]), figure, value: '', description: '', trend: '' }];
      const value = str(settings[`card${n}Value`]);
      if (!shape.columns.some(c => c.key === value)) return [];
      const rule = str(settings[`card${n}Row`]);
      const parsed = rule ? parseRule(rule) : '';
      const row = typeof parsed !== 'string' && shape.columns.some(c => c.key === parsed.column) ? parsed : undefined;
      return [{ label: str(settings[`card${n}Label`]), figure, value, description: str(settings[`card${n}Description`]), trend: str(settings[`card${n}Trend`]), row }];
    });
    if (cards.length === 0) return null;
    const [{ readSource }, views] = await Promise.all([sourceRead(), dataViews()]);
    const read = ctx.read ? await ctx.read() : await readSource(ctx.source);
    ctx.onSourceRead?.(read.provenance);
    const rows = presetRows(read.rows, preset, Number.MAX_SAFE_INTEGER);
    return <views.DataRegionMetrics heading={str(settings.heading)} level={ctx.first ? 'h1' : 'h2'} shape={shape} nameLabel={preset.nameLabel} rows={rows} cards={cards} columns={Number(str(settings.columns)) || 3} />;
  },
  // The Chart (P2.11; APEX: the Chart region): the preset's rows read as the Data region reads them (the shared read where a
  // Filters region has it), the Row rule over them, then one point or bar per label, one series or one per distinct value of the
  // Series Name column, the value read as rowPasses reads a number (a qualifying gap's text too), the rows of one label in a
  // series added up (APEX: a Sum aggregation); the series ranked by their last value; the emphasis, on a driver's or a team's
  // page, the series that are the page's own (a team through its curated drivers' rows, never its name alone: Racing Bulls is
  // "RB F1 Team" in the feed). Nothing without a Source, a preset, a label and a value column of the shape; no rows draws one
  // line. The view is DataRegionChart, the frame and the canvas behind it client pieces.
  async 'data.chart'(settings, ctx) {
    if (!ctx.source) return null;
    const preset = findPreset(str(settings.preset));
    if (!preset) return null;
    const shape = SHAPES[preset.shape];
    const own = shape.chart;
    const labelKey = str(settings.label) || own?.label || '';
    const valueKey = str(settings.value) || own?.value || '';
    const seriesKey = str(settings.seriesName) || own?.series || '';
    const column = (key: string) => shape.columns.find(c => c.key === key);
    const labelColumn = column(labelKey);
    const valueColumn = column(valueKey);
    if (!labelColumn || !valueColumn || (seriesKey && !column(seriesKey))) return null;
    const picked = str(settings.type);
    const type: ChartData['type'] = picked === 'line' || picked === 'bar' || picked === 'area' ? picked : (own?.type ?? 'bar');
    const [{ readSource }, views] = await Promise.all([sourceRead(), dataViews()]);
    const read = ctx.read ? await ctx.read() : await readSource(ctx.source);
    ctx.onSourceRead?.(read.provenance);
    let rows = presetRows(read.rows, preset, Number.MAX_SAFE_INTEGER);
    const ruleText = str(settings.rule);
    const rule = ruleText ? parseRule(ruleText) : '';
    if (typeof rule !== 'string' && column(rule.column)) rows = rows.filter(r => rowPasses(r, rule, shape.columns));
    const cell = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
    // A name column reads by the preset's label (Driver, Constructor), the rest by the shape's.
    const labelOf = (c: { key: string; label: string }) => (c.key === 'name' ? preset.nameLabel : c.label);
    const labelLabel = labelOf(labelColumn);
    const valueLabel = labelOf(valueColumn);
    // The labels in the preset's order, the series in first-seen order; a point's title carries a number label's column and the
    // race where the shape has one (the tab's "R5 · Monaco Grand Prix").
    const labels: string[] = [];
    const titles = new Map<string, string>();
    const names: string[] = [];
    const values = new Map<string, Map<string, number>>();
    const teamOf = new Map<string, string>();
    const raceKey = column('race') && labelKey !== 'race' ? 'race' : null;
    for (const r of rows) {
      const label = cell(r[labelKey]);
      if (!label) continue;
      const name = seriesKey ? cell(r[seriesKey]) : valueLabel;
      if (!name) continue;
      if (!titles.has(label)) {
        labels.push(label);
        titles.set(label, `${labelColumn.type === 'number' ? `${labelLabel} ${label}` : label}${raceKey && cell(r[raceKey]) ? ` · ${cell(r[raceKey])}` : ''}`);
      }
      if (!values.has(name)) {
        names.push(name);
        values.set(name, new Map());
      }
      const v = numeric(r[valueKey]);
      if (v !== null) {
        const m = values.get(name)!;
        m.set(label, (m.get(label) ?? 0) + v);
      }
      if (!teamOf.has(name) && typeof r.team === 'string' && r.team) teamOf.set(name, r.team);
    }
    const heading = str(settings.heading) || preset.name;
    const level = ctx.first ? ('h1' as const) : ('h2' as const);
    // No label, no series, or no value that reads as a number (a capture without gaps): the one line, never an empty plot.
    if (labels.length === 0 || names.length === 0 || ![...values.values()].some(m => m.size > 0)) return <views.DataRegionChart heading={heading} level={level} data={null} foot="" />;
    // The series ranked by their last value (the standings chart's order): the legend's order and the cap's.
    const last = (name: string): number | null => {
      const m = values.get(name)!;
      for (let i = labels.length - 1; i >= 0; i--) {
        const v = m.get(labels[i]);
        if (v !== undefined) return v;
      }
      return null;
    };
    const ranked = [...names].sort((a, b) => (last(b) ?? Number.NEGATIVE_INFINITY) - (last(a) ?? Number.NEGATIVE_INFINITY));
    const keyOf = new Map(ranked.map((name, i) => [name, `s${i}`]));
    // The emphasis (ours): the page's own driver by name; the page's team through its curated drivers' rows, the feed's team name
    // read off the first match, then every series whose rows carry that team (a constructor line's team is its own name).
    let emphasised: string[] = [];
    let highlighted: string | null = null;
    if (str(settings.emphasis) === 'page' && ctx.params.slug && (ctx.path === '/drivers/[slug]' || ctx.path === '/teams/[slug]')) {
      const { findDriverBySlug, findTeamBySlug } = await people();
      if (ctx.path === '/drivers/[slug]') {
        const driver = await findDriverBySlug(ctx.params.slug).catch(() => null);
        if (driver) {
          highlighted = driver.name;
          emphasised = ranked.filter(name => namesMatch(name, driver.name));
        }
      } else {
        const team = await findTeamBySlug(ctx.params.slug).catch(() => null);
        if (team) {
          highlighted = team.name;
          const personKey = column('name') ? 'name' : column('driver') ? 'driver' : null;
          const feedTeam = personKey ? read.rows.find(r => r.kind !== 'constructor' && team.drivers.some(d => namesMatch(cell(r[personKey]), d.name)))?.team : undefined;
          emphasised = ranked.filter(name => (typeof feedTeam === 'string' && feedTeam !== '' && teamOf.get(name) === feedTeam) || namesMatch(name, team.name));
        }
      }
    }
    const decimals = [...values.values()].some(m => [...m.values()].some(v => !Number.isInteger(v)));
    // A single series takes the rows' one series colour when every row carries the same (a championship's colour); else the brand's.
    const colours = new Set(rows.map(r => cell(r.colour)).filter(c => c !== ''));
    const data: ChartData = {
      type,
      series: ranked.map(name => ({ key: keyOf.get(name)!, label: name, team: teamOf.get(name), last: last(name) })),
      points: labels.map(label => ({ label, title: titles.get(label) ?? label, ...Object.fromEntries(ranked.map(name => [keyOf.get(name)!, values.get(name)!.get(label) ?? null])) })),
      decimals,
      zero: settings.zero !== false,
      height: Math.min(640, Math.max(160, num(settings.height, 320))),
      legend: settings.legend !== false,
      shown: Math.min(30, Math.max(1, num(settings.shown, 6))),
      emphasised: emphasised.map(name => keyOf.get(name)!),
      xTitle: str(settings.xTitle),
      yTitle: str(settings.yTitle),
      colour: ranked.length === 1 && colours.size === 1 ? [...colours][0] : null,
      labelLabel,
      valueLabel,
    };
    const foot = `${valueLabel} by ${labelLabel}${highlighted && emphasised.length ? ` · ${highlighted} highlighted` : ''}`;
    return <views.DataRegionChart heading={heading} level={level} data={data} foot={foot} />;
  },
  // The Map (P2.12; APEX: the Map region over a Map Layer of Longitude-Latitude columns): a marker per row of the preset whose
  // coordinates read as numbers, on the named background's tiles, light and dark both handed to the frame (the family is the
  // browser's); the mapping the preset's own where '' is stored; the link the row's link column (`row:<key>`, or the preset's
  // own) or one destination of the catalogue for every marker; a keyed background's URL filled from the environment here, on
  // the server, so the row carries the background's key alone (rule 10).
  async 'data.map'(settings, ctx) {
    if (!ctx.source) return null;
    const preset = findPreset(str(settings.preset));
    if (!preset) return null;
    const shape = SHAPES[preset.shape];
    const own = shape.map;
    const column = (key: string) => shape.columns.find(c => c.key === key);
    const latKey = str(settings.latitude) || own?.latitude || '';
    const lonKey = str(settings.longitude) || own?.longitude || '';
    const titleKey = str(settings.title) || own?.title || '';
    const bodyKey = str(settings.body) || own?.body || '';
    const colourKey = str(settings.colour) || own?.colour || '';
    if (!column(latKey) || !column(lonKey) || (titleKey && !column(titleKey)) || (bodyKey && !column(bodyKey)) || (colourKey && !column(colourKey))) return null;
    const background = findMapBackground(str(settings.background)) ?? findMapBackground(DEFAULT_MAP_BACKGROUND)!;
    const [{ readSource }, views] = await Promise.all([sourceRead(), dataViews()]);
    const read = ctx.read ? await ctx.read() : await readSource(ctx.source);
    ctx.onSourceRead?.(read.provenance);
    let rows = presetRows(read.rows, preset, Number.MAX_SAFE_INTEGER);
    const ruleText = str(settings.rule);
    const rule = ruleText ? parseRule(ruleText) : '';
    if (typeof rule !== 'string' && column(rule.column)) rows = rows.filter(r => rowPasses(r, rule, shape.columns));
    const cell = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
    const linkSetting = str(settings.link);
    const linkColumn = column(linkSetting ? (linkSetting.startsWith('row:') ? linkSetting.slice(4) : '') : (own?.link ?? ''));
    const hrefColumn = linkColumn?.type === 'link' ? (linkColumn.href ?? linkColumn.key) : null;
    const destination = linkSetting && !linkSetting.startsWith('row:') ? resolveDestination(linkSetting, await ctx.pages) : null;
    const hrefOf = (r: PresetRow): string | null => (hrefColumn ? cell(r[hrefColumn]) || null : destination && destination.kind !== 'action' ? destination.href : null);
    const markers: MapMarker[] = [];
    for (const r of rows) {
      const lat = numeric(r[latKey]);
      const lon = numeric(r[lonKey]);
      if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
      const title = titleKey ? cell(r[titleKey]) : '';
      markers.push({ lat, lon, title: title || `${lat}, ${lon}`, body: bodyKey ? cell(r[bodyKey]) : '', href: hrefOf(r), colour: colourKey ? cell(r[colourKey]) || null : null });
    }
    const heading = str(settings.heading) || preset.name;
    const level = ctx.first ? ('h1' as const) : ('h2' as const);
    if (markers.length === 0) return <views.DataRegionMap heading={heading} level={level} data={null} foot="" />;
    const fill = (set: TileSet): TileSet => ({ ...set, url: fillKey(set.url, process.env, background.keyVar) });
    const data: MapData = {
      background: background.key,
      light: fill(background.light),
      dark: background.dark ? fill(background.dark) : null,
      markers,
      view: str(settings.view) === 'world' ? 'world' : 'auto',
      height: Math.min(800, Math.max(240, num(settings.height, 520))),
      navigation: str(settings.navigation) === 'none' ? 'none' : 'zoom',
      scale: settings.scale === true,
      wheel: settings.wheel !== false,
    };
    return <views.DataRegionMap heading={heading} level={level} data={data} foot={`${markers.length} ${markers.length === 1 ? 'marker' : 'markers'} · ${background.name}`} />;
  },
  // Filters (P2.5; APEX: Smart Filters): the chips over its target's rows; nothing without a target or where no state can arrive.
  async 'data.filters'(settings, ctx) {
    const f = ctx.filters;
    if (!f) return null;
    const [{ DataRegionFilters }, rows] = await Promise.all([dataFilters(), f.rows()]);
    // The picks the address carries for a column: an `in` list, or one `eq` value (a value with a comma is picked alone).
    const current = (column: string): string[] => f.state.filters.filter(x => x.column === column && (x.op === 'in' || x.op === 'eq')).flatMap(x => (x.op === 'in' ? x.value.split(',').map(s => s.trim()).filter(s => s !== '') : [x.value]));
    const facets: Facet[] = ([1, 2, 3] as const).flatMap(n => {
      const column = str(settings[`facet${n}`]);
      const col = f.shape.columns.find(c => c.key === column);
      if (!col) return [];
      const parentKey = str(settings[`facet${n}DependsOn`]);
      const parentColumn = parentKey ? str(settings[parentKey]) : '';
      const parent = parentColumn ? f.shape.columns.find(c => c.key === parentColumn) : undefined;
      const open = !parent || current(parent.key).length > 0;
      const { values, more } = open ? facetValues(rows, column, f.shape.columns, f.state.filters) : { values: [], more: 0 };
      return [{ key: `facet${n}`, column, label: str(settings[`facet${n}Label`]) || col.label, several: settings[`facet${n}Several`] === true, open, parentLabel: parent ? str(settings[`${parentKey}Label`]) || parent.label : null, parentColumn: parent?.key ?? null, current: current(column), values, more }];
    });
    return <DataRegionFilters href={ctx.href} prefix={f.prefix} others={ctx.view ?? ''} state={f.state} facets={facets} />;
  },
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
    const read = ctx.read ? await ctx.read() : await readSource(ctx.source);
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
                  : settings.view === 'headlines' && shape.source === 'news'
                    ? views.DataRegionHeadlines
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
  // The Countdown reads the series' sessions from the feeds as the Weekends source does, and the circuits for the track's zone (P2.8).
  'series.countdown': ['content:series', 'live:ics', 'content:circuits'],
  // The Weather reads the weekend as the Countdown does, the circuit, and the forecast through the site's reader (KV, then
  // Open-Meteo) (P2.14).
  'series.weather': ['content:series', 'live:ics', 'content:circuits', 'kv:paddock:weather:', 'live:open-meteo'],
  // The Breadcrumb's label sources (P2.17): the pages' rows, the series and their sessions, the Learn content, a post or an author.
  'page.breadcrumb': ['db:page', 'content:series', 'live:ics', 'content:information', 'db:post'],
  // The Tabs over sibling pages (P2.10) read the series' meta or the live row pages; over regions they read nothing.
  'page.tabs': ['content:series', 'db:page'],
  // Metric cards read a Source as the Data region does (P2.7).
  'data.metrics': ['db:standing_current', 'snapshot:standings:', 'snapshot:results:', 'snapshot:f1:', 'db:post', 'snapshot:news:aggregate:', 'content:series', 'live:ics', 'db:session_result_current'],
  // The Chart (P2.11) reads the four sources whose rows carry a number to draw: the standings' two tiers, the results' and the trend's snapshots, the session results.
  'data.chart': ['db:standing_current', 'snapshot:standings:', 'snapshot:results:', 'snapshot:f1:', 'content:series', 'db:session_result_current'],
  // The Map (P2.12) reads the circuits of the content bundle, or the information hub's track entries.
  'data.map': ['content:circuits', 'content:information'],
  // The Filters region reads its target's Source (P2.5): the same tiers, once for both.
  'data.filters': ['db:standing_current', 'snapshot:standings:', 'snapshot:results:', 'snapshot:f1:', 'db:post', 'snapshot:news:aggregate:', 'content:series', 'live:ics', 'db:session_result_current'],
  // The Data region reads its Source: the standings' two tiers, the results' snapshots, the posts table and the news aggregate
  // (P2.24 A), the series' names and colours from the bundle, and the calendar feeds for the weekends (P2.24 B1).
  'data.region': ['db:standing_current', 'snapshot:standings:', 'snapshot:results:', 'snapshot:f1:', 'db:post', 'snapshot:news:aggregate:', 'content:series', 'live:ics', 'db:session_result_current'],
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
  // A Filters region may also target the Headlines view (P2.5 PR C): the News page's list narrows by series; master-detail stays
  // on the three.
  const FILTER_VIEWS = [...ROW_VIEWS, 'headlines'];
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
  // Filters (P2.5): a Filters region's target reads its keys whatever its menus, as a detail does; only a target drawn as a
  // Table, Cards, List or Headlines, named by a Filters region's Filtered region, on a shape.
  const targetOf = (f: ComponentRegion) =>
    dataRegions.find(d => d.id === str(f.settings.filteredRegion) && FILTER_VIEWS.includes(str(d.settings.view) || 'table') && shapeOf(d) !== null) ??
    // A component declaring its own facets (the calendar, P2.5 PR B).
    regions.find(r => r.id === str(f.settings.filteredRegion) && (findComponent(r.component)?.facets?.length ?? 0) > 0) ??
    null;
  const filterTargets = regions.filter(r => r.component === 'data.filters').map(targetOf).filter((d): d is ComponentRegion => d !== null);
  const details = new Set([...pairs.map(p => p.detail), ...filterTargets]);
  const withControls = regions.filter(r => (r.component === 'data.region' && (details.has(r) || ((r.settings.sortable === true || r.settings.actions === true || r.settings.views === true || r.settings.download === true) && ['table', 'cards'].includes(str(r.settings.view) || 'table')))) || (r.component !== 'data.region' && details.has(r)));
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
  // One Source read per region and request (P2.5): a Filters region reads its target's rows through the same promise.
  const reads = new Map<string, Promise<SourceReadResult>>();
  const readFor = (r: ComponentRegion, source: SourceRef) => () => {
    let p = reads.get(r.id);
    if (!p) {
      p = sourceRead().then(m => m.readSource(source));
      reads.set(r.id, p);
    }
    return p;
  };
  const filtersOf = (f: ComponentRegion): RenderContext['filters'] => {
    const target = targetOf(f);
    const prefix = target ? controlsKey(target) : null;
    // A component with facets of its own (the calendar): its rows are its model's sessions, by series name and session kind.
    const own = target && target.component !== 'data.region' ? findComponent(target.component)?.facets : undefined;
    if (target && own && own.length > 0 && prefix !== null && where.view !== undefined) {
      const columns = own;
      return {
        prefix,
        shape: { columns },
        state: bindViewState(parseViewState(where.view, prefix).value, { columns }),
        rows: async () => {
          const [{ loadCalendarModel }, { classifySession }] = await Promise.all([calendar(), calendarGrid()]);
          return (await loadCalendarModel()).items.map(i => ({ seriesName: i.seriesName, sessionType: classifySession(i.session.title) }));
        },
      };
    }
    const shape = target ? shapeOf(target) : null;
    const preset = target ? findPreset(str(target.settings.preset)) : null;
    const spec = target ? findComponent(target.component) : null;
    const source = target && target.source && spec?.sources?.length ? parseSourceRef(target.source, spec.sources).value : null;
    if (!target || prefix === null || !shape || !preset || !source || where.view === undefined) return undefined;
    const read = readFor(target, source);
    return { prefix, shape, state: bindViewState(parseViewState(where.view, prefix).value, shape), rows: async () => presetRows((await read()).rows, preset, Number.MAX_SAFE_INTEGER) };
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
        // The tabs a Tabs region lists (P2.10): the declared document's regions of every kind, page level, in its order.
        const tabs = r.component === 'page.tabs' ? tabsOf(doc, r).map(t => ({ id: t.id, label: t.title.trim() || t.id, icon: t.icon })) : undefined;
        out[r.id] = await render(r.settings, { path: where.path, params: where.params ?? {}, page, first: r.id === firstInBody, source, pages, now, onSourceRead, href: where.href ?? where.path, view: where.view, controlsKey: controlsKey(r), read: source ? readFor(r, source) : undefined, filters: r.component === 'data.filters' ? filtersOf(r) : undefined, region: r.id, master: masterOf(r), detailKeys: detailKeysOf(r), tabs });
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
