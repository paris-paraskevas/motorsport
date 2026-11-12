import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { VenueForecast } from '@/lib/met-norway';
import type { CircuitMap, DriverStints, SessionExtras } from '@/lib/openf1/weekend';
import { escapeHtml, type CalendarEntry, type CalendarRound, type RaceLaps, type ResultRound, type SeriesData, type Table } from './render';
import { weekendPoints } from './series';
import {
  aside,
  bar,
  championship,
  classTable,
  cols,
  lapChartNotes,
  nextRound,
  nothingUsed,
  resultTabs,
  seasonPage,
  sessionBand,
  sessionCard,
  strip,
  tableOf,
  weekendBand,
  weekendOf,
  weekendPages,
} from './weekend';

const at = (round: number, session: string, start: string, dateOnly = false): CalendarEntry => ({
  start,
  end: new Date(Date.parse(start) + 3_600_000).toISOString(),
  dateOnly,
  event: 'E',
  session,
  round,
});
const table = (columns: string[], rows: string[][]): Table => ({ title: '', columns, rows });

const VER = 'Max Verstappen';
const LEC = 'Charles Leclerc';
const HAM = 'Lewis Hamilton';
const RUS = 'George Russell';
const ANT = 'Kimi <b>Antonelli</b>';
const BEA = 'Oliver Bearman';
const BACK = ['Driver 7', 'Driver 8', 'Driver 9', 'Driver 10', 'Driver 11', 'Driver 12'];
const TEAM: Record<string, string> = { [VER]: 'Red Bull Racing', [LEC]: 'Ferrari', [HAM]: 'Ferrari', [RUS]: 'Mercedes', [ANT]: 'Mercedes', [BEA]: 'Haas F1 Team' };
const row = (name: string, p: number, ...cells: string[]): string[] => [String(p), name, TEAM[name] ?? 'Williams', ...cells];

const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1, 0, 0];
const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1, 0, 0, 0, 0];
const classified = (order: string[], time: (p: number) => string, points = POINTS): Table =>
  table(['Pos', 'Driver', 'Team', 'Time', 'Pts'], order.map((name, i) => row(name, i + 1, time(i + 1), String(points[i]))));
/** Qualifying in three parts: the last two out after the first. */
const parts = (order: string[], q = 'Q'): Table =>
  table(
    ['Pos', 'Driver', 'Team', `${q}1`, `${q}2`, `${q}3`],
    order.map((name, i) => row(name, i + 1, `1:32.${String(i + 1).padStart(3, '0')}`, i < 10 ? `1:31.${String(i + 1).padStart(3, '0')}` : '', i < 10 ? `1:30.${String(i + 1).padStart(3, '0')}` : '')),
  );
const practice = (order: string[]): Table =>
  table(['Pos', 'Driver', 'Team', 'Time', 'Gap', 'Laps'], order.map((name, i) => row(name, i + 1, `1:32.${String(100 + i * 200).padStart(3, '0')}`, i ? `+0.${String(i * 200).padStart(3, '0')}` : '', '20')));

// Round 1 a standard weekend, round 2 a sprint weekend (both raced), round 3 to come, round 4 moved, round 5 called off.
// Level on 31 points after round 2, Hamilton holds a Grand Prix second and Russell a third: Russell's sprint win does
// not count in the countback.
const r1: ResultRound = {
  round: 1,
  name: 'Australian Grand Prix',
  date: '2026-03-08',
  sessions: [{ label: 'Race', tables: [classified([VER, LEC, RUS, HAM, ANT, BEA, ...BACK], p => (p === 1 ? '1:20:00.000' : `+${(p - 1) * 3}.000`))] }],
  others: [{ label: 'Qualifying', tables: [parts([LEC, VER, RUS, HAM, ANT, BEA, ...BACK])] }],
};
const r2: ResultRound = {
  round: 2,
  name: 'Chinese Grand Prix',
  date: '2026-03-15',
  sessions: [
    { label: 'Sprint', tables: [classified([RUS, VER, LEC, ANT, BEA, 'Driver 7', 'Driver 8', HAM, 'Driver 9', 'Driver 10', 'Driver 11', 'Driver 12'], p => (p === 1 ? '30:00.000' : `+${p - 1}.000`), SPRINT_POINTS)] },
    { label: 'Race', tables: [classified([VER, HAM, LEC, ANT, BEA, RUS, ...BACK], p => (p === 1 ? '1:35:00.000' : p === 12 ? 'Retired' : p === 11 ? '+1 lap' : `+${((p - 1) * 2.5).toFixed(3)}`))] },
  ],
  others: [
    { label: 'Practice 1', tables: [practice([LEC, VER, HAM, RUS])] },
    { label: 'Sprint Qualifying', tables: [parts([RUS, VER, LEC, HAM, ANT, BEA, ...BACK], 'SQ')] },
    { label: 'Qualifying', tables: [parts([VER, HAM, LEC, RUS, ANT, BEA, ...BACK])] },
  ],
};

const points: [number, number][] = Array.from({ length: 60 }, (_, i) => [Math.round(500 + 400 * Math.cos(i / 10)), Math.round(400 + 300 * Math.sin(i / 10))]);
const shanghai: CircuitMap = { year: 2026, session: 9001, driver: 3, lap: 93.5, sectors: [24.1, 33.2, 36.2], w: 1000, h: 800, points, split: [20, 40] };
const suzuka: VenueForecast = {
  fetched: '2026-03-26T00:00:00Z',
  expires: null,
  lastModified: null,
  steps: [
    { t: '2026-03-27T02:00:00.000Z', air: 14, symbol: 'partlycloudy_day', mm: 0, hours: 1 },
    { t: '2026-03-27T06:00:00.000Z', air: 16, symbol: 'lightrain', mm: 0.4, hours: 1 },
    { t: '2026-03-29T00:00:00.000Z', air: 18, symbol: 'rain', mm: 3.2, hours: 6 },
  ],
};
const r2Extras: Record<string, SessionExtras> = {
  Race: {
    key: 9003,
    at: '2026-03-16T00:00:00Z',
    weather: { air: [24, 25, 26], track: [38, 41, 44], humidity: [55, 70], rain: false },
    marks: { red: [{ lap: 33, restarted: true }] },
    stints: [
      [3, [['MEDIUM', 1, 20], ['HARD', 21, 59]]],
      [44, [['HARD', 1, 28], ['MEDIUM', 29, 59]]],
      [16, [['MEDIUM', 1, 18], ['HARD', 19, 40], ['SOFT', 41, 59]]],
      [12, [['HARD', 1, 59]]],
      [87, [['MEDIUM', 1, 30], ['HARD', 31, 59]]],
      [63, [['SOFT', 1, 15], ['HARD', 16, 59]]],
      [23, [['UNKNOWN', 1, 25], ['HARD', 26, 58]]],
      [55, [['SOFT', 1, 8], ['HARD', 9, 29]]],
    ],
  },
  Sprint: {
    key: 9002,
    at: '2026-03-15T00:00:00Z',
    weather: { air: [22, 23, 23], track: null, humidity: null, rain: true },
    marks: { late: { planned: '2026-03-14T03:00:00Z', started: '2026-03-14T03:25:00Z' } },
  },
  Qualifying: { key: 9001, at: '2026-03-15T00:00:00Z', weather: { air: [20, 21, 22], track: [30, 32, 33], humidity: [60, 65], rain: false } },
};

/** A driver in one place lap after lap, but where `at` says otherwise, as f1/laps.json keeps it (O28). */
const run = (place: number, laps: number, at: Record<number, number> = {}): string => Array.from({ length: laps }, (_, i) => at[i + 1] ?? place).join('.');
// Round 2's race, 59 laps: Hamilton crossed the line third and Leclerc second, classified the other way round; Driver
// 10 started from the pit lane; Driver 11 ran a lap fewer; Driver 12 stopped after 29. The stops as Jolpica lists them.
const r2Laps: RaceLaps = {
  laps: 59,
  at: '2026-03-16T00:00:00.000Z',
  drivers: [
    [VER, 1, run(1, 59), '20'],
    [HAM, 3, run(2, 59, { 1: 3, 2: 3, 59: 3 }), '28'],
    [LEC, 2, run(3, 59, { 1: 2, 2: 2, 59: 2 }), '18.40'],
    [ANT, 5, run(4, 59), ''],
    [BEA, 6, run(5, 59), '30'],
    [RUS, 4, run(6, 59), '15'],
    ['Driver 7', 7, run(7, 59), '22'],
    ['Driver 8', 8, run(8, 59), '24'],
    ['Driver 9', 9, run(9, 59), '26'],
    ['Driver 10', 0, run(10, 59), '27'],
    ['Driver 11', 10, run(11, 58), '25'],
    ['Driver 12', 11, run(12, 29), '8'],
  ],
};

const f1: SeriesData = {
  slug: 'f1',
  name: 'Formula 1',
  season: 2026,
  // As content/series/f1/meta.json sets it (O33): every page built.
  sites: { f1: { family: 'F1', pages: ['results', 'standings', 'champions', 'weekends'] } },
  standings: null,
  teams: [
    { name: 'Red Bull Racing', colour: '#1E3A8A', drivers: [{ name: VER, code: 'VER', number: 3 }] },
    { name: 'Ferrari', colour: '#DC0000', drivers: [{ name: LEC, code: 'LEC', number: 16 }, { name: HAM, code: 'HAM', number: 44 }] },
    { name: 'Mercedes', colour: '#00D7B6', drivers: [{ name: RUS, code: 'RUS', number: 63 }, { name: ANT, code: 'ANT', number: 12 }] },
    { name: 'Haas', colour: 'red;background:url(x)', drivers: [{ name: BEA, code: 'BEA', number: 87 }] },
    { name: 'Williams', colour: '#1868DB', drivers: [{ name: 'Driver 11', number: 23 }, { name: 'Driver 12', number: 55 }] },
  ],
  rounds: [
    { round: 1, name: 'Australian Grand Prix', startDate: '2026-03-06', endDate: '2026-03-08', venue: 'Albert Park Circuit', place: 'Australia', outline: 'albert-park', circuit: 'albert-park', tz: 'Australia/Melbourne', country: 'Australia' },
    { round: 2, name: 'Chinese Grand Prix', startDate: '2026-03-13', endDate: '2026-03-15', venue: 'Shanghai International Circuit', place: 'China', outline: 'shanghai', circuit: 'shanghai', tz: 'Asia/Shanghai', country: 'China' },
    { round: 3, name: 'Japanese Grand Prix', startDate: '2026-03-27', endDate: '2026-03-29', venue: 'Suzuka International Racing Course', place: 'Japan', outline: 'suzuka', circuit: 'suzuka', tz: 'Asia/Tokyo', country: 'Japan' },
    {
      round: 4,
      name: 'Miami Grand Prix',
      startDate: '2026-05-01',
      endDate: '2026-05-03',
      venue: 'Miami International Autodrome',
      place: 'Miami',
      circuit: 'miami',
      tz: 'America/New_York',
      country: 'United States',
      moved: { note: 'moved from April', from: '2026-04-03', to: '2026-04-05' },
    },
  ],
  cancelled: [{ round: 5, name: 'Saudi Arabian Grand Prix', place: 'Saudi Arabia', from: '2026-04-17', to: '2026-04-19', reason: 'Called off by the FIA' }],
  calendar: [
    at(1, 'Practice 1', '2026-03-06T01:30:00Z'),
    at(1, 'Practice 2', '2026-03-06T05:00:00Z'),
    at(1, 'Practice 3', '2026-03-07T01:30:00Z'),
    at(1, 'Qualifying', '2026-03-07T05:00:00Z'),
    at(1, 'Race', '2026-03-08T04:00:00Z'),
    at(2, 'Race', '2026-03-15T07:00:00Z'),
    at(2, 'Practice 1', '2026-03-13T03:30:00Z'),
    // A feed's second line for the same session, and a day with no hour: neither is a page of its own.
    at(2, 'Practice 1', '2026-03-13T05:30:00Z'),
    at(2, 'Fan forum', '2026-03-13T00:00:00Z', true),
    at(2, 'Sprint Qualifying', '2026-03-13T07:30:00Z'),
    at(2, 'Sprint', '2026-03-14T03:00:00Z'),
    at(2, 'Qualifying', '2026-03-14T07:00:00Z'),
    at(3, 'Practice 1', '2026-03-27T02:30:00Z'),
    at(3, 'Practice 2', '2026-03-27T06:00:00Z'),
    at(3, 'Practice 3', '2026-03-28T02:30:00Z'),
    at(3, 'Qualifying', '2026-03-28T06:00:00Z'),
    at(3, 'Race', '2026-03-29T05:00:00Z'),
  ],
  results: [r1, r2],
  weekend: {
    sessions: { '2026': { '2': r2Extras } },
    maps: { shanghai, 'albert-park': { ...shanghai, year: 2025, driver: 81 }, suzuka: { miss: 'no laps', next: '2026-03-30T00:00:00Z' } },
    forecast: { suzuka },
    laps: { '2026': { '1': { miss: '2026-03-08T07:00:00.000Z', next: '2026-03-08T08:00:00.000Z' }, '2': r2Laps } },
  },
};

