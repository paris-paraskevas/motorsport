import { XMLParser } from 'fast-xml-parser';
import type { NewsItem } from './types';

const UA = 'Paddock-PWA (https://paddock-tracker.com)';
const BASE = 'https://www.motorsport.com/rss';
const MAX_ITEMS = 10;
const MAX_PER_SERIES_AGGREGATE = 3;

/**
 * Map our series slugs to motorsport.com's RSS slugs.
 * Values verified by WebFetch when present; null = no working feed known.
 * Series with null fall back to a "View on official site" affordance.
 */
export const NEWS_SLUG_MAP: Record<string, string | null> = {
  f1: 'f1',
  f2: 'f2',
  f3: 'f3',
  'formula-e': 'formula-e',
  indycar: 'indycar',
  wec: 'wec',
  imsa: 'imsa',
  'gt-world': null,
  dtm: 'dtm',
  motogp: 'motogp',
  wsbk: 'wsbk',
  wrc: 'wrc',
  'nascar-cup': 'nascar-cup',
  nls: null,
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  cdataPropName: '__cdata',
  textNodeName: '__text',
});

function flatten(node: unknown): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    if (typeof obj.__cdata === 'string') return obj.__cdata;
    if (typeof obj.__text === 'string') return obj.__text;
  }
  return '';
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface AggregatedNewsItem extends NewsItem {
  seriesSlug: string;
}

/**
 * Fetch top N items from every configured series in parallel, return a flat
 * array sorted by pubDate descending. Caller applies followed-series filter.
 */
export async function fetchAggregatedNews(
  perSeries: number = MAX_PER_SERIES_AGGREGATE,
): Promise<AggregatedNewsItem[]> {
  const slugs = Object.keys(NEWS_SLUG_MAP).filter(s => NEWS_SLUG_MAP[s]);
  const results = await Promise.all(
    slugs.map(async slug => {
      const items = await fetchNews(slug);
      return items.slice(0, perSeries).map(i => ({ ...i, seriesSlug: slug }));
    }),
  );
  return results
    .flat()
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
}

export async function fetchNews(seriesSlug: string): Promise<NewsItem[]> {
  const motorsportSlug = NEWS_SLUG_MAP[seriesSlug];
  if (!motorsportSlug) return [];

  const url = `${BASE}/${motorsportSlug}/news/`;
  let xml: string;
  try {
    const res = await fetch(url, {
      next: { revalidate: 1800 },
      headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml' },
    } as RequestInit);
    if (!res.ok) return [];
    xml = await res.text();
  } catch {
    return [];
  }

  try {
    const parsed = parser.parse(xml);
    const rawItems = parsed?.rss?.channel?.item;
    if (!rawItems) return [];
    const items = Array.isArray(rawItems) ? rawItems : [rawItems];

    const out: NewsItem[] = [];
    for (const item of items.slice(0, MAX_ITEMS)) {
      const title = stripHtml(flatten(item.title));
      const link = stripHtml(flatten(item.link));
      const pubDateRaw = flatten(item.pubDate);
      const pubDate = pubDateRaw ? new Date(pubDateRaw) : null;
      if (!title || !link || !pubDate || Number.isNaN(pubDate.getTime())) continue;

      const descRaw = stripHtml(flatten(item.description));
      // Strip "Keep reading" tail from motorsport.com descriptions
      const description = descRaw.replace(/\s*Keep reading\s*$/i, '').slice(0, 240);

      out.push({ title, link, pubDate, description: description || undefined });
    }
    return out;
  } catch {
    return [];
  }
}
