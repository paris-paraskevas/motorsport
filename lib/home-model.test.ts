import { describe, expect, it } from 'vitest';
import { changedFromStandings, liveBoxes, rankLiveWeekends, type LiveCandidate } from './home-model';

// P2.1: What it changed drawn from a Source's rows, the same shape the
// assembly builds from the brief: the leader, the gap to second, the top ten;
// no race context, so no winner's accent.
describe('changedFromStandings', () => {
  const driver = (position: number, points: number) => ({ kind: 'driver', position, name: `Driver ${position}`, points, code: null, team: 'T', wins: 0, class: null });
  it('reads the leader, the gap and the top ten from the driver rows, whatever their order; constructors are left aside', () => {
    const rows = [{ kind: 'constructor', position: 1, name: 'Mercedes', points: 468 }, ...Array.from({ length: 12 }, (_, i) => driver(12 - i, (12 - i) * -20 + 300))];
    const c = changedFromStandings(rows, 'Formula 1');
    expect(c).toMatchObject({ seriesName: 'Formula 1', leader: { name: 'Driver 1', points: 280 }, gapToSecond: 20 });
    expect(c!.top).toHaveLength(10);
    expect(c!.top[0]).toEqual({ position: 1, name: 'Driver 1', points: 280 });
    expect(c!.top[9]).toEqual({ position: 10, name: 'Driver 10', points: 100 });
    expect(c!.winnerName).toBeUndefined();
    expect(c!.seasonComplete).toBeUndefined();
  });
  it('is nothing without driver rows; a lone leader has no gap; a row missing its numbers is skipped', () => {
    expect(changedFromStandings([{ kind: 'constructor', position: 1, name: 'Mercedes', points: 468 }], 'Formula 1')).toBeNull();
    expect(changedFromStandings([], 'Formula 1')).toBeNull();
    expect(changedFromStandings([driver(1, 10)], 'X')).toMatchObject({ leader: { name: 'Driver 1', points: 10 }, gapToSecond: null });
    expect(changedFromStandings([driver(1, 10), { kind: 'driver', position: 'x', name: 'Broken', points: 1 }], 'X')!.top).toHaveLength(1);
  });
  it('P2.2: a source that carries several classes (a family series) is read for its first class only, never three tables merged; teams and manufacturers are left aside', () => {
    const at = (cls: string, position: number, points: number) => ({ kind: 'driver', position, name: `${cls} ${position}`, points, code: null, team: 'T', wins: null, class: cls });
    const rows = [at('Overall', 1, 98), { kind: 'team', position: 1, name: 'WRT', points: 120, class: 'Overall' }, at('Overall', 2, 91), at('Sprint Cup', 1, 50), at('Endurance Cup', 1, 60), at('Endurance Cup', 2, 55)];
    const c = changedFromStandings(rows, 'GT World Challenge')!;
    expect(c.leader).toEqual({ name: 'Overall 1', points: 98 });
    expect(c.gapToSecond).toBe(7);
    expect(c.top.map(r => r.name)).toEqual(['Overall 1', 'Overall 2']);
  });
});

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
