import type { Metadata } from 'next';
import { after } from 'next/server';
import { Suspense, type ReactNode } from 'react';
import Link from 'next/link';
import { auth, currentUser } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';
import { ensureBettingUser } from '@/lib/betting/credits';
import { getUserLeagues, getLeaderboardsForLeagues } from '@/lib/betting/leagues';
import {
  listFriends,
  listIncomingRequests,
  listOutgoingRequests,
  setDisplayNameIfMissing,
  clerkDisplayName,
} from '@/lib/betting/friends';
import { FriendsPanel } from '@/components/betting/FriendsPanel';
import { LeaguesPanel } from '@/components/betting/LeaguesPanel';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Social', robots: { index: false, follow: false } };

// Friends + leagues side by side (operator: two columns, friends left, leagues
// right) on one page — no sub-nav, no subheader. Each column streams behind its
// own Suspense boundary. League detail/join + friend-add keep their own routes;
// the old /social/friends + /social/leagues list pages redirect here.
function frame(children: ReactNode) {
  return (
    <div className="mx-auto max-w-2xl lg:max-w-6xl p-4 pb-16 md:p-6 lg:p-8">
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
    <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
      <Suspense fallback={<PanelSkeleton />}>
        <FriendsData userId={userId} />
      </Suspense>
      <Suspense fallback={<PanelSkeleton />}>
        <LeaguesData userId={userId} />
      </Suspense>
    </div>,
  );
}

async function FriendsData({ userId }: { userId: string }) {
  // Onboard here (idempotent); the leagues column only reads memberships and
  // doesn't need it, so we keep ensureBettingUser to a single call per request.
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

async function LeaguesData({ userId }: { userId: string }) {
  const leagues = await getUserLeagues(userId);
  const boards = await getLeaderboardsForLeagues(leagues.map(l => l.id), 0);
  const leaderboards = leagues.map(league => ({ league, rows: boards.get(league.id) ?? [] }));
  return <LeaguesPanel leagues={leaderboards} currentUserId={userId} />;
}

function PanelSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="h-24 animate-pulse rounded-lg border border-white/10 bg-white/5" />
      <div className="h-32 animate-pulse rounded-lg border border-white/10 bg-white/5" />
    </div>
  );
}
