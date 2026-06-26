import { Suspense, type ReactNode } from 'react';
import type { Metadata } from 'next';
import { after } from 'next/server';
import Link from 'next/link';
import { auth, currentUser } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';
import { ensureBettingUser } from '@/lib/betting/credits';
import { setDisplayNameIfMissing, clerkDisplayName } from '@/lib/betting/friends';
import { getLeagueDetail } from '@/lib/betting/leagues';
import { LeagueDetailView } from '@/components/betting/LeagueDetailView';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'League', robots: { index: false, follow: false } };

function frame(children: ReactNode) {
  return <div className="mx-auto max-w-2xl p-4 pb-16 md:p-6 lg:p-8">{children}</div>;
}

export default async function LeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isBettingConfigured()) {
    return frame(<p className="font-mono text-sm text-text-muted">Betting isn&apos;t live yet.</p>);
  }
  const { userId } = await auth();
  if (!userId) {
    return frame(
      <div className="font-mono text-sm text-text-muted">
        <p className="mb-3">Sign in to view this league.</p>
        <Link href="/sign-in" className="text-brand">
          Sign in →
        </Link>
      </div>,
    );
  }
  // Shell (the back link) paints immediately; the league detail streams in.
  return frame(
    <>
      <Link
        href="/social/leagues"
        className="mb-4 inline-block font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted hover:text-text"
      >
        ← Leagues
      </Link>
      <Suspense fallback={<LeagueSkeleton />}>
        <LeagueData id={id} userId={userId} />
      </Suspense>
    </>,
  );
}

// Onboarding + detail in one parallel wave; getLeagueDetail's reads don't need
// the app_user row, so they race ensureBettingUser safely. The name backfill —
// and its slow currentUser() Clerk hop — is deferred to after() so it never
// blocks the league render (mirrors /social + the feedback route).
async function LeagueData({ id, userId }: { id: string; userId: string }) {
  const [, league] = await Promise.all([
    ensureBettingUser(userId),
    getLeagueDetail(id, userId),
  ]);
  after(async () => {
    try {
      await setDisplayNameIfMissing(userId, clerkDisplayName(await currentUser()));
    } catch {
      /* best-effort */
    }
  });
  if (!league || !league.isMember) {
    return (
      <p className="font-mono text-sm text-text-muted">
        You&apos;re not a member of this league — leagues are invite-only.
      </p>
    );
  }
  return <LeagueDetailView league={league} currentUserId={userId} />;
}

function LeagueSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="h-8 w-2/3 animate-pulse rounded bg-white/5" />
      <div className="h-16 animate-pulse rounded-lg border border-white/10 bg-white/5" />
      <div className="h-16 animate-pulse rounded-lg border border-white/10 bg-white/5" />
      <div className="h-16 animate-pulse rounded-lg border border-white/10 bg-white/5" />
    </div>
  );
}
