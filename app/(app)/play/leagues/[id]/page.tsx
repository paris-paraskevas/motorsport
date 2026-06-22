import type { ReactNode } from 'react';
import type { Metadata } from 'next';
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
  const dn = clerkDisplayName(await currentUser());
  await ensureBettingUser(userId);
  await setDisplayNameIfMissing(userId, dn);

  const league = await getLeagueDetail(id, userId);
  if (!league || !league.isMember) {
    return frame(
      <div className="font-mono text-sm text-text-muted">
        <p className="mb-3">You&apos;re not a member of this league — leagues are invite-only.</p>
        <Link href="/play" className="text-brand">
          Back to Play →
        </Link>
      </div>,
    );
  }

  return frame(
    <>
      <Link
        href="/play"
        className="mb-4 inline-block font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted hover:text-text"
      >
        ← Play
      </Link>
      <LeagueDetailView league={league} currentUserId={userId} />
    </>,
  );
}
