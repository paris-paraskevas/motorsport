import type { Metadata } from 'next';
import { type ReactNode } from 'react';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Social — predictions, leagues & friends',
  description:
    'Predict race results with free monthly virtual credits, build private leagues with friends, and climb the win-rate leaderboard on Paddock Tracker. No cash, just bragging rights.',
};

// Social hub: a launcher of cards — play (solo → /play, with-friends → /social/leagues),
// Friends (→ /social/friends, its own page since 2026-06-25), and a community row
// (blog + threads). Each card opens a dedicated page; no per-user data loads here.
function frame(children: ReactNode) {
  return (
    <div className="mx-auto max-w-2xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl p-4 pb-16 md:p-6 lg:p-8">
      <header className="mb-5 flex items-stretch gap-3">
        <span aria-hidden="true" className="w-1 shrink-0 bg-brand" />
        <h1 className="font-display text-3xl font-extrabold uppercase leading-none tracking-wide text-text md:text-4xl">
          Social<span className="text-brand">.</span>
        </h1>
      </header>
      {children}
    </div>
  );
}

const cardClass =
  'rounded-2xl border border-border bg-surface/60 p-5 transition-colors duration-(--duration-fast) hover:border-brand/50';

export default async function SocialPage() {
  if (!isBettingConfigured()) return frame(<p className="font-mono text-sm text-text-muted">Not live yet.</p>);
  const { userId } = await auth();
  const signedIn = Boolean(userId);
  // Teaser landing: a guest sees the same marketing cards (a public, indexable
  // preview of what Social offers) with the play/friends actions routing to
  // sign-in; a signed-in user gets the live destinations. Blog + Threads are
  // public either way.
  return frame(
    <div className="space-y-8">
      {!signedIn && (
        <div className="rounded-2xl border border-brand/40 bg-surface/60 p-5">
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Free to play</div>
          <p className="mt-1 max-w-xl text-sm text-text-muted">
            Predict race results with free monthly virtual credits, build private leagues with friends, and
            climb the win-rate leaderboard. No cash, no catch — just bragging rights.
          </p>
          <Link
            href="/sign-in"
            className="mt-3 inline-flex items-center gap-2 rounded bg-brand px-4 py-2 font-semibold text-bg transition-opacity duration-(--duration-fast) hover:opacity-90"
          >
            Sign in — it’s free
          </Link>
        </div>
      )}

      {/* Play + people — solo, leagues, and your friends. Guests route to sign-in. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link href={signedIn ? '/play' : '/sign-in'} className={cardClass}>
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Play solo</div>
          <div className="mt-1 font-semibold text-text">Back the grid</div>
          <p className="mt-1 text-sm text-text-muted">
            Spend your monthly virtual credits predicting race results, solo against the house.
          </p>
        </Link>
        <Link href={signedIn ? '/social/leagues' : '/sign-in'} className={cardClass}>
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Play with friends</div>
          <div className="mt-1 font-semibold text-text">Private leagues</div>
          <p className="mt-1 text-sm text-text-muted">
            Create or join a league, share an invite link, climb the win-rate leaderboard.
          </p>
        </Link>
        <Link href={signedIn ? '/social/friends' : '/sign-in'} className={cardClass}>
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Friends</div>
          <div className="mt-1 font-semibold text-text">Your racers</div>
          <p className="mt-1 text-sm text-text-muted">
            Add friends, accept requests and share your invite link.
          </p>
        </Link>
      </div>

      {/* Community — blog + threads (public either way) */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/blog" className={cardClass}>
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Read</div>
          <div className="mt-1 font-semibold text-text">Blog</div>
          <p className="mt-1 text-sm text-text-muted">Analysis, recaps and championship deep-dives.</p>
        </Link>
        <Link href="/threads" className={cardClass}>
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Discuss</div>
          <div className="mt-1 font-semibold text-text">Threads</div>
          <p className="mt-1 text-sm text-text-muted">Fan discussion, lightly moderated — start one or join in.</p>
        </Link>
      </div>
    </div>,
  );
}
