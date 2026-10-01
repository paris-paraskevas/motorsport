import { describe, it, expect, beforeAll } from 'vitest';
import { generateInfoEntries, noteLead, driversOf } from './generated';
import {
  getAllInfoEntries,
  getInfoEntry,
  getIndexedInfoEntries,
  getSearchableInfoEntries,
  isTopicIndexable,
  isEntryIndexed,
  getInfoStats,
  INFORMATION_MAX_INDEXED,
  __resetInfoRegistry,
} from './registry';
import { INFO_TOPICS, topicForSeries, isTopicId, aboutGuideForSeries } from './topics';
import { entryKey } from './types';
import { loadAllSeriesMeta } from '../series';

beforeAll(() => __resetInfoRegistry());

describe('generateInfoEntries (champions-derived, verified)', () => {
  it('produces hundreds of verified entries from curated data', async () => {
    const g = await generateInfoEntries();
    expect(g.length).toBeGreaterThan(200);
    expect(g.every((e) => e.review === 'verified')).toBe(true);
  });

  it('every generated entry has a complete, well-formed shape', async () => {
    const g = await generateInfoEntries();
    for (const e of g) {
      expect(e.slug).toMatch(/^[a-z0-9-]+$/);
      expect(e.question.length).toBeGreaterThan(0);
      expect(e.summary.length).toBeGreaterThan(0);
      expect(e.bodyMarkdown.length).toBeGreaterThan(0);
      expect(e.keywords.length).toBeGreaterThan(0);
      expect(e.sources.length).toBeGreaterThan(0); // never sourceless
      expect(isTopicId(e.topic)).toBe(true);
    }
  });

  it('answers the current F1 champion straight from curated data', async () => {
    const g = await generateInfoEntries();
    const e = g.find(
      (x) => x.topic === 'formula-1' && x.slug === 'who-won-the-2025-formula-1-championship',
    );
    expect(e).toBeDefined();
    expect(e!.summary).toContain('Lando Norris');
    expect(e!.featured).toBe(true); // most-recent champion is featured (indexable)
  });

  it('labels the GP2 predecessor era of Formula 2 correctly (no anachronism)', async () => {
    const g = await generateInfoEntries();
    // A pre-2017 F2-series row must be branded GP2, not "Formula 2".
    const gp2 = g.find((x) => x.slug === 'who-won-the-2010-gp2-series-championship');
    expect(gp2).toBeDefined();
    expect(g.some((x) => x.slug === 'who-won-the-2010-formula-2-championship')).toBe(false);
  });

  // R18: the Formula 2 rows carry points now, so the generated answers clinch the title on them, in both eras.
  it('clinches a Formula 2 title on the curated points, in the F2 era and the GP2 era', async () => {
    const g = await generateInfoEntries();
    const f2 = g.find((x) => x.slug === 'who-won-the-2025-formula-2-championship');
    expect(f2?.bodyMarkdown).toContain('clinching the title on **211** points');
    const gp2 = g.find((x) => x.slug === 'who-won-the-2010-gp2-series-championship');
    expect(gp2?.bodyMarkdown).toContain('clinching the title on **87** points');
  });

  it('generates per-series record pages', async () => {
    const g = await generateInfoEntries();
    expect(g.some((e) => e.slug === 'most-formula-1-championships')).toBe(true);
  });
});

