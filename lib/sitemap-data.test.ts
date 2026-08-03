import { describe, it, expect } from 'vitest';
import { buildSitemapEntries } from './sitemap-data';
import { TRACKS_TAB_SLUGS } from './tabs';
import { loadSeries } from './series';
import { groupByWeekend } from './group';
import { weekendLabel } from './weekend';
import { circuitLayoutFor } from './circuit-layout';
import { listPostSlugs } from './posts';
import { SITE_URL } from './site';

describe('buildSitemapEntries', () => {
  it('emits the home URL without a trailing slash (matches metadataBase)', async () => {
    const urls = await buildSitemapEntries();
    expect(urls[0]?.url).toBe(SITE_URL);
  });

  it('includes all 15 series index pages', async () => {
    const urls = await buildSitemapEntries();
    const seriesUrls = urls.filter((u) => /\/series\/[^/]+$/.test(u.url));
    expect(seriesUrls).toHaveLength(15);
  });

  it('F1 has 23 weekend URLs in 2026 (Saudi cancelled; Bahrain back, rescheduled at Sepang)', async () => {
    // 24 original rounds - Saudi (cancelled) - Bahrain (cancelled) = 22 until
    // 0.245.2 restored Bahrain as round 16 at Sepang (2-4 Oct) → 23. Stale-guard:
    // if this fails, re-check content/series/f1/rounds.json before touching it.
    const urls = await buildSitemapEntries();
    const f1Weekends = urls.filter((u) => u.url.includes('/series/f1/weekend/'));
    expect(f1Weekends).toHaveLength(23);
  });

  it('Formula E emits all 17 weekend URLs (doubleheader race 2s split into their own weekends)', async () => {
    // Before the 1b-2 fix the sitemap listed 17 FE rounds from rounds.json
    // while the pages only resolved 11 — six advertised URLs 404'd. Both
    // sides now derive from groupByWeekend, so this asserts page reality.
    const urls = await buildSitemapEntries();
    const feWeekends = urls.filter((u) => u.url.includes('/series/formula-e/weekend/'));
    expect(feWeekends).toHaveLength(17);
  });

  it('emits the Tracks tab URL only for coverage-gated series (today: f1)', async () => {
    const urls = await buildSitemapEntries();
    const trackUrls = urls
      .filter((u) => /\/series\/[^/]+\/tracks$/.test(u.url))
      .map((u) => u.url);
    expect(trackUrls).toEqual(
      TRACKS_TAB_SLUGS.map((slug) => `${SITE_URL}/series/${slug}/tracks`),
    );
  });

  it('every Tracks-tab series has real circuit-layout coverage (gate sync)', async () => {
    // TRACKS_TAB_SLUGS is a static list (lib/tabs is client- and
    // middleware-bundled, so it can't fs-check content/circuits-layout.json
    // itself). This test IS the sync: a slug may only be listed while most of
    // its season resolves a curated layout via the same resolver the tab uses.
    const now = new Date();
    for (const slug of TRACKS_TAB_SLUGS) {
      const series = await loadSeries(slug);
      const weekends = groupByWeekend(series.sessions, now, series.rounds).filter(
        (w) => w.round >= 1,
      );
      expect(weekends.length).toBeGreaterThan(0);
      const layouts = await Promise.all(
        weekends.map((w) =>
          circuitLayoutFor(
            w.sessions.find((s) => s.location)?.location,
            weekendLabel(w, w.round).title,
          ),
        ),
      );
      const covered = layouts.filter(Boolean).length;
      expect(covered / weekends.length).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('omits the top-level /drivers/* and /teams/* profile routes (they 404 today)', async () => {
    const urls = await buildSitemapEntries();
    // Target the actual top-level profile routes, not any URL containing the
    // substring — the information hub legitimately has /information/teams/* and
    // /information/drivers/* pages, which are a different, real route tree.
    expect(urls.some((u) => u.url.startsWith(`${SITE_URL}/drivers/`))).toBe(false);
    expect(urls.some((u) => u.url.startsWith(`${SITE_URL}/teams/`))).toBe(false);
  });

  it('every URL starts with SITE_URL', async () => {
    const urls = await buildSitemapEntries();
    for (const u of urls) {
      expect(u.url.startsWith(SITE_URL)).toBe(true);
    }
  });

  it('series index URLs are emitted alphabetically by slug', async () => {
    const urls = await buildSitemapEntries();
    const seriesSlugs = urls
      .filter((u) => /\/series\/[^/]+$/.test(u.url))
      .map((u) => u.url.split('/').pop()!);
    const sorted = [...seriesSlugs].sort((a, b) => a.localeCompare(b));
    expect(seriesSlugs).toEqual(sorted);
  });

  // The legacy MDX posts were retired in 0.249.0 (operator call: their pages
  // stopped rendering on the Cloudflare runtime, so the cards linked to broken
  // URLs). This pins content/posts EMPTY — the blog SOP forbids new MDX posts
  // (they auto-publish on merge, unsigned); if one legitimately returns, it must
  // also be re-added to the sitemap assertions here.
  it('carries no legacy MDX blog posts (retired 0.249.0; DB posts are the blog)', async () => {
    const slugs = await listPostSlugs();
    expect(slugs).toHaveLength(0);
  });

  it('emits each blog URL once and keeps /blog itself', async () => {
    const urls = (await buildSitemapEntries()).map((u) => u.url);
    const blogPosts = urls.filter((u) => u.startsWith(`${SITE_URL}/blog/`));
    expect(new Set(blogPosts).size).toBe(blogPosts.length);
    expect(urls).toContain(`${SITE_URL}/blog`);
  });

  it('no entry carries lastModified / changeFrequency / priority (Google ignores all three in 2026)', async () => {
    const urls = await buildSitemapEntries();
    for (const u of urls) {
      expect(u.lastModified).toBeUndefined();
      expect(u.changeFrequency).toBeUndefined();
      expect(u.priority).toBeUndefined();
    }
  });
});
