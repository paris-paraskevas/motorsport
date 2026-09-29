import 'server-only';
import { OWN_BREADCRUMB_LD, type CodePage } from './page-registry';
import { matchCodePage } from './composed-page';
import type { PageDestinations } from './destinations';
import type { TabKey } from '@/lib/tabs';

// The Breadcrumb's trail (P2.17; APEX: the Breadcrumb region over a breadcrumb's
// entries). Ours is derived, never edited (the Shared Components catalogue's own
// line): the site's addresses are its hierarchy, so the pages above an address
// are its prefixes, each the page that answers it. A code page of the registry
// is labelled by what its route draws (the series' name, the weekend's title,
// the topic's label…); a live row page by its name. Nothing where no page is: a
// prefix no page answers, a pattern whose resolver knows no such thing, a row
// page deleted (P1.12: its crumb is back with Reinstate). The page itself is
// always drawn, its segment in words when nothing better is known.
//
// THE IMPORTS ARE DYNAMIC ON PURPOSE (component-render.tsx's rule): this module
// is reached from the renderer's own dynamic import, and a static graph of the
// label sources here would land in every route's chunk.

export interface Crumb {
  label: string;
  href: string;
  /** The page itself: drawn as words with aria-current, never a link. */
  current: boolean;
}

/** What the renderer knows of the page: the registry pattern or the literal
 *  path, the address's parts, and the row for a page made in the designer. */
export interface TrailPage {
  path: string;
  params: Readonly<Record<string, string>>;
  page?: { title: string | null; name: string } | null;
}

/** The pattern with its parts filled: `/series/[slug]/[tab]` and `{ slug, tab }` → `/series/f1/standings`. */
export function fillPattern(pattern: string, params: Readonly<Record<string, string>>): string {
  const parts = pattern
    .split('/')
    .map(seg => {
      const m = /^\[(?:\.\.\.)?([a-z]+)\]$/.exec(seg);
      return m ? (params[m[1]] ?? '') : seg;
    })
    .filter(Boolean);
  return `/${parts.join('/')}`;
}

/** An address's prefixes, Home first, the address itself last. */
export function trailPrefixes(path: string): string[] {
  const parts = path.split('/').filter(Boolean);
  return ['/', ...parts.map((_, i) => `/${parts.slice(0, i + 1).join('/')}`)];
}

