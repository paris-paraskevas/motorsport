import { describe, expect, it } from 'vitest';
import { rankLiveWeekends } from './home-model';

// Home-page precedence. Before 2026-09-04 this was purely temporal and on
// Italian Grand Prix Friday the page led with FORMULA 3, because F3's
// qualifying happened to fall before F1's second practice. The Grand Prix
// appeared nowhere. These cases pin the operator's rule so that cannot recur:
// F1 always leads, the four named majors each get a box ordered by soonest
// session, everything else collapses into one row.

const H = 3_600_000;
const at = (slug: string, hours: number) => ({ slug, nextStartMs: hours * H });

describe('rankLiveWeekends', () => {
  it('puts F1 first even when its session is the last of the day', () => {
    // The exact Monza Friday shape: F3 12:00, F2 12:55, WSBK 13:00, F1 14:00,
    // WEC 15:00. Input order is by weekend start, as the caller supplies it.
    const { featured, also } = rankLiveWeekends([
      at('f3', 12),
      at('f2', 12.9),
      at('wsbk', 13),
      at('f1', 14),
      at('wec', 15),
    ]);
    expect(featured.map(f => f.slug)).toEqual(['f1', 'wec']);
    expect(also.map(f => f.slug)).toEqual(['f3', 'f2', 'wsbk']);
  });

  it('orders the majors by soonest session, not by name or weekend start', () => {
    const { featured } = rankLiveWeekends([
      at('indycar', 22),
      at('motogp', 19),
      at('f1', 14),
      at('nascar-cup', 17),
    ]);
    expect(featured.map(f => f.slug)).toEqual(['f1', 'nascar-cup', 'motogp', 'indycar']);
  });

  it('features the majors on their own when F1 is not racing', () => {
    const { featured, also } = rankLiveWeekends([at('dtm', 9), at('motogp', 11), at('f2', 13)]);
    expect(featured.map(f => f.slug)).toEqual(['motogp']);
    expect(also.map(f => f.slug)).toEqual(['dtm', 'f2']);
  });

  it('sinks a major that has nothing left to run', () => {
    // Infinity is what the caller passes when no timed session remains.
    const { featured } = rankLiveWeekends([
      { slug: 'wec', nextStartMs: Number.POSITIVE_INFINITY },
      at('motogp', 20),
    ]);
    expect(featured.map(f => f.slug)).toEqual(['motogp', 'wec']);
  });

  it('falls back to the soonest-starting weekend when no named series is live', () => {
    // Otherwise the band would be empty on a weekend that is demonstrably busy.
    // Input is ordered by weekend start, so the first entry is that fallback
    // even though its next session is later than the others'.
    const { featured, also } = rankLiveWeekends([at('wsbk', 16), at('dtm', 10), at('f3', 12)]);
    expect(featured.map(f => f.slug)).toEqual(['wsbk']);
    expect(also.map(f => f.slug)).toEqual(['dtm', 'f3']);
  });

  it('returns nothing when nothing is live', () => {
    expect(rankLiveWeekends([])).toEqual({ featured: [], also: [] });
  });

  it('never lists a weekend in both featured and also', () => {
    const input = [at('f1', 14), at('wec', 15), at('f3', 12), at('motogp', 9)];
    const { featured, also } = rankLiveWeekends(input);
    expect(featured.length + also.length).toBe(input.length);
    for (const f of featured) expect(also).not.toContain(f);
  });
});
