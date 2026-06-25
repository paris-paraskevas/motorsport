import type { Metadata } from 'next';
import { type ReactNode } from 'react';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Social', robots: { index: false, follow: false } };

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
  if (!userId) {
    return frame(
      <div className="font-mono text-sm text-text-muted">
        <p className="mb-3">Sign in to manage friends and leagues.</p>
        <Link href="/sign-in" className="inline-block rounded bg-brand px-4 py-2 font-semibold text-bg">
          Sign in
        </Link>
      </div>,
    );
  }
  return frame(
    <div className="space-y-8">
      {/* Play + people — solo, leagues, and your friends (each opens its own page) */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/play" className={cardClass}>
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Play solo</div>
          <div className="mt-1 font-semibold text-text">Back the grid</div>
          <p className="mt-1 text-sm text-text-muted">
            Spend your monthly virtual credits predicting race results, solo against the house.
          </p>
        </Link>
        <Link href="/social/leagues" className={cardClass}>
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Play with friends</div>
          <div className="mt-1 font-semibold text-text">Private leagues</div>
          <p className="mt-1 text-sm text-text-muted">
            Create or join a league, share an invite link, climb the win-rate leaderboard.
          </p>
        </Link>
        <Link href="/social/friends" className={cardClass}>
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Friends</div>
          <div className="mt-1 font-semibold text-text">Your racers</div>
          <p className="mt-1 text-sm text-text-muted">
            Add friends, accept requests and share your invite link.
          </p>
        </Link>
      </div>

      {/* Community — blog + threads */}
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
