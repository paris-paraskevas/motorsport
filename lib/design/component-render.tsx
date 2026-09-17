import 'server-only';
import { cache, type ReactNode } from 'react';
import { firstBodyRegion, isLegacyBody, type ComponentRegion, type PageDocument } from './page-document';
import { findComponent, type SettingValue } from './components';
import { parseSourceRef, type SourceRef } from './sources';
import type { SourceProvenance } from './source-read';
import type { PageRow } from './pages';

// The server half of the component catalogue (lib/design/components.ts): how
// each component is drawn. A renderer takes the region's settings and the
// context (which page and address, whether this is the first component in
// the Body, so it carries the page's h1) and answers a node or nothing. Every
// renderer fails soft on its own: a component that throws draws nothing and
// the page stands.
//
// The Home components read the same assembly the home route uses
// (loadHomeModel, once per request) and apply their settings on top; the
// Calendar component reads its family's assembly the same way; the fact the
// race-weekend conditions need comes from the same place (raceWeekendNow).
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
const blog = () => import('@/lib/blog');
const calendar = () => import('./families/calendar');
const calendarView = () => import('@/components/calendar/CalendarView');
const sourceRead = () => import('./source-read');

export interface RenderContext {
  /** The registry pattern or literal path of the page. */
  path: string;
  /** The address's parts for a pattern page (`slug`, `round`); empty for a literal one. */
  params: Readonly<Record<string, string>>;
  /** The page itself, for components that draw its name or title. */
  page: Pick<PageRow, 'path' | 'name' | 'title'>;
  /** This component is the first region showing in the Body: it carries the page's h1. */
  first: boolean;
  /** The Source the region picked (P2.1), read against the sources its definition declares; null when none. */
  source: SourceRef | null;
  /** Tells the Debug trace what a source read answered (P2.1). */
  onSourceRead?: (p: SourceProvenance) => void;
}

type Renderer = (settings: Readonly<Record<string, SettingValue>>, ctx: RenderContext) => Promise<ReactNode> | ReactNode;

const num = (v: SettingValue | undefined, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const str = (v: SettingValue | undefined): string => (typeof v === 'string' ? v.trim() : '');

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
  async 'home.lead'(settings) {
    const [{ loadHomeModel, loadSeriesMeta }, { HomeLeadStory }, { fetchHomeBlogLead }] = await Promise.all([home(), pieces(), blog()]);
    const model = await loadHomeModel();
    const pinned = str(settings.pinned);
    let lead = model.blog;
    // A pin of the component's own, when it names another post than the page's
    // assembly chose; a pin that does not resolve keeps the assembly's lead.
    if (pinned && pinned !== lead?.slug) {
      const post = await fetchHomeBlogLead(pinned).catch(() => null);
      if (post) {
        const meta = post.seriesSlug ? (await loadSeriesMeta()).get(post.seriesSlug) : undefined;
        lead = { ...post, seriesName: meta?.name ?? null, seriesColor: meta?.color ?? null, ageLabel: null, suggested: model.blog?.suggested ?? [] };
      }
    }
    if (!lead) return null;
    return <HomeLeadStory blog={lead} suggested={num(settings.suggested, 3)} />;
  },
  async 'home.live'() {
    const [{ loadHomeModel }, { HomeThisWeekend }] = await Promise.all([home(), pieces()]);
    const model = await loadHomeModel();
    return <HomeThisWeekend liveWeekends={model.liveWeekends} alsoRacing={model.alsoRacing} />;
  },
  async 'home.result'(_settings, ctx) {
    const [{ loadHomeModel }, { HomeLatestResult }] = await Promise.all([home(), pieces()]);
    const model = await loadHomeModel();
    if (!model.result) return null;
    return <HomeLatestResult result={model.result} changed={model.changed} heading={ctx.first ? 'h1' : 'h2'} compact={!ctx.first} />;
  },
  async 'home.changed'(settings, ctx) {
    const [{ loadHomeModel, loadSeriesMeta, changedFromStandings }, { HomeWhatChanged }] = await Promise.all([home(), pieces()]);
    // A Source pins the table to one championship (P2.1): the catalogue's reader, the same shape the assembly builds.
    if (ctx.source) {
      const { readSource } = await sourceRead();
      const read = await readSource(ctx.source);
      ctx.onSourceRead?.(read.provenance);
      const slug = String(ctx.source.params.series ?? '');
      const changed = changedFromStandings(read.rows, (await loadSeriesMeta()).get(slug)?.name ?? slug);
      if (!changed) return null;
      return <HomeWhatChanged changed={changed} rows={num(settings.rows, 5)} />;
    }
    const model = await loadHomeModel();
    if (!model.changed) return null;
    return <HomeWhatChanged changed={model.changed} rows={num(settings.rows, 5)} />;
  },
  async 'home.next'() {
    const [{ loadHomeModel }, { HomeWhatsNext }] = await Promise.all([home(), pieces()]);
    const model = await loadHomeModel();
    return <HomeWhatsNext next={model.next} />;
  },
  async 'home.wire'(settings) {
    const [{ loadHomeModel, loadSeriesMeta, buildWire }, { HomeWire }] = await Promise.all([home(), pieces()]);
    const count = num(settings.items, 5);
    const model = await loadHomeModel();
    // The page's assembly already holds the setting's count; more is one more read of the same warm feed.
    const wire = model.wire.length >= count ? model.wire.slice(0, count) : await buildWire(count, await loadSeriesMeta());
    return <HomeWire wire={wire} />;
  },
};

/** Whether a component key has a renderer here. */
export function canRender(key: string): boolean {
  return key in RENDERERS;
}

/** What each component reads, as the Debug panel names it (P1.9): `content:`
 *  the bundle deployed with the site, `db:` a table read live, `snapshot:<prefix>`
 *  and `kv:<prefix>` the loader's tiers, whose run and phases the panel joins by
 *  prefix (lib/source-snapshot's meta). Declared beside the renderers, since the
 *  six Home components share one per-request assembly and a read cannot be
 *  attributed to one of them at run time. */
export const READS: Readonly<Record<string, readonly string[]>> = {
  'page.heading': [],
  'calendar.month': ['content:series'],
  'home.lead': ['db:post', 'content:series'],
  'home.live': ['content:series'],
  'home.result': ['kv:paddock:home:podium:v2:'],
  // Every series through withSourceSnapshot under standings:<slug>; F1 through its own last-good wrapper under f1:<name>.
  'home.changed': ['snapshot:standings:', 'snapshot:f1:'],
  'home.next': ['content:series'],
  'home.wire': ['snapshot:news:aggregate:'],
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
  page?: Pick<PageRow, 'path' | 'name' | 'title'>;
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
        out[r.id] = await render(r.settings, { path: where.path, params: where.params ?? {}, page, first: r.id === firstInBody, source, onSourceRead });
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
    const { loadHomeModel } = await home();
    const model = await loadHomeModel();
    return model.liveWeekends.length > 0 || model.alsoRacing.length > 0;
  } catch {
    return false;
  }
});
