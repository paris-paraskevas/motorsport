import type { Metadata } from 'next';
import { Suspense, type ReactNode } from 'react';
import Link from 'next/link';
import { after } from 'next/server';
import { Trophy, Users, BookOpen, MessagesSquare, ArrowUpRight } from 'lucide-react';
import { auth, currentUser } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';
import { ensureBettingUser } from '@/lib/betting/credits';
import { getOpenMarkets } from '@/lib/betting/markets';
import { getUserBets } from '@/lib/betting/bets';
import { setDisplayNameIfMissing, clerkDisplayName } from '@/lib/betting/friends';
import { PlayMarkets } from '@/components/betting/PlayMarkets';
import { PAGE_WIDE } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Social — predictions, leagues & threads',
  description:
    'Predict race results with free monthly virtual credits, build private leagues with friends, and join the fan threads on Paddock Tracker. No cash, just bragging rights.',
};

// The community hub (session-27 consolidation, GA4-grounded operator decision):
// /play folded in as the Predictions section below and /threads moved to
// /social/threads — both old routes 301 here (next.config.ts). Bets are still
// PLACED on race-weekend pages (MarketBetCard mounts there); this hub is the
// balance + open-markets + your-bets overview that used to be /play, over the
// launcher rows that were already here.
function frame(children: ReactNode) {
  return (
    <div className={PAGE_WIDE}>
      <header className="mb-5 flex items-stretch gap-3">
        <span aria-hidden="true" className="w-1 shrink-0 bg-brand-fill" />
        <h1 className="font-display text-3xl font-extrabold uppercase leading-none tracking-wide text-text md:text-4xl">
          Social<span className="text-brand">.</span>
        </h1>
      </header>
      {children}
    </div>
  );
}

const rowClass =
  'group flex items-center gap-3 border-b border-border py-4 transition-colors duration-(--duration-fast) hover:bg-surface';

function Row({ href, icon, eyebrow, title, desc }: {
  href: string;
  icon: ReactNode;
  eyebrow: string;
  title: string;
  desc: string;
}) {
  return (
    <Link href={href} className={rowClass}>
      <span className="shrink-0 text-text-muted">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-brand">
          {eyebrow}
        </span>
        <span className="block text-base font-semibold text-text">{title}</span>
        <span className="block text-xs text-text-faint">{desc}</span>
      </span>
      <ArrowUpRight size={16} className="shrink-0 text-text-faint group-hover:text-text-muted" />
    </Link>
  );
}

export default async function SocialPage() {
  if (!isBettingConfigured()) return frame(<p className="font-mono text-sm text-text-muted">Not live yet.</p>);
  const { userId } = await auth();
  const signedIn = Boolean(userId);
  return frame(
    <>
      {!signedIn && (
        <div className="mb-6 border-y border-border py-4">
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Free to play</div>
          <p className="mt-1 max-w-xl text-sm text-text-muted">
            Predict race results with free monthly virtual credits, build private leagues with friends, and
            climb the win-rate leaderboard. No cash, no catch — just bragging rights.
          </p>
          <Link
            href="/sign-in"
            className="mt-3 inline-flex items-center gap-2 rounded bg-brand-fill px-4 py-2 font-semibold text-bg transition-opacity duration-(--duration-fast) hover:opacity-90"
          >
            Sign in — it’s free
          </Link>
        </div>
      )}

      {signedIn && userId && (
        <div className="mb-8">
          <Suspense fallback={<PredictionsSkeleton />}>
            <Predictions userId={userId} />
          </Suspense>
        </div>
      )}

      <nav className="border-t border-border">
        <Row
          href={signedIn ? '/social/leagues' : '/sign-in'}
          icon={<Trophy size={18} />}
          eyebrow="Play with friends"
          title="Private leagues"
          desc="Create or join a league, share an invite link, climb the win-rate leaderboard."
        />
        <Row
          href={signedIn ? '/social/friends' : '/sign-in'}
          icon={<Users size={18} />}
          eyebrow="Friends"
          title="Your racers"
          desc="Add friends, accept requests and share your invite link."
        />
        <Row
          href="/social/threads"
          icon={<MessagesSquare size={18} />}
          eyebrow="Discuss"
          title="Threads"
          desc="Fan discussion, lightly moderated — start one or join in."
        />
        <Row
          href="/blog"
          icon={<BookOpen size={18} />}
          eyebrow="Read"
          title="Blog"
          desc="Analysis, recaps and championship deep-dives."
        />
      </nav>
    </>,
  );
}

// The old /play body verbatim: one parallel wave of betting reads, name backfill
// off the critical path, PlayMarkets as the overview (bets are placed on the
// race-weekend pages it links to).
async function Predictions({ userId }: { userId: string }) {
  const [balance, markets, bets] = await Promise.all([
    ensureBettingUser(userId),
    getOpenMarkets(),
    getUserBets(userId),
  ]);
  after(async () => {
    try {
      await setDisplayNameIfMissing(userId, clerkDisplayName(await currentUser()));
    } catch {
      /* best-effort */
    }
  });
  return <PlayMarkets balance={balance} markets={markets} bets={bets} />;
}

function PredictionsSkeleton() {
  return (
    <div className="space-y-8" aria-hidden="true">
      <div className="h-24 animate-pulse rounded-lg border border-border bg-surface/40" />
      <div className="h-40 animate-pulse rounded-lg border border-border bg-surface/40" />
    </div>
  );
}
