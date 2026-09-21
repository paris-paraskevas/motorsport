import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The reader behind the catalogue (P2.1): one readSource for the thirteen,
// each through the code's own loader, answering rows shaped by the source's
// columns and a provenance the Debug trace can print; the standings source
// reads the rows tier with its run first and the snapshot tier after; a reader
// that fails answers no rows and the reason, never a throw.

const meta = (slug: string, name: string) => ({ slug, name, color: '#e10600', icsUrl: 'https://example.com/ics', season: 2026, category: 'formula' });
const rounds = {
  season: 2026,
  rounds: [
    { round: 1, startDate: '2026-03-06', endDate: '2026-03-08', name: 'Australian Grand Prix' },
    { round: 2, startDate: '2026-03-13', endDate: '2026-03-15', name: 'Chinese Grand Prix', previousStartDate: '2026-03-20', previousEndDate: '2026-03-22', rescheduleNote: 'moved a week' },
  ],
  cancelledRounds: [{ originalRound: 4, name: 'Bahrain Grand Prix', originalStartDate: '2026-04-10', originalEndDate: '2026-04-12', reason: 'conflict' }],
};
vi.mock('@/lib/series', () => ({
  loadAllSeriesMeta: async () => [meta('f1', 'Formula 1'), meta('f2', 'Formula 2')],
  loadSeries: async (slug: string) => ({
    meta: meta(slug, slug === 'f1' ? 'Formula 1' : 'Formula 2'),
    sessions: [{ uid: 'u1', seriesSlug: slug, title: 'Race', start: new Date('2026-09-20T13:00:00Z'), end: new Date('2026-09-20T15:00:00Z'), location: 'Baku', significance: { tier: 'marquee', note: 'Season finale' } }, { uid: 'u2', seriesSlug: slug, title: 'Practice', start: new Date('2026-09-18T00:00:00Z'), end: new Date('2026-09-18T01:00:00Z'), dateOnly: true }],
    rounds,
    overview: '',
    drivers: '',
    significance: '',
    fetchedAt: new Date('2026-09-17T12:00:00Z'),
    stale: false,
    configured: true,
  }),
}));
vi.mock('@/lib/rounds-loader', () => ({ loadRounds: async () => rounds }));
const readCurrentStandingsWithRun = vi.fn();
vi.mock('@/lib/standing-rows', () => ({ readCurrentStandingsWithRun: (...a: unknown[]) => readCurrentStandingsWithRun(...a) }));
const fetchFullDriverStandings = vi.fn();
vi.mock('@/lib/standings/brief', () => ({ fetchFullDriverStandings: (...a: unknown[]) => fetchFullDriverStandings(...a) }));
// The class families and WRC (P2.2) read the snapshot tier the tabs read.
const fetchGtWorldStandings = vi.fn();
vi.mock('@/lib/standings/gt-world', () => ({ fetchGtWorldStandings: (...a: unknown[]) => fetchGtWorldStandings(...a) }));
const fetchImsaStandings = vi.fn();
vi.mock('@/lib/standings/imsa', () => ({ fetchImsaStandings: () => fetchImsaStandings(), IMSA_CLASSES: ['GTP', 'LMP2', 'GTD Pro', 'GTD'] }));
const fetchWecStandings = vi.fn();
vi.mock('@/lib/standings/wec', () => ({ fetchWecStandings: () => fetchWecStandings(), WEC_CLASSES: ['Hypercar', 'LMGT3'] }));
const fetchWRCStandings = vi.fn();
vi.mock('@/lib/standings/wrc', () => ({ fetchWRCStandings: () => fetchWRCStandings() }));
vi.mock('@/components/weekend/WeekendStandingsSnapshot', () => ({
  loadSnapshotSource: async () => ({
    races: [{ round: 1, raceName: 'Australian Grand Prix', date: new Date('2026-03-08T05:00:00Z'), circuit: 'Albert Park', results: [{ position: 1, driverName: 'Kimi Antonelli', driverCode: 'ANT', team: 'Mercedes', status: 'Finished', time: '1:30:12.345', points: 25 }] }],
    extras: [{ round: 2, raceName: 'Chinese Grand Prix Sprint', date: new Date('2026-03-14T03:00:00Z'), circuit: 'Shanghai', results: [{ position: 1, driverName: 'George Russell', team: 'Mercedes', status: 'Finished', points: 8 }] }],
    showTeams: true,
    pointsExact: true,
  }),
}));
vi.mock('@/lib/series-content', () => ({
  loadCuratedDrivers: async () => ({ teams: [{ name: 'Mercedes', color: '#00d2be', drivers: [{ name: 'Kimi Antonelli', code: 'ANT', number: 12 }, { name: 'George Russell', code: 'RUS', number: 63 }] }, { name: 'Ferrari', drivers: [{ name: 'Charles Leclerc' }] }] }),
}));
const post = (slug: string, seriesSlug: string | null, publishedAt: string) => ({ id: slug, slug, title: `Post ${slug}`, summary: 'Words.', body: '', seriesSlug, tags: seriesSlug ? [seriesSlug] : [], originalUrl: null, status: 'published', authorId: 'u', authorName: 'Paris', publishAt: null, publishedAt, heroImage: slug === 'a' ? 'https://example.com/a.jpg' : null, learnTopic: null, createdAt: publishedAt, updatedAt: null });
vi.mock('@/lib/blog', () => ({ publishedPosts: async () => [post('a', 'f1', '2026-09-10T10:00:00Z'), post('b', null, '2026-09-09T10:00:00Z'), post('c', 'f2', '2026-09-08T10:00:00Z')] }));
const fetchAggregatedNews = vi.fn(async (per: number) => [{ title: 'Headline', link: 'https://example.com/news/1', pubDate: new Date('2026-09-17T08:00:00Z'), seriesSlug: 'f1', description: `${per} per series` }]);
vi.mock('@/lib/news', () => ({ fetchAggregatedNews: (per: number) => fetchAggregatedNews(per) }));
vi.mock('@/lib/authors', () => ({ listAuthors: async () => [{ clerkUserId: 'u', slug: 'paris', displayName: 'Paris', roleTitle: 'Founder & Editor', bio: 'Writes.', links: [{ label: 'X', url: 'https://x.com/p' }] }] }));
vi.mock('@/app/(app)/changelog/releases', () => ({
  loadReleaseGroups: async () => [{ key: 'r15', label: 'The finishing pass', storyHtml: '', dateRange: '20–24 Aug 2026', versionSpan: '0.310.0 → 0.334.29', entries: [{ version: '0.334.29', dateISO: '2026-08-24', bodyHtml: '' }, { version: '0.334.28', dateISO: '2026-08-23', bodyHtml: '' }] }],
  releasesFilePath: () => 'RELEASES.md',
}));
const loadCircuits = vi.fn(async () => ({ monza: { name: 'Autodromo Nazionale Monza', countryCode: 'IT', lat: 45.6156, lon: 9.2811, aliases: ['Monza'] } }));
vi.mock('@/lib/circuits', () => ({ loadCircuits: () => loadCircuits() }));
const readSnapshotMeta = vi.fn(async () => ({}) as Record<string, { run: string; at: string; F?: number; W?: number }>);
vi.mock('@/lib/source-snapshot', () => ({ readSnapshotMeta: () => readSnapshotMeta() }));
let tables: Record<string, { data: unknown; error: { message: string } | null }> = {};
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => true,
  betDb: () => ({
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        limit: () => chain,
        order: () => chain,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(tables[table] ?? { data: [], error: null }).then(resolve, reject),
      };
      return chain;
    },
  }),
}));

