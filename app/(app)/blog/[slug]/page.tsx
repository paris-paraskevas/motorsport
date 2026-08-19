import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronLeft, ArrowRight } from 'lucide-react';
import { currentUser } from '@clerk/nextjs/server';
import { listPostSlugs, loadPost, loadAllPosts } from '@/lib/posts';
import { getPostBySlug, publishedPosts, type BlogPost } from '@/lib/blog';
import { getAuthorByClerkId } from '@/lib/authors';
import { resolveAuthorIdentity } from '@/lib/author-identity';
import { isAdmin, canAuthor } from '@/lib/threads';
import { renderPostBody, type RenderedBody } from '@/lib/blog-embeds';
import { DraftPreview } from '@/components/blog/DraftPreview';
import { PostArticle } from '@/components/blog/PostArticle';
import { POST_ARTICLE_CLASS, PostHeader, PostHero } from '@/components/blog/PostHeader';
import { JsonLd } from '@/components/JsonLd';
import { articleLd, breadcrumbLd } from '@/lib/json-ld';
import { SITE_URL } from '@/lib/site';
import type { Post } from '@/lib/types';
import { loadSeriesMeta } from '@/lib/series';
import type { TocItem } from '@/lib/toc';
import { BlogShare } from '@/components/blog/BlogShare';
import { BlogReactions } from '@/components/blog/BlogReactions';

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
      tags: p.tags,
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
      (db.status === 'approved' || db.status === 'draft' || db.status === 'in_review') &&
      (await canPreviewUnpublished(db));
    if (!previewable) notFound();
  }
  const post = db && db.status === 'published' ? dbToPost(db) : await loadPost(slug);
  if (!post && db) return { title: 'Draft preview' }; // admin preview metadata stays generic
  // Missing slugs get the same treatment as hidden posts above — notFound()
  // here, before the shell streams (the 0.160.0 lesson, applied to both paths).
  if (!post) notFound();
  // Blog posts carry article-specific openGraph fields (publishedTime) that the
  // shared withSocialMeta() helper doesn't model, so build the openGraph block
  // directly here. Re-set siteName + url since the per-page override fully
  // replaces the layout's openGraph block. og:image is NOT set here: the sibling
  // opengraph-image.tsx owns it (hero photo when set, branded card otherwise) —
  // file-based metadata overrides anything listed in this block anyway
  // (node_modules/next/dist/docs/…/generate-metadata.md, "File-based metadata
  // has the higher priority").
  return {
    title: post.frontmatter.title,
    description: post.frontmatter.summary,
    // An imported article canonicalizes to its ORIGINAL off-site URL, so the
    // import adds no indexable page of ours — the original keeps the equity.
    // Original writing sets no canonical here, exactly as before.
    ...(db?.status === 'published' && db.originalUrl
      ? { alternates: { canonical: db.originalUrl } }
      : {}),
    openGraph: {
      type: 'article',
      title: post.frontmatter.title,
      description: post.frontmatter.summary,
      siteName: 'Paddock Tracker',
      url: `${SITE_URL}/blog/${slug}`,
      publishedTime: post.frontmatter.publishedAt,
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
  return canAuthor(u) && db.authorId === u?.id;
}

interface RecentPost {
  slug: string;
  title: string;
  publishedAt: string;
}

// Sidebar "More from the blog" — merged DB + MDX posts, newest first, the
// current post excluded. Fail-soft: a Supabase/file hiccup just yields fewer
// (or no) items, never a 500 on the post route.
async function loadRecentPosts(excludeSlug: string, limit = 5): Promise<RecentPost[]> {
  const [dbPosts, mdxPosts] = await Promise.all([
    publishedPosts().catch(() => []),
    loadAllPosts().catch(() => []),
  ]);
  const bySlug = new Map<string, RecentPost>();
  for (const p of mdxPosts) {
    bySlug.set(p.slug, { slug: p.slug, title: p.frontmatter.title, publishedAt: p.frontmatter.publishedAt });
  }
  for (const p of dbPosts) {
    // DB wins on slug collision (matches the /blog list merge).
    bySlug.set(p.slug, { slug: p.slug, title: p.title, publishedAt: p.publishedAt ?? p.createdAt });
  }
  bySlug.delete(excludeSlug);
  return [...bySlug.values()]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, limit);
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let post: Post | null = null;
  let rendered: RenderedBody | null = null; // set for DB posts (rendered segments + ToC)
  // Preview banner for a not-yet-published post, or null on the public path.
  let previewBanner: { kind: 'draft' } | { kind: 'in_review' } | { kind: 'scheduled'; label: string } | null = null;

  const db = await getPostBySlug(slug);
  if (db) {
    if (db.status === 'published') {
      post = dbToPost(db);
      rendered = await renderPostBody(db.body);
    } else if (
      (db.status === 'approved' || db.status === 'draft' || db.status === 'in_review') &&
      (await canPreviewUnpublished(db))
    ) {
      // Not yet live (draft, submitted, or scheduled) — previewable by an admin or
      // the writer who owns it, so they can read the whole piece before it's live.
      // in_review included since 0.249.0: the review queue links here, and the gate
      // previously 404'd exactly the posts waiting on a decision.
      post = dbToPost(db);
      rendered = await renderPostBody(db.body);
      previewBanner =
        db.status === 'approved'
          ? { kind: 'scheduled', label: formatDateTime(db.publishAt ?? db.createdAt) }
          : { kind: db.status };
    } else {
      notFound(); // rejected / unpublished-but-not-yours → hidden; slug is taken
    }
  } else {
    post = await loadPost(slug); // legacy file-post fallback (content/posts is empty, test-pinned)
    if (!post) notFound();
    rendered = await renderPostBody(post.source ?? '');
  }
  if (!post) notFound();

  // Byline author — DB posts only (MDX posts have no author_id). The avatar comes
  // from Clerk (fail-soft: a hiccup just drops it). The profile row, when the writer
  // has one, supplies BOTH the name they chose in /settings/author and the link;
  // with no row the byline stays the Clerk name as plain text, exactly as before.
  const [identity, profile] = db
    ? await Promise.all([resolveAuthorIdentity(db.authorId, db.authorName), getAuthorByClerkId(db.authorId)])
    : [{ name: null, image: null }, null];
  const authorSlug = profile?.slug ?? null;
  const author = {
    name: profile?.displayName ?? identity.name,
    image: identity.image,
    href: authorSlug ? `/authors/${authorSlug}` : null,
  };

  const postUrl = `${SITE_URL}/blog/${slug}`;

  // Table of contents for the sidebar. DB posts carry rendered segments (ids
  // already injected across them, ToC accumulated in document order); MDX posts
  // derive the ToC from their markdown source (mdx-components adds matching ids).
  const toc: TocItem[] = rendered?.toc ?? [];

  const series = post.frontmatter.seriesSlug
    ? await loadSeriesMeta(post.frontmatter.seriesSlug).catch(() => null)
    : null;
  const recent = await loadRecentPosts(slug);

  return (
    <div className="max-w-2xl lg:max-w-6xl mx-auto p-4 md:p-6 lg:p-8 pb-16">
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', url: SITE_URL },
          { name: 'Blog', url: `${SITE_URL}/blog` },
          { name: post.frontmatter.title, url: postUrl },
        ])}
      />
      <JsonLd
        data={articleLd({
          post,
          url: postUrl,
          authorName: author.name,
          authorUrl: authorSlug ? `${SITE_URL}/authors/${authorSlug}` : null,
        })}
      />
      <Link
        href="/blog"
        className="inline-flex items-center gap-1 text-xs font-medium text-text-faint hover:text-text-muted transition-colors duration-(--duration-fast) mb-6"
      >
        <ChevronLeft size={14} />
        Back to blog
      </Link>

      {/* Unpublished preview (draft / in review / scheduled): DraftPreview owns
          the status rule + header + article, and links to /studio/[id] where all
          editing lives now. The public/published path below is untouched. db is
          always set here — only DB posts have these states. */}
      {db && previewBanner ? (
        <DraftPreview
          id={db.id}
          title={post.frontmatter.title}
          summary={post.frontmatter.summary}
          heroImage={db.heroImage}
          originalUrl={db.originalUrl}
          bodyNode={<PostArticle segments={rendered?.segments ?? []} />}
          dateLabel={formatDate(post.frontmatter.publishedAt)}
          banner={previewBanner}
          author={author}
        />
      ) : (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-12 lg:items-start">
          <div className="min-w-0 max-w-3xl">
      {/* PostHeader instead of a copy of its markup: the byline link has to be
          identical here and in DraftPreview, and this path had drifted
          into a byte-for-byte duplicate of the component it documents. */}
      <PostHeader
        dateLabel={formatDate(post.frontmatter.publishedAt)}
        tags={post.frontmatter.tags}
        title={post.frontmatter.title}
        summary={post.frontmatter.summary}
        author={author}
        originalUrl={db?.originalUrl}
      />

      {post.frontmatter.heroImage && (
        <PostHero src={post.frontmatter.heroImage} alt={post.frontmatter.title} />
      )}

      {/* Share bar above the body so readers can share before reading. */}
      <div className="mb-8">
        <BlogShare url={postUrl} title={post.frontmatter.title} slug={slug} />
      </div>

      <article className={POST_ARTICLE_CLASS}>
        <PostArticle segments={rendered?.segments ?? []} />
      </article>

      <BlogReactions slug={slug} />
          </div>

          <aside className="mt-10 lg:mt-0 lg:sticky lg:top-6 space-y-8">
            {toc.length >= 2 && (
              <nav aria-label="On this page" className="hidden lg:block">
                <h2 className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint">
                  On this page
                </h2>
                <ul className="space-y-1.5 border-l border-border">
                  {toc.map(item => (
                    <li key={item.id} className={item.level === 3 ? 'pl-7' : 'pl-3'}>
                      <a
                        href={`#${item.id}`}
                        className="block text-sm text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
                      >
                        {item.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}

            {recent.length > 0 && (
              <section className="border-t border-border pt-4">
                <h2 className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint">
                  More from the blog
                </h2>
                <ul className="space-y-3">
                  {recent.map(p => (
                    <li key={p.slug}>
                      <Link href={`/blog/${p.slug}`} className="group block">
                        <span className="block text-sm font-medium leading-snug text-text transition-colors duration-(--duration-fast) group-hover:text-tint">
                          {p.title}
                        </span>
                        <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.14em] tabular-nums text-text-faint">
                          {formatDate(p.publishedAt)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {series && (
              <section className="border-t border-border pt-4">
                <Link
                  href={`/series/${series.slug}`}
                  className="group inline-flex items-center gap-1.5 text-sm font-medium text-text transition-colors duration-(--duration-fast) hover:text-tint"
                >
                  <ArrowRight
                    size={14}
                    className="text-text-faint transition-all duration-(--duration-fast) group-hover:translate-x-0.5 group-hover:text-tint"
                  />
                  More on {series.name}
                </Link>
              </section>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
