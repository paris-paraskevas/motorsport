import { describe, expect, it } from 'vitest';
import { NOINDEX_TABS, TABS, describeTab, describeHub, tabIsIndexed, tabsFor } from './tabs';
import { DESCRIPTION_MAX_PX, DESCRIPTION_MIN_PX, DESCRIPTION_PX, TITLE_MAX_PX, TITLE_PX, TITLE_SUFFIX, textWidth } from './site';

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

// X10 (the Seobility crawl of 1 October): every tab's title fits Seobility's width at the longest series name (the whole with
// the layout's " — Paddock Tracker" under 570 px by lib/site.ts's model), repeats no word, and leaves "Paddock" to the suffix;
// every description sits between the floor and the ceiling. The names are the fifteen of content/series/*/meta.json.
const SERIES_NAMES = ['ADAC Ravenol 24h Nürburgring', 'DTM', 'Formula 1', 'Formula 2', 'Formula 3', 'Formula E', 'GT World Challenge', 'IMSA', 'IndyCar', 'MotoGP', 'NASCAR Cup', 'NLS Nürburgring', 'FIA WEC', 'WRC', 'WorldSBK'];
const repeats = (t: string) => {
  const words: string[] = t.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [];
  return words.filter((w, i) => words.indexOf(w) !== i);
};

describe('X10: describeTab fits every series', () => {
  it('titles within the width with the suffix, no word twice, no Paddock; descriptions between the floor and the ceiling', () => {
    for (const name of SERIES_NAMES) {
      for (const { key } of TABS) {
        for (const singleEvent of [false, true]) {
          const { title, description } = describeTab(key, name, 2026, singleEvent);
          expect(textWidth(title + TITLE_SUFFIX, TITLE_PX), `${name} ${key} title "${title}"`).toBeLessThanOrEqual(TITLE_MAX_PX);
          expect(repeats(title), `${name} ${key} title "${title}"`).toEqual([]);
          expect(title, `${name} ${key}`).not.toMatch(/paddock/i);
          expect(textWidth(description, DESCRIPTION_PX), `${name} ${key} description "${description}"`).toBeGreaterThanOrEqual(DESCRIPTION_MIN_PX);
          expect(textWidth(description, DESCRIPTION_PX), `${name} ${key} description "${description}"`).toBeLessThanOrEqual(DESCRIPTION_MAX_PX);
          expect(description, `${name} ${key} description`).not.toContain('…');
        }
      }
    }
  });

  it('names the champions as past winners for a single-event series, and never says "full list, year by year"', () => {
    expect(describeTab('champions', 'ADAC Ravenol 24h Nürburgring', 2026, true).title).toBe('ADAC Ravenol 24h Nürburgring winners');
    expect(describeTab('champions', 'IMSA', 2026, true).title).toBe('IMSA past winners');
    for (const name of SERIES_NAMES) {
      const hub = describeHub(name, 2026);
      expect(textWidth(hub.title + TITLE_SUFFIX, TITLE_PX), name).toBeLessThanOrEqual(TITLE_MAX_PX);
      expect(hub.title, name).not.toBe(describeTab('calendar', name, 2026).title);
      expect(textWidth(hub.description, DESCRIPTION_PX), name).toBeLessThanOrEqual(DESCRIPTION_MAX_PX);
    }
    expect(describeTab('champions', 'Formula 2', 2026).title).toBe('Formula 2 champions, every season');
    expect(describeTab('champions', 'Formula 2', 2026).description).not.toContain('their own tab');
  });
});
