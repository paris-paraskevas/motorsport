import { describe, expect, it } from 'vitest';
import { NOINDEX_TABS, TABS, tabIsIndexed, tabsFor } from './tabs';

// R14 (2026-09-28): the tabs kept out of the index live in ONE list, read by the
// page's robots rule (components/SeriesPageView.tsx seriesTabMetadata) and by
// the sitemap (lib/sitemap-data.ts), so the two cannot contradict each other.

describe('NOINDEX_TABS', () => {
  it('names news (aggregation) and the four table tabs, and nothing the series keeps in the index', () => {
    expect([...NOINDEX_TABS].sort()).toEqual(['blog', 'drivers', 'news', 'results', 'standings']);
    for (const key of ['calendar', 'champions', 'tracks', 'about', 'history'] as const) {
      expect(tabIsIndexed(key), key).toBe(true);
    }
    for (const key of NOINDEX_TABS) expect(tabIsIndexed(key), key).toBe(false);
  });

  it('only names tabs that exist, and leaves every series at least its calendar and its champions in the index', () => {
    const keys = new Set(TABS.map(t => t.key));
    for (const key of NOINDEX_TABS) expect(keys.has(key), key).toBe(true);
    for (const singleEvent of [false, true]) {
      const indexed = tabsFor(singleEvent, 'f1').filter(t => tabIsIndexed(t.key)).map(t => t.key);
      expect(indexed).toContain('calendar');
      expect(indexed).toContain('champions');
    }
  });
});
