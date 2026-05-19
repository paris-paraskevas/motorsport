import { loadAllPosts } from '@/lib/posts';

export const dynamic = 'force-dynamic';

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

export async function GET() {
  const posts = await loadAllPosts();
  const items = posts
    .map(post => {
      const url = `${SITE_URL}/blog/${post.slug}`;
      const pubDate = new Date(post.frontmatter.publishedAt).toUTCString();
      return `    <item>
      <title>${escapeXml(post.frontmatter.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${escapeXml(post.frontmatter.summary)}</description>
      <pubDate>${pubDate}</pubDate>
    </item>`;
    })
    .join('\n');

  // lastBuildDate tracks content freshness, not response time, so RSS clients
  // (and Google) only re-poll when posts actually change. Omit entirely when
  // there are no posts — better silent than emitting an obviously bogus epoch
  // date that aggregators will either ignore or treat as a dead feed.
  const lastBuildDateTag =
    posts.length > 0
      ? `<lastBuildDate>${new Date(
          Math.max(
            ...posts.map(p => new Date(p.frontmatter.publishedAt).getTime()),
          ),
        ).toUTCString()}</lastBuildDate>\n    `
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
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
