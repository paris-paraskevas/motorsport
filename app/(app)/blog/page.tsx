import Link from 'next/link';
import { loadAllPosts } from '@/lib/posts';
import { publishedPosts } from '@/lib/blog';
import { loadAllSeriesMeta } from '@/lib/series';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbLd } from '@/lib/json-ld';
import { SITE_URL } from '@/lib/site';
import { PostModeration } from '@/components/blog/PostModeration';

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
  const [dbPosts, mdxPosts, seriesMetas] = await Promise.all([
    publishedPosts(),
    loadAllPosts(),
    loadAllSeriesMeta(),
  ]);
  const nameBySlug = new Map(seriesMetas.map(m => [m.slug, m.name] as const));

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
  }));

  const bySlug = new Map<string, Card>();
  for (const c of mdxCards) bySlug.set(c.slug, c);
  for (const c of dbCards) bySlug.set(c.slug, c); // DB wins on slug collision
  const posts = [...bySlug.values()].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  return (
    <div className="max-w-2xl lg:max-w-4xl mx-auto p-4 md:p-6 lg:p-8 pb-16">
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', url: SITE_URL },
          { name: 'Blog', url: `${SITE_URL}/blog` },
        ])}
      />
      <header className="mb-8">
        <div className="text-[11px] uppercase tracking-[0.18em] text-text-faint font-semibold mb-2">
          Writing
        </div>
        <h1 className="text-text text-3xl md:text-4xl font-bold tracking-tight leading-tight">
          Blog
        </h1>
        <p className="mt-3 text-sm text-text-muted">
          Analysis, recaps, and opinion across motorsport championships.
        </p>
      </header>

      <PostModeration series={seriesMetas.map(m => ({ slug: m.slug, name: m.name }))} />

      <Link
        href="/threads"
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
        <div className="rounded-2xl bg-surface/40 border border-border/60 p-8 text-center">
          <div className="text-text text-base font-medium mb-1">
            Nothing here yet
          </div>
          <div className="text-text-faint text-sm">
            First posts are on the way.
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {posts.map(post => (
            <li key={post.slug} className="py-5 first:pt-0 last:pb-0">
              <Link
                href={`/blog/${post.slug}`}
                className="block group"
              >
                <div className="flex items-baseline gap-3 mb-1.5 flex-wrap">
                  <time className="text-[11px] uppercase tracking-[0.16em] text-text-faint font-semibold tabular-nums font-mono">
                    {formatDate(post.publishedAt)}
                  </time>
                  {post.tags?.map(tag => (
                    <span
                      key={tag}
                      className="text-[10px] uppercase tracking-[0.12em] font-semibold text-text-muted bg-surface border border-border rounded-full px-2 py-0.5"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <h2 className="text-text text-xl font-semibold tracking-tight leading-snug group-hover:text-tint transition-colors duration-(--duration-fast)">
                  {post.title}
                </h2>
                <p className="mt-2 text-sm text-text-muted leading-relaxed">
                  {post.summary}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
