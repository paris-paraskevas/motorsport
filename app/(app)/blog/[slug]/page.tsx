import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronLeft } from 'lucide-react';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { currentUser } from '@clerk/nextjs/server';
import { listPostSlugs, loadPost } from '@/lib/posts';
import { getPostBySlug, type BlogPost } from '@/lib/blog';
import { isAdmin } from '@/lib/threads';
import { renderMarkdown } from '@/lib/content';
import { mdxComponents } from '@/components/mdx/mdx-components';
import { JsonLd } from '@/components/JsonLd';
import { articleLd, breadcrumbLd } from '@/lib/json-ld';
import { SITE_URL } from '@/lib/site';
import type { Post } from '@/lib/types';

// Force-dynamic: required for the admin scheduled-preview branch (currentUser),
// and DB posts render at request time anyway. generateStaticParams stays
// MDX-only — DB posts are served dynamically, not enumerated at build.
export const dynamic = 'force-dynamic';

// Adapt a DB post to the file-based Post shape so articleLd() + generateMetadata
// reuse unchanged. `source` carries the markdown body (rendered separately).
function dbToPost(p: BlogPost): Post {
  return {
    slug: p.slug,
    frontmatter: {
      title: p.title,
      summary: p.summary,
      publishedAt: p.publishedAt ?? p.publishAt ?? p.createdAt,
      heroImage: p.heroImage ?? undefined,
      seriesSlug: p.seriesSlug ?? undefined,
    },
    source: p.body,
  };
}

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
  // DB-first (published only — unpublished drafts get generic metadata), MDX fallback.
  const db = await getPostBySlug(slug);
  const post = db && db.status === 'published' ? dbToPost(db) : await loadPost(slug);
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

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let post: Post | null = null;
  let bodyHtml: string | null = null; // set for DB posts (rendered markdown)
  let scheduledAt: string | null = null; // admin preview of a scheduled (approved) post
  let draftPreview = false; // admin preview of a still-draft post (not yet scheduled)

  const db = await getPostBySlug(slug);
  if (db) {
    if (db.status === 'published') {
      post = dbToPost(db);
      bodyHtml = await renderMarkdown(db.body);
    } else if ((db.status === 'approved' || db.status === 'draft') && isAdmin(await currentUser())) {
      // Not yet live (scheduled, or still a draft) — only admins may preview it,
      // so an editor can read the whole piece in full before approving it.
      post = dbToPost(db);
      bodyHtml = await renderMarkdown(db.body);
      scheduledAt = db.status === 'approved' ? db.publishAt : null;
      draftPreview = db.status === 'draft';
    } else {
      notFound(); // rejected / (draft|approved)-but-not-admin → hidden; slug is taken
    }
  } else {
    post = await loadPost(slug); // MDX fallback
    if (!post) notFound();
  }
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

      {draftPreview && (
        <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 font-mono text-xs text-amber-300">
          Draft preview · not yet scheduled · only admins can see this
        </div>
      )}
      {scheduledAt && (
        <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 font-mono text-xs text-amber-300">
          Scheduled preview · publishes {formatDateTime(scheduledAt)} UTC · only admins can see this
        </div>
      )}

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
        {db?.authorName && (
          <p className="mt-3 text-sm font-medium text-text-muted">By {db.authorName}</p>
        )}
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
        {bodyHtml !== null ? (
          <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
        ) : (
          <MDXRemote source={post.source} components={mdxComponents} />
        )}
      </article>
    </div>
  );
}
