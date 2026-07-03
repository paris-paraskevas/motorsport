import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  fetchNews,
  fetchAggregatedNews,
  filterNewsByMention,
  newsMentionAliases,
} from './news';
import type { NewsItem } from './types';

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test</title>
    <link>https://example.com</link>
    <item>
      <title><![CDATA[Story one]]></title>
      <link>https://example.com/one</link>
      <pubDate>Mon, 12 May 2026 10:00:00 +0000</pubDate>
      <description><![CDATA[Short summary.<br>More text.<a class='more' href='x'>Keep reading</a>]]></description>
    </item>
    <item>
      <title>Story two</title>
      <link>https://example.com/two</link>
      <pubDate>Mon, 12 May 2026 09:00:00 +0000</pubDate>
      <description>Plain description.</description>
    </item>
  </channel>
</rss>`;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchNews', () => {
  it('parses RSS into NewsItem[]', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(SAMPLE_RSS, {
        status: 200,
        headers: { 'Content-Type': 'application/rss+xml' },
      }),
    );
    const items = await fetchNews('f1');
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe('Story one');
    expect(items[0].link).toBe('https://example.com/one');
    expect(items[0].description).toBe('Short summary. More text.');
    expect(items[1].title).toBe('Story two');
  });

  it('returns [] for an unknown series slug', async () => {
    const items = await fetchNews('not-a-series');
    expect(items).toEqual([]);
  });

  it('returns [] when fetch returns 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('not found', { status: 404 }),
    );
    const items = await fetchNews('f1');
    expect(items).toEqual([]);
  });

  it('returns [] when XML is malformed', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<not real xml>', { status: 200 }),
    );
    const items = await fetchNews('f1');
    expect(items).toEqual([]);
  });
});

function item(title: string, description?: string): NewsItem {
  return {
    title,
    link: `https://example.com/${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    pubDate: new Date('2026-07-01T10:00:00Z'),
    description,
  };
}

describe('newsMentionAliases', () => {
  it('adds the surname for a driver', () => {
    expect(newsMentionAliases('driver', 'Max Verstappen')).toEqual([
      'Max Verstappen',
      'Verstappen',
    ]);
  });

  it('skips generational suffixes when picking the surname', () => {
    expect(newsMentionAliases('driver', 'Martin Truex Jr')).toEqual([
      'Martin Truex Jr',
      'Truex',
    ]);
  });

  it('keeps a single-token driver name as-is', () => {
    expect(newsMentionAliases('driver', 'Verstappen')).toEqual(['Verstappen']);
  });

  it('strips generic trailing words from a team name', () => {
    expect(newsMentionAliases('team', 'Haas F1 Team')).toEqual(['Haas F1 Team', 'Haas']);
    expect(newsMentionAliases('team', 'Red Bull Racing')).toEqual([
      'Red Bull Racing',
      'Red Bull',
    ]);
  });

  it('does not strip non-generic team words', () => {
    // "Bulls" is part of the identity, not a generic tail.
    expect(newsMentionAliases('team', 'Racing Bulls')).toEqual(['Racing Bulls']);
  });
});

describe('filterNewsByMention', () => {
  it('matches on word boundaries, not substrings', () => {
    const items = [
      item('Verstappen wins in Austria'),
      item('Verstappenmania grips the Netherlands'), // no boundary → no match
      item('Race report: no mention here'),
    ];
    const out = filterNewsByMention(items, newsMentionAliases('driver', 'Max Verstappen'));
    expect(out.map(i => i.title)).toEqual(['Verstappen wins in Austria']);
  });

  it('is diacritic-insensitive both ways', () => {
    const items = [
      item('Perez takes pole in Baku'), // feed drops the accent
      item('Hülkenberg scores again'), // feed keeps the accent
    ];
    expect(
      filterNewsByMention(items, newsMentionAliases('driver', 'Sergio Pérez')),
    ).toHaveLength(1);
    expect(
      filterNewsByMention(items, newsMentionAliases('driver', 'Nico Hulkenberg')),
    ).toHaveLength(1);
  });

  it('matches in the summary when the title misses', () => {
    const items = [
      item('Silly season latest', 'Sources say Norris is close to a new deal.'),
      item('Silly season extra', 'Nothing relevant.'),
    ];
    const out = filterNewsByMention(items, newsMentionAliases('driver', 'Lando Norris'));
    expect(out.map(i => i.title)).toEqual(['Silly season latest']);
  });

  it('does not cross-match sibling team names', () => {
    const items = [item('Red Bull confirm upgrade package'), item('Racing Bulls sign junior')];
    expect(
      filterNewsByMention(items, newsMentionAliases('team', 'Red Bull Racing')).map(i => i.title),
    ).toEqual(['Red Bull confirm upgrade package']);
    expect(
      filterNewsByMention(items, newsMentionAliases('team', 'Racing Bulls')).map(i => i.title),
    ).toEqual(['Racing Bulls sign junior']);
  });

  it('never matches on a generic tail word alone', () => {
    const items = [item('Team orders row erupts'), item('A racing story')];
    expect(filterNewsByMention(items, newsMentionAliases('team', 'Haas F1 Team'))).toEqual([]);
  });

  it('caps at the limit, preserving feed order', () => {
    const items = Array.from({ length: 8 }, (_, i) => item(`Verstappen story ${i + 1}`));
    const out = filterNewsByMention(items, ['Verstappen'], 5);
    expect(out).toHaveLength(5);
    expect(out[0].title).toBe('Verstappen story 1');
  });

  it('returns [] for empty aliases', () => {
    expect(filterNewsByMention([item('Anything')], [])).toEqual([]);
  });
});

describe('fetchAggregatedNews', () => {
  it('dedupes a cross-posted article by slug, keeping the earliest series', async () => {
    // Every category feed cross-posts the same article (same slug, category-
    // specific URL — as motorsport.com does), plus one feed-unique item.
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const cat = String(input).match(/\/rss\/([^/]+)\/news/)?.[1] ?? 'x';
      const rss = `<?xml version="1.0"?><rss version="2.0"><channel>
        <item><title>Shared cross-post</title>
        <link>https://www.motorsport.com/${cat}/news/shared-story/</link>
        <pubDate>Mon, 12 May 2026 10:00:00 +0000</pubDate></item>
        <item><title>${cat} exclusive</title>
        <link>https://www.motorsport.com/${cat}/news/${cat}-only/</link>
        <pubDate>Mon, 12 May 2026 09:00:00 +0000</pubDate></item>
      </channel></rss>`;
      return Promise.resolve(
        new Response(rss, {
          status: 200,
          headers: { 'Content-Type': 'application/rss+xml' },
        }),
      );
    });
    const items = await fetchAggregatedNews();
    const shared = items.filter(i => i.title === 'Shared cross-post');
    expect(shared).toHaveLength(1);
    expect(shared[0].seriesSlug).toBe('f1'); // first in NEWS_SLUG_MAP order
  });
});
