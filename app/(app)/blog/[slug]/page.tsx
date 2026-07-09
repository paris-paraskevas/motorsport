import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronLeft } from 'lucide-react';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { currentUser, clerkClient } from '@clerk/nextjs/server';
import { listPostSlugs, loadPost } from '@/lib/posts';
import { getPostBySlug, type BlogPost } from '@/lib/blog';
import { isAdmin, isWriter } from '@/lib/threads';
import { renderMarkdown } from '@/lib/content';
import { mdxComponents } from '@/components/mdx/mdx-components';
import { DraftEditor } from '@/components/blog/DraftEditor';
import { POST_ARTICLE_CLASS } from '@/components/blog/PostHeader';
import { JsonLd } from '@/components/JsonLd';
import { articleLd, breadcrumbLd } from '@/lib/json-ld';
import { readResultsCache, writeResultsCache } from '@/lib/results-cache';
import { SITE_URL, PAGE_READ } from '@/lib/site';
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
  // Hidden-post 404 belongs HERE, not only in the page: with streamed metadata
  // the shell flushes before the page body's notFound() can set the status, so
  // gating only in the page yields a 200 soft-404 (regression caught on prod
  // minutes after 0.160.0). Same visibility rule as the page branch.
  if (db && db.status !== 'published' && !(await loadPost(slug))) {
    const previewable =
      (db.status === 'approved' || db.status === 'draft') && (await canPreviewUnpublished(db));
    if (!previewable) notFound();
  }
  const post = db && db.status === 'published' ? dbToPost(db) : await loadPost(slug);
  if (!post && db) return { title: 'Draft preview' }; // admin preview metadata stays generic
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

// Byline identity — name + avatar resolved from CLERK (the source the author
// edits in their account), KV-cached 1h, fail-soft to the stored display name
// (no avatar) if Clerk is unreachable / the user can't be resolved. Clerk is
// authoritative here, which is why the byline can differ from app_user.display_name.
// The ENTIRE body is inside the try (the KV read/write used to sit outside it):
// the byline is a decoration, and no decoration may 500 a blog URL.
async function resolveBlogAuthor(
  authorId: string,
  fallbackName: string | null,
): Promise<{ name: string | null; image: string | null }> {
  try {
    const key = `paddock:blog-author:${authorId}`;
    const cached = await readResultsCache<{ name: string | null; image: string | null }>(key);
    if (cached) return cached;
    const u = await (await clerkClient()).users.getUser(authorId);
    const name =
      u.fullName ||
      [u.firstName, u.lastName].filter(Boolean).join(' ').trim() ||
      u.username ||
      fallbackName;
    const result = { name: name ?? null, image: u.imageUrl || null };
    await writeResultsCache(key, result, 60 * 60);
    return result;
  } catch {
    return { name: fallbackName, image: null };
  }
}

// Fail-soft Clerk session lookup. The admin-preview gate is a decoration on a
// public route: if Clerk misbehaves (local dev without a warm handshake, a
// backend-API blip), the viewer downgrades to anonymous — the draft hides
// (404) instead of the whole page 500ing. Local dev has seen /blog/[slug]
// 500s that typecheck/curl missed (docs/HANDOFF.md gotcha, 2026-07-03); every
// non-essential dependency of this page is now wrapped like this.
async function safeCurrentUser() {
  try {
    return await currentUser();
  } catch {
    return null;
  }
}

// A still-unpublished post (draft/scheduled) is previewable by an admin, or by
// the writer who OWNS it — so a writer reads/edits their own piece in full,
// before and after scheduling. Fail-soft: an anonymous/erroring session (null
// user) sees nothing and the draft 404s.
async function canPreviewUnpublished(db: BlogPost): Promise<boolean> {
  const u = await safeCurrentUser();
  if (isAdmin(u)) return true;
  return isWriter(u) && db.authorId === u?.id;
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
    } else if ((db.status === 'approved' || db.status === 'draft') && (await canPreviewUnpublished(db))) {
      // Not yet live (scheduled, or still a draft) — previewable by an admin or
      // the writer who owns it, so they can read the whole piece before it's live.
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

  // Byline author (name + avatar) from Clerk — DB posts only (MDX posts have no
  // author_id). Helper is fail-soft, so a Clerk hiccup just drops the avatar.
  const author = db ? await resolveBlogAuthor(db.authorId, db.authorName) : { name: null, image: null };

  const postUrl = `${SITE_URL}/blog/${slug}`;

  return (
    <div className={PAGE_READ}>
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

      {/* Admin preview (draft/scheduled): DraftEditor owns the amber banner +
          header + article and swaps them for the in-place markdown editor via
          the pencil (spec 2026-07-03). The public/published path below is
          untouched. db is always set here — only DB posts have these states. */}
      {db && (draftPreview || scheduledAt) ? (
        <DraftEditor
          id={db.id}
          title={post.frontmatter.title}
          summary={post.frontmatter.summary}
          body={db.body}
          bodyHtml={bodyHtml ?? ''}
          dateLabel={formatDate(post.frontmatter.publishedAt)}
          banner={
            draftPreview
              ? { kind: 'draft' }
              : { kind: 'scheduled', label: formatDateTime(scheduledAt as string) }
          }
          author={author}
        />
      ) : (
        <>
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
        {author.name && (
          <div className="mt-3 flex items-center gap-2">
            {author.image && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={author.image}
                  alt={author.name}
                  width={28}
                  height={28}
                  loading="lazy"
                  className="h-7 w-7 rounded-full object-cover border border-border bg-surface"
                />
              </>
            )}
            <span className="text-sm font-medium text-text-muted">By {author.name}</span>
          </div>
        )}
        <p className="mt-4 text-base text-text-muted leading-relaxed">
          {post.frontmatter.summary}
        </p>
      </header>

      <article className={POST_ARTICLE_CLASS}>
        {bodyHtml !== null ? (
          <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
        ) : (
          <MDXRemote source={post.source} components={mdxComponents} />
        )}
      </article>
        </>
      )}
    </div>
  );
}
