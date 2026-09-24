import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The reader behind the catalogue (P2.1): one readSource for the fourteen,
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
vi.mock('@/lib/series', () => {
  // Two past sessions and one far ahead (2030), so the weekends reader (P2.24 B1) finds a coming weekend whatever the clock says.
  const loadSeries = async (slug: string) => ({
    meta: meta(slug, slug === 'f1' ? 'Formula 1' : slug === 'f2' ? 'Formula 2' : slug === 'wec' ? 'FIA WEC' : slug),
    sessions: [
      { uid: 'u1', seriesSlug: slug, title: 'Race', start: new Date('2026-09-20T13:00:00Z'), end: new Date('2026-09-20T15:00:00Z'), location: 'Baku', significance: { tier: 'marquee', note: 'Season finale' } },
      { uid: 'u2', seriesSlug: slug, title: 'Practice', start: new Date('2026-09-18T00:00:00Z'), end: new Date('2026-09-18T01:00:00Z'), dateOnly: true },
      { uid: 'u3', seriesSlug: slug, title: 'Race', start: new Date('2030-03-07T13:00:00Z'), end: new Date('2030-03-07T15:00:00Z'), location: 'Melbourne' },
    ],
    rounds,
    overview: '',
    drivers: '',
    significance: '',
    fetchedAt: new Date('2026-09-17T12:00:00Z'),
    stale: false,
    configured: true,
  });
  return {
    loadAllSeriesMeta: async () => [meta('f1', 'Formula 1'), meta('f2', 'Formula 2')],
    loadSeries,
    loadAllSeries: async () => [await loadSeries('f1'), await loadSeries('f2')],
  };
});
vi.mock('@/lib/rounds-loader', () => ({ loadRounds: async () => rounds }));
const readCurrentStandingsWithRun = vi.fn();
vi.mock('@/lib/standing-rows', () => ({ readCurrentStandingsWithRun: (...a: unknown[]) => readCurrentStandingsWithRun(...a) }));
const fetchFullDriverStandings = vi.fn();
vi.mock('@/lib/standings/brief', () => ({
  fetchFullDriverStandings: (...a: unknown[]) => fetchFullDriverStandings(...a),
  // The ten with a drivers' brief (lib/standings/brief.ts ELIGIBLE_STANDINGS_SLUGS); the Latest result reads none other (P2.24 B2).
  isEligibleStandingsSeries: (slug: string) => ['f1', 'f2', 'f3', 'indycar', 'formula-e', 'motogp', 'nascar-cup', 'wsbk', 'wrc', 'dtm'].includes(slug),
}));
// The class families and WRC (P2.2) read the snapshot tier the tabs read.
const fetchGtWorldStandings = vi.fn();
vi.mock('@/lib/standings/gt-world', () => ({ fetchGtWorldStandings: (...a: unknown[]) => fetchGtWorldStandings(...a) }));
const fetchImsaStandings = vi.fn();
vi.mock('@/lib/standings/imsa', () => ({ fetchImsaStandings: () => fetchImsaStandings(), IMSA_CLASSES: ['GTP', 'LMP2', 'GTD Pro', 'GTD'] }));
const fetchWecStandings = vi.fn();
vi.mock('@/lib/standings/wec', () => ({ fetchWecStandings: () => fetchWecStandings(), WEC_CLASSES: ['Hypercar', 'LMGT3'] }));
const fetchWRCStandings = vi.fn();
vi.mock('@/lib/standings/wrc', () => ({ fetchWRCStandings: () => fetchWRCStandings() }));
// P2.4 PR B: each row's page from the site's own rosters (lib/people.ts). The stand-in answers any name in IMSA and WRC, so a
// crew, a co-driver or a manufacturer without a page shows the reader never asks the rosters for one.
vi.mock('@/lib/people', () => ({
  peopleIndex: async () => ({
    driver: (series: string, name: string) => (series === 'f1' && name.endsWith('Antonelli') ? '/drivers/kimi-antonelli' : series === 'imsa' || series === 'wrc' ? `/drivers/${series}-any` : null),
    team: (series: string, name: string) => (series === 'f1' && name === 'Mercedes' ? '/teams/mercedes' : series === 'imsa' || series === 'wrc' ? `/teams/${series}-any` : null),
  }),
}));
// The results dispatch (eight series; P2.2 B1 reads WRC and DTM through their real fetchers, never this).
// The mock reads the series handed in, so a test may answer per series (P2.24 B2: the newest race across Home's series).
const loadSnapshotSource = vi.fn<(series: { meta: { slug: string } }) => Promise<unknown>>(async () => snapshotAnswer());
vi.mock('@/components/weekend/WeekendStandingsSnapshot', () => ({ loadSnapshotSource: (s: { meta: { slug: string } }) => loadSnapshotSource(s) }));
const snapshotAnswer = () => ({
    races: [{ round: 1, raceName: 'Australian Grand Prix', date: new Date('2026-03-08T05:00:00Z'), circuit: 'Albert Park', results: [{ position: 1, driverName: 'Kimi Antonelli', driverCode: 'ANT', team: 'Mercedes', status: 'Finished', time: '1:30:12.345', points: 25 }] }],
    extras: [{ round: 2, raceName: 'Chinese Grand Prix Sprint', date: new Date('2026-03-14T03:00:00Z'), circuit: 'Shanghai', results: [{ position: 1, driverName: 'George Russell', team: 'Mercedes', status: 'Finished', points: 8 }] }],
    showTeams: true,
    pointsExact: true,
});
// P2.2 B1: the four results readers the dispatch lacks, the two real fetchers WRC and DTM use, and the weekend grouping behind the link column.
const fetchNlsSeasonResults = vi.fn();
vi.mock('@/lib/results/nls', () => ({ fetchNlsSeasonResults: (...a: unknown[]) => fetchNlsSeasonResults(...a) }));
const fetchImsaSeasonResults = vi.fn();
vi.mock('@/lib/results/imsa', () => ({ fetchImsaSeasonResults: () => fetchImsaSeasonResults() }));
const fetchWecSeasonResults = vi.fn();
vi.mock('@/lib/results/wec', () => ({ fetchWecSeasonResults: () => fetchWecSeasonResults(), WEC_RESULT_CLASSES: ['Hypercar', 'LMP2', 'LMGT3'] }));
const fetchAllGtWorldSeasonRaces = vi.fn();
vi.mock('@/lib/results/gt-world', () => ({ fetchAllGtWorldSeasonRaces: (...a: unknown[]) => fetchAllGtWorldSeasonRaces(...a) }));
const fetchWRCSeasonResults = vi.fn();
vi.mock('@/lib/results/wrc', () => ({ fetchWRCSeasonResults: (...a: unknown[]) => fetchWRCSeasonResults(...a) }));
const fetchDTMSeasonResults = vi.fn();
vi.mock('@/lib/results/dtm', () => ({ fetchDTMSeasonResults: (...a: unknown[]) => fetchDTMSeasonResults(...a) }));
// One weekend of every session handed in, coming (P2.24 B1); the results reader reads its round alone. A test may re-point it.
const comingWeekend = (sessions: { start: Date; end: Date }[]) => [{ round: 1, key: 'w1', isPast: false, dateRangeLabel: '5–7 Mar', sessions }];
const groupByWeekend = vi.fn(comingWeekend);
vi.mock('@/lib/group', () => ({ groupByWeekend: (...a: Parameters<typeof groupByWeekend>) => groupByWeekend(...a) }));
vi.mock('@/lib/series-content', () => ({
  loadCuratedDrivers: async () => ({ teams: [{ name: 'Mercedes', color: '#00d2be', drivers: [{ name: 'Kimi Antonelli', code: 'ANT', number: 12 }, { name: 'George Russell', code: 'RUS', number: 63 }] }, { name: 'Ferrari', drivers: [{ name: 'Charles Leclerc' }] }] }),
}));
const post = (slug: string, seriesSlug: string | null, publishedAt: string | null, over: Record<string, unknown> = {}) => ({ id: slug, slug, title: `Post ${slug}`, summary: 'Words.', body: '', seriesSlug, tags: seriesSlug ? [seriesSlug] : [], originalUrl: null, status: 'published', authorId: 'u', authorName: 'Paris', publishAt: null, publishedAt, heroImage: slug === 'a' ? 'https://example.com/a.jpg' : null, learnTopic: null, createdAt: publishedAt ?? '2026-09-01T00:00:00Z', updatedAt: null, ...over });
// The published posts the reader sees; a test may swap the list and put it back.
let blogPosts = [post('a', 'f1', '2026-09-10T10:00:00Z'), post('b', null, '2026-09-09T10:00:00Z'), post('c', 'f2', '2026-09-08T10:00:00Z')];
vi.mock('@/lib/blog', () => ({ publishedPosts: async () => blogPosts, readMinutes: (body: string) => Math.max(1, Math.round(body.trim().split(/\s+/).filter(w => w.length > 0).length / 220)) }));
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

