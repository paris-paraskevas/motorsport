import type { Metadata } from 'next';
import Link from 'next/link';
import { isAdmin } from '@/lib/threads';
import { requireAuthor } from '@/lib/admin-guard';
import { isBettingConfigured } from '@/lib/betting/client';
import { listPosts, publishedPosts, type BlogPost } from '@/lib/blog';
import { RowActions } from '@/components/studio/RowActions';
import { STATUS_META, fmtWhen } from '@/components/studio/studio-shared';

export const metadata: Metadata = { title: 'Studio' };

// The studio dashboard: the whole pipeline on one page, newest first inside each
// stage. Admins see every writer's posts; a writer sees only their own (the same
// scoping GET /api/blog applies — the [id] API routes still authorize every
// action per-post, so this page is presentation, not the security boundary).

const LIVE_CAP = 12;

function fmtDay(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function Row({
  post,
  admin,
  meta,
}: {
  post: BlogPost;
  admin: boolean;
  meta?: string;
}) {
  const actionable = post.status === 'draft' || post.status === 'in_review' || post.status === 'approved';
  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Link
          href={actionable ? `/studio/${post.id}` : `/blog/${post.slug}`}
          className="font-semibold text-text transition-colors duration-(--duration-fast) hover:text-tint"
        >
          {post.title}
        </Link>
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-faint">
          {post.seriesSlug ?? 'site-wide'}
          {admin && post.authorName ? ` · ${post.authorName}` : ''}
          {meta ? ` · ${meta}` : ''}
        </span>
        {actionable && (
          <Link
            href={`/blog/${post.slug}`}
            className="ml-auto font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
          >
            Preview ↗
          </Link>
        )}
      </div>
      <p className="mt-1 text-sm text-text-muted">{post.summary}</p>
      {actionable && (
        <div className="mt-2.5">
          <RowActions
            id={post.id}
            status={post.status as 'draft' | 'in_review' | 'approved'}
            publishAt={post.publishAt}
            admin={admin}
          />
        </div>
      )}
    </li>
  );
}

function Section({
  status,
  count,
  children,
}: {
  status: keyof typeof STATUS_META;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  const meta = STATUS_META[status];
  return (
    <section className="mt-10 first:mt-0">
      <h2
        className={`mb-1 border-b border-border pb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] ${meta.cls}`}
      >
        {meta.label} · {count}
      </h2>
      <ul className="divide-y divide-border/60">{children}</ul>
    </section>
  );
}

export default async function StudioPage() {
  const user = await requireAuthor();
  const admin = isAdmin(user);
  const scope = admin ? undefined : user.id;

  if (!isBettingConfigured()) {
    return (
      <p className="font-mono text-sm text-text-muted">
        The post database is not configured in this environment.
      </p>
    );
  }

  const [drafts, inReview, scheduled, allLive] = await Promise.all([
    listPosts('draft', undefined, scope),
    listPosts('in_review', undefined, scope),
    listPosts('approved', undefined, scope),
    publishedPosts(),
  ]);
  const live = admin ? allLive : allLive.filter(p => p.authorId === user.id);
  const nothingInFlight = drafts.length === 0 && inReview.length === 0 && scheduled.length === 0;

  return (
    <>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-text-faint">
            Blog
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-text md:text-4xl">Studio</h1>
          <p className="mt-3 text-sm text-text-muted">
            {admin
              ? 'Every post in the pipeline: write, review, schedule.'
              : 'Your posts: write, submit, track.'}
          </p>
        </div>
        <Link
          href="/studio/new"
          className="bg-text px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-bg transition-colors duration-(--duration-fast) hover:bg-text-muted"
        >
          + New post
        </Link>
      </header>

      <div className="mb-10 flex flex-wrap gap-x-6 gap-y-1 border-y border-border py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-text-faint">
        <span>
          Drafts <span className="text-text">{drafts.length}</span>
        </span>
        <span>
          In review <span className="text-text">{inReview.length}</span>
        </span>
        <span>
          Scheduled <span className="text-text">{scheduled.length}</span>
        </span>
        <span>
          Live <span className="text-text">{live.length}</span>
        </span>
      </div>

      {nothingInFlight && (
        <p className="mb-10 text-sm text-text-muted">
          Nothing in progress.{' '}
          <Link href="/studio/new" className="font-medium text-tint hover:underline underline-offset-2">
            Start a new post
          </Link>{' '}
          and it saves as a private draft.
        </p>
      )}

      <Section status="in_review" count={inReview.length}>
        {inReview.map(p => (
          <Row key={p.id} post={p} admin={admin} />
        ))}
      </Section>
      <Section status="draft" count={drafts.length}>
        {drafts.map(p => (
          <Row key={p.id} post={p} admin={admin} />
        ))}
      </Section>
      <Section status="approved" count={scheduled.length}>
        {scheduled.map(p => (
          <Row key={p.id} post={p} admin={admin} meta={`publishes ${fmtWhen(p.publishAt)}`} />
        ))}
      </Section>
      <Section status="published" count={Math.min(live.length, LIVE_CAP)}>
        {live.slice(0, LIVE_CAP).map(p => (
          <Row key={p.id} post={p} admin={admin} meta={fmtDay(p.publishedAt)} />
        ))}
      </Section>
      {live.length > LIVE_CAP && (
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-text-faint">
          + {live.length - LIVE_CAP} more on{' '}
          <Link href="/blog" className="text-text-muted hover:text-text">
            /blog
          </Link>
        </p>
      )}
    </>
  );
}
