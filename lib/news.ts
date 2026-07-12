import { XMLParser } from 'fast-xml-parser';
import type { NewsItem } from './types';
import { withSourceSnapshot } from './source-snapshot';

const UA = 'PaddockTracker-PWA (https://paddock-tracker.com)';
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
  'gt-world': 'gt', // motorsport.com's GT category — probed 200/50 items (audit #9)
  dtm: 'dtm',
  motogp: 'motogp',
  wsbk: 'wsbk',
  wrc: 'wrc',
  'nascar-cup': 'nascar-cup',
  nls: null, // no dedicated upstream category; 'endurance' would mislabel generic stories under the NLS chip (audit #9)
  'adac-ravenol-24h': null, // no dedicated Nürburgring-24h feed; like nls, a generic 'endurance' feed would mislabel — fall back to the official-site affordance rather than being unmapped
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

// motorsport.com cross-posts one article to multiple category feeds, each with a
// category-specific URL (`/f1/news/<slug>/` vs `/wec/news/<slug>/`). The article
// SLUG (last path segment) is its canonical identity across categories — keying
// on the full link misses the duplicate because the category path differs.
export function articleKey(link: string): string {
  try {
    const segs = new URL(link).pathname.split('/').filter(Boolean);
    return segs.length ? segs[segs.length - 1] : link;
  } catch {
    return link;
  }
}

// News push notifications only fire for genuinely-fresh articles. motorsport.com
// re-orders and re-timestamps its feed and cross-posts one story to several
// category feeds; without a freshness gate an OLD story resurfacing to feed-top
// fired a push at a random hour of the day (operator 2026-07-09). An article's
// RSS pubDate is its original publish time (unchanged on reorder), so gating on
// age suppresses resurfaces. 2h comfortably covers the detection lag — 15-min
// cron + 30-min RSS revalidate + GitHub Actions scheduling delay — while killing
// day-old refires. A future-dated item (clock skew) counts as fresh.
export const NEWS_FRESH_WINDOW_MS = 2 * 60 * 60 * 1000;

export function isRecentArticle(
  pubDate: Date,
  now: Date = new Date(),
  windowMs: number = NEWS_FRESH_WINDOW_MS,
): boolean {
  return now.getTime() - pubDate.getTime() <= windowMs;
}

/**
 * Fetch top N items from every configured series in parallel, return a flat
 * array sorted by pubDate descending, with cross-posted duplicates removed.
 * Caller applies followed-series filter.
 */
async function fetchAggregatedNewsLive(
  perSeries: number = MAX_PER_SERIES_AGGREGATE,
): Promise<AggregatedNewsItem[]> {
  const slugs = Object.keys(NEWS_SLUG_MAP).filter(s => NEWS_SLUG_MAP[s]);
  const results = await Promise.all(
    slugs.map(async slug => {
      const items = await fetchNews(slug);
      return items.slice(0, perSeries).map(i => ({ ...i, seriesSlug: slug }));
    }),
  );
  // Dedupe cross-posts: the same story tagged to F1 + WEC + WRC arrives once per
  // feed. Keep the first occurrence (earliest series in NEWS_SLUG_MAP order = its
  // most-specific tag); without this the wire showed a story 3× and inflated the
  // per-series chip counts (audit 2026-06-21).
  const seen = new Set<string>();
  const deduped: AggregatedNewsItem[] = [];
  for (const item of results.flat()) {
    const key = articleKey(item.link);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
}

// Durable last-good (source_snapshot): if motorsport.com's RSS is unreachable the
// wire serves the last good aggregate instead of blanking. pubDate round-trips
// through jsonb as a string, so rehydrate it after a last-good read.
export async function fetchAggregatedNews(
  perSeries: number = MAX_PER_SERIES_AGGREGATE,
): Promise<AggregatedNewsItem[]> {
  const items = await withSourceSnapshot(
    `news:aggregate:${perSeries}`,
    () => fetchAggregatedNewsLive(perSeries),
    v => !Array.isArray(v) || v.length === 0,
  );
  return items.map(i => ({
    ...i,
    pubDate: i.pubDate instanceof Date ? i.pubDate : new Date(i.pubDate as unknown as string),
  }));
}

// ---------------------------------------------------------------------------
// Profile-page "In the news" — pure filtering over the SAME per-series feed
// the News tab renders (fetchNews above). No new fetch, no new source.

// Lowercase, strip diacritics (NFD + combining-mark removal, same trick as
// lib/slug.ts), collapse every non-alphanumeric run to a single space, and pad
// with spaces so word-boundary matching is a plain substring test:
// "O'Ward" → " o ward ".
function normalizeForMatch(s: string): string {
  const collapsed = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return collapsed ? ` ${collapsed} ` : '';
}

// Generational suffixes that aren't a usable surname token ("Martin Truex Jr").
const NAME_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);
// Generic trailing team-name words: stripped so "Red Bull Racing" also matches
// headlines that say just "Red Bull". Never used as a standalone alias — a
// bare "Team"/"Racing" would match everything.
const TEAM_GENERIC_TAIL = new Set(['f1', 'team', 'racing', 'gp', 'motorsport', 'motorsports']);

/**
 * Aliases a headline could plausibly use for this driver/team, for
 * `filterNewsByMention`. Drivers: the full name plus the surname (headlines
 * say "Verstappen wins", not "Max Verstappen wins"), skipping generational
 * suffixes. Teams: the full name plus the name with generic trailing words
 * stripped ("Haas F1 Team" → "Haas"). Pure; word-boundary + diacritic handling
 * happens in the matcher, so aliases keep their human spelling.
 */
export function newsMentionAliases(kind: 'driver' | 'team', name: string): string[] {
  const aliases: string[] = [];
  const push = (alias: string) => {
    const trimmed = alias.trim();
    if (trimmed && !aliases.some(a => a.toLowerCase() === trimmed.toLowerCase())) {
      aliases.push(trimmed);
    }
  };
  push(name);

  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (kind === 'driver' && tokens.length >= 2) {
    let i = tokens.length - 1;
    while (i > 0 && NAME_SUFFIXES.has(tokens[i].toLowerCase().replace(/\./g, ''))) i--;
    const surname = tokens[i];
    // ≥3 letters: a two-letter token is too collision-prone as a word.
    if (i > 0 && surname.replace(/[^a-z]/gi, '').length >= 3) push(surname);
  }
  if (kind === 'team' && tokens.length >= 2) {
    let end = tokens.length;
    while (end > 1 && TEAM_GENERIC_TAIL.has(tokens[end - 1].toLowerCase())) end--;
    if (end < tokens.length) push(tokens.slice(0, end).join(' '));
  }
  return aliases;
}

/**
 * Filter news items to those mentioning any of `aliases` in title or summary —
 * word-boundary, diacritic-insensitive ("Perez" matches "Pérez"). Preserves
 * the input order (feeds arrive date-desc) and caps at `limit`. Pure.
 */
export function filterNewsByMention<T extends NewsItem>(
  items: T[],
  aliases: string[],
  limit = 5,
): T[] {
  const needles = aliases.map(normalizeForMatch).filter(Boolean);
  if (needles.length === 0) return [];
  const out: T[] = [];
  for (const item of items) {
    const haystack = normalizeForMatch(`${item.title} ${item.description ?? ''}`);
    if (needles.some(n => haystack.includes(n))) {
      out.push(item);
      if (out.length >= limit) break;
    }
  }
  return out;
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
