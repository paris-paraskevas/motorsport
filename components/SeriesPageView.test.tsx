// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import type { Series } from '@/lib/types';

// R18: the series tab shell's two branches. A tab with a recipe of its own address keeps the back link, the BreadcrumbList and
// the foot around the composed body (the recipe's heading is the h1) and hands ComposedTab the WHOLE legacy layout, masthead
// and h1 included, to draw instead when the composition fails; every other tab is the legacy layout itself.
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: { href: string; children: ReactNode; className?: string }) => <a href={href} {...rest}>{children}</a> }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('not found');
  },
}));
const name = (slug: string) => (slug === 'f2' ? 'Formula 2' : 'Formula 3');
const meta = (slug: string) => ({ slug, name: name(slug), color: '#38bdf8', icsUrl: '', season: 2026, category: 'formula' as const });
const series = (slug: string): Series => ({ meta: meta(slug), sessions: [], overview: '', drivers: '', significance: '', fetchedAt: new Date('2026-10-01T12:00:00Z'), stale: false, configured: true });
vi.mock('@/lib/series', () => ({ loadSeries: async (slug: string) => series(slug), loadSeriesMeta: async (slug: string) => meta(slug) }));
vi.mock('@/lib/blog', () => ({ seriesPublishedPostCount: async () => 0 }));
vi.mock('@/components/tabs/ChampionsTab', () => ({ ChampionsTab: ({ series: s }: { series: Series }) => <div data-tab={`champions ${s.meta.slug}`} /> }));
let composition: 'drawn' | 'failed' = 'drawn';
vi.mock('@/components/tabs/ComposedTab', async () => {
  const actual = await vi.importActual<typeof import('@/components/tabs/ComposedTab')>('@/components/tabs/ComposedTab');
  return {
    hasComposedTab: actual.hasComposedTab,
    ComposedTab: ({ path, before, after, children }: { path: string; before?: ReactNode; after?: ReactNode; children: ReactNode }) =>
      composition === 'drawn' ? (
        <>
          {before}
          <div data-composed={path} />
          {after}
        </>
      ) : (
        <>{children}</>
      ),
  };
});

import { SeriesPageView } from './SeriesPageView';

const draw = async (slug: string) => renderToStaticMarkup(<>{await SeriesPageView({ slug, activeTab: 'champions' })}</>);
const count = (html: string, needle: string) => html.split(needle).length - 1;

describe('SeriesPageView (R18)', () => {
  beforeEach(() => {
    composition = 'drawn';
  });

  it('a tab with a recipe: the back link and the structured data before the composed body, the foot after it, no masthead of the shell’s (the recipe’s heading is the h1)', async () => {
    const html = await draw('f2');
    expect(html).toContain('data-composed="/series/f2/champions"');
    expect(count(html, '"BreadcrumbList"')).toBe(1);
    expect(html).toMatch(/<a href="\/series\/f2"[^>]*>← Formula 2<\/a>[\s\S]*data-composed="\/series\/f2\/champions"[\s\S]*>More Formula 2</);
    expect(html).not.toContain('<h1');
    expect(html).not.toContain('<header');
    expect(count(html, '>More Formula 2<')).toBe(1);
    expect(html).not.toContain('data-tab=');
  });

  it('the same tab when the composition fails: the whole legacy layout, masthead and h1 included, once', async () => {
    composition = 'failed';
    const html = await draw('f2');
    expect(html).not.toContain('data-composed');
    expect(count(html, '<h1')).toBe(1);
    expect(html).toMatch(/<h1[^>]*>Champions<\/h1>/);
    expect(html).toContain('>Formula 2 · 2026 season<');
    expect(count(html, '"BreadcrumbList"')).toBe(1);
    expect(count(html, '>More Formula 2<')).toBe(1);
    expect(html).toContain('data-tab="champions f2"');
  });

  it('a tab without a recipe is the legacy layout itself', async () => {
    const html = await draw('f3');
    expect(html).not.toContain('data-composed');
    expect(count(html, '<h1')).toBe(1);
    expect(html).toMatch(/<h1[^>]*>Champions<\/h1>/);
    expect(html).toContain('>Formula 3 · 2026 season<');
    expect(html).toContain('data-tab="champions f3"');
    expect(count(html, '"BreadcrumbList"')).toBe(1);
    expect(count(html, '>More Formula 3<')).toBe(1);
  });
});