import { readSource } from './source-read';
import { SOURCES, defaultSourceRef } from './sources';

const drivers = [
  { position: 1, driverName: 'Kimi Antonelli', driverCode: 'ANT', team: 'Mercedes', points: 267, wins: 7 },
  { position: 2, driverName: 'George Russell', driverCode: 'RUS', team: 'Mercedes', points: 201, wins: 2 },
];
const constructors = [{ position: 1, name: 'Mercedes', points: 468, wins: 9 }];

beforeEach(() => {
  readCurrentStandingsWithRun.mockReset();
  fetchFullDriverStandings.mockReset();
  readSnapshotMeta.mockReset();
  readSnapshotMeta.mockResolvedValue({});
  loadCircuits.mockReset();
  loadCircuits.mockResolvedValue({ monza: { name: 'Autodromo Nazionale Monza', countryCode: 'IT', lat: 45.6156, lon: 9.2811, aliases: ['Monza'] } });
  tables = { source_run: { data: [{ id: 'run-1', status: 'ok', finished_at: '2026-09-17T12:20:04Z', rows_written: 44, runner: 'warm-live-data#77' }], error: null } };
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('readSource', () => {
  it('standings: the rows tier first, drivers then constructors as rows with a kind, the run behind them in the provenance', async () => {
    readCurrentStandingsWithRun.mockResolvedValue({ standings: { drivers, constructors }, runId: 'run-1' });
    const read = await readSource({ source: 'standings', params: { series: 'f1', season: 2026 } });
    expect(readCurrentStandingsWithRun).toHaveBeenCalledWith('f1', 2026);
    expect(fetchFullDriverStandings).not.toHaveBeenCalled();
    expect(read.rows).toEqual([
      { kind: 'driver', position: 1, name: 'Kimi Antonelli', code: 'ANT', team: 'Mercedes', points: 267, wins: 7, class: null },
      { kind: 'driver', position: 2, name: 'George Russell', code: 'RUS', team: 'Mercedes', points: 201, wins: 2, class: null },
      { kind: 'constructor', position: 1, name: 'Mercedes', code: null, team: null, points: 468, wins: 9, class: null },
    ]);
    expect(read.total).toBe(3);
    expect(read.columns.map(c => c.key)).toEqual(['kind', 'position', 'name', 'code', 'team', 'points', 'wins', 'class']);
    expect(read.provenance).toMatchObject({
      ref: { source: 'standings', params: { series: 'f1', season: 2026 } },
      label: 'Standings · Formula 1 · 2026',
      tier: 'rows',
      keys: ['standings:f1', 'f1:standings'],
      rows: 3,
      run: { id: 'run-1', status: 'ok', finished: '2026-09-17T12:20:04Z', rows: 44, runner: 'warm-live-data#77' },
    });
    expect(typeof read.provenance.ms).toBe('number');
  });

  it('standings: the snapshot tier when the rows are absent, drivers only, the loader’s meta for its key behind them', async () => {
    readCurrentStandingsWithRun.mockResolvedValue(null);
    fetchFullDriverStandings.mockResolvedValue(drivers);
    readSnapshotMeta.mockResolvedValue({ 'f1:standings': { run: 'warm-live-data#77', at: '2026-09-17T12:20:00.000Z', F: 812, W: 40 }, 'standings:wec': { run: 'warm-live-data#77', at: '2026-09-17T12:21:00.000Z' } });
    const read = await readSource({ source: 'standings', params: { series: 'f1', season: 2026 } });
    expect(fetchFullDriverStandings).toHaveBeenCalledWith('f1', 2026);
    expect(read.rows.map(r => r.name)).toEqual(['Kimi Antonelli', 'George Russell']);
    expect(read.provenance).toMatchObject({ tier: 'snapshot', run: null, meta: { run: 'warm-live-data#77', at: '2026-09-17T12:20:00.000Z', F: 812, W: 40 } });
    // Neither tier: no rows, no error (an unwarmed slot, not a failure).
    fetchFullDriverStandings.mockResolvedValue(null);
    const empty = await readSource({ source: 'standings', params: { series: 'wec', season: 2026 } });
    expect(empty.rows).toEqual([]);
    expect(empty.provenance.error).toBeUndefined();
    expect(empty.provenance.keys).toEqual(['standings:wec']);
  });

  it('P2.2: the class families read the snapshot tier the tabs read, one row per class and kind (GT World’s cups, IMSA’s and WEC’s classes, in the site’s order); WRC reads its drivers, co-drivers and manufacturers the same way; an empty snapshot is no rows', async () => {
    fetchGtWorldStandings.mockResolvedValue({
      season: 2026,
      overall: { championship: 'overall', drivers: [{ position: 1, driverName: 'Marciello', team: 'WRT', points: 98 }], teams: [{ position: 1, name: 'WRT', points: 120 }] },
      sprint: { championship: 'sprint', drivers: [{ position: 1, driverName: 'Engel', team: 'GetSpeed', points: 50, wins: 2 }], teams: [] },
      endurance: { championship: 'endurance', drivers: [], teams: [{ position: 1, name: 'AF Corse', points: 60 }] },
    });
    const gt = await readSource({ source: 'standings', params: { series: 'gt-world', season: 2026 } });
    expect(fetchGtWorldStandings).toHaveBeenCalledWith(2026);
    expect(readCurrentStandingsWithRun).not.toHaveBeenCalled();
    expect(gt.provenance.tier).toBe('snapshot');
    expect(gt.provenance.keys).toEqual(['standings:gt-world:2026']);
    expect(gt.rows.map(r => `${r.class} · ${r.kind} · ${r.name} · ${r.points}`)).toEqual(['Overall · driver · Marciello · 98', 'Overall · team · WRT · 120', 'Sprint Cup · driver · Engel · 50', 'Endurance Cup · team · AF Corse · 60']);
    expect(gt.rows[0]).toEqual({ kind: 'driver', position: 1, name: 'Marciello', code: null, team: 'WRT', points: 98, wins: null, class: 'Overall' });
    expect(gt.rows[2].wins).toBe(2);
    fetchImsaStandings.mockResolvedValue({
      drivers: { GTP: [{ position: 1, driverName: 'Nasr Tandy', points: 2412 }], LMP2: [], 'GTD Pro': [], GTD: [] },
      teams: { GTP: [{ position: 1, team: '#7 Porsche Penske Motorsport', points: 2412 }], LMP2: [], 'GTD Pro': [], GTD: [{ position: 1, team: '#1 Paul Miller Racing', points: 2000 }] },
      manufacturers: { GTP: [{ position: 1, manufacturer: 'Porsche', points: 2500 }] },
    });
    const imsa = await readSource({ source: 'standings', params: { series: 'imsa', season: 2026 } });
    expect(imsa.rows.map(r => `${r.class} · ${r.kind} · ${r.name}`)).toEqual(['GTP · driver · Nasr Tandy', 'GTP · team · #7 Porsche Penske Motorsport', 'GTP · manufacturer · Porsche', 'GTD · team · #1 Paul Miller Racing']);
    expect(imsa.rows[0]).toMatchObject({ position: 1, points: 2412, code: null, team: null, wins: null });
    expect(imsa.provenance.keys).toEqual(['standings:imsa']);
    fetchWecStandings.mockResolvedValue({
      drivers: { Hypercar: [{ position: 1, driverName: 'Estre Campbell Vanthoor', team: 'Porsche #6', points: 121 }], LMGT3: [] },
      teams: { LMGT3: [{ position: 1, team: 'IRON LYNX #50', points: 80 }] },
      manufacturers: { Hypercar: [{ position: 1, manufacturer: 'Porsche', points: 150 }] },
    });
    const wec = await readSource({ source: 'standings', params: { series: 'wec', season: 2026 } });
    expect(wec.rows.map(r => `${r.class} · ${r.kind} · ${r.name}`)).toEqual(['Hypercar · driver · Estre Campbell Vanthoor', 'Hypercar · manufacturer · Porsche', 'LMGT3 · team · IRON LYNX #50']);
    expect(wec.rows[0].team).toBe('Porsche #6');
    fetchWRCStandings.mockResolvedValue({
      drivers: [{ position: 1, driverName: 'Rovanperä', team: 'Toyota', points: 200, wins: 5 }],
      coDrivers: [{ position: 1, coDriverName: 'Halttunen', team: 'Toyota', points: 200 }],
      manufacturers: [{ position: 1, name: 'Toyota Gazoo Racing', points: 412, wins: 7 }],
    });
    // WRC without a rows tier: the snapshot answers whole.
    const wrc = await readSource({ source: 'standings', params: { series: 'wrc', season: 2026 } });
    expect(wrc.provenance.tier).toBe('snapshot');
    expect(wrc.rows.map(r => `${r.kind} · ${r.name} · ${r.points}`)).toEqual(['driver · Rovanperä · 200', 'co-driver · Halttunen · 200', 'manufacturer · Toyota Gazoo Racing · 412']);
    expect(wrc.rows.every(r => r.class === null)).toBe(true);
    expect(wrc.rows[1]).toMatchObject({ team: 'Toyota', code: null, wins: null });
    // WRC with its rows tier (the drivers, as the loader writes them): the rows tier first, its run kept, the
    // co-drivers and manufacturers joining from the snapshot (the reviewer's finding: the Drivers preset keeps its run).
    readCurrentStandingsWithRun.mockResolvedValue({ standings: { drivers: [{ position: 1, driverName: 'Rovanperä', team: 'Toyota', points: 200, wins: 5 }], constructors: [] }, runId: 'run-1' });
    const wrcRows = await readSource({ source: 'standings', params: { series: 'wrc', season: 2026 } });
    expect(wrcRows.provenance.tier).toBe('rows');
    expect(wrcRows.provenance.run).toMatchObject({ id: 'run-1', status: 'ok' });
    expect(wrcRows.rows.map(r => `${r.kind} · ${r.name}`)).toEqual(['driver · Rovanperä', 'co-driver · Halttunen', 'manufacturer · Toyota Gazoo Racing']);
    expect(wrcRows.rows[0].wins).toBe(5);
    readCurrentStandingsWithRun.mockReset();
    fetchWecStandings.mockResolvedValue(null);
    expect((await readSource({ source: 'standings', params: { series: 'wec', season: 2026 } })).rows).toEqual([]);
    // The ten flat series still read the rows tier first, and never the family or WRC fetchers.
    readCurrentStandingsWithRun.mockResolvedValue({ standings: { drivers, constructors }, runId: 'run-1' });
    const dtm = await readSource({ source: 'standings', params: { series: 'dtm', season: 2026 } });
    expect(dtm.provenance.tier).toBe('rows');
    expect(dtm.provenance.meta).toBeUndefined();
    expect(fetchWRCStandings).toHaveBeenCalledTimes(2);
  });

  it('never throws: a reader that fails answers no rows and the reason in words; a limit cuts the rows and keeps the total', async () => {
    loadCircuits.mockRejectedValue(new Error('boom'));
    const bad = await readSource({ source: 'tracks', params: {} });
    expect(bad.rows).toEqual([]);
    expect(bad.provenance.error).toBe('boom');
    expect(bad.provenance.tier).toBe('content');
    const cut = await readSource({ source: 'posts', params: { count: 10 } }, { limit: 2 });
    expect(cut.rows).toHaveLength(2);
    expect(cut.total).toBe(3);
    const unknown = await readSource({ source: 'nope', params: {} });
    expect(unknown.rows).toEqual([]);
    expect(unknown.provenance.error).toBe('Source must name a source from the catalogue');
  });

  it('every one of the thirteen answers rows that carry each declared column, dates as ISO strings', async () => {
    readCurrentStandingsWithRun.mockResolvedValue({ standings: { drivers, constructors }, runId: null });
    for (const s of SOURCES) {
      const read = await readSource(defaultSourceRef(s));
      expect(read.provenance.error, s.key).toBeUndefined();
      expect(read.rows.length, s.key).toBeGreaterThan(0);
      for (const c of s.columns) expect(Object.keys(read.rows[0]), `${s.key}.${c.key}`).toContain(c.key);
      for (const c of s.columns) {
        const v = read.rows[0][c.key];
        expect(['string', 'number', 'boolean'].includes(typeof v) || v === null, `${s.key}.${c.key} = ${String(v)}`).toBe(true);
        if (c.type === 'date' && v !== null) expect(String(v), `${s.key}.${c.key}`).toMatch(/^\d{4}-\d{2}-\d{2}/);
      }
    }
  });

  it('the readers’ own rules: sessions carry their dates as ISO strings; rounds carry the cancelled ones with their status; posts filter by series; news asks the reader for the per-series cap', async () => {
    const sessions = await readSource({ source: 'sessions', params: { series: 'f1' } });
    expect(sessions.rows[0]).toMatchObject({ uid: 'u1', title: 'Race', start: '2026-09-20T13:00:00.000Z', end: '2026-09-20T15:00:00.000Z', location: 'Baku', dateOnly: false, significance: 'Season finale' });
    expect(sessions.rows[1]).toMatchObject({ dateOnly: true, location: null, significance: null });
    expect(sessions.provenance.tier).toBe('live');
    const r = await readSource({ source: 'rounds', params: { series: 'f1' } });
    expect(r.rows.map(x => [x.round, x.status])).toEqual([
      [1, 'scheduled'],
      [2, 'rescheduled'],
      [4, 'cancelled'],
    ]);
    const posts = await readSource({ source: 'posts', params: { series: 'f2', count: 10 } });
    expect(posts.rows.map(x => x.slug)).toEqual(['c']);
    expect(posts.rows[0]).toMatchObject({ title: 'Post c', series: 'f2', author: 'Paris', published: '2026-09-08T10:00:00Z', link: '/blog/c', hero: null });
    const news = await readSource({ source: 'news', params: { per: 3 } });
    expect(fetchAggregatedNews).toHaveBeenCalledWith(3);
    expect(news.rows[0]).toMatchObject({ title: 'Headline', link: 'https://example.com/news/1', source: 'example.com', published: '2026-09-17T08:00:00.000Z', series: 'f1' });
    expect(news.provenance.keys).toEqual(['news:aggregate:3']);
    const season = await readSource({ source: 'season', params: {} });
    expect(season.rows[0]).toMatchObject({ series: 'f1', season: 2026, rounds: 2, first: '2026-03-06', last: '2026-03-15' });
    expect(typeof season.rows[0].underWay).toBe('boolean');
    const teams = await readSource({ source: 'teams', params: { series: 'f1' } });
    expect(teams.rows).toEqual([
      { name: 'Mercedes', colour: '#00d2be', drivers: 'Kimi Antonelli, George Russell', count: 2 },
      { name: 'Ferrari', colour: null, drivers: 'Charles Leclerc', count: 1 },
    ]);
    const results = await readSource({ source: 'results', params: { series: 'f1', season: 2026 } });
    expect(results.rows.map(x => [x.round, x.race, x.driver])).toEqual([
      [1, 'Australian Grand Prix', 'Kimi Antonelli'],
      [2, 'Chinese Grand Prix Sprint', 'George Russell'],
    ]);
    expect(results.rows[0].date).toBe('2026-03-08T05:00:00.000Z');
    expect(results.provenance.keys).toEqual(['f1:results', 'f1:sprints', 'f1:last-race']);
  });
});
