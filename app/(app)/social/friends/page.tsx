import type { Metadata } from 'next';
import { Suspense, type ReactNode } from 'react';
import Link from 'next/link';
import { auth, currentUser } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';
import { ensureBettingUser } from '@/lib/betting/credits';
import { listFriends, listIncomingRequests, setDisplayNameIfMissing, clerkDisplayName } from '@/lib/betting/friends';
import { FriendsPanel } from '@/components/betting/FriendsPanel';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Friends', robots: { index: false, follow: false } };

// Shell (header + Friends|Leagues sub-nav) paints immediately; the data streams.
function frame(children: ReactNode) {
  return (
    <div className="mx-auto max-w-2xl lg:max-w-4xl p-4 pb-16 md:p-6 lg:p-8">
      <header className="mb-4 flex items-stretch gap-3">
        <span aria-hidden="true" className="w-1 shrink-0 bg-brand" />
        <div>
          <h1 className="font-display text-3xl font-extrabold uppercase leading-none tracking-wide text-text md:text-4xl">
            Social<span className="text-brand">.</span>
          </h1>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
            Friends · leagues · bragging rights
          </p>
        </div>
      </header>
      <nav className="mb-5 flex gap-5 border-b border-white/10 font-mono text-[11px] uppercase tracking-[0.16em]">
        <Link href="/social/friends" className="-mb-px border-b-2 border-brand pb-2 text-text">
          Friends
        </Link>
        <Link href="/social/leagues" className="-mb-px border-b-2 border-transparent pb-2 text-text-muted hover:text-text">
          Leagues
        </Link>
      </nav>
      {children}
    </div>
  );
}

export default async function FriendsPage() {
  if (!isBettingConfigured()) return frame(<p className="font-mono text-sm text-text-muted">Not live yet.</p>);
  const { userId } = await auth();
  if (!userId) {
    return frame(
      <div className="font-mono text-sm text-text-muted">
        <p className="mb-3">Sign in to manage your friends.</p>
        <Link href="/sign-in" className="inline-block rounded bg-brand px-4 py-2 font-semibold text-bg">
          Sign in
        </Link>
      </div>,
    );
  }
  return frame(
    <Suspense fallback={<FriendsSkeleton />}>
      <FriendsData userId={userId} />
    </Suspense>,
  );
}

async function FriendsData({ userId }: { userId: string }) {
  const [, friends, incoming, user] = await Promise.all([
    ensureBettingUser(userId),
    listFriends(userId),
    listIncomingRequests(userId),
    currentUser(),
  ]);
  await setDisplayNameIfMissing(userId, clerkDisplayName(user));
  return <FriendsPanel friends={friends} incoming={incoming} />;
}

function FriendsSkeleton() {
  return <div className="h-40 animate-pulse rounded-lg border border-white/10 bg-white/5" aria-hidden="true" />;
}
