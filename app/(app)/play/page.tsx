import type { Metadata } from 'next';
import { Suspense, type ReactNode } from 'react';
import Link from 'next/link';
import { auth, currentUser } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';
import { ensureBettingUser } from '@/lib/betting/credits';
import { getOpenMarkets } from '@/lib/betting/markets';
import { getUserBets } from '@/lib/betting/bets';
import { PlayMarkets } from '@/components/betting/PlayMarkets';
import { setDisplayNameIfMissing, clerkDisplayName } from '@/lib/betting/friends';

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

  // The shell paints immediately; the per-user panels stream in. This page is
  // inherently dynamic (per-user + auth-gated) so it can't be CDN/ISR-cached —
  // the win is not blocking first paint on the auth + Supabase round-trips.
  return frame(
    <Suspense fallback={<PlaySkeleton />}>
      <PlayData userId={userId} />
    </Suspense>,
  );
}

// Betting reads in one parallel wave. Friends + leagues moved to /social — Play
// is the betting hub now, with quick links across to the Social area.
async function PlayData({ userId }: { userId: string }) {
  const [balance, markets, bets, user] = await Promise.all([
    ensureBettingUser(userId),
    getOpenMarkets(),
    getUserBets(userId),
    currentUser(),
  ]);
  await setDisplayNameIfMissing(userId, clerkDisplayName(user));

  return (
    <div className="space-y-8">
      <PlayMarkets balance={balance} markets={markets} bets={bets} />
      <section className="grid gap-3 sm:grid-cols-2">
        <Link href="/social/leagues" className="rounded-lg border border-white/10 p-3 hover:border-text-faint">
          <span className="font-display uppercase tracking-wide text-text">Leagues →</span>
          <p className="mt-0.5 font-mono text-xs text-text-muted">Your leagues, invites, win-rate tables + honours.</p>
        </Link>
        <Link href="/social/friends" className="rounded-lg border border-white/10 p-3 hover:border-text-faint">
          <span className="font-display uppercase tracking-wide text-text">Friends →</span>
          <p className="mt-0.5 font-mono text-xs text-text-muted">Requests + who you&apos;re racing against.</p>
        </Link>
      </section>
    </div>
  );
}

function PlaySkeleton() {
  return (
    <div className="space-y-8" aria-hidden="true">
      <div className="h-24 animate-pulse rounded-lg border border-white/10 bg-white/5" />
      <div className="h-40 animate-pulse rounded-lg border border-white/10 bg-white/5" />
    </div>
  );
}
