import 'server-only';
import { cache, type ReactNode } from 'react';
import { isLegacyBody, type ComponentRegion, type PageDocument } from './page-document';
import type { SettingValue } from './components';

// The server half of the component catalogue (lib/design/components.ts): how
// each component is drawn. A renderer takes the region (its settings) and the
// context (which page, whether this is the first component in the Body, so it
// carries the page's h1) and answers a node or nothing. Every renderer fails
// soft on its own: a component that throws draws nothing and the page stands.
//
// The Home components read the same assembly the home route uses
// (loadHomeModel, once per request) and apply their settings on top; the
// facts a show rule needs come from the same place (raceWeekendNow).
//
// THE IMPORTS ARE DYNAMIC ON PURPOSE. This file is reached from
// page-frame.tsx, which every code route imports; a static import of the home
// assembly (the series loader, the content bundle, the news and blog readers)
// would pull that whole graph into every route's chunk and it did: the first
// build measured 58 MiB against 42 MiB before (the Worker's ceiling is 64
// MiB). Loaded on demand, the graph is one shared chunk, read only when a
// page actually carries a Home component.

const home = () => import('@/lib/home-model');
const pieces = () => import('@/components/HomeLead');
const blog = () => import('@/lib/blog');

export interface RenderContext {
  path: string;
  /** This component is the first region showing in the Body: it carries the page's h1. */
  first: boolean;
}

type Renderer = (settings: Readonly<Record<string, SettingValue>>, ctx: RenderContext) => Promise<ReactNode> | ReactNode;

const num = (v: SettingValue | undefined, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const str = (v: SettingValue | undefined): string => (typeof v === 'string' ? v.trim() : '');

const RENDERERS: Readonly<Record<string, Renderer>> = {
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
  async 'home.changed'(settings) {
    const [{ loadHomeModel }, { HomeWhatChanged }] = await Promise.all([home(), pieces()]);
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

/**
 * Draw every component region of a document (the transitional body excepted:
 * the frame places the code's body itself), by region id. The first region
 * showing in the Body is told so, for the h1. A renderer that throws yields
 * nothing for its region and nothing else is affected.
 */
export async function renderComponents(doc: PageDocument, ctx: { path: string }): Promise<Record<string, ReactNode>> {
  const out: Record<string, ReactNode> = {};
  const firstInBody = doc.regions.find(r => r.position === 'body' && !r.hidden)?.id ?? null;
  const regions = doc.regions.filter((r): r is ComponentRegion => r.kind === 'component' && !isLegacyBody(r));
  await Promise.all(
    regions.map(async r => {
      const render = RENDERERS[r.component];
      if (!render) return;
      try {
        out[r.id] = await render(r.settings, { path: ctx.path, first: r.id === firstInBody });
      } catch {
        out[r.id] = null;
      }
    }),
  );
  return out;
}

/** Whether a race weekend is under way now: a weekend with a box or a row on
 *  Home's live band, the fact the show rules "during a race weekend" and
 *  "between race weekends" decide on. Once per request. */
export const raceWeekendNow = cache(async (): Promise<boolean> => {
  try {
    const { loadHomeModel } = await home();
    const model = await loadHomeModel();
    return model.liveWeekends.length > 0 || model.alsoRacing.length > 0;
  } catch {
    return false;
  }
});
