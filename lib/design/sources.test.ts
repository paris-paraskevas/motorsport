import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CURRENT_SEASON, HOME_RESULTS_SERIES, REMOTE_SERVERS, SERIES_OPTIONS, SOURCES, TREND_SERIES, defaultSourceRef, describeLoaderKey, encodeSourceRef, findSource, parseSourceRef, sourceLabel } from './sources';
import { HOME_RESULTS_SLUGS } from '@/lib/home-results';
import { HEALTH_SEASON } from '@/lib/standings-health';
import { RESULTS_HEALTH_SEASON } from '@/lib/results-health';
import { SESSIONS_HEALTH_SEASON } from '@/lib/sessions-health';
import { MAX_PER_SERIES_AGGREGATE } from '@/lib/news';

// The source catalogue (the components programme, P2.1; APEX: REST Data
// Sources, Data Profile, Remote Servers): the thirteen the changes line of
// 2026-09-17 names and Weekends (P2.24 B1), each a name, parameters, columns
// and a reader; a ref is one string a region carries; the loader's keys read
// back in the catalogue's words.

const EIGHTEEN = ['series', 'season', 'standings', 'results', 'rounds', 'sessions', 'drivers', 'teams', 'posts', 'news', 'authors', 'releases', 'tracks', 'weekends', 'session-results', 'trend', 'guides', 'champions'];
const PARAMETER_KINDS = ['series', 'season', 'number', 'choice', 'text'];
const COLUMN_TYPES = ['text', 'number', 'date', 'boolean', 'link', 'image', 'colour'];
/** P2.24 B2: the two Series values the readers resolve rather than read (Home's series, the Latest result), each on its source alone. */
const SPECIAL: Readonly<Record<string, readonly string[]>> = { results: ['home'], standings: ['latest'] };