// The endurance families put a whole crew in one `driver` string, and counting
// titles by that string treats a crew as a person. That published a false claim
// on every WEC page: the 2019 answer said it was Buemi/Alonso/Nakajima's FIRST
// title when Buemi had won in 2014 with a different crew, and the all-time record
// said 2 titles shared between two crews when Buemi and Hartley had four each.
describe('crew title counting', () => {
  it('splits crews on commas and slashes, and leaves solo names alone', () => {
    expect(driversOf('James Calado, Antonio Giovinazzi, Alessandro Pier Guidi')).toEqual([
      'James Calado',
      'Antonio Giovinazzi',
      'Alessandro Pier Guidi',
    ]);
    expect(driversOf('Nick Wüstenhagen / Ranko Mijatovic')).toEqual([
      'Nick Wüstenhagen',
      'Ranko Mijatovic',
    ]);
    expect(driversOf('Kenny Roberts Jr.')).toEqual(['Kenny Roberts Jr.']);
  });

  it('never claims a first title for a driver who already had one', async () => {
    const g = await generateInfoEntries();
    const e = g.find((x) => x.slug === 'who-won-the-2019-fia-wec-championship');
    expect(e).toBeDefined();
    // The firsts clause names exactly the two who had never won, and stops there.
    expect(e!.bodyMarkdown).toContain(
      'a first FIA WEC title for **Fernando Alonso** and **Kazuki Nakajima**,',
    );
    // Buemi's 2014 title with Anthony Davidson has to be counted, not erased.
    expect(e!.bodyMarkdown).toMatch(/\*\*Sébastien Buemi\*\*’s 2nd of 4 \(2014, 2019, 2022, 2023\)/);
  });

  it('states the all-time record per person, not per crew', async () => {
    const g = await generateInfoEntries();
    const e = g.find((x) => x.slug === 'who-won-the-2019-fia-wec-championship');
    expect(e!.bodyMarkdown).toContain('record is **4** titles');
    expect(e!.bodyMarkdown).toContain('Brendon Hartley and Sébastien Buemi');
  });

  it('reads without a stuttered "and" when a crew mixes firsts and repeats', async () => {
    const g = await generateInfoEntries();
    const e = g.find((x) => x.slug === 'who-won-the-2019-fia-wec-championship');
    expect(e!.bodyMarkdown).not.toMatch(/\*\* and \*\*[^*]+\*\*’s \d/);
  });

  it('leaves a single-driver family untouched', async () => {
    const g = await generateInfoEntries();
    const f1 = g.find((x) => x.slug === 'who-won-the-2025-formula-1-championship');
    // 166 authored notes were written to sit under this exact sentence.
    expect(f1!.bodyMarkdown).toContain('It was **Lando Norris**’s first Formula 1 title.');
  });
});

describe('noteLead', () => {
  const base = { note: 'body', sources: ['https://example.com/a'] };

  it('labels a sourced clinch as the title being clinched', () => {
    expect(noteLead({ ...base, clinched: 'Monza, 9 September 2006' })).toEqual({
      label: 'Title clinched',
      text: 'Monza, 9 September 2006',
    });
  });

  it('labels an unrecorded deciding round as the season', () => {
    expect(noteLead({ ...base, season: 'Eight rounds in 1980' })).toEqual({
      label: 'The season',
      text: 'Eight rounds in 1980',
    });
  });

  it('labels a single-race family as the race', () => {
    expect(noteLead({ ...base, race: 'Won by 1m 12s in 2026' })).toEqual({
      label: 'The race',
      text: 'Won by 1m 12s in 2026',
    });
  });

  it('prefers the clinch when more than one is set, and never throws on none', () => {
    // The integrity gate rejects both of these states; this pins the fallback so
    // a bad note degrades to a page without a lead line rather than to a crash.
    expect(noteLead({ ...base, clinched: 'Monza 2006', season: 'ignored' })?.label).toBe(
      'Title clinched',
    );
    expect(noteLead({ ...base })).toBeNull();
    expect(noteLead({ ...base, clinched: '   ' })).toBeNull();
  });
});

describe('topic mapping', () => {
  it('routes each series to a sensible topic', () => {
    expect(topicForSeries('f1', 'formula')).toBe('formula-1');
    expect(topicForSeries('f2', 'formula')).toBe('feeder-series');
    expect(topicForSeries('motogp', 'motorcycle')).toBe('motogp');
    expect(topicForSeries('wec', 'endurance')).toBe('endurance');
    expect(topicForSeries('wrc', 'rally')).toBe('rally');
    expect(topicForSeries('nascar-cup', 'stock')).toBe('stock-cars');
  });
  it('falls back by category for an unknown series', () => {
    expect(topicForSeries('some-new-gt-series', 'gt')).toBe('endurance');
    expect(topicForSeries('totally-unknown')).toBe('general');
  });
});

