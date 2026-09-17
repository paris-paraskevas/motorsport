import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CURRENT_SEASON, REMOTE_SERVERS, SERIES_OPTIONS, SOURCES, defaultSourceRef, describeLoaderKey, encodeSourceRef, findSource, parseSourceRef, sourceLabel } from './sources';
import { HEALTH_SEASON } from '@/lib/standings-health';
import { RESULTS_HEALTH_SEASON } from '@/lib/results-health';
import { SESSIONS_HEALTH_SEASON } from '@/lib/sessions-health';

// The source catalogue (the components programme, P2.1; APEX: REST Data
// Sources, Data Profile, Remote Servers): the thirteen the changes line of
// 2026-09-17 names, each a name, parameters, columns and a reader; a ref is one
// string a region carries; the loader's keys read back in the catalogue's words.

const THIRTEEN = ['series', 'season', 'standings', 'results', 'rounds', 'sessions', 'drivers', 'teams', 'posts', 'news', 'authors', 'releases', 'tracks'];
const PARAMETER_KINDS = ['series', 'season', 'number', 'choice', 'text'];
const COLUMN_TYPES = ['text', 'number', 'date', 'boolean', 'link', 'image', 'colour'];

describe('the source catalogue', () => {
  it('holds the thirteen in the changes line’s order, each well formed: parameters of a known kind with usable defaults, unique columns, a tier and a loading method', () => {
    expect(SOURCES.map(s => s.key)).toEqual(THIRTEEN);
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
        if (p.kind === 'series') for (const o of p.options ?? []) expect(contentSlugs, `${s.key}.${p.key}: ${o.key}`).toContain(o.key);
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
    expect(describeLoaderKey('results:wrc')).toEqual({ ref: { source: 'results', params: { series: 'wrc', season: 2026 } }, label: 'Results · WRC · 2026' });
    expect(describeLoaderKey('results:wrc-chart')?.label).toBe('Results · WRC · 2026 · chart');
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
    expect(standings.hosts?.f1).toBe('jolpica');
    const results = findSource('results')!;
    expect(results.loaderKeys!({ series: 'f1', season: 2026 })).toEqual(['f1:results', 'f1:sprints', 'f1:last-race']);
    expect(results.loaderKeys!({ series: 'wrc', season: 2026 })).toEqual(['results:wrc', 'results:wrc-chart']);
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
