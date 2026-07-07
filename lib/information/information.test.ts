import { describe, it, expect, beforeAll } from 'vitest';
import { generateInfoEntries } from './generated';
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
import { INFO_TOPICS, topicForSeries, isTopicId } from './topics';
import { entryKey } from './types';

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

  it('generates per-series record pages', async () => {
    const g = await generateInfoEntries();
    expect(g.some((e) => e.slug === 'most-formula-1-championships')).toBe(true);
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

  it('never indexes an unverified draft', async () => {
    const all = await getAllInfoEntries();
    const drafts = all.filter((e) => e.review === 'unverified');
    expect(drafts.length).toBeGreaterThan(0); // team histories + rising stars ship as drafts
    for (const d of drafts) expect(await isEntryIndexed(d)).toBe(false);
  });

  it('loads the curated datasets as unverified drafts', async () => {
    const all = await getAllInfoEntries();
    expect(all.some((e) => e.topic === 'teams' && e.review === 'unverified')).toBe(true);
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
