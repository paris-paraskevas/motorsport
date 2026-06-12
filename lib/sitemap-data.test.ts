import { describe, it, expect } from 'vitest';
import { buildSitemapEntries } from './sitemap-data';
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

  it('F1 has 22 weekend URLs in 2026 (cancelled Bahrain + Saudi rounds excluded)', async () => {
    const urls = await buildSitemapEntries();
    const f1Weekends = urls.filter((u) => u.url.includes('/series/f1/weekend/'));
    expect(f1Weekends).toHaveLength(22);
  });

  it('Formula E emits all 17 weekend URLs (doubleheader race 2s split into their own weekends)', async () => {
    // Before the 1b-2 fix the sitemap listed 17 FE rounds from rounds.json
    // while the pages only resolved 11 — six advertised URLs 404'd. Both
    // sides now derive from groupByWeekend, so this asserts page reality.
    const urls = await buildSitemapEntries();
    const feWeekends = urls.filter((u) => u.url.includes('/series/formula-e/weekend/'));
    expect(feWeekends).toHaveLength(17);
  });

  it('omits /drivers/* and /teams/* URLs (they 404 today)', async () => {
    const urls = await buildSitemapEntries();
    expect(urls.some((u) => u.url.includes('/drivers/'))).toBe(false);
    expect(urls.some((u) => u.url.includes('/teams/'))).toBe(false);
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

  it('no entry carries lastModified / changeFrequency / priority (Google ignores all three in 2026)', async () => {
    const urls = await buildSitemapEntries();
    for (const u of urls) {
      expect(u.lastModified).toBeUndefined();
      expect(u.changeFrequency).toBeUndefined();
      expect(u.priority).toBeUndefined();
    }
  });
});