describe('the source catalogue', () => {
  it('holds the eighteen in the changes line’s order (Weekends the fourteenth, P2.24 B1; Session results the fifteenth, P2.25; Season trend the sixteenth, P2.11; Circuit guides the seventeenth, P2.12; Champions the eighteenth, R18), each well formed: parameters of a known kind with usable defaults, unique columns, a tier and a loading method', () => {
    expect(SOURCES.map(s => s.key)).toEqual(EIGHTEEN);
    const contentSlugs = readdirSync(path.join(process.cwd(), 'content', 'series'), { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort();
    expect(SERIES_OPTIONS.map(o => o.key).sort()).toEqual(contentSlugs);
    for (const s of SOURCES) {
      expect(s.name.length, s.key).toBeGreaterThan(0);
      expect(s.holds.length, s.key).toBeGreaterThan(0);
      expect(['loader', 'content', 'db', 'live'], s.key).toContain(s.fresh);
      expect(['append', 'merge', 'replace', 'none'], s.key).toContain(s.load);
      expect(s.pagination, s.key).toBe('none');
      expect(s.reads.length, s.key).toBeGreaterThan(0);
      const columnKeys = s.columns.map(c => c.key);
      expect(new Set(columnKeys).size, s.key).toBe(columnKeys.length);
      for (const c of s.columns) expect(COLUMN_TYPES, `${s.key}.${c.key}`).toContain(c.type);
      const parameterKeys = s.parameters.map(p => p.key);
      expect(new Set(parameterKeys).size, s.key).toBe(parameterKeys.length);
      for (const p of s.parameters) {
        expect(PARAMETER_KINDS, `${s.key}.${p.key}`).toContain(p.kind);
        if (p.required) expect(p.default, `${s.key}.${p.key} needs a default`).toBeDefined();
        // Every series option is a content slug, save the two declared values the readers resolve (P2.24 B2), which only their source offers.
        if (p.kind === 'series') for (const o of p.options ?? []) if (!(SPECIAL[s.key] ?? []).includes(o.key)) expect(contentSlugs, `${s.key}.${p.key}: ${o.key}`).toContain(o.key);
        if (p.kind === 'series') for (const k of ['home', 'latest']) expect((p.options ?? []).some(o => o.key === k), `${s.key}.${p.key}: ${k}`).toBe((SPECIAL[s.key] ?? []).includes(k));
      }
      // The defaults the picker writes pass the source's own rule.
      expect(parseSourceRef(encodeSourceRef(defaultSourceRef(s))).problems, s.key).toEqual([]);
      for (const host of Object.values(s.hosts ?? {})) expect(REMOTE_SERVERS.map(r => r.key), `${s.key}: ${host}`).toContain(host);
    }
    expect(findSource('standings')?.parameters.map(p => p.key)).toEqual(['series', 'season']);
    expect(findSource('nope')).toBeNull();
  });

  it('the season the loader warms is the one the health modules check', () => {
    expect(CURRENT_SEASON).toBe(HEALTH_SEASON);
    expect(CURRENT_SEASON).toBe(RESULTS_HEALTH_SEASON);
    expect(CURRENT_SEASON).toBe(SESSIONS_HEALTH_SEASON);
  });

  it('every pick names a snapshot the pages keep warm: the news source offers the home wire’s cap and the News page’s ten, nothing else (the reviewer’s finding)', () => {
    const per = findSource('news')!.parameters[0];
    expect(per.key).toBe('per');
    expect(per.default).toBe(MAX_PER_SERIES_AGGREGATE);
    // The News page (app/(app)/news/page.tsx) asks the aggregate for ten per series; the page's constant is its own, so the number is held here.
    expect(per.options?.map(o => o.key)).toEqual([String(MAX_PER_SERIES_AGGREGATE), '10']);
    expect(parseSourceRef('news?per=10')).toEqual({ value: { source: 'news', params: { per: 10 } }, problems: [] });
    expect(parseSourceRef('news?per=5').problems).toEqual(['Per series must be 3 (the home wire) or 10 (the News page)']);
    expect(parseSourceRef('news').value).toEqual({ source: 'news', params: {} });
    // A parameter named twice is refused, never the first value kept.
    expect(parseSourceRef('standings?series=f1&series=wec&season=2026').problems).toEqual(['Standings names series twice']);
  });

  it('encodes a ref canonically (the source, then its parameters in the declared order) and parses it back, numbers as numbers; empty is none', () => {
    const ref = { source: 'standings', params: { series: 'f1', season: 2026 } };
    expect(encodeSourceRef(ref)).toBe('standings?series=f1&season=2026');
    expect(parseSourceRef('standings?series=f1&season=2026')).toEqual({ value: ref, problems: [] });
    expect(encodeSourceRef(parseSourceRef('standings?season=2026&series=f1').value!)).toBe('standings?series=f1&season=2026');
    expect(parseSourceRef('')).toEqual({ value: null, problems: [] });
    expect(parseSourceRef('authors')).toEqual({ value: { source: 'authors', params: {} }, problems: [] });
    expect(encodeSourceRef({ source: 'authors', params: {} })).toBe('authors');
    expect(parseSourceRef('posts?count=3').value).toEqual({ source: 'posts', params: { count: 3 } });
  });

  it('refuses in words: not text, an unknown source, one not allowed, a missing or unknown parameter, a series the source does not offer, a season the loader does not keep, a number out of range', () => {
    expect(parseSourceRef(42)).toEqual({ value: null, problems: ['Source must be text'] });
    expect(parseSourceRef('foo?x=1').problems).toEqual(['Source must name a source from the catalogue']);
    expect(parseSourceRef('posts?count=3', ['standings']).problems).toEqual(['Source must be one of Standings']);
    expect(parseSourceRef('posts?count=3', ['standings', 'results']).problems).toEqual(['Source must be one of Standings, Results']);
    expect(parseSourceRef('standings?season=2026').problems).toEqual(['Standings needs a series']);
    expect(parseSourceRef('standings?series=f1').problems).toEqual(['Standings needs a season']);
    expect(parseSourceRef('standings?series=nope&season=2026').problems).toEqual(['Series must be one of the series Standings offers']);
    expect(parseSourceRef('standings?series=f1&season=2025').problems).toEqual(['Season must be 2026 (the season the loader keeps)']);
    expect(parseSourceRef('standings?series=f1&season=2026&foo=1').problems).toEqual(['Standings has no parameter called foo']);
    expect(parseSourceRef('posts?count=99').problems).toEqual(['Count must be a number from 1 to 50']);
    expect(parseSourceRef('posts?count=many').problems).toEqual(['Count must be a number from 1 to 50']);
    // A refused ref has no value: the writer refuses, nothing is guessed.
    expect(parseSourceRef('standings?season=2026').value).toBeNull();
  });

  it('P2.24 B1: the Weekends source, the fourteenth: the coming weekends across every series or one, the nearest first, read live from the feeds; a Count; the columns Home’s What’s next draws from; a ref with or without a series parses and reads back in words', () => {
    const weekends = findSource('weekends')!;
    expect(weekends).toMatchObject({ name: 'Weekends', fresh: 'live', load: 'none', pagination: 'none', reads: ['content:series', 'live:ics'] });
    expect(weekends.parameters.map(p => [p.key, p.kind, p.required, p.default])).toEqual([
      ['series', 'series', false, undefined],
      ['count', 'number', undefined, 10],
    ]);
    expect(weekends.columns.map(c => [c.key, c.label, c.type])).toEqual([
      ['series', 'Series slug', 'text'],
      ['seriesName', 'Series', 'text'],
      ['colour', 'Series colour', 'colour'],
      ['round', 'Round', 'number'],
      ['title', 'Title', 'text'],
      ['start', 'First session', 'date'],
      ['end', 'Last session', 'date'],
      ['dates', 'Dates', 'text'],
      ['weekend', 'Weekend page', 'link'],
    ]);
    expect(parseSourceRef('weekends?count=3')).toEqual({ value: { source: 'weekends', params: { count: 3 } }, problems: [] });
    expect(parseSourceRef('weekends?series=f1&count=3').value).toEqual({ source: 'weekends', params: { series: 'f1', count: 3 } });
    expect(parseSourceRef('weekends?count=0').problems).toEqual(['Count must be a number from 1 to 50']);
    expect(sourceLabel({ source: 'weekends', params: { count: 3 } })).toBe('Weekends · Count 3');
    expect(sourceLabel({ source: 'weekends', params: { series: 'f1', count: 3 } })).toBe('Weekends · Formula 1 · Count 3');
    expect(defaultSourceRef(weekends)).toEqual({ source: 'weekends', params: { count: 10 } });
  });

  it('P2.24 B2: the Series values the readers resolve: Results offers “Home’s series” (key home) first and Standings “Latest result” (key latest) first, each parsing on its source alone and reading back by its label; the loader keys behind Home’s series are the six series’ own, none behind Latest result until it is read; Home’s set is Home’s; both sources carry the series’ facts as columns', () => {
    const results = findSource('results')!;
    const standings = findSource('standings')!;
    expect(results.parameters[0].options![0]).toEqual({ key: 'home', label: "Home's series" });
    expect(standings.parameters[0].options![0]).toEqual({ key: 'latest', label: 'Latest result' });
    expect(HOME_RESULTS_SERIES).toEqual(HOME_RESULTS_SLUGS);
    expect(parseSourceRef('results?series=home&season=2026')).toEqual({ value: { source: 'results', params: { series: 'home', season: 2026 } }, problems: [] });
    expect(parseSourceRef('standings?series=latest&season=2026')).toEqual({ value: { source: 'standings', params: { series: 'latest', season: 2026 } }, problems: [] });
    expect(parseSourceRef('results?series=latest&season=2026').problems).toEqual(['Series must be one of the series Results offers']);
    expect(parseSourceRef('standings?series=home&season=2026').problems).toEqual(['Series must be one of the series Standings offers']);
    for (const ref of ['rounds?series=home', 'sessions?series=latest', 'weekends?series=home&count=3', 'posts?series=latest&count=3', 'season?series=home']) expect(parseSourceRef(ref).value, ref).toBeNull();
    expect(sourceLabel({ source: 'results', params: { series: 'home', season: 2026 } })).toBe("Results · Home's series · 2026");
    expect(sourceLabel({ source: 'standings', params: { series: 'latest', season: 2026 } }, [{ slug: 'f1', name: 'Formula One' }])).toBe('Standings · Latest result · 2026');
    // The picker's default stays the first championship, never the special value.
    expect(defaultSourceRef(results)).toEqual({ source: 'results', params: { series: 'f1', season: 2026 } });
    expect(results.loaderKeys!({ series: 'home', season: 2026 })).toEqual(['f1:results', 'f1:sprints', 'f1:last-race', 'results:f3', 'results:formula-e', 'results:indycar', 'results:motogp', 'results:wec']);
    expect(standings.loaderKeys!({ series: 'latest', season: 2026 })).toEqual([]);
    expect(results.columns.slice(-4).map(c => [c.key, c.label, c.type])).toEqual([
      ['seriesName', 'Series', 'text'],
      ['colour', 'Series colour', 'colour'],
      ['final', 'Season complete', 'boolean'],
      ['champion', 'Champion', 'text'],
    ]);
    expect(standings.columns.slice(-4).map(c => [c.key, c.label, c.type])).toEqual([
      ['seriesName', 'Series', 'text'],
      ['colour', 'Series colour', 'colour'],
      ['winner', 'Race winner', 'boolean'],
      ['final', 'Season complete', 'boolean'],
    ]);
  });

  it('labels a ref in the catalogue’s words, the series by name from the list given or the catalogue’s', () => {
    const ref = { source: 'standings', params: { series: 'f1', season: 2026 } };
    expect(sourceLabel(ref)).toBe('Standings · Formula 1 · 2026');
    expect(sourceLabel(ref, [{ slug: 'f1', name: 'Formula One' }])).toBe('Standings · Formula One · 2026');
    expect(sourceLabel({ source: 'news', params: { per: 5 } })).toBe('News · Per series 5');
    expect(sourceLabel({ source: 'authors', params: {} })).toBe('Authors');
    expect(sourceLabel({ source: 'nope', params: {} })).toBe('nope');
  });

  it('reads the loader’s keys in the new vocabulary: standings and results per series, the F1 slots, the news aggregate; an unknown key is nothing', () => {
    expect(describeLoaderKey('standings:f1')).toEqual({ ref: { source: 'standings', params: { series: 'f1', season: 2026 } }, label: 'Standings · Formula 1 · 2026' });
    expect(describeLoaderKey('standings:gt-world')?.label).toBe('Standings · GT World Challenge · 2026');
    expect(describeLoaderKey('standings:gt-world:2026')).toEqual({ ref: { source: 'standings', params: { series: 'gt-world', season: 2026 } }, label: 'Standings · GT World Challenge · 2026' });
    expect(describeLoaderKey('results:wrc')).toEqual({ ref: { source: 'results', params: { series: 'wrc', season: 2026 } }, label: 'Results · WRC · 2026' });
    expect(describeLoaderKey('results:wrc-chart')?.label).toBe('Results · WRC · 2026 · chart');
    expect(describeLoaderKey('results:imsa')?.label).toBe('Results · IMSA · 2026');
    expect(describeLoaderKey('f1:standings')?.label).toBe('Standings · Formula 1 · 2026');
    expect(describeLoaderKey('f1:results')?.label).toBe('Results · Formula 1 · 2026');
    expect(describeLoaderKey('f1:sprints')?.label).toBe('Results · Formula 1 · 2026 · sprints');
    expect(describeLoaderKey('f1:last-race')?.label).toBe('Results · Formula 1 · 2026 · last race');
    expect(describeLoaderKey('news:aggregate:5')).toEqual({ ref: { source: 'news', params: { per: 5 } }, label: 'News · Per series 5' });
    expect(describeLoaderKey('paddock:home:podium:v2:f1:2026')).toBeNull();
    expect(describeLoaderKey('nope')).toBeNull();
    expect(describeLoaderKey('standings:')).toBeNull();
  });

  it('names the loader keys behind a pick, and the remote server per series', () => {
    const standings = findSource('standings')!;
    expect(standings.loaderKeys!({ series: 'f1', season: 2026 })).toEqual(['standings:f1', 'f1:standings']);
    expect(standings.loaderKeys!({ series: 'wec', season: 2026 })).toEqual(['standings:wec']);
    // GT World's snapshot is season-scoped (lib/standings/gt-world.ts), the one such key (P2.2; the plan critic's point).
    expect(standings.loaderKeys!({ series: 'gt-world', season: 2026 })).toEqual(['standings:gt-world:2026']);
    expect(standings.hosts?.f1).toBe('jolpica');
    const results = findSource('results')!;
    expect(results.loaderKeys!({ series: 'f1', season: 2026 })).toEqual(['f1:results', 'f1:sprints', 'f1:last-race']);
    expect(results.loaderKeys!({ series: 'wrc', season: 2026 })).toEqual(['results:wrc', 'results:wrc-chart']);
    expect(results.loaderKeys!({ series: 'gt-world', season: 2026 })).toEqual(['results:gt-world']);
    // P2.2 B1: the results source reads fourteen series (NLS, IMSA, WEC and GT World joined), each with its remote server, over twenty columns.
    const resultsSeries = results.parameters[0].options!.map(o => o.key);
    // P2.24 B2: Home's series first, resolved server-side (no remote server behind it), then the fourteen.
    expect(resultsSeries).toEqual(['home', 'f1', 'f2', 'f3', 'formula-e', 'indycar', 'motogp', 'wsbk', 'nascar-cup', 'wrc', 'dtm', 'nls', 'imsa', 'wec', 'gt-world']);
    for (const slug of resultsSeries.filter(s => s !== 'home')) expect(results.hosts?.[slug], slug).toBeDefined();
    expect(results.hosts).toMatchObject({ nls: 'vln', imsa: 'alkamel', wec: 'fiawec', 'gt-world': 'gt-world-challenge' });
    expect(results.columns.map(c => c.key)).toEqual(['round', 'race', 'raceId', 'date', 'circuit', 'class', 'session', 'position', 'driver', 'code', 'car', 'team', 'vehicle', 'manufacturer', 'laps', 'status', 'time', 'gap', 'points', 'weekend', 'profile', 'seriesName', 'colour', 'final', 'champion']);
    expect(results.columns.find(c => c.key === 'weekend')?.type).toBe('link');
    // P2.4 PR B: a driver's or a team's page beside the race's, from the site's own rosters, which both sources now read.
    const standingsSource = SOURCES.find(s => s.key === 'standings')!;
    for (const s of [results, standingsSource]) {
      expect(s.columns.find(c => c.key === 'profile'), s.key).toMatchObject({ label: 'Page', type: 'link' });
      expect(s.reads, s.key).toContain('content:series');
    }
    expect(standingsSource.columns.map(c => c.key)).toEqual(['kind', 'position', 'name', 'code', 'team', 'points', 'wins', 'class', 'profile', 'seriesName', 'colour', 'winner', 'final']);
    // P2.24 A: the posts and news sources carry what Home's pieces derived (the series' name and colour, the read time), so the Data
    // region's templates are functions of their rows; the slug column is named as such.
    expect(findSource('posts')!.columns.map(c => [c.key, c.label, c.type])).toEqual([
      ['slug', 'Slug', 'text'],
      ['title', 'Title', 'text'],
      ['summary', 'Summary', 'text'],
      ['series', 'Series slug', 'text'],
      ['author', 'Author', 'text'],
      ['published', 'Published', 'date'],
      ['hero', 'Cover', 'image'],
      ['link', 'Link', 'link'],
      ['seriesName', 'Series', 'text'],
      ['colour', 'Series colour', 'colour'],
      ['minutes', 'Read time', 'number'],
    ]);
    expect(findSource('news')!.columns.map(c => [c.key, c.label, c.type])).toEqual([
      ['title', 'Title', 'text'],
      ['link', 'Link', 'link'],
      ['source', 'Source', 'text'],
      ['published', 'Published', 'date'],
      ['series', 'Series slug', 'text'],
      ['seriesName', 'Series', 'text'],
      ['colour', 'Series colour', 'colour'],
    ]);
    expect(findSource('news')!.loaderKeys!({ per: 5 })).toEqual(['news:aggregate:5']);
    expect(findSource('authors')!.loaderKeys).toBeUndefined();
    for (const r of REMOTE_SERVERS) expect(r.baseUrl).toMatch(/^https:\/\/[a-z0-9.-]+$/);
  });

  it('imports nothing at runtime: the catalogue reaches every route’s chunk through the parser, so it stays declarations (the plan critic’s point)', () => {
    const text = readFileSync(path.join(process.cwd(), 'lib', 'design', 'sources.ts'), 'utf8');
    const imports = text.split(/\r?\n/).filter(l => /^import\b/.test(l));
    for (const line of imports) expect(line, line).toMatch(/^import type\b/);
    expect(text).not.toMatch(/\brequire\(/);
  });
});

describe('the Season trend source (P2.11)', () => {
  it('is the sixteenth: the eight series with canonical points (f1 the default) and the season; the trend’s columns; the loader’s results keys and hosts; a series it does not offer is refused', () => {
    const trend = findSource('trend')!;
    expect(trend).toMatchObject({ name: 'Season trend', fresh: 'loader', load: 'replace', pagination: 'none', reads: ['snapshot:results:', 'snapshot:f1:', 'content:series'] });
    expect(trend.holds).toMatch(/^the season trend the standings tab draws/);
    expect(trend.parameters.map(p => [p.key, p.kind, p.required, p.default])).toEqual([
      ['series', 'series', true, 'f1'],
      ['season', 'season', true, 2026],
    ]);
    expect(trend.parameters[0].options?.map(o => o.key)).toEqual(TREND_SERIES);
    expect(TREND_SERIES).toEqual(['f1', 'f2', 'f3', 'motogp', 'wsbk', 'nascar-cup', 'wrc', 'dtm']);
    expect(trend.columns.map(c => [c.key, c.type])).toEqual([
      ['kind', 'text'],
      ['round', 'number'],
      ['race', 'text'],
      ['name', 'text'],
      ['code', 'text'],
      ['team', 'text'],
      ['points', 'number'],
      ['gained', 'number'],
      ['total', 'number'],
      ['profile', 'link'],
      ['seriesName', 'text'],
      ['colour', 'colour'],
    ]);
    expect(trend.loaderKeys?.({ series: 'f1', season: 2026 })).toEqual(['f1:results', 'f1:sprints', 'f1:last-race']);
    expect(trend.loaderKeys?.({ series: 'wrc', season: 2026 })).toEqual(['results:wrc', 'results:wrc-chart']);
    expect(trend.hosts).toEqual({ f1: 'jolpica', f2: 'fom', f3: 'fom', motogp: 'pulselive-motogp', wsbk: 'pulselive-wsbk', 'nascar-cup': 'wikipedia', wrc: 'wikipedia', dtm: 'motorsport-com' });
    expect(sourceLabel({ source: 'trend', params: { series: 'f1', season: 2026 } })).toBe('Season trend · Formula 1 · 2026');
    expect(parseSourceRef('trend?series=f1&season=2026').value).toEqual({ source: 'trend', params: { series: 'f1', season: 2026 } });
    // Formula E's and IndyCar's feeds derive their points: the trend never offers them (the CHANGELOG's invariant).
    expect(parseSourceRef('trend?series=formula-e&season=2026')).toEqual({ value: null, problems: ['Series must be one of the series Season trend offers'] });
  });
});

describe('the Circuit guides source (P2.12)', () => {
  it('is the seventeenth: the information hub’s circuit guides with a place on the map, no parameters, deployed with the site', () => {
    const guides = findSource('guides')!;
    expect(guides).toMatchObject({ name: 'Circuit guides', fresh: 'content', load: 'none', pagination: 'none', reads: ['content:information'], parameters: [] });
    expect(guides.holds).toMatch(/^the information hub’s circuit guides/);
    expect(guides.columns.map(c => [c.key, c.type])).toEqual([
      ['slug', 'text'],
      ['name', 'text'],
      ['country', 'text'],
      ['countryCode', 'text'],
      ['category', 'text'],
      ['categories', 'text'],
      ['lat', 'number'],
      ['lon', 'number'],
      ['page', 'link'],
      ['colour', 'colour'],
    ]);
    expect(sourceLabel({ source: 'guides', params: {} })).toBe('Circuit guides');
    expect(parseSourceRef('guides').value).toEqual({ source: 'guides', params: {} });
    expect(parseSourceRef('guides?series=f1').problems).toEqual(['Circuit guides has no parameter called series']);
  });
});

describe('the Champions source (R18)', () => {
  it('is the eighteenth: a series’ curated roll of honour and its title tallies, every series, deployed with the site; the season rows’ columns, the tally rows’ columns, the derived ones', () => {
    const champions = findSource('champions')!;
    expect(champions).toMatchObject({ name: 'Champions', fresh: 'content', load: 'none', pagination: 'none', reads: ['content:series'] });
    expect(champions.holds).toMatch(/^a series’ roll of honour/);
    expect(champions.parameters.map(p => [p.key, p.kind, p.required ?? false, p.default])).toEqual([['series', 'series', true, 'f1']]);
    expect(champions.parameters[0].options!.map(o => o.key)).toEqual(SERIES_OPTIONS.map(o => o.key));
    expect(champions.columns.map(c => [c.key, c.type])).toEqual([
      ['kind', 'text'],
      ['year', 'number'],
      ['driver', 'text'],
      ['profile', 'link'],
      ['nationality', 'text'],
      ['team', 'text'],
      ['teamPage', 'link'],
      ['points', 'number'],
      ['wins', 'number'],
      ['podiums', 'number'],
      ['margin', 'number'],
      ['runnerUp', 'text'],
      ['runnerUpTeam', 'text'],
      ['runnerUpPoints', 'number'],
      ['teamsChampion', 'text'],
      ['teamsChampionPage', 'link'],
      ['teamsTitles', 'number'],
      ['teamsRun', 'number'],
      ['driverTitles', 'number'],
      ['era', 'text'],
      ['decade', 'text'],
      ['rookie', 'boolean'],
      ['name', 'text'],
      ['titles', 'number'],
      ['page', 'link'],
      ['seriesName', 'text'],
      ['colour', 'colour'],
    ]);
    expect(parseSourceRef('champions?series=f2').problems).toEqual([]);
    expect(parseSourceRef('champions').problems).toEqual(['Champions needs a series']);
  });
});
