import Link from 'next/link';
import { loadAllPosts } from '@/lib/posts';

export const revalidate = 300;

export const metadata = {
  title: 'Blog',
  description: 'Analysis, recaps, and opinion across motorsport championships.',
};

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
  const posts = await loadAllPosts();

  return (
    <div className="max-w-2xl lg:max-w-4xl mx-auto p-4 md:p-6 lg:p-8 pb-16">
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
                    {formatDate(post.frontmatter.publishedAt)}
                  </time>
                  {post.frontmatter.tags?.map(tag => (
                    <span
                      key={tag}
                      className="text-[10px] uppercase tracking-[0.12em] font-semibold text-text-muted bg-surface border border-border rounded-full px-2 py-0.5"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <h2 className="text-text text-xl font-semibold tracking-tight leading-snug group-hover:text-tint transition-colors duration-(--duration-fast)">
                  {post.frontmatter.title}
                </h2>
                <p className="mt-2 text-sm text-text-muted leading-relaxed">
                  {post.frontmatter.summary}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
