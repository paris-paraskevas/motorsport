import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { auth, currentUser } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';
import { canAuthor } from '@/lib/threads';
import { getAuthorByClerkId } from '@/lib/authors';
import { authorPostVisibility } from '@/lib/blog';
import { slugify } from '@/lib/slug';
import { AuthorProfileForm } from '@/components/author/AuthorProfileForm';
import { PAGE_READ } from '@/lib/site';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Author profile',
  robots: { index: false, follow: false },
};

// Where a writer creates and edits their own public /authors/<slug> page. Sits in
// the /settings family (theme, notifications, series) because it is account
// configuration, not an admin surface. 404 for non-writers rather than 403: this
// URL should not confirm the existence of a writing role to a reader who guesses it.
export default async function AuthorProfileSettingsPage() {
  const { userId } = await auth();
  const user = await currentUser();
  if (!userId || !isBettingConfigured() || !canAuthor(user)) notFound();

  const [profile, posts] = await Promise.all([getAuthorByClerkId(userId), authorPostVisibility(userId)]);

  // First-time prefill from the Clerk account. slugify strips everything outside
  // [a-z0-9], so a non-Latin name yields "" — that is left blank deliberately
  // rather than guessed at, since the slug is a permanent public URL.
  const clerkName =
    user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || user?.username || '';

  return (
    <div className={PAGE_READ}>
      <Link
        href="/settings"
        className="mb-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
      >
        <ArrowLeft size={13} /> Account
      </Link>
      <header className="mb-5 flex items-stretch gap-3">
        <span aria-hidden="true" className="w-1 shrink-0 bg-brand-fill" />
        <div>
          <h1 className="font-display text-3xl font-extrabold uppercase leading-none tracking-wide text-text md:text-4xl">
            Author profile<span className="text-brand">.</span>
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            {profile ? (
              <>
                Your public page is at{' '}
                <Link
                  href={`/authors/${profile.slug}`}
                  className="text-text underline decoration-border underline-offset-4 hover:text-brand"
                >
                  /authors/{profile.slug}
                </Link>
                .
              </>
            ) : (
              'Set this up and your byline starts linking to a public page listing everything you have written.'
            )}
          </p>
        </div>
      </header>

      <AuthorProfileForm
        initial={
          profile
            ? { slug: profile.slug, displayName: profile.displayName, bio: profile.bio, links: profile.links }
            : null
        }
        posts={posts}
        suggestedName={clerkName}
        suggestedSlug={slugify(clerkName)}
      />
    </div>
  );
}
