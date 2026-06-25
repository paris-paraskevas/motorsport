import type { Metadata } from 'next';
import { after } from 'next/server';
import { Suspense, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
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
export const metadata: Metadata = { title: 'Friends', robots: { index: false, follow: false } };

// Dedicated friends page — reached from the Social hub's "Friends" card (operator
// 2026-06-25). Was a redirect to /social; promoted to its own page so friends,
// requests and the invite link get a real, shareable home. The friend-add flow
// keeps its own /social/friends/add/[id] route. Mirrors /social/leagues.
function frame(children: ReactNode) {
  return (
    <div className="mx-auto max-w-2xl lg:max-w-4xl p-4 pb-16 md:p-6 lg:p-8">
      <Link
        href="/social"
        className="mb-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted transition-colors hover:text-text"
      >
        <ArrowLeft size={14} /> Social
      </Link>
      <header className="mb-5 flex items-stretch gap-3">
        <span aria-hidden="true" className="w-1 shrink-0 bg-brand" />
        <h1 className="font-display text-3xl font-extrabold uppercase leading-none tracking-wide text-text md:text-4xl">
          Friends<span className="text-brand">.</span>
        </h1>
      </header>
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
        <p className="mb-3">Sign in to manage friends and requests.</p>
        <Link href="/sign-in" className="inline-block rounded bg-brand px-4 py-2 font-semibold text-bg">
          Sign in
        </Link>
      </div>,
    );
  }
  return frame(
    <Suspense fallback={<PanelSkeleton />}>
      <FriendsData userId={userId} />
    </Suspense>,
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
