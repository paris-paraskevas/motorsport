import { describe, it, expect } from 'vitest';
import { aggregateBingRows } from './bing';

describe('aggregateBingRows', () => {
  it('collapses per-day rows per label, sums, sorts clicks-desc then impressions-desc', () => {
    const rows = aggregateBingRows([
      { Query: 'paddock gp', Clicks: 0, Impressions: 172 },
      { Query: 'paddock gp', Clicks: 0, Impressions: 10 },
      { Query: 'paddock tracker', Clicks: 2, Impressions: 5 },
      { Query: 'paddock tracker', Clicks: 1, Impressions: 3 },
      { Clicks: 5, Impressions: 5 }, // no Query → dropped
    ]);
    expect(rows).toEqual([
      { label: 'paddock tracker', clicks: 3, impressions: 8 }, // clicks win the sort
      { label: 'paddock gp', clicks: 0, impressions: 182 },
    ]);
  });

  it('is empty for no rows', () => {
    expect(aggregateBingRows([])).toEqual([]);
  });
});
