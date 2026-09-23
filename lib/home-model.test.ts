import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Series } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/design/setting-defaults';

// P2.24 C: the live model reads the loaded series and the settings' priority; both are stood in for here, the rest is pure.
const loadAllSeries = vi.fn(async (): Promise<Series[]> => []);
vi.mock('@/lib/series', async importOriginal => ({ ...(await importOriginal<typeof import('@/lib/series')>()), loadAllSeries: () => loadAllSeries() }));
const loadSettings = vi.fn(async () => ({ ...DEFAULT_SETTINGS }));
vi.mock('@/lib/design/settings', async importOriginal => ({ ...(await importOriginal<typeof import('@/lib/design/settings')>()), loadSettings: () => loadSettings() }));

import { liveBoxes, liveStep, loadLiveModel, rankLiveWeekends, type LiveCandidate } from './home-model';

// Home-page precedence. Before 2026-09-04 this was purely temporal and on
// Italian Grand Prix Friday the page led with FORMULA 3, because F3's
// qualifying happened to fall before F1's second practice. The Grand Prix
// appeared nowhere. These cases pin the operator's rule so that cannot recur:
// F1 always leads, the four named majors each get a box ordered by soonest
// session, everything else collapses into one row.

const H = 3_600_000;
const at = (slug: string, hours: number) => ({ slug, nextStartMs: hours * H });

// P2.9: the live band's data from the weekends under way, pure over the candidates the temporal step finds.
describe('liveBoxes', () => {
  const now = new Date('2026-09-25T12:00:00Z');
  const session = (slug: string, uid: string, title: string, startH: number, hours = 1) => ({ uid, seriesSlug: slug, title, start: new Date(now.getTime() + startH * H), end: new Date(now.getTime() + (startH + hours) * H) });
  const cand = (slug: string, name: string, round: number, roundName: string, sessions: ReturnType<typeof session>[]): LiveCandidate =>
    ({ s: { meta: { slug, name, color: '#123456' } }, w: { key: `${slug}-${round}`, dateRangeLabel: '', isPast: false, round, roundName, sessions }, start: sessions[0].start }) as unknown as LiveCandidate;
  const f1 = cand('f1', 'Formula 1', 16, 'Italian Grand Prix', [session('f1', 'fp1', 'Practice 1', -2), session('f1', 'q', 'Qualifying', 2), session('f1', 'race', 'Race', 26, 2)]);
  const dtm = cand('dtm', 'DTM', 7, 'Red Bull Ring', [session('dtm', 'r1', 'Race 1', 3)]);
  const wsbk = cand('wsbk', 'WorldSBK', 9, 'Aragón', [session('wsbk', 'r2', 'Race 2', -3)]);

  it('boxes the featured weekends with their next timed session, derives the Also racing rows from the rest and drops a weekend with no timed session left, and lists every box in ranked order', () => {
    const boxes = liveBoxes([f1, dtm, wsbk], { lead: 'f1', majors: ['motogp'] }, now);
    expect(boxes.liveWeekends.map(b => b.seriesSlug)).toEqual(['f1']);
    expect(boxes.liveWeekends[0]).toMatchObject({ seriesName: 'Formula 1', color: '#123456', eventName: 'Italian Grand Prix', href: '/series/f1/weekend/16', nextSession: { name: 'Qualifying', startIso: '2026-09-25T14:00:00.000Z', endIso: '2026-09-25T15:00:00.000Z' }, alsoSameDay: [], alsoDayIso: '2026-09-25' });
    expect(boxes.alsoRacing).toEqual([{ seriesSlug: 'dtm', seriesName: 'DTM', color: '#123456', eventName: 'Red Bull Ring', href: '/series/dtm/weekend/7', sessionName: 'Race 1', startIso: '2026-09-25T15:00:00.000Z' }]);
    expect(boxes.liveAll.map(b => b.seriesSlug)).toEqual(['f1', 'dtm', 'wsbk']);
    expect(boxes.liveAll[2]).toMatchObject({ eventName: 'Aragón', nextSession: null });
  });
  it('is empty when nothing is under way', () => {
    expect(liveBoxes([], { lead: 'f1', majors: [] }, now)).toEqual({ liveWeekends: [], alsoRacing: [], liveAll: [] });
  });
});

