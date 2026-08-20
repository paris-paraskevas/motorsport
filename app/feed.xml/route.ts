import { loadAllPosts } from '@/lib/posts';
import { publishedPosts } from '@/lib/blog';

// ISR, not force-dynamic: an `s-maxage` header on a force-dynamic response
// caches nowhere on the Workers runtime, so the old pair re-rendered the feed
// on every poll while promising caching it never had. The incremental cache
// now serves it like every other content route.
export const revalidate = 300;

const SITE_URL = 'https://paddock-tracker.com';
const SITE_TITLE = 'Paddock Tracker';
const SITE_DESCRIPTION =
  'Analysis, recaps, and opinion across motorsport championships.';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

interface FeedEntry {
  slug: string;
  title: string;
  summary: string;
  /** Epoch ms; NaN when the source carries no usable date. */
  publishedMs: number;
}

export async function GET() {
  // Both sources the /blog page merges, DB winning a slug collision — the same
  // precedence lib/sitemap-data.ts uses (this route read only legacy MDX until
  // 0.322.1, so RSS subscribers never saw a single DB-published post). Each
  // source is fail-soft: a Supabase hiccup or an unreadable content directory
  // drops its entries rather than failing the whole feed.
  const [dbPosts, mdxPosts] = await Promise.all([
    publishedPosts().catch(() => []),
    loadAllPosts().catch(() => []),
  ]);

  const bySlug = new Map<string, FeedEntry>();
  for (const post of mdxPosts) {
    bySlug.set(post.slug, {
      slug: post.slug,
      title: post.frontmatter.title,
      summary: post.frontmatter.summary,
      publishedMs: Date.parse(post.frontmatter.publishedAt),
    });
  }
  for (const post of dbPosts) {
    // Imported articles (original_url set) canonicalize off-site; advertising
    // them in the feed sends aggregators to a URL whose canonical says "index
    // somewhere else" — original writing only, matching the sitemap.
    if (post.originalUrl) continue;
    bySlug.set(post.slug, {
      slug: post.slug,
      title: post.title,
      summary: post.summary,
      // publishedAt stays null for rows hand-flipped to published (only the
      // publish cron stamps it) — those still belong in the feed, dateless.
      publishedMs: post.publishedAt ? Date.parse(post.publishedAt) : NaN,
    });
  }

  const posts = [...bySlug.values()].sort(
    (a, b) => (Number.isFinite(b.publishedMs) ? b.publishedMs : 0) - (Number.isFinite(a.publishedMs) ? a.publishedMs : 0),
  );

  const items = posts
    .map(post => {
      const url = `${SITE_URL}/blog/${post.slug}`;
      const pubDateTag = Number.isFinite(post.publishedMs)
        ? `\n      <pubDate>${new Date(post.publishedMs).toUTCString()}</pubDate>`
        : '';
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${escapeXml(post.summary)}</description>${pubDateTag}
    </item>`;
    })
    .join('\n');

  // lastBuildDate tracks content freshness, not response time, so RSS clients
  // (and Google) only re-poll when posts actually change. Omit entirely when
  // no dated post exists — better silent than emitting an obviously bogus
  // epoch date that aggregators will either ignore or treat as a dead feed.
  const datedMs = posts.map(p => p.publishedMs).filter(ms => Number.isFinite(ms));
  const lastBuildDateTag =
    datedMs.length > 0
      ? `<lastBuildDate>${new Date(Math.max(...datedMs)).toUTCString()}</lastBuildDate>\n    `
      : '';

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${SITE_URL}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
    <language>en</language>
    ${lastBuildDateTag}<ttl>60</ttl>
    <category>Sports/Motorsport</category>
    <image>
      <url>${SITE_URL}/icons/icon-192.png</url>
      <title>${escapeXml(SITE_TITLE)}</title>
      <link>${SITE_URL}</link>
    </image>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
}
