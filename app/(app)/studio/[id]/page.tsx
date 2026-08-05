import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hasDonated, isAdmin } from '@/lib/threads';
import { requireAuthor } from '@/lib/admin-guard';
import { isBettingConfigured } from '@/lib/betting/client';
import { getPostById } from '@/lib/blog';
import { StudioEditor } from '@/components/studio/StudioEditor';
import { STATUS_META } from '@/components/studio/studio-shared';

export const metadata: Metadata = { title: 'Edit post' };

// One post's editor page. Ownership is the boundary: an admin opens any post, a
// writer only their own — everyone else (and any unknown id) 404s identically,
// so the URL leaks nothing. Published and rejected posts are immutable (the
// PATCH API refuses them), so they render a status card instead of the editor.
export default async function StudioPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuthor();
  const admin = isAdmin(user);

  const post = isBettingConfigured() ? await getPostById(id) : null;
  if (!post) notFound();
  if (!admin && post.authorId !== user.id) notFound();

  const back = (
    <Link
      href="/studio"
      className="mb-6 inline-block font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
    >
      ← Studio
    </Link>
  );

  if (post.status === 'published' || post.status === 'rejected') {
    const meta = STATUS_META[post.status];
    return (
      <>
        {back}
        <div className={`mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] ${meta.cls}`}>
          {meta.label}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-text">{post.title}</h1>
        <p className="mt-3 max-w-prose text-sm text-text-muted">
          {post.status === 'published'
            ? 'This post is live and can no longer be edited here.'
            : 'This post was rejected and is closed. Start a new draft to rework it.'}
        </p>
        {post.status === 'published' && (
          <Link
            href={`/blog/${post.slug}`}
            className="mt-4 inline-block font-mono text-[11px] uppercase tracking-[0.14em] text-tint hover:underline underline-offset-2"
          >
            View the live post →
          </Link>
        )}
      </>
    );
  }

  return (
    <>
      {back}
      <StudioEditor
        post={{
          id: post.id,
          slug: post.slug,
          title: post.title,
          summary: post.summary,
          body: post.body,
          heroImage: post.heroImage,
          seriesSlug: post.seriesSlug,
          tags: post.tags,
          originalUrl: post.originalUrl,
          status: post.status,
          publishAt: post.publishAt,
        }}
        admin={admin}
        aiTools={admin || hasDonated(user)}
      />
    </>
  );
}
