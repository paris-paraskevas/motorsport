import 'server-only';
import { createElement, type ReactNode } from 'react';
import type { Metadata, ResolvingMetadata } from 'next';
import { notFound } from 'next/navigation';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { SITE_TITLE } from '@/lib/site';
import { RefusedPage } from '@/components/page/RefusedPage';
import { loadAuthzSchemes } from './authz';
import { allowedKeys, currentVisitor } from './authz-evaluate';
import { PAGE_APPLICATION_KEY, PAGE_COLUMNS, pageFromRow } from './pages';

// The frame around a page the code serves (the Page Designer plan, PR 1): the
// attributes a code page's row carries that the site reads at render, and the
// two helpers every code route goes through. `pageMetadata` puts the row's
// title and index rule over the code's own metadata; `withPageGate` refuses
// the page to a visitor who fails the row's scheme, the way the catch-all
// refuses a page made in the designer. The registry (page-registry.ts) names
// the paths; the coverage test in page-registry.test.ts requires both helpers
// in every route file, with the file's own path.
//
// THE RULE THIS FILE ENFORCES: the code is the fallback. No row, a row the
// parser cannot use, an unconfigured or unreachable database: the page renders
// exactly as its code says, and nothing is refused by accident. Only a row that
// asks for a scheme reads the visitor's session, so a wholly public page stays
// a cached render.

/** What the site reads from a code page's row. */
export interface PageFrame {
  name: string;
  title: string | null;
  indexable: boolean;
  authz: string | null;
}

const MEMO_MS = 60_000;
let memo: { at: number; value: Map<string, PageFrame> } | null = null;

export function resetPageFrameMemo(): void {
  memo = null;
}

/** Every code page's row, by path, read once a minute per isolate. Null when
 *  the rows cannot be read; a failed read is not memoised. */
async function loadFrames(): Promise<Map<string, PageFrame> | null> {
  if (!isBettingConfigured()) return null;
  if (memo && Date.now() - memo.at < MEMO_MS) return memo.value;
  try {
    const { data, error } = await betDb()
      .from('page')
      .select(PAGE_COLUMNS)
      .eq('application_key', PAGE_APPLICATION_KEY)
      .eq('kind', 'code');
    if (error || !Array.isArray(data)) return null;
    const value = new Map<string, PageFrame>();
    for (const item of data) {
      const row = pageFromRow(item);
      if (row) value.set(row.path, { name: row.name, title: row.title, indexable: row.indexable, authz: row.authz });
    }
    memo = { at: Date.now(), value };
    return value;
  } catch {
    return null;
  }
}

/** The row for a code page's registry path, or null when there is none or the rows cannot be read. */
export async function loadPageFrame(path: string): Promise<PageFrame | null> {
  const frames = await loadFrames();
  return frames?.get(path) ?? null;
}

function saysNoindex(robots: Metadata['robots']): boolean {
  if (!robots) return false;
  if (typeof robots === 'string') return /\bnoindex\b/i.test(robots);
  return robots.index === false;
}

/** The row over the code's metadata: a title set on the row replaces the page's
 *  own (the tab, the search result, and the social card with the site's suffix
 *  when the page has a card); `indexable` off adds `noindex, follow` unless the
 *  code already says noindex; `indexable` on leaves the code's rule, so an
 *  empty tab still says noindex on its own. Pure, for the tests. */
export function applyFrame(own: Metadata, frame: PageFrame): Metadata {
  const out: Metadata = { ...own };
  if (frame.title) {
    out.title = frame.title;
    const full = `${frame.title} — ${SITE_TITLE}`;
    if (own.openGraph) out.openGraph = { ...own.openGraph, title: full };
    if (own.twitter) out.twitter = { ...own.twitter, title: full };
  }
  if (!frame.indexable && !saysNoindex(own.robots)) out.robots = { index: false, follow: true };
  return out;
}

type MetadataBase<P> = Metadata | ((props: P, parent: ResolvingMetadata) => Metadata | Promise<Metadata>);

/** A route's `generateMetadata`: the code's own metadata (an object, or the
 *  function the route had) with the row's title and index rule applied. */
export function pageMetadata<P = unknown>(
  path: string,
  base: MetadataBase<P>,
): (props: P, parent?: ResolvingMetadata) => Promise<Metadata> {
  return async (props, parent) => {
    // Next always passes the parent; the routes' own tests call with the props alone.
    const own = typeof base === 'function' ? await base(props, parent as ResolvingMetadata) : base;
    const frame = await loadPageFrame(path);
    return frame ? applyFrame(own, frame) : own;
  };
}

/** A page's component as the routes write them: a server component, async or not. */
type PageComponent<P> = (props: P) => ReactNode | Promise<ReactNode>;

/** A route's default export: the page as it is, unless its row asks for a
 *  scheme the visitor fails. Then the scheme's message with Sign in when that
 *  could help, or the 404 when the scheme has no message; the same as the
 *  catch-all does for a page made in the designer. The page is called, not
 *  wrapped in an element, so the route behaves exactly as before to Next and
 *  to its own tests (its `notFound()` and `redirect()` propagate unchanged). */
export function withPageGate<P extends object>(path: string, Page: PageComponent<P>): (props: P) => Promise<ReactNode> {
  return async function GatedPage(props: P): Promise<ReactNode> {
    const frame = await loadPageFrame(path);
    const scheme = frame?.authz && frame.authz !== 'public' ? frame.authz : null;
    if (!frame || !scheme) return Page(props);
    const [visitor, schemes] = await Promise.all([currentVisitor(), loadAuthzSchemes()]);
    if (allowedKeys([scheme], schemes, visitor).has(scheme)) return Page(props);
    const rule = schemes.find(s => s.key === scheme);
    if (!rule?.message) notFound();
    return createElement(RefusedPage, {
      title: frame.title ?? frame.name,
      message: rule.message,
      signInHelps: !visitor.signedIn && rule.type !== 'public',
    });
  };
}
