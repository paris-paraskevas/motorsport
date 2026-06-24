import type { Metadata } from 'next';
import { Suspense, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { auth } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';
import { ensureBettingUser } from '@/lib/betting/credits';
import { getUserLeagues, getLeaderboardsForLeagues } from '@/lib/betting/leagues';
import { LeaguesPanel } from '@/components/betting/LeaguesPanel';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Leagues', robots: { index: false, follow: false } };

// Dedicated leagues page — reached from the Social hub's "Play with friends" card.
// (Was a redirect to /social; promoted to its own page on operator feedback so the
// card opens a real page, not an in-page anchor.) League detail (/social/leagues/[id])
// + join (/social/leagues/join/[token]) keep their own routes.
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
          Leagues<span className="text-brand">.</span>
        </h1>
      </header>
      {children}
    </div>
  );
}

export default async function LeaguesPage() {
  if (!isBettingConfigured()) return frame(<p className="font-mono text-sm text-text-muted">Not live yet.</p>);
  const { userId } = await auth();
  if (!userId) {
    return frame(
      <div className="font-mono text-sm text-text-muted">
        <p className="mb-3">Sign in to create or join a league.</p>
        <Link href="/sign-in" className="inline-block rounded bg-brand px-4 py-2 font-semibold text-bg">
          Sign in
        </Link>
      </div>,
    );
  }
  return frame(
    <Suspense fallback={<LeaguesSkeleton />}>
      <LeaguesData userId={userId} />
    </Suspense>,
  );
}

async function LeaguesData({ userId }: { userId: string }) {
  await ensureBettingUser(userId);
  const leagues = await getUserLeagues(userId);
  const boards = await getLeaderboardsForLeagues(leagues.map(l => l.id), 0);
  const leaderboards = leagues.map(league => ({ league, rows: boards.get(league.id) ?? [] }));
  return <LeaguesPanel leagues={leaderboards} currentUserId={userId} />;
}

function LeaguesSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="h-24 animate-pulse rounded-lg border border-white/10 bg-white/5" />
      <div className="h-32 animate-pulse rounded-lg border border-white/10 bg-white/5" />
    </div>
  );
}