const pages = weekendPages(f1);
const pageOf = (path: string, from = pages): string => {
  const p = from.find(x => x.path === path);
  if (!p) throw new Error(`no page ${path}`);
  return p.body;
};
/** One section of a page by its heading, up to the next section. */
const sectionOf = (body: string, title: string): string => {
  const from = body.indexOf(`<h2>${title}</h2>`);
  if (from < 0) return '';
  const end = body.indexOf('<section', from);
  return body.slice(from, end < 0 ? undefined : end);
};
const R = '/series/f1/2026/round-';

describe('weekendPages', () => {
  it("writes the season, each round's Overview and a page a timed session, on the Wide template", () => {
    const sessions = (n: number, ...names: string[]) => [`${R}${n}/`, ...names.map(s => `${R}${n}/${s}/`)];
    expect(pages.map(p => p.path)).toEqual([
      '/series/f1/2026/',
      ...sessions(1, 'practice-1', 'practice-2', 'practice-3', 'qualifying', 'race'),
      ...sessions(2, 'practice-1', 'sprint-qualifying', 'sprint', 'qualifying', 'race'),
      ...sessions(3, 'practice-1', 'practice-2', 'practice-3', 'qualifying', 'race'),
      `${R}4/`,
    ]);
    expect(pages.slice(0, 3).map(p => p.title)).toEqual(['Formula 1 2026', 'Australian Grand Prix 2026', 'Australian Grand Prix 2026: Practice 1']);
    expect(pages.find(p => p.path === `${R}2/sprint-qualifying/`)?.title).toBe('Chinese Grand Prix 2026: Sprint Qualifying');
    expect(pages.every(p => p.template === 'page-wide' && p.body.startsWith('<!-- wp:html -->'))).toBe(true);
    // A session keeps the feed's first time for it.
    expect(pageOf(`${R}2/practice-1/`)).toContain('data-utc="2026-03-13T03:30:00Z" data-f="wt">Fri 03:30 UTC</span> your time');
  });

  it('writes none for a series without weekend pages, a season or rounds', () => {
    expect(weekendPages({ ...f1, slug: 'f2' })).toEqual([]);
    expect(weekendPages({ ...f1, season: undefined })).toEqual([]);
    expect(weekendPages({ ...f1, rounds: [] })).toEqual([]);
  });

  it('writes the same pages whatever the hour', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-03-13T04:00:00Z'));
      const during = weekendPages(f1);
      vi.setSystemTime(new Date('2026-12-07T09:00:00Z'));
      expect(weekendPages(f1)).toEqual(during);
      expect(during).toEqual(pages);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the season page', () => {
  const season = pageOf('/series/f1/2026/');

  it('sits under the series band and tabs, lighting none', () => {
    expect(season).toContain('<h1>Formula 1</h1><p>2026 season · 4 rounds · 2 run · ');
    expect(season).toContain('<a href="/series/f1/">Overview</a>');
    expect(season).not.toContain('aria-current');
    expect(season).toContain('<h2>The 2026 season</h2><p>4 rounds · 2 run</p>');
  });

  it('tiles each weekend in date order, a moved round also where it was first set, a round called off struck through', () => {
    expect([...season.matchAll(/class="pd-sn-t[^"]*"[^>]*><small>([^<]+)<\/small>/g)].map(m => m[1])).toEqual([
      'Round 1 · 6–8 Mar',
      'Round 2 · 13–15 Mar',
      'Round 3 · 27–29 Mar',
      'Was 3–5 Apr',
      'Called off · was 17–19 Apr',
      'Round 4 · 1–3 May',
    ]);
    expect(season).toContain(
      `<a class="pd-sn-t" href="${R}1/" style="--t:#1E3A8A"><small>Round 1 · 6–8 Mar</small><b>Australian Grand Prix</b><span><i class="pd-tc" style="--t:#1E3A8A"></i>Max Verstappen</span><i class="pd-ol pd-ol-albert-park" aria-hidden="true"></i></a>`,
    );
    expect(season).toContain(
      `<a class="pd-sn-t is-now" href="${R}3/"><small>Round 3 · 27–29 Mar</small><b>Japanese Grand Prix</b><span class="pd-sn-next"><span class="pd-wk" data-from="2026-03-27" data-to="2026-03-29" data-on="This weekend">Next</span></span>`,
    );
    expect(season).toContain(`<a class="pd-sn-t is-moved" href="${R}4/"><small>Was 3–5 Apr</small><b>Miami Grand Prix</b><span>Moved to round 4: Miami, 1–3 May</span></a>`);
    expect(season).toContain('<span class="pd-sn-t is-off"><small>Called off · was 17–19 Apr</small><b>Saudi Arabian Grand Prix</b><span>Called off by the FIA</span></span>');
  });
});

describe('a weekend before it starts', () => {
  const before = pageOf(`${R}3/`);

  it('heads the weekend with its crumbs, its place and dates, and a bar of its pages, its sessions still to run', () => {
    expect(before).toContain(
      '<p class="pd-wk-crumb"><a href="/series/f1/">Formula 1</a> › <a href="/series/f1/2026/">2026 season</a> › Round 3 of 4</p><h1>Japanese Grand Prix</h1>' +
        '<p class="pd-wk-where">Suzuka International Racing Course, Japan · <span class="pd-wk-dt">27–29 March</span></p><span class="pd-wk-num" aria-hidden="true">3</span>',
    );
    expect(before).toContain(
      `<nav class="pd-wb" aria-label="Japanese Grand Prix: its pages"><a href="${R}3/" aria-current="page">Overview<small>the weekend</small></a>` +
        `<a href="${R}3/practice-1/" class="is-up">Practice 1<small><span class="pd-t" data-utc="2026-03-27T02:30:00Z" data-f="wt">Fri 02:30 UTC</span><span class="pd-vh"> · still to run</span></small></a>`,
    );
    expect(before.match(/class="is-up"/g)).toHaveLength(5);
  });

  it('names the next session with its countdown, beside Session emails and Follow', () => {
    expect(before).toContain(
      '<span class="pd-wk-nx" data-pd-ses="Practice%201|2026-03-27T02:30:00Z|2026-03-27T03:30:00.000Z;Practice%202|2026-03-27T06:00:00Z|2026-03-27T07:00:00.000Z;',
    );
    expect(before).toContain(
      '<em class="pd-wk-pill is-next">Next</em><span class="pd-wk-sum"><b class="pd-sr-ses">Practice 1 · <span class="pd-t" data-utc="2026-03-27T02:30:00Z" data-f="wt">Fri 02:30 UTC</span></b></span><span class="pd-wk-count" data-pd-target="2026-03-27T02:30:00Z" hidden>',
    );
    expect(before).toContain(
      '<span class="pd-wk-acts"><a class="pd-wk-btn" href="/subscribe/">Session emails</a><button type="button" class="pd-wk-btn" data-pd-follow="f1" data-off="Follow Formula 1" data-on="Following Formula 1 ✓" hidden>Follow Formula 1</button></span>',
    );
  });

  it("lays the sessions out by the track's days, your time and the track's, with MET Norway's forecast while it reaches them", () => {
    const weekend = sectionOf(before, 'The weekend');
    expect([...weekend.matchAll(/<h3 class="pd-wk-day">([^<]+)<\/h3>/g)].map(m => m[1])).toEqual(['Friday 27 March', 'Saturday 28 March', 'Sunday 29 March']);
    expect(weekend).toContain(
      `<a class="pd-wk-row" href="${R}3/practice-1/"><span class="pd-wk-when"><b><span class="pd-t" data-utc="2026-03-27T02:30:00Z" data-f="wt">Fri 02:30 UTC</span></b><small>Track 11:30</small></span>` +
        '<span class="pd-wk-name">Practice 1</span><span class="pd-wk-wx"><b>14°</b><small>Partly cloudy · 0 mm</small></span><span class="pd-wk-go"><span class="t">Its page</span> →</span></a>',
    );
    expect(weekend).toContain('<span class="pd-wk-name">Practice 3</span><span class="pd-wk-wx"></span>');
    expect(weekend).toContain('<span class="pd-wk-name">Race</span><span class="pd-wk-wx"><b>18°</b><small>Rain · 3.2 mm in 6 h</small></span>');
    expect(before).toContain('<p class="pd-wk-credit">Forecasts: Data from <a href="https://www.met.no/en">MET Norway</a></p>');
    // No map for the circuit yet, and nothing measured: OpenF1 goes uncredited.
    expect(before).not.toContain('pd-cm');
    expect(before).not.toContain('OpenF1');
  });

  it("sets the championship before the round beside the track's zone, the format and the rounds either side", () => {
    expect(before).toContain('<h3>Championship before round 3</h3>');
    expect(before).toContain(
      '<li><span class="p">1</span><i class="pd-tc" style="--t:#1E3A8A"></i><span class="d"><b>Max Verstappen</b><small>Red Bull Racing</small></span><span class="g">Leader</span><b class="pt">57</b></li>',
    );
    expect(before).toContain('<a class="pd-wk-more" href="/series/f1/standings/">Full standings →</a>');
    expect(before).toContain(
      '<dt>Circuit</dt><dd>Suzuka International Racing Course</dd><dt>Country</dt><dd>Japan</dd><dt>Track time</dt><dd>UTC+9<span class="pd-wk-ahead" data-pd-ahead="540" data-pd-at="2026-03-27T02:30:00Z"></span></dd><dt>Format</dt><dd>Standard weekend</dd>',
    );
    expect(before).toContain(`<a class="pd-wk-next" href="${R}4/"><small>Next round · 4</small><b>Miami Grand Prix</b><span>Miami · 1–3 May</span></a><a class="pd-wk-prev" href="${R}2/">‹ Round 2 · Chinese Grand Prix</a>`);
  });
});

describe('a weekend under way', () => {
  const during: SeriesData = {
    ...f1,
    results: [...f1.results!, { round: 3, name: 'Japanese Grand Prix', date: null, sessions: [], others: [{ label: 'Practice 1', tables: [practice([LEC, VER, HAM, RUS])] }, { label: 'Practice 2', tables: [practice([VER, LEC, RUS, HAM])] }] }],
  };
  const body = pageOf(`${R}3/`, weekendPages(during));

  it('cards the sessions run so far, three rows a practice, and lays out the rest by day', () => {
    const done = sectionOf(body, 'Done so far');
    expect(done.match(/<article class="pd-sc is-sm">/g)).toHaveLength(2);
    expect(done.match(/<li>/g)).toHaveLength(6);
    expect(done).toContain('<li><span class="p">1</span><i class="pd-tc" style="--t:#DC0000"></i><b>LEC</b><span class="nm">Charles Leclerc</span><span class="tt">1:32.100</span></li>');
    expect(done).toContain(`<a class="pd-sc-go" href="${R}3/practice-1/">All 4 on its page →</a>`);
    // A run session shows what OpenF1 measured, never the forecast.
    expect(done).not.toContain('pd-wk-wx');
    const still = sectionOf(body, 'Still to come');
    expect([...still.matchAll(/<span class="pd-wk-name">([^<]+)<\/span>/g)].map(m => m[1])).toEqual(['Practice 3', 'Qualifying', 'Race']);
  });

  it("names the first session still to run as next, and puts each run session's winner on the bar", () => {
    expect(body).toContain('<b class="pd-sr-ses">Practice 3 · <span class="pd-t" data-utc="2026-03-28T02:30:00Z" data-f="wt">Sat 02:30 UTC</span></b>');
    expect(body).toContain('data-pd-target="2026-03-28T02:30:00Z"');
    expect(body).toContain(`<a href="${R}3/practice-1/">Practice 1<small><span class="pd-t" data-utc="2026-03-27T02:30:00Z" data-f="wt">Fri 02:30 UTC</span> · LEC</small></a>`);
    expect(body.match(/class="is-up"/g)).toHaveLength(3);
  });
});

describe('a weekend after its race', () => {
  const sprint = pageOf(`${R}2/`);
  const standard = pageOf(`${R}1/`);

  it('opens on Final: who won, from pole, and who won the sprint', () => {
    expect(sprint).toContain(
      '<em class="pd-wk-pill is-fin">Final</em><span class="pd-wk-sum"><b>Max Verstappen</b> won from pole, and the sprint went to George Russell</span><span class="pd-wk-acts"><button type="button" class="pd-wk-btn" data-pd-follow="f1"',
    );
    expect(standard).toContain('<span class="pd-wk-sum"><b>Max Verstappen</b> won</span>');
    expect(sprint).not.toContain('data-pd-ses');
  });

  it("leads with the race: the measured weather, its red flag, the podium, the top ten and a way to the race's page", () => {
    const race = sectionOf(sprint, 'Race result');
    expect(race).toContain('<p class="pd-wk-hint"><span class="pd-t" data-utc="2026-03-15T07:00:00Z" data-f="t">07:00 UTC</span> your time · air 25°, track 41°, dry</p>');
    expect(race).toContain('<span class="pd-wk-marks"><em class="pd-wk-mark is-red">Red flag on lap 33 · restarted</em></span>');
    expect(race).toContain(
      '<ol class="pd-wk-podium"><li style="--t:#1E3A8A"><small>Winner</small><b>Max Verstappen</b><span>Red Bull Racing</span><em>1:35:00.000</em></li>' +
        '<li style="--t:#DC0000"><small>P2</small><b>Lewis Hamilton</b><span>Ferrari</span><em>+2.500</em></li><li style="--t:#DC0000"><small>P3</small><b>Charles Leclerc</b><span>Ferrari</span><em>+5.000</em></li></ol>',
    );
    expect(race.match(/<tr>/g)).toHaveLength(1 + 10);
    expect(race).toContain(`<a class="pd-wk-link" href="${R}2/race/">All 12 on the race's page</a>`);
  });

  it("draws the Pit wall: the top ten's stints placed by lap, a line every five laps, each stint's laps and pit lap for its tooltip", () => {
    const wall = sectionOf(sprint, 'Pit wall');
    expect(wall.match(/<div class="pd-pw-row">/g)).toHaveLength(10);
    expect(wall).toContain(
      '<div class="pd-pw-row"><span class="pd-pw-d"><i class="pd-tc" style="--t:#1E3A8A"></i><b>VER</b></span><span class="pd-pw-bar">' +
        '<i class="pd-c-m" role="img" data-tip="VER · Medium · laps 1–20 · pitted at the end of lap 20" aria-label="VER · Medium · laps 1–20 · pitted at the end of lap 20" style="--l:0.00%;--w:33.90%">M</i>' +
        '<i class="pd-c-h" role="img" data-tip="VER · Hard · laps 21–59 · to the flag" aria-label="VER · Hard · laps 21–59 · to the flag" style="--l:33.90%;--w:66.10%">H</i>' +
        '<span class="pd-pw-g" style="--n:59"></span></span><span class="pd-pw-n">1 stop</span></div>',
    );
    expect(wall).toContain('<b>LEC</b></span>');
    expect(wall).toMatch(/<b>LEC<\/b><\/span><span class="pd-pw-bar">(<i [^>]+>[SMH]<\/i>){3}<span class="pd-pw-g" style="--n:59"><\/span><\/span><span class="pd-pw-n">2 stops<\/span>/);
    expect(wall).toContain('<span class="pd-pw-d">Lap · 59</span><span class="pd-pw-scale"><span class="is-first" style="--l:0%">1</span><span class="o" style="--l:8.47%">5</span><span style="--l:16.95%">10</span>');
    expect(wall).toContain('<span class="is-last" style="--l:100%">59</span></span>');
    // The key names the tyres the rows draw: Drivers 7 to 10 have no OpenF1 stints, so theirs on the FIA's stops are
    // not recorded. Its laps and stops are Jolpica's, credited.
    expect(wall).toContain(
      '<p class="pd-pw-key"><span><i class="pd-c-s"></i>Soft</span><span><i class="pd-c-m"></i>Medium</span><span><i class="pd-c-h"></i>Hard</span><span><i class="pd-c-u"></i>Tyre not recorded</span>' +
        '<span>Point at a stint, or tap it, for its laps</span><span class="pd-pw-credit">Laps: Jolpica F1 · CC BY-NC-SA 4.0</span></p>',
    );
    // The retirement in twelfth is the race's page's to show.
    expect(wall).not.toContain('out on lap');
  });

  it("adds a sprint weekend's points, then the earlier sessions' cards in running order", () => {
    const pts = sectionOf(sprint, 'The weekend’s points');
    expect([...pts.matchAll(/<b>([A-Z0-9]+)<\/b><span>[^<]+<\/span><\/td><td class="tm">[^<]+<\/td><td class="n">([^<]+)<\/td><td class="n">([^<]+)<\/td><td class="n tot">(\d+)<\/td>/g)].map(m => m.slice(1).join(' '))).toEqual([
      'VER 7 25 32',
      'LEC 6 15 21',
      'HAM 1 18 19',
      'ANT 5 12 17',
      'RUS 8 8 16',
      'BEA 4 10 14',
      '7 3 6 9',
      '8 2 4 6',
      '9 – 2 2',
      '10 – 1 1',
    ]);
    expect(sectionOf(standard, 'The weekend’s points')).toBe('');
    const earlier = sectionOf(sprint, 'Earlier in the weekend');
    expect([...earlier.matchAll(/<h3>([^<]+)<\/h3>/g)].map(m => m[1])).toEqual(['Practice 1', 'Sprint Qualifying', 'Sprint', 'Qualifying']);
    const card = (name: string) => earlier.slice(earlier.indexOf(`<h3>${name}</h3>`), earlier.indexOf('</article>', earlier.indexOf(`<h3>${name}</h3>`)));
    expect(card('Practice 1').match(/<li>/g)).toHaveLength(3);
    expect(card('Sprint Qualifying').match(/<li>/g)).toHaveLength(10);
    expect(card('Qualifying').match(/<li>/g)).toHaveLength(10);
    // A qualifying card leads with each driver's best time: the last part reached.
    expect(card('Qualifying')).toContain('<b>VER</b><span class="nm">Max Verstappen</span><span class="tt">1:30.001</span></li>');
  });

  it('times a late session from its real start, marks it, and shows the sprint’s eight scorers with their points', () => {
    const earlier = sectionOf(sprint, 'Earlier in the weekend');
    const card = earlier.slice(earlier.indexOf('<h3>Sprint</h3>'), earlier.indexOf('</article>', earlier.indexOf('<h3>Sprint</h3>')));
    expect(card).toContain(
      '<h3>Sprint</h3><p><span class="pd-t" data-utc="2026-03-14T03:25:00Z" data-f="wt">Sat 03:25 UTC</span> your time · Sat 11:25 at the track</p><span class="pd-wk-marks"><em class="pd-wk-mark">Started 25 minutes late</em></span></div><span class="pd-wk-wx"><b>23°</b><small>air · rain</small></span></header>',
    );
    expect(card.match(/<li>/g)).toHaveLength(8);
    expect(card).toContain('<b>RUS</b><span class="nm">George Russell</span><span class="tt">30:00.000</span><span class="pp">8</span></li>');
    expect(card).toContain(`<a class="pd-sc-go" href="${R}2/sprint/">All 12 on its page →</a>`);
  });

  it("maps the circuit from this season's pole lap, naming its driver, or last year's without, and credits OpenF1", () => {
    expect(sprint).toContain(
      '<div class="pd-cm-draw" role="img" aria-label="Shanghai International Circuit, drawn from a pole lap, with its three sectors and the start/finish line" data-pd-map="1000 800|20 40|900,400 ',
    );
    expect(sprint).toContain('<dt><i class="pd-cm-k1"></i>Sector 1</dt><dd>24.100 s</dd>');
    expect(sprint).toContain('<dt>The lap</dt><dd>1:33.500</dd>');
    expect(sprint).toContain("<p>Drawn from Max Verstappen's pole lap in qualifying: the car's position as OpenF1 recorded it");
    expect(standard).toContain("<p>Drawn from the pole lap in qualifying here in 2025: the car's position");
    expect(sprint).toContain('<p class="pd-wk-credit">The weather, race control’s marks, the tyres and the circuit’s pole lap from <a href="https://openf1.org/">OpenF1</a></p>');
    // A page credits only what it shows: round 1 holds a map and no measured data.
    expect(standard).toContain('<p class="pd-wk-credit">The circuit’s pole lap from <a href="https://openf1.org/">OpenF1</a></p>');
    const thin = weekendPages({ ...f1, weekend: { ...f1.weekend!, maps: { shanghai: { ...shanghai, points: points.slice(0, 40) } } } });
    expect(pageOf(`${R}2/`, thin)).not.toContain('pd-cm');
  });

  it('sets the championship after the round, drivers level on points split on Grand Prix finishes, sprints not counted', () => {
    const champ = sprint.slice(sprint.indexOf('<h3>Championship after round 2</h3>'), sprint.indexOf('</section>', sprint.indexOf('<h3>Championship after round 2</h3>')));
    expect([...champ.matchAll(/<b>([^<]+)<\/b><small>[^<]*<\/small><\/span><span class="g">([^<]+)<\/span><b class="pt">(\d+)<\/b>/g)].map(m => m.slice(1).join(' '))).toEqual([
      'Max Verstappen Leader 57',
      'Charles Leclerc −18 39',
      'Lewis Hamilton −26 31',
      'George Russell −26 31',
      'Kimi &lt;b&gt;Antonelli&lt;/b&gt; −30 27',
    ]);
  });

  it('takes the official table after the latest round raced, which carries any penalty, and sums the races before it', () => {
    const official = table(['Pos', 'Driver', 'Team', 'Pts'], [row(VER, 1, '55'), row(LEC, 2, '39'), row(HAM, 3, '31'), row(RUS, 4, '31'), row(ANT, 5, '27'), row(BEA, 6, '22')]);
    const withTable = weekendPages({ ...f1, standings: [official] });
    expect(pageOf(`${R}2/`, withTable)).toContain('<b>Max Verstappen</b><small>Red Bull Racing</small></span><span class="g">Leader</span><b class="pt">55</b>');
    expect(pageOf(`${R}2/`, withTable)).toContain('<span class="g">−16</span><b class="pt">39</b>');
    const first = pageOf(`${R}1/`, withTable);
    expect(first).toContain('<h3>Championship after round 1</h3>');
    expect([...first.matchAll(/<span class="g">([^<]+)<\/span><b class="pt">(\d+)<\/b>/g)].map(m => `${m[1]} ${m[2]}`)).toEqual(['Leader 25', '−7 18', '−10 15', '−13 12', '−15 10']);
  });
});

describe("a session's page", () => {
  it('classifies every driver in every part, the parts before the last for the wide screen only', () => {
    const q = pageOf(`${R}2/qualifying/`);
    expect(q).toContain(
      '<p class="pd-wk-crumb"><a href="/series/f1/">Formula 1</a> › <a href="/series/f1/2026/">2026</a> › <a href="/series/f1/2026/round-2/">Round 2 · Chinese Grand Prix</a></p><h1>Qualifying</h1>' +
        '<p class="pd-ss-sub">Saturday 14 March · 15:00 at the track, <span class="pd-t" data-utc="2026-03-14T07:00:00Z" data-f="wt">Sat 07:00 UTC</span> your time</p>',
    );
    expect(q).toContain(`<a href="${R}2/qualifying/" aria-current="page">Qualifying<small>`);
    expect(q).toContain('<p class="pd-wk-hint">All 12, as classified; each driver’s best time in each part</p>');
    expect(q).toContain('<tr><th class="p">Pos</th><th class="d">Driver</th><th class="tm">Team</th><th class="t q">Q1</th><th class="t q">Q2</th><th class="t">Q3</th></tr>');
    expect(q.match(/<tr>/g)).toHaveLength(1 + 12);
    expect(q).toContain('<td class="tm">Williams</td><td class="t q">1:32.012</td><td class="t q">–</td><td class="t">–</td></tr>');
    expect(q).toContain('<h3>Weather at the track</h3><dl><dt>Air</dt><dd>20–22 °C</dd><dt>Track</dt><dd>30–33 °C</dd><dt>Humidity</dt><dd>60–65 %</dd><dt>Rain</dt><dd>None</dd></dl>');
    expect(q).toContain('href="https://openf1.org/"');
    expect(q).not.toContain('pd-pw');
  });

  it("gives a race's page its Pit wall for every driver, a retirement out on its last lap", () => {
    const race = pageOf(`${R}2/race/`);
    expect(race).toContain('<p class="pd-wk-hint">All 12, as classified</p>');
    expect(race).toContain('<em class="pd-wk-mark is-red">Red flag on lap 33 · restarted</em>');
    expect(race.match(/<div class="pd-pw-row">/g)).toHaveLength(12);
    expect(race).toContain('<i class="pd-c-h" role="img" data-tip="12 · Hard · laps 9–29 · out on lap 29" aria-label="12 · Hard · laps 9–29 · out on lap 29" style="--l:13.56%;--w:35.59%">H</i>');
    expect(race).toMatch(/<b>12<\/b><\/span><span class="pd-pw-bar">.*?<\/span><span class="pd-pw-n">out<\/span>/);
    expect(race).toContain('data-tip="11 · Hard · laps 26–58 · to the flag"');
    // A tyre OpenF1 did not record: grey, a question mark, and said so.
    expect(race).toContain('<i class="pd-c-u" role="img" data-tip="11 · Tyre not recorded · laps 1–25 · pitted at the end of lap 25" aria-label="11 · Tyre not recorded · laps 1–25 · pitted at the end of lap 25" style="--l:0.00%;--w:42.37%">?</i>');
    expect(race).toContain('<dt>Rain</dt><dd>None</dd>');
  });

  it('says a session not yet run is not run yet, with the forecast for its start', () => {
    const race = pageOf(`${R}3/race/`);
    expect(race).toContain('<p class="pd-wk-empty">Not run yet. Its results join this page when it ends.</p>');
    expect(race).toContain('<h3>Forecast for its start</h3><div class="pd-wk-fc"><span class="pd-wk-wx"><b>18°</b><small>Rain · 3.2 mm in 6 h</small></span></div><p class="pd-wk-src">The sky and rain over the six hours it starts in</p>');
    expect(race).toContain('Data from <a href="https://www.met.no/en">MET Norway</a>');
    // Beyond the forecast's reach: no box, and nothing to credit.
    const p3 = pageOf(`${R}3/practice-3/`);
    expect(p3).not.toContain('Forecast for its start');
    expect(p3).not.toContain('pd-wk-credit');
  });

  it('marks a minute-late start and a red flag after which the session did not start again', () => {
    const marked: SeriesData = {
      ...f1,
      weekend: { ...f1.weekend!, sessions: { '2026': { '2': { ...r2Extras, 'Practice 1': { key: 9000, at: '2026-03-14T00:00:00Z', marks: { late: { planned: '2026-03-13T03:30:00Z', started: '2026-03-13T03:31:00Z' }, red: [{ lap: null, restarted: false }] } } } } } },
    };
    const p1 = pageOf(`${R}2/practice-1/`, weekendPages(marked));
    expect(p1).toContain('<span class="pd-wk-marks"><em class="pd-wk-mark">Started 1 minute late</em><em class="pd-wk-mark is-red">Red flag · not restarted</em></span>');
    expect(p1).toContain('<p class="pd-ss-sub">Friday 13 March · 11:31 at the track, <span class="pd-t" data-utc="2026-03-13T03:31:00Z" data-f="wt">Fri 03:31 UTC</span> your time</p>');
  });
});

describe('the lap chart (O28)', () => {
  /** The chart's data as the theme's script reads it: the laps and rows, the spans, and each driver's eleven fields
   *  (code, colour, dashed, start, pit lane, finish, end, places, stops, name, team) by code. */
  const chartData = (body: string) => {
    const raw = /data-pd-laps="([^"]*)"/.exec(body)?.[1] ?? '';
    const text = raw.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    const [head, spans, drivers = ''] = text.split('|');
    return { head, spans, drivers: new Map(drivers.split(';').map(s => s.split(',')).map(f => [f[0], f] as const)) };
  };
  /** One row of the places table by its code: its cells as text. */
  const tableRow = (body: string, code: string): string[] => {
    const tr = body.slice(body.indexOf('<tbody>')).split('<tr>').find(r => r.includes(`<b>${code}</b>`)) ?? '';
    return [...tr.matchAll(/<td[^>]*>(.*?)<\/td>/g)].map(m => m[1].replace(/<[^>]+>/g, ''));
  };
  const withRace = (change: { rows?: (row: string[]) => string[]; extras?: Partial<SessionExtras>; laps?: RaceLaps }): SeriesData => ({
    ...f1,
    results: [r1, { ...r2, sessions: [r2.sessions[0], { label: 'Race', tables: [{ ...r2.sessions[1].tables[0], rows: r2.sessions[1].tables[0].rows.map(change.rows ?? (row => row)) }] }] }],
    weekend: { ...f1.weekend!, sessions: { '2026': { '2': { ...r2Extras, Race: { ...r2Extras.Race, ...change.extras } } } }, laps: { '2026': { '2': change.laps ?? r2Laps } } },
  });
  const race = pageOf(`${R}2/race/`);
  const chart = sectionOf(race, 'Lap chart');

  it("sits on the race's page between the Classification and Pit wall, drawn by the theme's script, with its key, credit and table", () => {
    expect(race.indexOf('<h2>Classification</h2>')).toBeLessThan(race.indexOf('<h2>Lap chart</h2>'));
    expect(race.indexOf('<h2>Lap chart</h2>')).toBeLessThan(race.indexOf('<h2>Pit wall</h2>'));
    expect(race).toContain('<section class="pd-wk-sec" id="lap-chart"><div class="pd-wk-sh"><h2>Lap chart</h2><p class="pd-wk-hint">Each driver’s place at the end of every lap</p></div>');
    expect(chart).toContain(
      '<div class="pd-lc"><p class="pd-lc-read" role="status" hidden></p><div class="pd-lc-draw" role="img" aria-label="Lap chart of the Chinese Grand Prix: each driver’s place at the end of each of its 59 laps. Arrow keys follow a driver; the table below holds the same places." data-pd-laps="59 12|',
    );
    expect(chart).toContain('<span class="pd-lc-credit">Laps: Jolpica F1 · CC BY-NC-SA 4.0</span></p><details class="pd-lc-tbl"><summary>Places as a table</summary>');
    const { head, spans, drivers } = chartData(chart);
    expect([head, spans, drivers.size]).toEqual(['59 12', '', 12]);
    expect(drivers.get('VER')).toEqual(['VER', '#1E3A8A', '0', '1', '0', '1', 'f', run(1, 59), '20', VER, 'Red Bull Racing']);
    // The table: every tenth lap and the flag, as the chart's places; the stops the FIA's (Jolpica's pit stops).
    expect(chart).toContain('<tr><th class="p">Finish</th><th class="d">Code</th><th class="dn">Driver</th><th class="tm">Team</th><th class="n">Grid</th><th class="n">Lap 10</th><th class="n">20</th><th class="n">30</th><th class="n">40</th><th class="n">50</th><th class="n">Flag</th><th class="n">Stops on lap</th></tr>');
    expect(tableRow(chart, 'VER')).toEqual(['1', 'VER', VER, 'Red Bull Racing', '1', '1', '1', '1', '1', '1', '1', '20']);
    // The other sessions' pages carry none.
    expect(pageOf(`${R}2/sprint/`)).not.toContain('pd-lc');
    expect(pageOf(`${R}2/qualifying/`)).not.toContain('pd-lc');
  });

  it('starts a car from the pit lane after the last car on the grid, labelled PL', () => {
    expect(chartData(chart).drivers.get('10')?.slice(3, 5)).toEqual(['12', '1']);
    expect(tableRow(chart, '10').slice(0, 5)).toEqual(['10', '10', 'Driver 10', 'Williams', 'PL']);
  });

  it('crosses a retirement out where it stopped, and runs a lapped car to its last lap without a cross', () => {
    const { drivers } = chartData(chart);
    expect(drivers.get('12')?.slice(5, 8)).toEqual(['12', 'x', run(12, 29)]);
    expect(drivers.get('11')?.slice(5, 8)).toEqual(['11', 'f', run(11, 58)]);
    expect(chart).toContain('<span class="pd-lc-k"><i class="pd-lc-kx"></i>Out of the race</span>');
    expect(tableRow(chart, '12').slice(5)).toEqual(['12', '12', 'out', '–', '–', '–', '8']);
    expect(tableRow(chart, '11').slice(5, 11)).toEqual(['11', '11', '11', '11', '11', '11']);
  });

  it('marks a driver placed differently in the result than at the flag, and names the race in the log', () => {
    const { drivers } = chartData(chart);
    expect(drivers.get('HAM')?.slice(5, 7)).toEqual(['2', 'f']);
    expect(drivers.get('HAM')?.[7].endsWith('.2.3')).toBe(true);
    expect(tableRow(chart, 'HAM').slice(0, 1)).toEqual(['2†']);
    expect(tableRow(chart, 'LEC').slice(0, 1)).toEqual(['3†']);
    expect(tableRow(chart, 'HAM')[10]).toBe('3');
    expect(chart).toContain('<span class="pd-lc-k"><b>†</b> placed differently in the result than at the flag</span>');
    expect(lapChartNotes(f1)).toEqual([{ round: 2, differs: ['HAM P3→P2', 'LEC P2→P3'], unjoined: [] }]);
    const same = withRace({ laps: { ...r2Laps, drivers: r2Laps.drivers.map(([n, g, p, s]) => [n, g, n === HAM ? run(2, 59) : n === LEC ? run(3, 59) : p, s]) } });
    expect(sectionOf(pageOf(`${R}2/race/`, weekendPages(same)), 'Lap chart')).not.toContain('†');
    expect(lapChartNotes(same)).toEqual([]);
  });

  it("dashes a team's second driver by drivers.json's order, a stand-in after the regular driver", () => {
    const { drivers } = chartData(chart);
    expect(['LEC', 'HAM', 'RUS', 'ANT'].map(c => drivers.get(c)?.[2])).toEqual(['0', '1', '0', '1']);
    // Driver 7 in Red Bull's second car all weekend (as Lawson in rounds 12 to 14): the roster lists Verstappen alone.
    const seat = (t: Table): Table => ({ ...t, rows: t.rows.map(row => (row[1] === 'Driver 7' ? [row[0], row[1], 'Red Bull Racing', ...row.slice(3)] : row)) });
    const moved: ResultRound = { ...r2, sessions: r2.sessions.map(s => ({ ...s, tables: s.tables.map(seat) })), others: r2.others!.map(s => ({ ...s, tables: s.tables.map(seat) })) };
    const standIn = chartData(sectionOf(pageOf(`${R}2/race/`, weekendPages({ ...f1, results: [r1, moved] })), 'Lap chart'));
    expect(['VER', '7'].map(c => standIn.drivers.get(c)?.slice(1, 3))).toEqual([['#1E3A8A', '0'], ['#1E3A8A', '1']]);
    expect(chart).toContain('<span class="pd-lc-k"><i class="pd-lc-kd"></i>The team’s second driver</span>');
  });

  it("puts a stop where Jolpica lists one, none at a red flag's lap, and draws none when the store holds no stops", () => {
    const { drivers } = chartData(chart);
    expect(['VER', 'LEC', 'ANT', '7'].map(c => drivers.get(c)?.[8])).toEqual(['20', '18.40', '', '22']);
    expect(tableRow(chart, 'LEC')[11]).toBe('18, 40');
    expect(tableRow(chart, 'ANT')[11]).toBe('none');
    // Not OpenF1's stints, which Pit wall draws: those were a lap early or missing in 8 of 2026's first 17 races.
    const stints = withRace({ extras: { stints: [...r2Extras.Race.stints!.filter(([n]) => n !== 3), [3, [['MEDIUM', 1, 19], ['HARD', 20, 59]]]] } });
    expect(chartData(sectionOf(pageOf(`${R}2/race/`, weekendPages(stints)), 'Lap chart')).drivers.get('VER')?.[8]).toBe('20');
    // Round 2's red flag came on lap 33: Jolpica lists the tyre changes under it as stops, and they are no stop.
    const red = withRace({ laps: { ...r2Laps, drivers: r2Laps.drivers.map(([n, g, p, s]) => [n, g, p, n === ANT ? '33' : n === LEC ? '18.33.40' : s]) } });
    const redData = chartData(sectionOf(pageOf(`${R}2/race/`, weekendPages(red)), 'Lap chart')).drivers;
    expect([redData.get('ANT')?.[8], redData.get('LEC')?.[8]]).toEqual(['', '18.40']);
    expect(chart).toContain('<span class="pd-lc-k"><i class="pd-lc-kp"></i>Pit stop</span>');
    // A store without the stops (read from a file written before them): no dots, no stops column, no Pit stop in the
    // key, never a guessed dot.
    const before: RaceLaps = JSON.parse(JSON.stringify({ ...r2Laps, drivers: r2Laps.drivers.map(d => d.slice(0, 3)) }));
    const none = sectionOf(pageOf(`${R}2/race/`, weekendPages(withRace({ laps: before }))), 'Lap chart');
    expect([...chartData(none).drivers.values()].every(f => f[8] === '-')).toBe(true);
    expect(none).not.toContain('Stops on lap');
    expect(none).not.toContain('Pit stop');
  });

  it("leaves out the visits race control's times mark as passes or a red flag's changes, and keeps a penalty visit and a tyre change inside a pass", () => {
    // Round 2's race starts at 15:00 at the track (UTC+8): the whole field through the pit lane from 16:00 to 16:03,
    // a red flag from 16:30 to 16:50.
    const lanes = [
      { kind: 'through' as const, from: '2026-03-15T08:00:00.000Z', to: '2026-03-15T08:03:00.000Z' },
      { kind: 'red' as const, from: '2026-03-15T08:30:00.000Z', to: '2026-03-15T08:50:00.000Z' },
    ];
    const marks = { red: [{ lap: 33, restarted: true }], neutral: [], lanes };
    // Verstappen's dots from his visits, his OpenF1 stints the fixture's (Medium to 20, Hard from 21) unless given.
    const ver = (visits: string, m: SessionExtras['marks'], openf1?: [string, number, number][]) => {
      const stints = openf1 ? [...r2Extras.Race.stints!.filter(([n]) => n !== 3), [3, openf1] as DriverStints] : r2Extras.Race.stints;
      const d = withRace({ extras: { marks: m, stints }, laps: { ...r2Laps, drivers: r2Laps.drivers.map(([n, g, p, s]) => [n, g, p, n === VER ? visits : s]) } });
      return chartData(sectionOf(pageOf(`${R}2/race/`, weekendPages(d)), 'Lap chart')).drivers.get('VER')?.[8];
    };
    // A stop at 15:40, the pass at 16:01:30, a drive-through at 16:20 and a change under the red at 16:35.
    expect(ver('20@15:40:00.25@16:01:30.28@16:20:00.33@16:35:00', marks)).toBe('20.28');
    // A race read before race control's times were kept: the red flag's lap still takes its changes out.
    expect(ver('20@15:40:00.33@16:35:00', { red: [{ lap: 33, restarted: true }], neutral: [] })).toBe('20');
    // Hard to Soft on the pass is a stop (Antonelli, Monaco's lap 61; Lawson, Baku's lap 36); Hard to Hard is the pass
    // (the rest of both fields), and so is a tyre OpenF1 did not record.
    expect(ver('20@15:40:00.25@16:01:30', marks, [['MEDIUM', 1, 20], ['HARD', 21, 25], ['SOFT', 26, 59]])).toBe('20.25');
    expect(ver('20@15:40:00.25@16:01:30', marks, [['MEDIUM', 1, 20], ['HARD', 21, 25], ['HARD', 26, 59]])).toBe('20');
    expect(ver('20@15:40:00.25@16:01:30', marks, [['MEDIUM', 1, 20], ['HARD', 21, 25], ['UNKNOWN', 26, 59]])).toBe('20');
    // A stop just before the pass (Piastri, Hamilton and Leclerc under Monaco's safety car): the stop's change is its
    // own, and the pass a lap later, on the same compound, stays out.
    expect(ver('24@15:59:00.25@16:01:30', marks, [['MEDIUM', 1, 24], ['HARD', 25, 25], ['HARD', 26, 59]])).toBe('24');
    // A change under the red flag stays out whatever the tyres.
    expect(ver('20@15:40:00.33@16:35:00', marks, [['MEDIUM', 1, 20], ['HARD', 21, 33], ['SOFT', 34, 59]])).toBe('20');
  });

  it("draws Pit wall's stints on the FIA's stops, each tyre OpenF1's stint starting within a lap of it, else not recorded", () => {
    const wall = (openf1: [string, number, number][], stops: string) => {
      const d = withRace({
        extras: { stints: [...r2Extras.Race.stints!.filter(([n]) => n !== 3), [3, openf1]] },
        laps: { ...r2Laps, drivers: r2Laps.drivers.map(([n, g, p, s]) => [n, g, p, n === VER ? stops : s]) },
      });
      const section = sectionOf(pageOf(`${R}2/race/`, weekendPages(d)), 'Pit wall');
      return [...section.matchAll(/data-tip="VER · ([^·]+?) · laps? (\d+)(?:–(\d+))? · /g)].map(m => `${m[1]} ${m[2]}-${m[3] ?? m[2]}`);
    };
    // Australia, OpenF1 a lap early (2026, 19 of 21 cars).
    expect(wall([['MEDIUM', 1, 10], ['HARD', 11, 59]], '11')).toEqual(['Medium 1-11', 'Hard 12-59']);
    // Monaco, a lap-1 stop OpenF1 does not have (Bottas, Bearman).
    expect(wall([['MEDIUM', 1, 59]], '1')).toEqual(['Medium 1-1', 'Tyre not recorded 2-59']);
    // Canada, a lap early and the lap-1 stop missing (Piastri).
    expect(wall([['SOFT', 1, 11], ['MEDIUM', 12, 50], ['HARD', 51, 59]], '1.12.51')).toEqual(['Soft 1-1', 'Tyre not recorded 2-12', 'Medium 13-51', 'Hard 52-59']);
    // Malaysia, stints ended on lap 1 and 2 and the later stops missing (Verstappen).
    expect(wall([['SOFT', 1, 1], ['SOFT', 2, 2], ['MEDIUM', 3, 9], ['HARD', 10, 59]], '9.32.43')).toEqual(['Soft 1-9', 'Hard 10-32', 'Tyre not recorded 33-43', 'Tyre not recorded 44-59']);
    // Malaysia, a one-lap stint on lap 2 next to the one that starts on lap 3 (Piastri): the stints matched in order,
    // the nearest start taking the tyre, so laps 3 to 9 are on the Hard OpenF1 gives them.
    expect(wall([['MEDIUM', 1, 1], ['INTERMEDIATE', 2, 2], ['HARD', 3, 9], ['MEDIUM', 10, 34], ['HARD', 35, 59]], '2.9.33.45')).toEqual(['Medium 1-2', 'Hard 3-9', 'Medium 10-33', 'Hard 34-45', 'Tyre not recorded 46-59']);
    // Singapore, a stint ended on lap 1 and the real stop missing (Hadjar, Alonso, Stroll).
    expect(wall([['MEDIUM', 1, 1], ['SOFT', 2, 59]], '32')).toEqual(['Medium 1-32', 'Tyre not recorded 33-59']);
    // Barcelona, the second stop on 28 for 39 (Bearman).
    expect(wall([['MEDIUM', 1, 18], ['HARD', 19, 28], ['SOFT', 29, 59]], '18.39')).toEqual(['Medium 1-18', 'Hard 19-39', 'Tyre not recorded 40-59']);
    // Belgium, a stop OpenF1 adds (Antonelli).
    expect(wall([['MEDIUM', 1, 18], ['HARD', 19, 44], ['SOFT', 45, 59]], '18')).toEqual(['Medium 1-18', 'Hard 19-59']);
    // Hungary, the first stop on lap 1 for 21 (Pérez).
    expect(wall([['SOFT', 1, 1], ['MEDIUM', 2, 46], ['HARD', 47, 59]], '21.46')).toEqual(['Soft 1-21', 'Tyre not recorded 22-46', 'Hard 47-59']);
    // The note counts the FIA's stops; a sprint, or a race whose laps are not stored, keeps OpenF1's stints.
    expect(sectionOf(pageOf(`${R}2/race/`), 'Pit wall')).toMatch(/<b>LEC<\/b><\/span><span class="pd-pw-bar">(<i [^>]+>[SMH]<\/i>){3}<span class="pd-pw-g" style="--n:59"><\/span><\/span><span class="pd-pw-n">2 stops<\/span>/);
  });

  it('draws a tyre change under a red flag on Pit wall and counts it, with no dot on the chart; a pass splits a stint only where the tyre changed', () => {
    // Round 2's race at 15:00 at the track (UTC+8): the whole field through the pit lane from 16:00 to 16:03, a red flag
    // from 16:30 to 16:50; the operator, 27 Oct: "Show it, count it".
    const lanes = [
      { kind: 'through' as const, from: '2026-03-15T08:00:00.000Z', to: '2026-03-15T08:03:00.000Z' },
      { kind: 'red' as const, from: '2026-03-15T08:30:00.000Z', to: '2026-03-15T08:50:00.000Z' },
    ];
    const ver = (visits: string, openf1: [string, number, number][], m: SessionExtras['marks'] = { red: [{ lap: 33, restarted: true }], neutral: [], lanes }) => {
      const d = withRace({ extras: { marks: m, stints: [...r2Extras.Race.stints!.filter(([n]) => n !== 3), [3, openf1] as DriverStints] }, laps: { ...r2Laps, drivers: r2Laps.drivers.map(([n, g, p, s]) => [n, g, p, n === VER ? visits : s]) } });
      const body = pageOf(`${R}2/race/`, weekendPages(d));
      const wall = sectionOf(body, 'Pit wall');
      const row = wall.slice(wall.indexOf('<b>VER</b>'), wall.indexOf('<div class="pd-pw-row">', wall.indexOf('<b>VER</b>')));
      return {
        dots: chartData(sectionOf(body, 'Lap chart')).drivers.get('VER')?.[8],
        wall: [...row.matchAll(/data-tip="VER · ([^·]+?) · laps? (\d+)(?:–(\d+))? · /g)].map(x => `${x[1]} ${x[2]}-${x[3] ?? x[2]}`),
        note: /pd-pw-n">([^<]*)/.exec(row)?.[1],
      };
    };
    // Monza: every car changed tyres under the red flag (Russell, Medium to Hard on lap 3).
    expect(ver('33@16:35:00', [['MEDIUM', 1, 33], ['HARD', 34, 59]])).toEqual({ dots: '', wall: ['Medium 1-33', 'Hard 34-59'], note: '1 stop' });
    // Baku: the field's pass on the same tyre splits nothing; Lawson's, Medium to Soft, is a stop on both.
    expect(ver('20@15:40:00.25@16:01:30', [['MEDIUM', 1, 20], ['HARD', 21, 25], ['HARD', 26, 59]])).toEqual({ dots: '20', wall: ['Medium 1-20', 'Hard 21-59'], note: '1 stop' });
    expect(ver('20@15:40:00.25@16:01:30', [['MEDIUM', 1, 20], ['HARD', 21, 25], ['SOFT', 26, 59]])).toEqual({ dots: '20.25', wall: ['Medium 1-20', 'Hard 21-25', 'Soft 26-59'], note: '2 stops' });
    // A red flag inside a pass's three minutes wins: a tyre change there is no dot, and is on Pit wall.
    const overlap = { red: [{ lap: 25, restarted: true }], neutral: [], lanes: [lanes[0], { kind: 'red' as const, from: '2026-03-15T08:02:00.000Z', to: '2026-03-15T08:30:00.000Z' }] };
    expect(ver('20@15:40:00.25@16:02:30', [['MEDIUM', 1, 20], ['HARD', 21, 25], ['SOFT', 26, 59]], overlap)).toEqual({ dots: '20', wall: ['Medium 1-20', 'Hard 21-25', 'Soft 26-59'], note: '2 stops' });
    // A race read before race control's times: the red flag's lap still has no dot, and its change is on Pit wall.
    expect(ver('33', [['MEDIUM', 1, 33], ['HARD', 34, 59]], { red: [{ lap: 33, restarted: true }], neutral: [] })).toEqual({ dots: '', wall: ['Medium 1-33', 'Hard 34-59'], note: '1 stop' });
  });

  it('draws a car out on the first lap on Pit wall on its first tyre, as OpenF1 has it (Verstappen at Monaco, 2026)', () => {
    const d = withRace({
      rows: row => (row[1] === VER ? [...row.slice(0, 3), 'Retired', '0'] : row),
      extras: { stints: [...r2Extras.Race.stints!.filter(([n]) => n !== 3), [3, [['MEDIUM', 1, 1]]] as DriverStints] },
      laps: { ...r2Laps, drivers: r2Laps.drivers.map(([n, g, p, s]) => (n === VER ? [n, g, '', ''] : [n, g, p, s])) },
    });
    const wall = sectionOf(pageOf(`${R}2/race/`, weekendPages(d)), 'Pit wall');
    expect(wall).toContain('data-tip="VER · Medium · lap 1 · out on lap 1"');
    expect(wall).toMatch(/<b>VER<\/b><\/span><span class="pd-pw-bar"><i [^>]+>M<\/i><span class="pd-pw-g" style="--n:59"><\/span><\/span><span class="pd-pw-n">out<\/span>/);
  });

  it("places the visits on the track's own day of the race, a day before Jolpica's date for an evening race west of UTC (Las Vegas)", () => {
    // Round 2 on Las Vegas' clock: the race at 21:00 on Saturday 14 March at the track, 04:00 UTC on the 15th, the date
    // Jolpica gives; a stop at 21:30 and the whole field through the pit lane at 21:40 at the track.
    const base = withRace({
      extras: { marks: { neutral: [], lanes: [{ kind: 'through', from: '2026-03-15T04:39:00.000Z', to: '2026-03-15T04:42:00.000Z' }] } },
      laps: { ...r2Laps, drivers: r2Laps.drivers.map(([n, g, p, s]) => [n, g, p, n === VER ? '20@21:30:00.25@21:40:10' : s]) },
    });
    const vegas: SeriesData = {
      ...base,
      rounds: (base.rounds ?? []).map(r => (r.round === 2 ? { ...r, tz: 'America/Los_Angeles' } : r)),
      calendar: (base.calendar ?? []).map(e => (e.round === 2 && e.session === 'Race' ? at(2, 'Race', '2026-03-15T04:00:00Z') : e)),
    };
    expect(chartData(sectionOf(pageOf(`${R}2/race/`, weekendPages(vegas)), 'Lap chart')).drivers.get('VER')?.[8]).toBe('20');
  });

  it('draws from a store edited by hand without throwing: windows, spans and stints of another shape are none', () => {
    const odd = withRace({ extras: { marks: { neutral: {}, lanes: [null] } as unknown as SessionExtras['marks'], stints: [[3, null], 'x'] as unknown as SessionExtras['stints'] } });
    const body = pageOf(`${R}2/race/`, weekendPages(odd));
    expect(chartData(sectionOf(body, 'Lap chart')).drivers.get('VER')?.[8]).toBe('20');
    expect(chartData(sectionOf(body, 'Lap chart')).spans).toBe('');
    expect(sectionOf(body, 'Pit wall')).toBe('');
  });

  it("shades the safety car laps, says which in the key and credits race control's marks", () => {
    const neutral = withRace({ extras: { marks: { neutral: [{ kind: 'SC', from: 30, to: 33 }, { kind: 'VSC', from: 50, to: 51 }, { kind: 'VSC', from: 60, to: 61 }] } } });
    const body = pageOf(`${R}2/race/`, weekendPages(neutral));
    const shaded = sectionOf(body, 'Lap chart');
    // A span past the race's laps (race control counted on) is dropped.
    expect(chartData(shaded).spans).toBe('SC 30 33,VSC 50 51');
    expect(shaded).toContain('<span class="pd-lc-k"><i class="pd-lc-kb">SC</i>Safety car</span><span class="pd-lc-k"><i class="pd-lc-kb">VSC</i>Virtual safety car</span>');
    expect(body).toContain('<p class="pd-wk-credit">The weather, race control’s marks and the tyres from <a href="https://openf1.org/">OpenF1</a></p>');
    const calm = pageOf(`${R}2/race/`, weekendPages(withRace({ extras: { marks: { neutral: [] } } })));
    expect(chartData(sectionOf(calm, 'Lap chart')).spans).toBe('');
    expect(calm).not.toContain('race control’s marks');
    expect(calm).not.toContain('Safety car');
  });

  it("keeps a disqualified driver's line to the flag, DSQ at the finish and no cross; a driver who did not start has none", () => {
    const dsq = withRace({ rows: row => (row[1] === BEA ? [...row.slice(0, 3), 'Disqualified', '0'] : row[1] === 'Driver 9' ? [...row.slice(0, 3), 'Did not start', '0'] : row) });
    const body = sectionOf(pageOf(`${R}2/race/`, weekendPages(dsq)), 'Lap chart');
    const { head, drivers } = chartData(body);
    expect(drivers.get('BEA')?.slice(5, 7)).toEqual(['5', 'd']);
    expect(tableRow(body, 'BEA')[0]).toBe('DSQ');
    expect(tableRow(body, 'BEA')[10]).toBe('5');
    expect(drivers.has('9')).toBe(false);
    expect(head).toBe('59 12');
  });

  it("links the chart from the Overview's race card once the race's laps are stored, and draws none before", () => {
    expect(sectionOf(pageOf(`${R}2/`), 'Race result')).toContain(
      `<p class="pd-wk-links"><a class="pd-wk-link" href="${R}2/race/">All 12 on the race's page</a><a class="pd-wk-link" href="${R}2/race/#lap-chart">Lap chart</a></p>`,
    );
    // Round 1's laps were a miss: no chart and no link until they are whole.
    expect(pageOf(`${R}1/`)).not.toContain('#lap-chart');
    expect(pageOf(`${R}1/race/`)).not.toContain('pd-lc');
  });

  it('keeps feed text as text in the data and the table, and draws a name the classification does not hold without a finish', () => {
    expect(chart).toContain('Kimi &lt;b&gt;Antonelli&lt;/b&gt;,Mercedes');
    expect(tableRow(chart, 'ANT')[2]).toBe('Kimi &lt;b&gt;Antonelli&lt;/b&gt;');
    const odd = '<img src=x>, Driver;|';
    const stranger = withRace({ laps: { ...r2Laps, drivers: [...r2Laps.drivers, [odd, 12, run(12, 20), '']] } });
    const body = pageOf(`${R}2/race/`, weekendPages(stranger));
    expect(body).not.toContain('<img');
    const { drivers } = chartData(sectionOf(body, 'Lap chart'));
    const f = [...drivers.values()].find(x => x[9].includes('img'));
    expect(f?.slice(5, 7)).toEqual(['', 'f']);
    expect(f?.[9]).toBe('<img src=x>  Driver');
    expect(lapChartNotes(stranger)).toEqual([{ round: 2, differs: ['HAM P3→P2', 'LEC P2→P3'], unjoined: [odd] }]);
  });
});

describe('odd data', () => {
  it('keeps feed text as text and a bad colour out of the style', () => {
    const race = pageOf(`${R}2/race/`);
    expect(race).toContain('<span>Kimi &lt;b&gt;Antonelli&lt;/b&gt;</span>');
    expect(race).not.toContain('<b>Antonelli</b>');
    expect(race).toContain('<i class="pd-tc" style="--t:#9aa3b2"></i><b>BEA</b>');
    expect(pages.some(p => p.body.includes('url(x)'))).toBe(false);
    const odd = weekendPages({ ...f1, calendar: [...f1.calendar!, at(3, '<img src=x>', '2026-03-28T08:00:00Z')] });
    expect(pageOf(`${R}3/img-src-x/`, odd)).toContain('<h1>&lt;img src=x&gt;</h1>');
    expect(odd.some(p => p.body.includes('<img'))).toBe(false);
  });

  it("reads the track's times in UTC for a zone it does not know", () => {
    const lost = weekendPages({ ...f1, rounds: f1.rounds!.map(r => (r.round === 3 ? { ...r, tz: 'Mars/Olympus' } : r)) });
    const body = pageOf(`${R}3/`, lost);
    expect(body).toContain('<small>Track 02:30</small>');
    expect(body).toContain('<dt>Track time</dt><dd>UTC+0<span class="pd-wk-ahead" data-pd-ahead="0" data-pd-at="2026-03-27T02:30:00Z"></span></dd>');
  });

  it('tags a moved round with its first dates, and says when a weekend has no times yet', () => {
    const moved = pageOf(`${R}4/`);
    expect(moved).toContain('<p class="pd-wk-where">Miami International Autodrome, United States · <span class="pd-wk-dt">1–3 May</span></p><em class="pd-wk-tag">Moved from April, first set for 3–5 April</em>');
    expect(moved).toContain("<span class=\"pd-wk-sum\">The weekend's times are not published yet</span>");
    expect(moved).toContain('<p class="pd-wk-empty">The weekend’s session times are not published yet; they appear here as soon as they are.</p>');
    expect(moved).toContain('<dt>Track time</dt><dd>UTC−4<span class="pd-wk-ahead" data-pd-ahead="-240" data-pd-at="2026-05-01T12:00:00Z"></span></dd>');
    expect(moved).toContain(`<a class="pd-wk-prev" href="${R}3/">‹ Round 3 · Japanese Grand Prix</a>`);
    expect(moved).not.toContain('pd-wk-next');
  });

  it('keeps every feed and content string as text on every page, the Pit wall’s tips included', () => {
    const x = '<img src=x onerror=1>';
    const bad = (s: string): string => `${s}${x}`;
    // Every cell from `from` on: past the place and the name, a row still finds its car number and its points.
    const badTable = (from: number) => (t: Table): Table => ({ ...t, rows: t.rows.map(row => row.map((cell, i) => (i < from ? cell : bad(cell)))) });
    const badRound = (r: ResultRound, from = 2): ResultRound => ({
      ...r,
      name: bad(r.name),
      sessions: r.sessions.map(s => ({ ...s, tables: s.tables.map(badTable(from)) })),
      others: r.others?.map(s => ({ ...s, tables: s.tables.map(badTable(from)) })),
    });
    const hostile: SeriesData = {
      ...f1,
      name: bad(f1.name),
      teams: f1.teams!.map(t => ({ ...t, name: bad(t.name), drivers: t.drivers.map(d => ({ ...d, code: bad(d.code ?? 'XXX') })) })),
      rounds: f1.rounds!.map(r => ({
        ...r,
        name: bad(r.name),
        venue: r.venue ? bad(r.venue) : r.venue,
        place: r.place ? bad(r.place) : r.place,
        country: r.country ? bad(r.country) : r.country,
        moved: r.moved ? { ...r.moved, note: bad(r.moved.note) } : r.moved,
      })),
      cancelled: f1.cancelled!.map(c => ({ ...c, name: bad(c.name), place: c.place ? bad(c.place) : c.place, reason: c.reason ? bad(c.reason) : c.reason })),
      results: f1.results!.map(r => badRound(r)),
      weekend: { ...f1.weekend!, forecast: { suzuka: { ...suzuka, steps: suzuka.steps.map(s => ({ ...s, symbol: bad(s.symbol) })) } } },
    };
    const all = weekendPages(hostile);
    expect(all.map(p => p.path)).toEqual(pages.map(p => p.path));
    for (const p of all) expect(p.body, p.path).not.toContain('<img');
    // The drivers' names too, on the podium, the cards, the tables and the championship.
    for (const p of weekendPages({ ...hostile, results: f1.results!.map(r => badRound(r, 1)) })) expect(p.body, p.path).not.toContain('<img');
    // The text is all there, escaped: the race's tips among it.
    expect(pageOf(`${R}2/race/`, all)).toContain('data-tip="VER&lt;img src=x onerror=1&gt; · Medium · laps 1–20');
    expect(all.filter(p => p.body.includes('&lt;img src=x onerror=1&gt;'))).toHaveLength(all.length);
  });
});

describe('found in review', () => {
  const withRace = (stints: SessionExtras['stints']): SeriesData => ({
    ...f1,
    weekend: { ...f1.weekend!, laps: {}, sessions: { '2026': { '2': { ...r2Extras, Race: { ...r2Extras.Race, stints } } } } },
  });
  const others = (car: number) => r2Extras.Race.stints!.filter(([n]) => n !== car);

  it('draws no stint that ends before it starts, and counts no stop for it', () => {
    const wall = sectionOf(pageOf(`${R}2/`, weekendPages(withRace([...others(87), [87, [['SOFT', 1, 0], ['MEDIUM', 1, 30], ['HARD', 31, 59]]]]))), 'Pit wall');
    expect(wall).not.toContain('laps 1–0');
    expect(wall).not.toContain('--w:0.00%');
    expect(wall).toMatch(/<b>BEA<\/b><\/span><span class="pd-pw-bar">(<i [^>]+>[MH]<\/i>){2}<span class="pd-pw-g" style="--n:59"><\/span><\/span><span class="pd-pw-n">1 stop<\/span>/);
  });

  it('says when OpenF1 holds no tyres for a driver, or none for the first laps, rather than count no stop', () => {
    const wall = sectionOf(pageOf(`${R}2/`, weekendPages(withRace([...others(63), [63, [['SOFT', 4, 15], ['HARD', 16, 59]]]]))), 'Pit wall');
    expect(wall).toMatch(/<b>RUS<\/b><\/span><span class="pd-pw-bar">(<i [^>]+>[SH]<\/i>){2}<span class="pd-pw-g" style="--n:59"><\/span><\/span><span class="pd-pw-n">partial<\/span>/);
    // Drivers 7 to 10 carry no number on the roster.
    expect(wall).toContain('<b>7</b></span><span class="pd-pw-bar"><span class="pd-pw-g" style="--n:59"></span></span><span class="pd-pw-n">no data</span>');
  });

  it('reads a driver who did not start as out', () => {
    const rows = r2.sessions[1].tables[0].rows.map(row => (row[1] === 'Driver 11' ? [...row.slice(0, 3), 'Did not start', '0'] : row));
    const dns = weekendPages({ ...f1, results: [r1, { ...r2, sessions: [r2.sessions[0], { label: 'Race', tables: [{ ...r2.sessions[1].tables[0], rows }] }] }] });
    expect(pageOf(`${R}2/race/`, dns)).toMatch(/<b>11<\/b><\/span><span class="pd-pw-bar">(<i [^>]+>[?H]<\/i>){2}<span class="pd-pw-g" style="--n:59"><\/span><\/span><span class="pd-pw-n">out<\/span>/);
  });

  it('heads a round further off than the next with the table as it stands, after the latest round raced', () => {
    expect(pageOf(`${R}4/`)).toContain('<h3>Championship after round 2</h3>');
    expect(pageOf(`${R}3/`)).toContain('<h3>Championship before round 3</h3>');
  });

  it("groups the sessions by the track's own day, where it differs from UTC's", () => {
    const vegas: SeriesData = {
      ...f1,
      rounds: [...f1.rounds!, { round: 6, name: 'Las Vegas Grand Prix', startDate: '2026-11-19', endDate: '2026-11-21', venue: 'Las Vegas Strip Circuit', tz: 'America/Los_Angeles' }],
      // Friday 18:30 and 22:00, Saturday 20:00 on the Strip: Saturday and Sunday in UTC.
      calendar: [...f1.calendar!, at(6, 'Practice 3', '2026-11-21T02:30:00Z'), at(6, 'Qualifying', '2026-11-21T06:00:00Z'), at(6, 'Race', '2026-11-22T04:00:00Z')],
    };
    const rows = sectionOf(pageOf(`${R}6/`, weekendPages(vegas)), 'The weekend');
    expect([...rows.matchAll(/<h3 class="pd-wk-day">([^<]+)<\/h3>/g)].map(m => m[1])).toEqual(['Friday 20 November', 'Saturday 21 November']);
    expect(rows).toContain('<small>Track 22:00</small></span><span class="pd-wk-name">Qualifying</span>');
  });

  it("splits equal weekend totals by the race's result, whatever order the feed lists them in", () => {
    const head = ['Pos', 'Driver', 'Team', 'Time', 'Pts'];
    const tie: ResultRound = {
      round: 9,
      name: 'X',
      date: null,
      sessions: [
        { label: 'Sprint', tables: [table(head, [['1', 'Driver A', 'Williams', '30:00.000', '8']])] },
        { label: 'Race', tables: [table(head, [['5', 'Driver A', 'Williams', '+9.000', '10'], ['2', 'Driver B', 'Williams', '+2.000', '18']])] },
      ],
    };
    expect(weekendPoints(tie).map(s => `${s.name} ${s.t}`)).toEqual(['Driver B 18', 'Driver A 18']);
  });

  it('writes a lap of under a minute and ten seconds with its leading zero', () => {
    const quick = weekendPages({ ...f1, weekend: { ...f1.weekend!, maps: { shanghai: { ...shanghai, lap: 69.511 } } } });
    expect(pageOf(`${R}2/`, quick)).toContain('<dt>The lap</dt><dd>1:09.511</dd>');
  });

  it('names a sprint weekend from its timetable before the sprint has run', () => {
    const early = weekendPages({ ...f1, results: [r1] });
    expect(pageOf(`${R}2/`, early)).toContain('<dt>Format</dt><dd>Sprint weekend</dd>');
    expect(pageOf(`${R}3/`, early)).toContain('<dt>Format</dt><dd>Standard weekend</dd>');
  });

  it('puts a session that ran late on the bar at its real start', () => {
    expect(pageOf(`${R}2/`)).toContain(`<a href="${R}2/sprint/">Sprint<small><span class="pd-t" data-utc="2026-03-14T03:25:00Z" data-f="wt">Sat 03:25 UTC</span> · RUS</small></a>`);
  });

  it("takes a driver's team from the round's race, sprint or qualifying, never a practice's roster", () => {
    // OpenF1's practices take the roster's team: Lawson's Racing Bulls in rounds 12 to 14, where he drove for Red Bull.
    const practice1 = { label: 'Practice 1', tables: [table(['Pos', 'Driver', 'Team', 'Time', 'Gap', 'Laps'], [['1', HAM, 'Mercedes', '1:32.100', '', '20']])] };
    const swapped = weekendPages({ ...f1, results: [r1, { ...r2, others: [practice1, ...r2.others!.slice(1)] }] });
    expect(pageOf(`${R}2/practice-1/`, swapped)).toContain('<td class="d"><i class="pd-tc" style="--t:#DC0000"></i><b>HAM</b><span>Lewis Hamilton</span></td><td class="tm">Ferrari</td>');
  });
});

// ── The groundwork (O33): the parts every family shares, from the saved document ──

/** What the publisher stored for three rounds (paddock-data 3a1aac6f), cut to a few rows a table, and their rounds. */
type Saved = { round: CalendarRound; result: ResultRound };
const saved = JSON.parse(readFileSync(path.join(process.cwd(), 'tests/fixtures/result-tabs.json'), 'utf8')) as Record<'f2' | 'wsbk' | 'gt-world', Saved>;
const seriesOf = (slug: 'f2' | 'wsbk' | 'gt-world', name: string, extra: Partial<SeriesData> = {}): SeriesData => ({
  slug,
  name,
  season: 2026,
  standings: null,
  results: [saved[slug].result],
  calendar: null,
  rounds: [saved[slug].round],
  ...extra,
});
// Formula 2's Madrid timetable as f2/calendar.json stored it at the same commit.
const madrid = [at(11, 'Practice', '2026-09-11T09:05:00.000Z'), at(11, 'Qualifying', '2026-09-11T13:00:00.000Z'), at(11, 'Sprint Race', '2026-09-12T12:15:00.000Z'), at(11, 'Feature Race', '2026-09-13T09:25:00.000Z')];
const f2Madrid = seriesOf('f2', 'Formula 2', { calendar: madrid });
const w11 = weekendOf(f2Madrid, 2026, saved.f2.round);

describe('the results table with tabs (O33), from the saved document', () => {
  it("A1: Formula 2's Madrid, the weekend first, then a race a tab", () => {
    const html = resultTabs([
      { tab: ['Both races'], body: '<p>The weekend’s points</p>' },
      { tab: ['Sprint Race'], body: classTable(w11, tableOf(w11, 'Sprint')!) },
      { tab: ['Feature Race'], body: classTable(w11, tableOf(w11, 'Feature')!) },
    ]);
    expect(html.match(/data-pd-tab="[^"]+"/g)).toEqual(['data-pd-tab="Both races"', 'data-pd-tab="Sprint Race"', 'data-pd-tab="Feature Race"']);
    expect(html.startsWith('<div class="pd-rt"><section class="pd-rt-p" data-pd-tab="Both races"><h3 class="pd-rt-h">Both races</h3><p>The weekend’s points</p></section>')).toBe(true);
    expect(html).toContain('<section class="pd-rt-p" data-pd-tab="Sprint Race"><h3 class="pd-rt-h">Sprint Race</h3><div class="pd-wk-scroll"><table class="pd-wk-tbl"><thead><tr><th class="p">Pos</th><th class="d">Driver</th>');
    expect(html).toContain('<td class="d"><i class="pd-tc" style="--t:#9aa3b2"></i><b>MIY</b><span>Ritomo Miyata</span></td><td class="tm">Hitech</td><td class="t">47:21.330</td><td class="pt">11</td>');
    expect(html).toContain('<b>BEG</b><span>Dino Beganovic</span>');
    expect(html.endsWith('</section></div>')).toBe(true);
  });

  it("A1: WorldSBK's Jerez, its riders, opening on the tab it names", () => {
    const d = seriesOf('wsbk', 'WorldSBK');
    const w = weekendOf(d, 2026, saved.wsbk.round);
    const races = ['Race 1', 'Superpole Race', 'Race 2'];
    const html = resultTabs([{ tab: ['All three'], body: '<p>The weekend’s points</p>' }, ...races.map(r => ({ tab: [r], body: classTable(w, tableOf(w, r)!) }))], { open: ['Race 2'] });
    expect(html.startsWith('<div class="pd-rt" data-pd-open="Race 2"><section class="pd-rt-p" data-pd-tab="All three">')).toBe(true);
    expect(html.match(/<th class="d">Rider<\/th>/g)).toHaveLength(3);
    expect(html).toContain('<b>BUL</b><span>Nicolo Bulega</span></td><td class="tm">Aruba.it Racing - Ducati</td><td class="t">27:01.253</td><td class="pt">12</td>');
  });

  it("C4: GT World's Zandvoort, a race and then a class over one table", () => {
    const list = (rows: string[][]) => `<ol>${rows.map(r => `<li>#${escapeHtml(r[1])} ${escapeHtml(r[2])}</li>`).join('')}</ol>`;
    const panels = saved['gt-world'].result.sessions.flatMap(s => {
      const t = s.tables[0];
      const cup = t.columns.indexOf('Cup');
      const race = s.label === 'Race 1' ? 'Race 1 · Sat' : 'Race 2 · Sun';
      const classes = ['Pro Cup', 'Gold Cup', 'Silver Cup', 'Bronze Cup'].filter(c => t.rows.some(r => r[cup] === c));
      return [{ tab: [race, 'Overall'], body: list(t.rows) }, ...classes.map(c => ({ tab: [race, c.replace(' Cup', '')], body: list(t.rows.filter(r => r[cup] === c)) }))];
    });
    const html = resultTabs(panels, { rows: ['Race', 'Class'], open: ['Race 2 · Sun', 'Overall'] });
    expect(
      html.startsWith(
        '<div class="pd-rt" data-pd-rt="Race|Class" data-pd-open="Race 2 · Sun|Overall"><section class="pd-rt-p" data-pd-tab="Race 1 · Sat|Overall"><h3 class="pd-rt-h">Race 1 · Sat · Overall</h3><ol><li>#58 Thomas Fleming, Louis Prette</li>',
      ),
    ).toBe(true);
    expect(html.match(/data-pd-tab="[^"]+"/g)).toHaveLength(10);
    expect(html).toContain('<section class="pd-rt-p" data-pd-tab="Race 1 · Sat|Gold"><h3 class="pd-rt-h">Race 1 · Sat · Gold</h3><ol><li>#58 Thomas Fleming, Louis Prette</li><li>#51 ');
    expect(html).toContain('<section class="pd-rt-p" data-pd-tab="Race 2 · Sun|Overall"><h3 class="pd-rt-h">Race 2 · Sun · Overall</h3><ol><li>#69 Thierry Vermeulen, Ben Green</li>');
  });

  it('escapes its names and keeps the rows apart', () => {
    expect(resultTabs([{ tab: ['A <b>&</b> "B"|C'], title: 'T <i>', body: '<p>x</p>' }])).toBe(
      '<div class="pd-rt"><section class="pd-rt-p" data-pd-tab="A &lt;b&gt;&amp;&lt;/b&gt; &quot;B&quot;/C"><h3 class="pd-rt-h">T &lt;i&gt;</h3><p>x</p></section></div>',
    );
    expect(resultTabs([{ tab: ['R|1', 'X'], body: '' }], { rows: ['Race|s', 'Class'], open: ['R|1', 'X'] })).toBe(
      '<div class="pd-rt" data-pd-rt="Race/s|Class" data-pd-open="R/1|X"><section class="pd-rt-p" data-pd-tab="R/1|X"><h3 class="pd-rt-h">R/1 · X</h3></section></div>',
    );
  });

  it('draws nothing without panels and refuses panels that do not make rows', () => {
    expect(resultTabs([])).toBe('');
    expect(() => resultTabs([{ tab: ['A'], body: '' }, { tab: ['A', 'B'], body: '' }])).toThrow('every panel names one tab, or one in each of two rows');
    expect(() => resultTabs([{ tab: ['A', 'B', 'C'], body: '' }])).toThrow('every panel names one tab');
    expect(() => resultTabs([{ tab: [], body: '' }])).toThrow('every panel names one tab');
    expect(() => resultTabs([{ tab: ['A'], body: '' }, { tab: ['A '], body: '' }])).toThrow('two panels named A');
  });
});

describe("the shared parts' options (O33), Formula 1's by default", () => {
  it('bar: a page, a session without one, one called off, a divider, one still to run', () => {
    expect(
      bar(w11, [
        { label: 'Overview', note: 'the weekend', href: w11.path, current: true },
        { label: 'Free Practice', note: 'Fri · not stored', state: 'off' },
        { label: 'Qualifying', note: 'Sat · called off', state: 'x' },
        { divider: 'Round <15>' },
        { label: 'Race <1>', note: 'Sun', href: `${w11.path}race/`, state: 'up' },
      ]),
    ).toBe(
      '<nav class="pd-wb" aria-label="Spanish Grand Prix (Madrid): its pages"><a href="/series/f2/2026/round-11/" aria-current="page">Overview<small>the weekend</small></a>' +
        '<span class="is-off">Free Practice<small>Fri · not stored</small></span><span class="is-x">Qualifying<small>Sat · called off</small></span>' +
        '<span class="pd-wb-div">Round &lt;15&gt;</span><a href="/series/f2/2026/round-11/race/" class="is-up">Race &lt;1&gt;<small>Sun</small></a></nav>',
    );
  });

  it('weekendBand: the crumb, the season, tags, words after the dates, the number', () => {
    expect(weekendBand(w11)).toBe(
      '<section class="pd-wk-band"><div class="pd-wk-band-in"><p class="pd-wk-crumb"><a href="/series/f2/">Formula 2</a> › <a href="/series/f2/2026/">2026 season</a> › Round 11 of 1</p>' +
        '<h1>Spanish Grand Prix (Madrid)</h1><p class="pd-wk-where"><span class="pd-wk-dt">11–13 September</span></p><span class="pd-wk-num" aria-hidden="true">11</span></div></section>',
    );
    const odd = weekendBand(w11, { crumb: 'Race 2 of 10', season: 'Season 12 · 2025–26', tags: ['Two qualifying sessions & two Feature Races'], after: '4 hours', num: '24' });
    expect(odd).toContain('<a href="/series/f2/2026/">Season 12 · 2025–26</a> › Race 2 of 10</p>');
    expect(odd).toContain(
      '<span class="pd-wk-dt">11–13 September</span> · 4 hours</p><em class="pd-wk-tag">Two qualifying sessions &amp; two Feature Races</em><span class="pd-wk-num" aria-hidden="true">24</span>',
    );
    expect(weekendBand(w11, { crumb: null })).toContain('<a href="/series/f2/2026/">2026 season</a></p>');
  });

  it("strip: the family's own Final line, or the next session", () => {
    expect(strip(w11, '<b>Dino Beganovic</b> won the Feature Race')).toBe(
      '<div class="pd-wk-strip"><div class="pd-wk-strip-in"><em class="pd-wk-pill is-fin">Final</em><span class="pd-wk-sum"><b>Dino Beganovic</b> won the Feature Race</span>' +
        '<span class="pd-wk-acts"><button type="button" class="pd-wk-btn" data-pd-follow="f2" data-off="Follow Formula 2" data-on="Following Formula 2 ✓" hidden>Follow Formula 2</button></span></div></div>',
    );
    expect(strip(w11, null)).toContain(
      '<em class="pd-wk-pill is-next">Next</em><span class="pd-wk-sum"><b class="pd-sr-ses">Practice · <span class="pd-t" data-utc="2026-09-11T09:05:00.000Z" data-f="wt">Fri 09:05 UTC</span></b></span>',
    );
  });

  it('sessionCard: no page and nothing stored, or a table stored under another name', () => {
    const used = nothingUsed();
    expect(sessionCard(w11, w11.sessions[0], used, { page: false, empty: 'Not stored yet: FOM’s API answers it.' })).toBe(
      '<article class="pd-sc is-sm is-off"><header><div><h3>Practice</h3><p><span class="pd-t" data-utc="2026-09-11T09:05:00.000Z" data-f="wt">Fri 09:05 UTC</span> your time · Fri 09:05 at the track</p></div></header>' +
        '<p class="pd-sc-empty">Not stored yet: FOM’s API answers it.</p><span class="pd-sc-go is-off">No page yet</span></article>',
    );
    const sprint = sessionCard(w11, w11.sessions[2], used, { table: tableOf(w11, 'Sprint'), rows: 3 });
    expect(sprint.match(/<li>/g)).toHaveLength(3);
    expect(sprint).toContain(
      '<li><span class="p">1</span><i class="pd-tc" style="--t:#9aa3b2"></i><b>MIY</b><span class="nm">Ritomo Miyata</span><span class="tt">47:21.330</span><span class="pp">11</span></li>',
    );
    expect(sprint).toContain('<a class="pd-sc-go" href="/series/f2/2026/round-11/sprint-race/">All 5 on its page →</a></article>');
  });

  it('aside: a box before the rest, no championship or one of its own, its own title and facts', () => {
    expect(
      aside(w11, true, {
        before: '<section class="pd-wk-box"><h3>The twin round</h3></section>',
        champ: null,
        title: 'The rally',
        facts: [
          ['Stages', '17'],
          ['Crews', 'driver & co-driver'],
        ],
        unit: 'Race',
      }),
    ).toBe(
      '<aside class="pd-wk-aside"><section class="pd-wk-box"><h3>The twin round</h3></section><section class="pd-wk-box"><h3>The rally</h3><dl><dt>Stages</dt><dd>17</dd><dt>Crews</dt><dd>driver &amp; co-driver</dd></dl></section></aside>',
    );
    const chase = aside(w11, true, {
      champ: {
        title: 'The Chase after race 33',
        rows: [
          { name: 'Kyle Larson', team: 'Hendrick Motorsports', pts: 2370 },
          { name: 'Christopher Bell', team: 'Joe Gibbs Racing', pts: 2365 },
        ],
      },
    });
    expect(chase).toContain(
      '<section class="pd-wk-box pd-wk-champ"><h3>The Chase after race 33</h3><ol><li><span class="p">1</span><i class="pd-tc" style="--t:#9aa3b2"></i><span class="d"><b>Kyle Larson</b><small>Hendrick Motorsports</small></span><span class="g">Leader</span><b class="pt">2370</b></li>',
    );
    expect(chase).toContain('<span class="g">−5</span><b class="pt">2365</b></li></ol><span class="pd-wk-more is-off">Full standings →</span></section>');
    expect(chase).toContain('<dt>Format</dt><dd>Sprint weekend</dd>');
  });

  const three = seriesOf('f2', 'Formula 2', {
    calendar: madrid,
    rounds: [
      { ...saved.f2.round, round: 10, name: 'Hungarian Grand Prix' },
      saved.f2.round,
      { ...saved.f2.round, round: 12, name: 'Azerbaijan Grand Prix', startDate: '2026-09-24', endDate: '2026-09-26' },
    ],
  });

  it('nextRound and sessionBand: the word for a round', () => {
    const w = weekendOf(three, 2026, saved.f2.round);
    expect(nextRound(w, 'Race')).toBe(
      '<a class="pd-wk-next" href="/series/f2/2026/round-12/"><small>Next race · 12</small><b>Azerbaijan Grand Prix</b><span>24–26 September</span></a><a class="pd-wk-prev" href="/series/f2/2026/round-10/">‹ Race 10 · Hungarian Grand Prix</a>',
    );
    expect(nextRound(w)).toContain('<small>Next round · 12</small>');
    expect(sessionBand(w, w.sessions[0], 'Race')).toContain(
      '<a href="/series/f2/2026/round-11/">Race 11 · Spanish Grand Prix (Madrid)</a></p><h1>Practice</h1><p class="pd-ss-sub">Friday 11 September · 09:05 at the track, <span class="pd-t" data-utc="2026-09-11T09:05:00.000Z" data-f="wt">Fri 09:05 UTC</span> your time</p>',
    );
  });

  it("seasonPage: its title, a round's word and a called-off round's line", () => {
    const off = { round: 7, name: 'Qatar <1812> km', from: '2026-10-22', to: '2026-10-24', reason: 'the situation' };
    const body = seasonPage({ ...three, cancelled: [off] }, 2026, { unit: 'Race', title: 'Season 12 · 2025–26', offLine: c => `First set for 26–28 March; called off on 28 July (${c.round})` }).body;
    expect(body).toContain('<h2>Season 12 · 2025–26</h2><p>3 races · 1 run</p>');
    expect(body).toContain('<small>Race 11 · 11–13 Sep</small><b>Spanish Grand Prix (Madrid)</b>');
    expect(body).toContain('<span class="pd-sn-t is-off"><small>Called off · was 22–24 Oct</small><b>Qatar &lt;1812&gt; km</b><span>First set for 26–28 March; called off on 28 July (7)</span></span>');
    expect(seasonPage({ ...three, cancelled: [off] }, 2026).body).toContain('<b>Qatar &lt;1812&gt; km</b><span>the situation</span>');
  });

  it("reads a motorcycle series' riders", () => {
    expect(cols(saved.wsbk.result.sessions[0].tables[0])).toEqual({ pos: 0, name: 1, team: 2, time: 3, pts: 4 });
    const riders = seriesOf('wsbk', 'WorldSBK', { standings: [{ title: 'Riders', columns: ['Pos', 'Rider', 'Team', 'Pts'], rows: [['1', 'Nicolo Bulega', 'Aruba.it Racing - Ducati', '600']] }] });
    expect(championship(riders, 12)).toEqual([{ name: 'Nicolo Bulega', team: 'Aruba.it Racing - Ducati', pts: 600 }]);
  });
});