const race = (round: number, raceName: string, over: Record<string, unknown> = {}) => ({
  round,
  raceName,
  date: new Date(`2026-0${round}-10T12:00:00Z`),
  circuit: `Circuit ${round}`,
  results: [{ position: 1, driverName: `Winner ${round}`, driverCode: 'WIN', team: 'Team A', status: 'Finished', time: '1:30:00.0', points: 25 }],
  ...over,
});
const imsaEntry = (position: number, carNumber: string, drivers: string, gap: string) => ({ position, carNumber, team: `Team ${carNumber}`, drivers, vehicle: 'Porsche 963', manufacturer: 'Porsche', laps: 781 - position, status: 'Classified', gap });

beforeEach(() => {
  readCurrentStandingsWithRun.mockReset();
  fetchFullDriverStandings.mockReset();
  // A test may re-point these two per series or per weekend; every test starts from the defaults.
  loadSnapshotSource.mockReset();
  loadSnapshotSource.mockImplementation(async () => snapshotAnswer());
  groupByWeekend.mockReset();
  groupByWeekend.mockImplementation(comingWeekend);
  fetchNlsSeasonResults.mockReset();
  fetchNlsSeasonResults.mockResolvedValue([race(1, 'NLS 1', { results: [{ position: 1, driverName: 'Crew One', team: 'Team One', status: 'Winner', points: 0 }] })]);
  fetchImsaSeasonResults.mockReset();
  fetchImsaSeasonResults.mockResolvedValue([{ round: 1, eventName: 'Rolex 24 at Daytona', circuit: 'Daytona International Speedway', date: new Date('2026-01-25T00:00:00Z'), perClass: { GTP: [imsaEntry(1, '7', 'Nasr Tandy', ''), imsaEntry(2, '6', 'Campbell Jaminet', '+2.5')], GTD: [imsaEntry(1, '1', '', '')] } }]);
  fetchWecSeasonResults.mockReset();
  fetchWecSeasonResults.mockResolvedValue([
    { round: 3, eventName: '24 Hours of Le Mans', dateStart: new Date('2026-06-13T00:00:00Z'), dateEnd: new Date('2026-06-14T00:00:00Z'), perClass: { Hypercar: [{ ...imsaEntry(1, '6', 'Estre Campbell Vanthoor', ''), elapsedTime: '24:00:12.345' }, { ...imsaEntry(2, '50', 'Fuoco Molina Nielsen', '+1 Lap'), elapsedTime: '24:01:00.000' }], LMGT3: [{ ...imsaEntry(1, '92', 'Crew GT', ''), elapsedTime: '24:00:30.000' }] } },
  ]);
  fetchAllGtWorldSeasonRaces.mockReset();
  fetchAllGtWorldSeasonRaces.mockResolvedValue([
    { raceId: 501, raceName: 'Race 1', eventName: 'Brands Hatch', eventSlug: 'brands-hatch', championship: 'sprint', round: 2, entries: [{ position: 1, carNumber: '99', cup: 'gold', cupLabel: 'Gold', drivers: ['A', 'B'], team: 'Gold Team', car: 'Audi R8', gap: '+10.0', laps: 40 }, { position: 1, carNumber: '32', cup: 'pro', cupLabel: 'Pro', drivers: ['Vanthoor', 'Weerts'], team: 'Team WRT', car: 'BMW M4 GT3', time: '1:00:01.234', laps: 40 }] },
    { raceId: 777, raceName: 'Race', eventName: 'Spa', eventSlug: 'spa', championship: 'endurance', entries: [{ position: 1, carNumber: '51', cup: 'pro', cupLabel: 'Pro', drivers: ['C', 'D', 'E'], team: 'AF Corse', car: 'Ferrari 296', laps: 540, gap: '' }] },
  ]);
  fetchWRCSeasonResults.mockReset();
  fetchWRCSeasonResults.mockResolvedValue([race(1, 'Rallye Monte-Carlo', { results: [{ position: 1, driverName: 'Rovanperä', team: 'Toyota', status: 'Finished', time: '3:12:00.0', points: 25 }] })]);
  fetchDTMSeasonResults.mockReset();
  fetchDTMSeasonResults.mockResolvedValue([race(2, 'Oschersleben Race 1'), race(2, 'Oschersleben Race 2')]);
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
    // P2.24 B2: every row carries the series' name and colour; the race winner and the season's end are the Latest result's facts, null for one championship.
    expect(read.rows).toEqual([
      { kind: 'driver', position: 1, name: 'Kimi Antonelli', code: 'ANT', team: 'Mercedes', points: 267, wins: 7, class: null, profile: '/drivers/kimi-antonelli', seriesName: 'Formula 1', colour: '#e10600', winner: null, final: null },
      { kind: 'driver', position: 2, name: 'George Russell', code: 'RUS', team: 'Mercedes', points: 201, wins: 2, class: null, profile: null, seriesName: 'Formula 1', colour: '#e10600', winner: null, final: null },
      { kind: 'constructor', position: 1, name: 'Mercedes', code: null, team: null, points: 468, wins: 9, class: null, profile: '/teams/mercedes', seriesName: 'Formula 1', colour: '#e10600', winner: null, final: null },
    ]);
    expect(read.total).toBe(3);
    expect(read.columns.map(c => c.key)).toEqual(['kind', 'position', 'name', 'code', 'team', 'points', 'wins', 'class', 'profile', 'seriesName', 'colour', 'winner', 'final']);
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
    expect(gt.rows[0]).toEqual({ kind: 'driver', position: 1, name: 'Marciello', code: null, team: 'WRT', points: 98, wins: null, class: 'Overall', profile: null, seriesName: null, colour: null, winner: null, final: null });
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
    // P2.4 PR B: the driver's page; a co-driver and a manufacturer none, though the stand-in would answer any WRC name.
    expect(wrc.rows.map(r => r.profile)).toEqual(['/drivers/wrc-any', null, null]);
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

  it('P2.2 B1: results read fourteen series: the session from the dispatch’s arrays (extras sprint, F2’s races feature, the rest race), WRC and DTM through the real fetchers and never the chart dispatch, NLS’s winners, IMSA and WEC per class with the car columns (the WEC class leader’s time as its gap), GT World per cup with its race id; the weekend link where a weekend page exists', async () => {
    const f1 = await readSource({ source: 'results', params: { series: 'f1', season: 2026 } });
    expect(f1.provenance.tier).toBe('snapshot');
    expect(f1.rows.filter(r => r.session === 'race').map(r => r.driver)).toEqual(['Kimi Antonelli']);
    expect(f1.rows.filter(r => r.session === 'sprint').map(r => r.driver)).toEqual(['George Russell']);
    expect(f1.rows[0]).toMatchObject({ round: 1, race: 'Australian Grand Prix', raceId: null, circuit: 'Albert Park', class: null, session: 'race', position: 1, code: 'ANT', car: null, vehicle: null, manufacturer: null, laps: null, gap: null, points: 25, weekend: '/series/f1/weekend/1' });
    expect(f1.rows[0].date).toMatch(/^2026-03-08/);
    // Round 2 has no weekend page (the grouping answers round 1 only): no link.
    expect(f1.rows.find(r => r.round === 2)?.weekend).toBeNull();
    // P2.4 PR B: a flat series' driver carries the page the rosters answer; one they do not know carries none.
    expect(f1.rows.find(r => r.session === 'race')?.profile).toBe('/drivers/kimi-antonelli');
    expect(f1.rows.find(r => r.session === 'sprint')?.profile).toBeNull();
    const f2 = await readSource({ source: 'results', params: { series: 'f2', season: 2026 } });
    expect(f2.rows.map(r => r.session)).toEqual(['feature', 'sprint']);
    const motogp = await readSource({ source: 'results', params: { series: 'motogp', season: 2026 } });
    expect(motogp.rows.map(r => r.session)).toEqual(['race', 'sprint']);
    // F3's one merged Feature-and-Sprint array stays 'race', as the tab lists both under Season results; only F2's races are 'feature'.
    const f3 = await readSource({ source: 'results', params: { series: 'f3', season: 2026 } });
    expect(f3.rows.map(r => r.session)).toEqual(['race', 'sprint']);
    loadSnapshotSource.mockClear();
    const wrc = await readSource({ source: 'results', params: { series: 'wrc', season: 2026 } });
    expect(fetchWRCSeasonResults).toHaveBeenCalledWith(2026);
    expect(wrc.rows.map(r => `${r.round} · ${r.race} · ${r.driver} · ${r.session}`)).toEqual(['1 · Rallye Monte-Carlo · Rovanperä · race']);
    const dtm = await readSource({ source: 'results', params: { series: 'dtm', season: 2026 } });
    expect(fetchDTMSeasonResults).toHaveBeenCalledWith(2026, rounds.rounds);
    expect(dtm.rows.map(r => r.race)).toEqual(['Oschersleben Race 1', 'Oschersleben Race 2']);
    expect(loadSnapshotSource).not.toHaveBeenCalled();
    const nls = await readSource({ source: 'results', params: { series: 'nls', season: 2026 } });
    expect(fetchNlsSeasonResults).toHaveBeenCalledWith(2026);
    expect(nls.rows).toHaveLength(1);
    expect(nls.rows[0]).toMatchObject({ round: 1, race: 'NLS 1', driver: 'Crew One', status: 'Winner', session: 'race', points: 0, weekend: '/series/nls/weekend/1' });
    const imsa = await readSource({ source: 'results', params: { series: 'imsa', season: 2026 } });
    expect(imsa.provenance.keys).toEqual(['results:imsa']);
    expect(imsa.rows.map(r => `${r.class} · ${r.position} · ${r.car} · ${r.driver}`)).toEqual(['GTP · 1 · 7 · Nasr Tandy', 'GTP · 2 · 6 · Campbell Jaminet', 'GTD · 1 · 1 · null']);
    expect(imsa.rows[0]).toMatchObject({ round: 1, race: 'Rolex 24 at Daytona', circuit: 'Daytona International Speedway', session: 'race', team: 'Team 7', vehicle: 'Porsche 963', manufacturer: 'Porsche', laps: 780, status: 'Classified', gap: null, points: null, code: null, time: null, raceId: null });
    expect(imsa.rows[1].gap).toBe('+2.5');
    // P2.4 PR B: a crew (a car row) has no page, and the rosters are never asked, though the stand-in answers any IMSA name.
    expect(imsa.rows.map(r => r.profile)).toEqual([null, null, null]);
    expect(imsa.rows[0].date).toMatch(/^2026-01-25/);
    const wec = await readSource({ source: 'results', params: { series: 'wec', season: 2026 } });
    expect(wec.rows.map(r => `${r.class} · ${r.position} · ${r.gap}`)).toEqual(['Hypercar · 1 · 24:00:12.345', 'Hypercar · 2 · +1 Lap', 'LMGT3 · 1 · 24:00:30.000']);
    expect(wec.rows[0]).toMatchObject({ round: 3, race: '24 Hours of Le Mans', circuit: null, driver: 'Estre Campbell Vanthoor', car: '6', team: 'Team 6' });
    expect(wec.rows[0].date).toMatch(/^2026-06-14/);
    const gt = await readSource({ source: 'results', params: { series: 'gt-world', season: 2026 } });
    expect(gt.rows.map(r => `${r.raceId} · ${r.class} · ${r.driver} · ${r.gap}`)).toEqual(['501 · Pro Cup · Vanthoor · Weerts · 1:00:01.234', '501 · Gold Cup · A · B · +10.0', '777 · Pro Cup · C · D · E · null']);
    expect(gt.rows[0]).toMatchObject({ round: 2, race: 'Brands Hatch Race 1', car: '32', team: 'Team WRT', vehicle: 'BMW M4 GT3', laps: 40, date: null, weekend: null, points: null, session: 'race' });
    expect(gt.rows[2]).toMatchObject({ round: null, weekend: null });
    fetchWecSeasonResults.mockResolvedValue([]);
    expect((await readSource({ source: 'results', params: { series: 'wec', season: 2026 } })).rows).toEqual([]);
  });

  it('P2.24 A: the posts reader orders as Home’s lead is chosen (published desc with nulls last, created desc as the tie-break), stamps an unstamped post by its creation, counts the read time from the body and resolves the series’ name and colour; the news reader sorts newest first and carries the series’ name and colour, nulls for a series it does not know', async () => {
    const before = blogPosts;
    blogPosts = [
      post('old', 'f1', '2026-09-01T10:00:00Z', { createdAt: '2026-08-30T00:00:00Z' }),
      post('tie-early', 'f1', '2026-09-10T10:00:00Z', { createdAt: '2026-09-09T08:00:00Z' }),
      post('unstamped', null, null, { createdAt: '2026-09-20T00:00:00Z' }),
      post('tie-late', 'f2', '2026-09-10T10:00:00Z', { createdAt: '2026-09-09T09:00:00Z', body: Array(440).fill('word').join(' ') }),
    ];
    try {
      const read = await readSource({ source: 'posts', params: { count: 10 } });
      expect(read.rows.map(r => r.slug)).toEqual(['tie-late', 'tie-early', 'old', 'unstamped']);
      expect(read.rows[0]).toMatchObject({ seriesName: 'Formula 2', colour: '#e10600', minutes: 2, published: '2026-09-10T10:00:00Z' });
      expect(read.rows[3]).toMatchObject({ published: '2026-09-20T00:00:00Z', seriesName: null, colour: null, minutes: 1 });
    } finally {
      blogPosts = before;
    }
    fetchAggregatedNews.mockResolvedValueOnce([
      { title: 'Older', link: 'https://www.example.com/older', pubDate: new Date('2026-09-17T06:00:00Z'), seriesSlug: 'f1', description: '' },
      { title: 'Newer', link: 'https://example.com/newer', pubDate: new Date('2026-09-17T09:00:00Z'), seriesSlug: 'nope', description: '' },
    ]);
    const news = await readSource({ source: 'news', params: { per: 3 } });
    expect(news.rows.map(r => [r.title, r.source, r.seriesName, r.colour])).toEqual([
      ['Newer', 'example.com', null, null],
      ['Older', 'example.com', 'Formula 1', '#e10600'],
    ]);
  });

  it('P2.24 B1: the weekends reader answers the coming weekends across every series or one, the nearest first, cut to the count, each with the series’ name and colour, the round, the title, the first and last sessions, the dates label and the weekend page; a weekend that is past is left out; a series whose grouping throws yields none, as Home’s does', async () => {
    const every = await readSource({ source: 'weekends', params: { count: 10 } });
    expect(every.provenance.tier).toBe('live');
    expect(every.rows.map(r => [r.series, r.seriesName, r.colour, r.round, r.dates, r.weekend])).toEqual([
      ['f1', 'Formula 1', '#e10600', 1, '5–7 Mar', '/series/f1/weekend/1'],
      ['f2', 'Formula 2', '#e10600', 1, '5–7 Mar', '/series/f2/weekend/1'],
    ]);
    expect(every.rows[0]).toMatchObject({ start: '2026-09-18T00:00:00.000Z', end: '2030-03-07T15:00:00.000Z' });
    expect(typeof every.rows[0].title).toBe('string');
    expect(String(every.rows[0].title).length).toBeGreaterThan(0);
    const one = await readSource({ source: 'weekends', params: { series: 'f2', count: 10 } });
    expect(one.rows.map(r => r.series)).toEqual(['f2']);
    // Three weekends for one series: the past one left out, the two coming ones by their first session, the count cutting the later.
    const at = (round: number, iso: string, isPast = false) => ({ round, key: `w${round}`, isPast, dateRangeLabel: `w${round}`, sessions: [{ start: new Date(iso), end: new Date(new Date(iso).getTime() + 7_200_000) }] });
    groupByWeekend.mockImplementationOnce(() => [at(3, '2031-01-10T10:00:00Z'), at(2, '2030-06-01T10:00:00Z'), at(1, '2020-01-01T10:00:00Z', true)]);
    const ordered = await readSource({ source: 'weekends', params: { series: 'f1', count: 10 } });
    expect(ordered.rows.map(r => [r.round, r.start])).toEqual([
      [2, '2030-06-01T10:00:00.000Z'],
      [3, '2031-01-10T10:00:00.000Z'],
    ]);
    groupByWeekend.mockImplementationOnce(() => [at(3, '2031-01-10T10:00:00Z'), at(2, '2030-06-01T10:00:00Z')]);
    expect((await readSource({ source: 'weekends', params: { series: 'f1', count: 1 } })).rows.map(r => r.round)).toEqual([2]);
    groupByWeekend.mockImplementationOnce(() => {
      throw new Error('no calendar');
    });
    const partial = await readSource({ source: 'weekends', params: { count: 10 } });
    expect(partial.rows.map(r => r.series)).toEqual(['f2']);
    expect(partial.provenance.error).toBeUndefined();
  });

  it('P2.24 B2: every Results read carries the series’ facts: its name and colour, whether the season is complete (no weekend still to run) and, then, its champion from the drivers’ standings (none for a series without a drivers’ championship); a plain Standings read carries the name and colour with no race context', async () => {
    const f1 = await readSource({ source: 'results', params: { series: 'f1', season: 2026 } });
    expect(f1.rows[0]).toMatchObject({ seriesName: 'Formula 1', colour: '#e10600', final: false, champion: null });
    expect(f1.columns.map(c => c.key).slice(-4)).toEqual(['seriesName', 'colour', 'final', 'champion']);
    expect(fetchFullDriverStandings).not.toHaveBeenCalled();
    // Every weekend past: the season is complete and the champion is the standings' leader; the brief answers null for a series without a drivers' table.
    groupByWeekend.mockImplementation(() => [{ round: 1, key: 'w1', isPast: true, dateRangeLabel: '6–8 Mar', sessions: [] }]);
    fetchFullDriverStandings.mockResolvedValue(drivers);
    const done = await readSource({ source: 'results', params: { series: 'f1', season: 2026 } });
    expect(done.rows[0]).toMatchObject({ final: true, champion: 'Kimi Antonelli' });
    expect(fetchFullDriverStandings).toHaveBeenCalledWith('f1', 2026);
    fetchFullDriverStandings.mockResolvedValue(null);
    const wec = await readSource({ source: 'results', params: { series: 'wec', season: 2026 } });
    expect(wec.rows[0]).toMatchObject({ seriesName: 'FIA WEC', final: true, champion: null });
    // A plain Standings read: the series' name and colour from the content, no race context.
    readCurrentStandingsWithRun.mockResolvedValue({ standings: { drivers, constructors }, runId: 'run-1' });
    const standings = await readSource({ source: 'standings', params: { series: 'f2', season: 2026 } });
    expect(standings.rows[0]).toMatchObject({ name: 'Kimi Antonelli', seriesName: 'Formula 2', colour: '#e10600', winner: null, final: null });
  });

  it('P2.24 B2: Results with the Series “Home’s series” answers the newest finished race across the series Home ranks, that race’s rows alone: the flat series’ race sessions (never a sprint), WEC’s Hypercar class, by date with a tie kept in Home’s order, a future race and a failing series left out; the rows carry the series’ facts and the provenance the resolved series’ keys; nothing when no series has a finished race', async () => {
    const home = { source: 'results', params: { series: 'home', season: 2026 } };
    // Le Mans (14 June) is newer than every flat series' Australian Grand Prix (8 March): WEC's Hypercar rows, LMGT3 left out.
    const wec = await readSource(home);
    expect(wec.provenance).toMatchObject({ label: "Results · Home's series · 2026", tier: 'snapshot', keys: ['results:wec'], rows: 2 });
    expect(wec.provenance.error).toBeUndefined();
    expect(wec.rows.map(r => [r.class, r.position, r.driver, r.gap])).toEqual([
      ['Hypercar', 1, 'Estre Campbell Vanthoor', '24:00:12.345'],
      ['Hypercar', 2, 'Fuoco Molina Nielsen', '+1 Lap'],
    ]);
    expect(wec.rows[0]).toMatchObject({ round: 3, race: '24 Hours of Le Mans', date: '2026-06-14T00:00:00.000Z', seriesName: 'FIA WEC', colour: '#e10600', final: false, champion: null, weekend: null });
    // F1's Italian Grand Prix (6 September) newer than Le Mans: F1's race, its sprint of a week later never a candidate, a race dated 2030 not finished; F3's race on the same day loses the tie to F1, Home's first.
    const gp = (round: number, name: string, iso: string, driver: string) =>
      race(round, name, {
        date: new Date(iso),
        results: [
          { position: 1, driverName: driver, driverCode: 'WIN', team: 'Team A', status: 'Finished', time: '1:20:00.0', points: 25 },
          { position: 2, driverName: `${driver} II`, driverCode: 'SEC', team: 'Team B', status: 'Finished', time: '+3.857', points: 18 },
        ],
      });
    const bySlug: Record<string, unknown> = {
      f1: { ...snapshotAnswer(), races: [gp(9, 'Italian Grand Prix', '2026-09-06T13:00:00Z', 'Kimi Antonelli'), gp(24, 'Future Grand Prix', '2030-12-01T13:00:00Z', 'Nobody')], extras: [gp(10, 'Sprint', '2026-09-12T13:00:00Z', 'Sprinter')] },
      f3: { ...snapshotAnswer(), races: [gp(8, 'Monza Feature', '2026-09-06T13:00:00Z', 'F3 Winner')] },
    };
    loadSnapshotSource.mockImplementation(async s => bySlug[s.meta.slug] ?? snapshotAnswer());
    const f1 = await readSource(home);
    expect(f1.provenance.keys).toEqual(['f1:results', 'f1:sprints', 'f1:last-race']);
    expect(f1.rows.map(r => [r.round, r.race, r.session, r.position, r.driver, r.time])).toEqual([
      [9, 'Italian Grand Prix', 'race', 1, 'Kimi Antonelli', '1:20:00.0'],
      [9, 'Italian Grand Prix', 'race', 2, 'Kimi Antonelli II', '+3.857'],
    ]);
    expect(f1.rows[0]).toMatchObject({ seriesName: 'Formula 1', colour: '#e10600', final: false, champion: null, date: '2026-09-06T13:00:00.000Z' });
    // A series whose read throws is skipped, as Home's per-series lookup fails soft: F3's race of the same day stands.
    loadSnapshotSource.mockImplementation(async s => {
      if (s.meta.slug === 'f1') throw new Error('boom');
      return bySlug[s.meta.slug] ?? snapshotAnswer();
    });
    const without = await readSource(home);
    expect(without.provenance.error).toBeUndefined();
    expect(without.rows.map(r => r.driver)).toEqual(['F3 Winner', 'F3 Winner II']);
    // No finished race anywhere: no rows, no error, the declared keys.
    loadSnapshotSource.mockImplementation(async () => ({ ...snapshotAnswer(), races: [], extras: [] }));
    fetchWecSeasonResults.mockResolvedValue([]);
    const none = await readSource(home);
    expect(none.rows).toEqual([]);
    expect(none.provenance.error).toBeUndefined();
    expect(none.provenance.keys).toEqual(['f1:results', 'f1:sprints', 'f1:last-race', 'results:f3', 'results:formula-e', 'results:indycar', 'results:motogp', 'results:wec']);
  });

  it('P2.24 B2: Standings with the Series “Latest result” reads the championship of the newest race across Home’s series through the standings path, every row carrying the series’ name and colour, the race winner’s flag on the winner’s driver row and whether the season is complete, the provenance that series’ keys and run; nothing for a series without a drivers’ championship (WEC) or when no race has finished', async () => {
    const latest = { source: 'standings', params: { series: 'latest', season: 2026 } };
    // Le Mans is the newest race by default, and WEC has no drivers' brief: no rows, no error.
    const wec = await readSource(latest);
    expect(wec.rows).toEqual([]);
    expect(wec.provenance).toMatchObject({ label: 'Standings · Latest result · 2026', keys: [] });
    expect(wec.provenance.error).toBeUndefined();
    expect(readCurrentStandingsWithRun).not.toHaveBeenCalled();
    // F1's race the newest: F1's rows tier, Antonelli's row flagged as the race winner.
    loadSnapshotSource.mockImplementation(async s =>
      s.meta.slug === 'f1'
        ? { ...snapshotAnswer(), races: [race(9, 'Italian Grand Prix', { date: new Date('2026-09-06T13:00:00Z'), results: [{ position: 1, driverName: 'Kimi Antonelli', driverCode: 'ANT', team: 'Mercedes', status: 'Finished', time: '1:20:00.0', points: 25 }] })] }
        : snapshotAnswer(),
    );
    readCurrentStandingsWithRun.mockResolvedValue({ standings: { drivers, constructors }, runId: 'run-1' });
    const f1 = await readSource(latest);
    expect(readCurrentStandingsWithRun).toHaveBeenCalledWith('f1', 2026);
    expect(f1.rows.map(r => [r.kind, r.name, r.seriesName, r.winner, r.final])).toEqual([
      ['driver', 'Kimi Antonelli', 'Formula 1', true, false],
      ['driver', 'George Russell', 'Formula 1', false, false],
      ['constructor', 'Mercedes', 'Formula 1', false, false],
    ]);
    expect(f1.rows[0].colour).toBe('#e10600');
    expect(f1.provenance).toMatchObject({ tier: 'rows', keys: ['standings:f1', 'f1:standings'], run: { id: 'run-1' } });
    // No race finished anywhere: no rows.
    loadSnapshotSource.mockImplementation(async () => ({ ...snapshotAnswer(), races: [], extras: [] }));
    fetchWecSeasonResults.mockResolvedValue([]);
    expect((await readSource(latest)).rows).toEqual([]);
  });

  it('every one of the fourteen answers rows that carry each declared column, dates as ISO strings; the results source does so for each of its fourteen series', async () => {
    readCurrentStandingsWithRun.mockResolvedValue({ standings: { drivers, constructors }, runId: null });
    const results = SOURCES.find(s => s.key === 'results')!;
    const refs = [...SOURCES.map(s => defaultSourceRef(s)), ...results.parameters[0].options!.map(o => ({ source: 'results', params: { series: o.key, season: 2026 } }))];
    for (const ref of refs) {
      const s = SOURCES.find(x => x.key === ref.source)!;
      const who = `${s.key}${ref.params.series ? ` · ${ref.params.series}` : ''}`;
      const read = await readSource(ref);
      expect(read.provenance.error, who).toBeUndefined();
      expect(read.rows.length, who).toBeGreaterThan(0);
      for (const c of s.columns) expect(Object.keys(read.rows[0]), `${who}.${c.key}`).toContain(c.key);
      for (const c of s.columns) {
        const v = read.rows[0][c.key];
        expect(['string', 'number', 'boolean'].includes(typeof v) || v === null, `${who}.${c.key} = ${String(v)}`).toBe(true);
        if (c.type === 'date' && v !== null) expect(String(v), `${who}.${c.key}`).toMatch(/^\d{4}-\d{2}-\d{2}/);
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
    expect(posts.rows[0]).toMatchObject({ title: 'Post c', series: 'f2', author: 'Paris', published: '2026-09-08T10:00:00Z', link: '/blog/c', hero: null, seriesName: 'Formula 2', colour: '#e10600', minutes: 1 });
    const news = await readSource({ source: 'news', params: { per: 3 } });
    expect(fetchAggregatedNews).toHaveBeenCalledWith(3);
    expect(news.rows[0]).toMatchObject({ title: 'Headline', link: 'https://example.com/news/1', source: 'example.com', published: '2026-09-17T08:00:00.000Z', series: 'f1', seriesName: 'Formula 1', colour: '#e10600' });
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