describe('aboutGuideForSeries — About-tab → /information redirect map', () => {
  it('maps sample series to their what-is guide path', () => {
    expect(aboutGuideForSeries('f1')).toBe('/information/formula-1/what-is-formula-1');
    expect(aboutGuideForSeries('wec')).toBe('/information/endurance/what-is-the-wec');
    expect(aboutGuideForSeries('nascar-cup')).toBe(
      '/information/stock-cars/what-is-the-nascar-cup-series',
    );
    expect(aboutGuideForSeries('adac-ravenol-24h')).toBe(
      '/information/endurance/what-is-the-nurburgring-24-hours',
    );
  });

  it('returns null for a series with no guide', () => {
    expect(aboutGuideForSeries('totally-unknown')).toBeNull();
  });

  // The load-bearing guard against a redirect landing on a 404: every real
  // series must have a what-is guide AND it must resolve to an existing entry.
  it('every series has a what-is guide that resolves to a real entry', async () => {
    const metas = await loadAllSeriesMeta();
    for (const m of metas) {
      const href = aboutGuideForSeries(m.slug);
      expect(href, `${m.slug} has no about guide`).not.toBeNull();
      const [, , topic, slug] = href!.split('/');
      const entry = await getInfoEntry(topic, slug);
      expect(entry, `${href} does not resolve to an entry`).not.toBeNull();
    }
  });
});

describe('registry — merge + indexing gates', () => {
  it('merges generated + curated with unique topic/slug keys', async () => {
    const all = await getAllInfoEntries();
    const keys = all.map(entryKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keeps slugs unique within every topic', async () => {
    const all = await getAllInfoEntries();
    const byTopic = new Map<string, Set<string>>();
    for (const e of all) {
      const set = byTopic.get(e.topic) ?? new Set<string>();
      expect(set.has(e.slug)).toBe(false);
      set.add(e.slug);
      byTopic.set(e.topic, set);
    }
  });

  it('finds a known editorial answer', async () => {
    const e = await getInfoEntry('general', 'what-is-motorsport');
    expect(e).not.toBeNull();
    expect(e!.review).toBe('verified');
    expect(e!.featured).toBe(true);
  });

  it('indexes ONLY verified + featured entries, within the cap', async () => {
    const indexed = await getIndexedInfoEntries();
    expect(indexed.length).toBeGreaterThan(0);
    expect(indexed.length).toBeLessThanOrEqual(INFORMATION_MAX_INDEXED);
    expect(indexed.every((e) => e.review === 'verified' && e.featured)).toBe(true);
  });

  it('exposes only verified entries to on-site search (no drafts)', async () => {
    const searchable = await getSearchableInfoEntries();
    expect(searchable.length).toBeGreaterThan(0);
    expect(searchable.every((e) => e.review === 'verified')).toBe(true);
  });

  it('never indexes an unverified entry (gate holds even at zero drafts)', async () => {
    // Every indexed entry is verified — the primary invariant.
    const indexed = await getIndexedInfoEntries();
    expect(indexed.every((e) => e.review === 'verified')).toBe(true);
    // And from the draft side: any unverified entry (none right now — the current
    // round promoted them all — but the gate must hold for future drafts) is never
    // in the indexed set.
    const all = await getAllInfoEntries();
    for (const d of all.filter((e) => e.review === 'unverified')) {
      expect(await isEntryIndexed(d)).toBe(false);
    }
  });

  it('loads the curated datasets (team histories + rising-stars watchlist)', async () => {
    const all = await getAllInfoEntries();
    expect(all.some((e) => e.topic === 'teams')).toBe(true);
    expect(all.some((e) => e.kind === 'watchlist')).toBe(true);
  });

  it('loads a healthy set of editorial answers across topics', async () => {
    const all = await getAllInfoEntries();
    const editorial = all.filter(
      (e) =>
        e.kind === 'qa' &&
        e.review === 'verified' &&
        !e.slug.startsWith('who-won-') &&
        !e.slug.startsWith('most-'),
    );
    expect(editorial.length).toBeGreaterThanOrEqual(10);
    // Every topic that has an editorial answer is therefore indexable.
    expect(await isTopicIndexable('general')).toBe(true);
  });

  it('reports consistent stats', async () => {
    const s = await getInfoStats();
    expect(s.total).toBe(s.verified + s.unverified);
    expect(s.indexed).toBeLessThanOrEqual(s.verified);
    expect(Object.keys(s.byTopic).every((t) => INFO_TOPICS.some((x) => x.id === t))).toBe(true);
  });
});