// P2.24 C: the live step, pure over the loaded series: every weekend whose window straddles now (a day's lookahead), fed
// to liveBoxes; the live model reads it once per request for the Live band and the race-weekend conditions.
describe('liveStep and loadLiveModel', () => {
  const now = new Date('2026-09-25T12:00:00Z');
  const series = (slug: string, name: string, sessions: { uid: string; title: string; startH: number; hours?: number }[]) =>
    ({
      meta: { slug, name, color: '#123456', season: 2026 },
      sessions: sessions.map(s => ({ uid: s.uid, seriesSlug: slug, title: s.title, start: new Date(now.getTime() + s.startH * H), end: new Date(now.getTime() + (s.startH + (s.hours ?? 1)) * H) })),
    }) as unknown as Series;
  const f1 = series('f1', 'Formula 1', [{ uid: 'fp1', title: 'Practice 1', startH: -2 }, { uid: 'q', title: 'Qualifying', startH: 2 }, { uid: 'race', title: 'Race', startH: 26, hours: 2 }]);
  const dtm = series('dtm', 'DTM', [{ uid: 'r1', title: 'Race 1', startH: 3 }]);
  const wec = series('wec', 'FIA WEC', [{ uid: 'r', title: 'Race', startH: 24 * 9 }]);
  const priority = { lead: 'f1', majors: ['motogp'] };

  afterEach(() => {
    vi.useRealTimers();
  });

  it('finds the weekends under way, boxes the featured ones and rows the rest; a weekend nine days out is not under way; nothing without series', () => {
    const boxes = liveStep([wec, dtm, f1], priority, now);
    expect(boxes.liveWeekends.map(b => b.seriesSlug)).toEqual(['f1']);
    expect(boxes.liveWeekends[0]).toMatchObject({ seriesName: 'Formula 1', nextSession: { name: 'Qualifying' } });
    expect(boxes.alsoRacing.map(r => r.seriesSlug)).toEqual(['dtm']);
    expect(boxes.liveAll.map(b => b.seriesSlug)).toEqual(['f1', 'dtm']);
    expect(liveStep([], priority, now)).toEqual({ liveWeekends: [], alsoRacing: [], liveAll: [] });
  });

  it('loadLiveModel reads the loaded series and the settings’ two series values once, at the clock’s now', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
    loadAllSeries.mockResolvedValueOnce([dtm, f1]);
    loadSettings.mockResolvedValueOnce({ ...DEFAULT_SETTINGS, 'home.lead_series': 'dtm', 'home.major_series': ['f1'] });
    const m = await loadLiveModel();
    expect(m.liveWeekends.map(b => b.seriesSlug)).toEqual(['dtm', 'f1']);
    expect(m).toEqual(liveStep([dtm, f1], { lead: 'dtm', majors: ['f1'] }, now));
    expect(loadAllSeries).toHaveBeenCalledTimes(1);
    expect(loadSettings).toHaveBeenCalledTimes(1);
  });
});

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

  it('features the lead once when it is also named among the majors (the operator’s report of 2026-09-23: the Azerbaijan Grand Prix boxed twice in the band, the second box without its Also row)', () => {
    const { featured, also } = rankLiveWeekends([at('f1', 14), at('motogp', 19), at('f2', 13)], { lead: 'f1', majors: ['f1', 'motogp'] });
    expect(featured.map(f => f.slug)).toEqual(['f1', 'motogp']);
    expect(also.map(f => f.slug)).toEqual(['f2']);
    // The lead named among the majors but not racing: the majors feature on their own, as before (the reviewer's note).
    const absent = rankLiveWeekends([at('motogp', 19), at('f2', 13)], { lead: 'f1', majors: ['f1', 'motogp'] });
    expect(absent.featured.map(f => f.slug)).toEqual(['motogp']);
    expect(absent.also.map(f => f.slug)).toEqual(['f2']);
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

  it('takes the lead and the majors from the Application Settings when they are given', () => {
    // The operator's rows can rename the lead and the boxes without a deploy;
    // the shipped names above are only the fallback.
    const { featured, also } = rankLiveWeekends([at('f1', 14), at('motogp', 9), at('wec', 10), at('dtm', 8)], {
      lead: 'motogp',
      majors: ['wec', 'dtm'],
    });
    expect(featured.map(f => f.slug)).toEqual(['motogp', 'dtm', 'wec']);
    expect(also.map(f => f.slug)).toEqual(['f1']);
  });
});
