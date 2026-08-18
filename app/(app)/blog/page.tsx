import Link from 'next/link';
import { loadAllPosts } from '@/lib/posts';
import { publishedPosts } from '@/lib/blog';
import { listAuthors } from '@/lib/authors';
import { loadAllSeriesMeta } from '@/lib/series';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbLd } from '@/lib/json-ld';
import { SITE_URL, PAGE_WIDE } from '@/lib/site';
import { StudioLink } from '@/components/blog/StudioLink';

export const revalidate = 300;

export const metadata = {
  title: 'Blog',
  description:
    'Original analysis, race recaps, championship deep-dives, and commentary across F1, MotoGP, WEC, IndyCar, NASCAR and more motorsport categories.',
};

// Cards from two sources: DB-backed posts (lib/blog) + file-based MDX posts
// (lib/posts). DB wins on a slug collision; the merged list is newest-first.
interface Card {
  slug: string;
  title: string;
  summary: string;
  publishedAt: string;
  tags?: string[];
  /** Series identity for the row's tint bar + the "By series" rail. */
  seriesSlug?: string;
  seriesName?: string;
  seriesColor?: string;
  /** Only set for authors with a public profile — the card byline IS the link to
   *  it, so a writer with no profile row (and every legacy MDX post) shows no
   *  byline here, exactly as before. Name comes from the profile row rather than
   *  Clerk: it's curated, and it keeps the list off the Clerk Backend API. */
  author?: { name: string; slug: string };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default async function BlogIndexPage() {
  const [dbPosts, mdxPosts, seriesMetas, authors] = await Promise.all([
    publishedPosts(),
    loadAllPosts(),
    loadAllSeriesMeta(),
    listAuthors(),
  ]);
  const nameBySlug = new Map(seriesMetas.map(m => [m.slug, m.name] as const));
  const colorBySlug = new Map(seriesMetas.map(m => [m.slug, m.color] as const));
  const profileByAuthorId = new Map(
    authors.map(a => [a.clerkUserId, { name: a.displayName, slug: a.slug }] as const),
  );

  const mdxCards: Card[] = mdxPosts.map(p => ({
    slug: p.slug,
    title: p.frontmatter.title,
    summary: p.frontmatter.summary,
    publishedAt: p.frontmatter.publishedAt,
    tags: p.frontmatter.tags,
  }));

  const dbCards: Card[] = dbPosts.map(p => ({
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    publishedAt: p.publishedAt ?? p.createdAt,
    tags: p.seriesSlug ? [nameBySlug.get(p.seriesSlug) ?? p.seriesSlug] : undefined,
    seriesSlug: p.seriesSlug ?? undefined,
    seriesName: p.seriesSlug ? nameBySlug.get(p.seriesSlug) : undefined,
    seriesColor: p.seriesSlug ? colorBySlug.get(p.seriesSlug) : undefined,
    author: profileByAuthorId.get(p.authorId),
  }));

  const bySlug = new Map<string, Card>();
  for (const c of mdxCards) bySlug.set(c.slug, c);
  for (const c of dbCards) bySlug.set(c.slug, c); // DB wins on slug collision
  const posts = [...bySlug.values()].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  // "By series" rail counts (§4.11: no thumbnails — there is no licensed
  // photography for most rounds; the rail carries the browsing instead).
  const bySeries = new Map<string, { name: string; color: string; count: number }>();
  for (const p of posts) {
    if (!p.seriesSlug || !p.seriesName || !p.seriesColor) continue;
    const cur = bySeries.get(p.seriesSlug);
    if (cur) cur.count += 1;
    else bySeries.set(p.seriesSlug, { name: p.seriesName, color: p.seriesColor, count: 1 });
  }

  return (
    <div className={PAGE_WIDE}>
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', url: SITE_URL },
          { name: 'Blog', url: `${SITE_URL}/blog` },
        ])}
      />
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-text-faint font-semibold mb-2">
            Writing
          </div>
          <h1 className="text-text text-3xl md:text-4xl font-bold tracking-tight leading-tight">
            Blog
          </h1>
          <p className="mt-3 text-sm text-text-muted">
            Analysis, recaps, and opinion across motorsport championships.
          </p>
        </div>
        {/* Authoring + moderation live at /studio now; this pill (writers only,
            null for readers) is the only editor-facing element on the page. */}
        <StudioLink />
      </header>

      <Link
        href="/social/threads"
        className="mb-8 flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface/40 px-5 py-4 transition-colors duration-(--duration-fast) hover:border-brand/50"
      >
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-brand font-semibold">
            Community
          </div>
          <div className="mt-1 text-text font-semibold">
            Threads — fan discussion across the grid
          </div>
        </div>
        <span aria-hidden="true" className="text-text-faint">→</span>
      </Link>

      {posts.length === 0 ? (
        <div className="border border-border bg-surface/40 p-8 text-center">
          <div className="text-text text-base font-medium mb-1">
            Nothing here yet
          </div>
          <div className="text-text-faint text-sm">
            First posts are on the way.
          </div>
        </div>
      ) : (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_240px]">
          {/* Lead with the piece (§4.11): series bar, mono meta, serif
              headline, the standfirst — no thumbnails by design. */}
          <ul className="border-t border-text">
            {posts.map(post => (
              <li key={post.slug} className="flex gap-3 border-b border-border py-4">
                <span
                  aria-hidden="true"
                  className="mt-1 h-4 w-[3px] shrink-0"
                  style={{ backgroundColor: post.seriesColor ?? 'var(--border-strong)' }}
                />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 font-mono text-[10px] uppercase tracking-[0.14em]">
                    {post.seriesName && <span className="font-semibold text-text-muted">{post.seriesName}</span>}
                    <time className="tabular-nums text-text-faint">{formatDate(post.publishedAt)}</time>
                    {post.author && (
                      <Link
                        href={`/authors/${post.author.slug}`}
                        className="text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
                      >
                        {post.author.name}
                      </Link>
                    )}
                  </div>
                  <Link href={`/blog/${post.slug}`} className="group block">
                    <h2 className="font-serif text-[22px] font-semibold leading-snug text-text group-hover:underline">
                      {post.title}
                    </h2>
                    <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-text-muted">
                      {post.summary}
                    </p>
                  </Link>
                </div>
              </li>
            ))}
          </ul>

          {/* The rail: by series + the write-for-us pitch (§4.11). */}
          <aside>
            {bySeries.size > 0 && (
              <>
                <div className="mb-1 border-b border-text pb-1">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                    By series
                  </span>
                </div>
                {[...bySeries.entries()]
                  .sort((a, b) => b[1].count - a[1].count)
                  .map(([slug, x]) => (
                    <div key={slug} className="flex items-center gap-2.5 border-b border-border py-2">
                      <span aria-hidden="true" className="h-3.5 w-[3px] shrink-0" style={{ backgroundColor: x.color }} />
                      <span className="min-w-0 flex-1 truncate text-sm text-text">{x.name}</span>
                      <span className="shrink-0 font-mono text-[10px] tabular-nums text-text-faint">{x.count}</span>
                    </div>
                  ))}
              </>
            )}
            <Link
              href="/write-for-us"
              className="mt-4 block border border-border-strong p-3 transition-colors duration-(--duration-fast) hover:border-text"
            >
              <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-brand">
                Write for Paddock
              </span>
              <span className="mt-1 block font-serif text-[15px] font-semibold leading-snug text-text">
                Pitch a piece — the data is already here
              </span>
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
