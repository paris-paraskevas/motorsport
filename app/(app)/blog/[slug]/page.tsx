import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronLeft } from 'lucide-react';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { listPostSlugs, loadPost } from '@/lib/posts';
import { mdxComponents } from '@/components/mdx/mdx-components';
import { JsonLd } from '@/components/JsonLd';
import { articleLd, breadcrumbLd } from '@/lib/json-ld';
import { SITE_URL } from '@/lib/site';

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
  if (!post) return { title: 'Post not found' };
  // Blog posts carry article-specific openGraph fields (publishedTime, hero
  // images) that the shared withSocialMeta() helper doesn't model, so build
  // the openGraph block directly here. Re-set siteName + url since the
  // per-page override fully replaces the layout's openGraph block.
  return {
    title: post.frontmatter.title,
    description: post.frontmatter.summary,
    openGraph: {
      type: 'article',
      title: post.frontmatter.title,
      description: post.frontmatter.summary,
      siteName: 'Paddock Tracker',
      url: `${SITE_URL}/blog/${slug}`,
      publishedTime: post.frontmatter.publishedAt,
      images: post.frontmatter.heroImage ? [post.frontmatter.heroImage] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.frontmatter.title,
      description: post.frontmatter.summary,
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

  const postUrl = `${SITE_URL}/blog/${slug}`;

  return (
    <div className="max-w-2xl lg:max-w-3xl mx-auto p-4 md:p-6 lg:p-8 pb-16">
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', url: SITE_URL },
          { name: 'Blog', url: `${SITE_URL}/blog` },
          { name: post.frontmatter.title, url: postUrl },
        ])}
      />
      <JsonLd data={articleLd({ post, url: postUrl })} />
      <Link
        href="/blog"
        className="inline-flex items-center gap-1 text-xs font-medium text-text-faint hover:text-text-muted transition-colors duration-(--duration-fast) mb-6"
      >
        <ChevronLeft size={14} />
        Back to blog
      </Link>

      <header className="mb-8">
        <div className="flex items-baseline gap-3 mb-3 flex-wrap">
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
        <h1 className="text-text text-3xl md:text-4xl font-bold tracking-tight leading-tight">
          {post.frontmatter.title}
        </h1>
        <p className="mt-4 text-base text-text-muted leading-relaxed">
          {post.frontmatter.summary}
        </p>
      </header>

      <article
        className="prose dark:prose-invert prose-zinc max-w-none
                   prose-headings:tracking-tight
                   prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
                   prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
                   prose-p:leading-relaxed
                   prose-strong:text-text
                   prose-a:text-text prose-a:underline-offset-4"
      >
        <MDXRemote source={post.source} components={mdxComponents} />
      </article>
    </div>
  );
}
