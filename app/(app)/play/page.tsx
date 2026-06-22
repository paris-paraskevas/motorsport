import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';
import { ensureBettingUser } from '@/lib/betting/credits';
import { getOpenMarkets } from '@/lib/betting/markets';
import { getUserBets } from '@/lib/betting/bets';
import { getUserLeagues, getLeaderboard } from '@/lib/betting/leagues';
import { PlayMarkets } from '@/components/betting/PlayMarkets';
import { LeaguesPanel } from '@/components/betting/LeaguesPanel';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Play',
  robots: { index: false, follow: false },
};

function frame(children: ReactNode) {
  return (
    <div className="max-w-2xl lg:max-w-4xl mx-auto p-4 md:p-6 lg:p-8 pb-16">
      <header className="mb-5 flex items-stretch gap-3">
        <span aria-hidden="true" className="w-1 shrink-0 bg-brand" />
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-extrabold uppercase tracking-wide leading-none text-text">
            Play<span className="text-brand">.</span>
          </h1>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
            Paddock credits · bet the grid · ranked by win-rate, never cashout
          </p>
        </div>
      </header>
      {children}
    </div>
  );
}

export default async function PlayPage() {
  // Dormant until provisioned: never touch the DB when the betting env is absent
  // (the whole feature is inert in prod until SUPABASE_URL/KEY are set).
  if (!isBettingConfigured()) {
    return frame(
      <p className="font-mono text-sm text-text-muted">
        Paddock Betting is coming soon — virtual credits, multiplied returns, friend leagues. No cashout. Not yet live.
      </p>,
    );
  }

  const { userId } = await auth();
  if (!userId) {
    return frame(
      <div className="font-mono text-sm text-text-muted">
        <p className="mb-3">Sign in to claim your monthly credits and bet the grid.</p>
        <Link href="/sign-in" className="inline-block rounded bg-brand px-4 py-2 font-semibold text-bg">
          Sign in
        </Link>
      </div>,
    );
  }

  const balance = await ensureBettingUser(userId);
  const [markets, bets, leagues] = await Promise.all([
    getOpenMarkets(),
    getUserBets(userId),
    getUserLeagues(userId),
  ]);
  const leaderboards = await Promise.all(
    leagues.map(async league => ({ league, rows: await getLeaderboard(league.id, 0) })),
  );

  return frame(
    <div className="space-y-8">
      <PlayMarkets balance={balance} markets={markets} bets={bets} leagues={leagues} />
      <LeaguesPanel leagues={leaderboards} currentUserId={userId} />
    </div>,
  );
}
