import Link from 'next/link';
import { loadAllPosts } from '@/lib/posts';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Blog · Paddock',
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
        <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 font-semibold mb-2">
          Writing
        </div>
        <h1 className="text-zinc-50 text-3xl md:text-4xl font-bold tracking-tight leading-tight">
          Blog
        </h1>
        <p className="mt-3 text-sm text-zinc-400">
          Analysis, recaps, and opinion across motorsport championships.
        </p>
      </header>

      {posts.length === 0 ? (
        <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/60 p-8 text-center">
          <div className="text-zinc-300 text-base font-medium mb-1">
            Nothing here yet
          </div>
          <div className="text-zinc-500 text-sm">
            First posts are on the way.
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-800/60">
          {posts.map(post => (
            <li key={post.slug} className="py-5 first:pt-0 last:pb-0">
              <Link
                href={`/blog/${post.slug}`}
                className="block group"
              >
                <div className="flex items-baseline gap-3 mb-1.5 flex-wrap">
                  <time className="text-[11px] uppercase tracking-[0.16em] text-zinc-500 font-semibold tabular-nums">
                    {formatDate(post.frontmatter.publishedAt)}
                  </time>
                  {post.frontmatter.tags?.map(tag => (
                    <span
                      key={tag}
                      className="text-[10px] uppercase tracking-[0.12em] font-semibold text-zinc-400 bg-zinc-900/60 border border-zinc-800/60 rounded-full px-2 py-0.5"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <h2 className="text-zinc-100 text-xl font-semibold tracking-tight leading-snug group-hover:text-white transition-colors">
                  {post.frontmatter.title}
                </h2>
                <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
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
