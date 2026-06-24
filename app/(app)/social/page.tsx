import type { Metadata } from 'next';
import { after } from 'next/server';
import { Suspense, type ReactNode } from 'react';
import Link from 'next/link';
import { auth, currentUser } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';
import { ensureBettingUser } from '@/lib/betting/credits';
import {
  listFriends,
  listIncomingRequests,
  listOutgoingRequests,
  setDisplayNameIfMissing,
  clerkDisplayName,
} from '@/lib/betting/friends';
import { FriendsPanel } from '@/components/betting/FriendsPanel';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Social', robots: { index: false, follow: false } };

// Social hub: a play launcher (solo → /play, with-friends → /social/leagues), the
// friends panel, and a community row (blog + threads). Leagues live on their own
// page (/social/leagues); friend-add + league detail/join keep their own routes.
// No 3xl wide cap here — the hub's content is light, so it stays a comfortable width.
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
      {/* How do you want to play — solo vs with friends (each opens its own page) */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/play"
          className="rounded-2xl border border-border bg-surface/60 p-5 transition-colors duration-(--duration-fast) hover:border-brand/50"
        >
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Play solo</div>
          <div className="mt-1 font-semibold text-text">Back the grid</div>
          <p className="mt-1 text-sm text-text-muted">
            Spend your monthly virtual credits predicting race results, solo against the house.
          </p>
        </Link>
        <Link
          href="/social/leagues"
          className="rounded-2xl border border-border bg-surface/60 p-5 transition-colors duration-(--duration-fast) hover:border-brand/50"
        >
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Play with friends</div>
          <div className="mt-1 font-semibold text-text">Private leagues</div>
          <p className="mt-1 text-sm text-text-muted">
            Create or join a league, share an invite link, climb the win-rate leaderboard.
          </p>
        </Link>
      </div>

      {/* Friends (leagues live on their own page now — the launcher links there) */}
      <Suspense fallback={<PanelSkeleton />}>
        <FriendsData userId={userId} />
      </Suspense>

      {/* Community — blog + threads */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/blog"
          className="rounded-2xl border border-border bg-surface/60 p-5 transition-colors duration-(--duration-fast) hover:border-brand/50"
        >
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Read</div>
          <div className="mt-1 font-semibold text-text">Blog</div>
          <p className="mt-1 text-sm text-text-muted">Analysis, recaps and championship deep-dives.</p>
        </Link>
        <Link
          href="/threads"
          className="rounded-2xl border border-border bg-surface/60 p-5 transition-colors duration-(--duration-fast) hover:border-brand/50"
        >
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Discuss</div>
          <div className="mt-1 font-semibold text-text">Threads</div>
          <p className="mt-1 text-sm text-text-muted">Fan discussion, lightly moderated — start one or join in.</p>
        </Link>
      </div>
    </div>,
  );
}

async function FriendsData({ userId }: { userId: string }) {
  const [, friends, incoming, outgoing] = await Promise.all([
    ensureBettingUser(userId),
    listFriends(userId),
    listIncomingRequests(userId),
    listOutgoingRequests(userId),
  ]);
  // Name backfill off the critical path — currentUser() (Clerk backend) can fail
  // on a fresh sign-in handshake and must never block the page (see the join page).
  after(async () => {
    try {
      await setDisplayNameIfMissing(userId, clerkDisplayName(await currentUser()));
    } catch {
      /* best-effort */
    }
  });
  return <FriendsPanel friends={friends} incoming={incoming} outgoing={outgoing} myUserId={userId} />;
}

function PanelSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="h-24 animate-pulse rounded-lg border border-white/10 bg-white/5" />
      <div className="h-32 animate-pulse rounded-lg border border-white/10 bg-white/5" />
    </div>
  );
}