/** A segment in words, the fallback for a page nothing else names: `pierre-gasly` → Pierre Gasly. */
export function wordsFromSegment(segment: string): string {
  let plain = segment;
  try {
    plain = decodeURIComponent(segment);
  } catch {
    plain = segment;
  }
  return plain
    .split('-')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Whether the page's own code prints a BreadcrumbList, so the region prints none. */
export function ownsBreadcrumbLd(pattern: string): boolean {
  return OWN_BREADCRUMB_LD.has(pattern);
}

type Resolver = (params: Record<string, string>) => Promise<string | null>;

/** The session's own name, as the session page's metadata strips the series and the weekend before the dash. */
const sessionName = (title: string) => title.replace(/^.*?[-–—:]\s*/, '').trim() || title;

async function weekendOf(slug: string, round: string) {
  const [{ loadSeries }, { weekendFor }] = await Promise.all([import('@/lib/series'), import('@/lib/weekend')]);
  const series = await loadSeries(slug);
  const n = Number(round);
  return { weekend: Number.isInteger(n) && n > 0 ? weekendFor(series, n) : null, round: n };
}

/** A label per pattern, what the route draws today; null when there is no such page. A pattern absent here is one no
 *  resolver vouches for: no crumb as an ancestor, the segment in words as the page itself. */
const RESOLVERS: Readonly<Record<string, Resolver>> = {
  '/series/[slug]': async ({ slug }) => (await (await import('@/lib/series')).loadSeries(slug)).meta.name,
  '/series/[slug]/[tab]': async ({ tab }) => {
    const { TABS, labelForTab } = await import('@/lib/tabs');
    return TABS.some(t => t.key === tab) ? labelForTab(tab as TabKey) : null;
  },
  '/series/[slug]/weekend/[round]': async ({ slug, round }) => {
    const { weekend, round: n } = await weekendOf(slug, round);
    if (!weekend) return null;
    return (await import('@/lib/weekend')).weekendLabel(weekend, n).title;
  },
  '/series/[slug]/weekend/[round]/[session]': async ({ slug, round, session }) => {
    const { weekend } = await weekendOf(slug, round);
    if (!weekend) return null;
    const s = (await import('@/lib/weekend')).sessionBySlug(weekend, session);
    return s ? sessionName(s.title) : null;
  },
  '/information/[topic]': async ({ topic }) => (await import('@/lib/information/topics')).getTopic(topic)?.label ?? null,
  '/information/[topic]/[slug]': async ({ topic, slug }) => (await (await import('@/lib/information/registry')).getInfoEntry(topic, slug))?.question ?? null,
  '/blog/[slug]': async ({ slug }) => (await (await import('@/lib/blog')).getPostBySlug(slug))?.title ?? null,
  '/authors/[slug]': async ({ slug }) => (await (await import('@/lib/authors')).getAuthorBySlug(slug))?.displayName ?? null,
  '/drivers/[slug]': async ({ slug }) => (await (await import('@/lib/people')).findDriverBySlug(slug))?.name ?? null,
  '/teams/[slug]': async ({ slug }) => (await (await import('@/lib/people')).findTeamBySlug(slug))?.name ?? null,
  '/archive/[season]/[slug]': async ({ season, slug }) => `${(await (await import('@/lib/series')).loadSeries(slug)).meta.name} ${season}`,
};

/** A literal code page's name: its row's, the one the designer edits (the frame's memo, read once a minute), or the registry's. */
async function codePageName(page: CodePage): Promise<string> {
  try {
    const { loadPageFrame } = await import('./page-frame');
    return (await loadPageFrame(page.path))?.name || page.name;
  } catch {
    return page.name;
  }
}

/** The trail for a page: every prefix of its address that a page answers, Home first, the page itself last; Show Home and
 *  This page as the region's settings say. The live row pages are read once, and only when a prefix matches no code page. */
export async function breadcrumbTrail(where: TrailPage, opts: { home: boolean; current: boolean }): Promise<Crumb[]> {
  const prefixes = trailPrefixes(fillPattern(where.path, where.params));
  let live: Promise<PageDestinations> | null = null;
  const rowName = async (path: string): Promise<string | null> => {
    live ??= import('./pages')
      .then(m => m.loadPageDestinations())
      .catch(() => ({}) as PageDestinations);
    return Object.values(await live).find(p => p.path === path)?.name ?? null;
  };
  const labels = await Promise.all(prefixes.map((prefix, i) => labelFor(prefix, i === prefixes.length - 1, where, rowName)));
  const crumbs: Crumb[] = [];
  prefixes.forEach((href, i) => {
    const label = labels[i];
    if (label !== null) crumbs.push({ label, href, current: i === prefixes.length - 1 });
  });
  return crumbs.filter(c => (opts.home || c.href !== '/') && (opts.current || !c.current));
}

/** A page beside this one, for the Tabs strip over sibling pages (P2.10). */
export interface SiblingPage {
  label: string;
  href: string;
  current: boolean;
}

/** The pages beside an address (P2.10, the Tabs over sibling pages; ours: the series tabs stay one page per tab, so the
 *  strip links them): a series' sub-pages and News for a series page (the site's own list, lib/tabs.ts seriesSubPages), the
 *  Learn topics for a topic, the live row pages under the same parent for a page made in the designer; nothing elsewhere,
 *  and nothing with fewer than two. The current page is marked, never left out. */
export async function siblingPages(where: TrailPage): Promise<SiblingPage[]> {
  const address = fillPattern(where.path, where.params);
  const hit = matchCodePage(address);
  let list: { label: string; href: string }[] = [];
  try {
    if (hit && (hit.page.path === '/series/[slug]' || hit.page.path === '/series/[slug]/[tab]')) {
      const [{ loadSeries }, { seriesSubPages }] = await Promise.all([import('@/lib/series'), import('@/lib/tabs')]);
      const series = await loadSeries(hit.params.slug);
      list = [...seriesSubPages(series.meta).map(p => ({ label: p.label, href: p.href })), { label: 'News', href: `/series/${series.meta.slug}/news` }];
    } else if (hit && hit.page.path === '/information/[topic]') {
      const { INFO_TOPICS } = await import('@/lib/information/topics');
      list = INFO_TOPICS.map(t => ({ label: t.label, href: `/information/${t.id}` }));
    } else if (!hit) {
      const parentOf = (path: string) => path.split('/').slice(0, -1).join('/') || '/';
      const parent = parentOf(address);
      const live = await (await import('./pages')).loadPageDestinations();
      list = Object.values(live)
        .filter(p => parentOf(p.path) === parent)
        .sort((a, b) => a.path.localeCompare(b.path))
        .map(p => ({ label: p.name, href: p.path }));
    }
  } catch {
    list = [];
  }
  return list.length < 2 ? [] : list.map(p => ({ ...p, current: p.href === address }));
}

async function labelFor(prefix: string, current: boolean, where: TrailPage, rowName: (path: string) => Promise<string | null>): Promise<string | null> {
  const last = prefix.split('/').filter(Boolean).pop() ?? '';
  const hit = matchCodePage(prefix);
  if (hit) {
    if (!hit.page.path.includes('[')) return codePageName(hit.page);
    const resolve = RESOLVERS[hit.page.path];
    let label: string | null = null;
    if (resolve) {
      try {
        label = await resolve(hit.params);
      } catch {
        label = null;
      }
    }
    if (label !== null) return label;
    return current ? wordsFromSegment(last) : null;
  }
  // A page made in the designer: the row the caller knows for the page itself, the live pages for one above it.
  const own = where.page?.title || where.page?.name;
  if (current && own) return own;
  const name = await rowName(prefix);
  if (name !== null) return name;
  return current ? wordsFromSegment(last) : null;
}
