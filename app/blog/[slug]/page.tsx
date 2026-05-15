import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronLeft } from 'lucide-react';
import { listPostSlugs, loadPost } from '@/lib/posts';

export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  const slugs = await listPostSlugs();
  return slugs.map(slug => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post) return { title: 'Post not found · Paddock' };
  return {
    title: `${post.frontmatter.title} · Paddock`,
    description: post.frontmatter.summary,
    openGraph: {
      title: post.frontmatter.title,
      description: post.frontmatter.summary,
      type: 'article',
      publishedTime: post.frontmatter.publishedAt,
      images: post.frontmatter.heroImage ? [post.frontmatter.heroImage] : undefined,
    },
  };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post) notFound();

  return (
    <div className="max-w-2xl lg:max-w-3xl mx-auto p-4 md:p-6 lg:p-8 pb-16">
      <Link
        href="/blog"
        className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors mb-6"
      >
        <ChevronLeft size={14} />
        Back to blog
      </Link>

      <header className="mb-8">
        <div className="flex items-baseline gap-3 mb-3 flex-wrap">
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
        <h1 className="text-zinc-50 text-3xl md:text-4xl font-bold tracking-tight leading-tight">
          {post.frontmatter.title}
        </h1>
        <p className="mt-4 text-base text-zinc-400 leading-relaxed">
          {post.frontmatter.summary}
        </p>
      </header>

      <article
        className="prose prose-invert prose-zinc max-w-none
                   prose-headings:tracking-tight
                   prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
                   prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
                   prose-p:leading-relaxed
                   prose-strong:text-zinc-100
                   prose-a:text-zinc-100 prose-a:underline-offset-4"
        dangerouslySetInnerHTML={{ __html: post.contentHtml }}
      />
    </div>
  );
}
