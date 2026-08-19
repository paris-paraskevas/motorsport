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
import { getUserLeagues, getLeaderboard } from '@/lib/betting/leagues';
import { setDisplayNameIfMissing, clerkDisplayName } from '@/lib/betting/friends';
import { PlayMarkets } from '@/components/betting/PlayMarkets';
import { PER_WEEKEND_CREDITS } from '@/lib/betting/constants';
import { PAGE_WIDE } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Social — predictions, leagues & threads',
  description:
    'Predict race results with free monthly virtual credits, build private leagues with friends, and join the fan threads on Paddock Tracker. No cash, just bragging rights.',
};

// The community hub, restyled per panel 10c (reimagining job ⑧): a serif
// Predictions masthead with the balance in mono at its right, the OPEN NOW
// market cards + open calls + the win-rate league rail (PlayMarkets), the
// house rules in plain type, and the launcher rows beneath. Bets are still
// PLACED on race-weekend pages; this is the overview.
function frame(children: ReactNode, balance?: ReactNode) {
  return (
    <div className={PAGE_WIDE}>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-b border-border pb-5">
        <div className="min-w-0">
          <h1 className="font-serif text-[38px] font-medium leading-none tracking-[-0.02em] text-text md:text-[46px]">
            Predictions
          </h1>
          <p className="mt-2 max-w-[52ch] font-serif text-[16px] leading-snug text-text-muted">
            Call the race before the grid does. Virtual credits only — nothing
            to buy, nothing to cash out.
          </p>
        </div>
        {balance}
      </header>
      {children}
    </div>
  );
}

// Panel 10c: the balance in mono, big, with the allowance stated under it.
async function BalanceBlock({ userId }: { userId: string }) {
  const balance = await ensureBettingUser(userId);
  return (
    <div className="text-right">
      <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
        Your balance
      </div>
      <div className="font-mono text-[36px] font-bold leading-none tabular-nums text-text">
        {balance.toLocaleString()}
      </div>
      <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-text-faint">
        +{PER_WEEKEND_CREDITS} per race weekend
      </div>
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
        <span className="block font-serif text-[17px] font-semibold text-text">{title}</span>
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
        <div className="mb-6 border-b border-border pb-5">
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Free to play</div>
          <p className="mt-1 max-w-xl text-sm text-text-muted">
            Predict race results with free monthly virtual credits, build private leagues with friends, and
            climb the win-rate leaderboard. No cash, no catch — just bragging rights.
          </p>
          <Link
            href="/sign-in"
            className="mt-3 inline-flex min-h-11 items-center bg-text px-5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-bg transition-colors duration-(--duration-fast) hover:bg-text-muted"
          >
            Sign in — it&rsquo;s free
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
    signedIn && userId ? (
      <Suspense fallback={null}>
        <BalanceBlock userId={userId} />
      </Suspense>
    ) : undefined,
  );
}

// One parallel wave of betting reads; name backfill off the critical path.
// The league rail rides the same wave: first league + its win-rate table.
async function Predictions({ userId }: { userId: string }) {
  const [markets, bets, leagues] = await Promise.all([
    getOpenMarkets(),
    getUserBets(userId),
    getUserLeagues(userId).catch(() => []),
  ]);
  const firstLeague = leagues[0] ?? null;
  const leagueRows = firstLeague ? await getLeaderboard(firstLeague.id).catch(() => []) : [];
  after(async () => {
    try {
      await setDisplayNameIfMissing(userId, clerkDisplayName(await currentUser()));
    } catch {
      /* best-effort */
    }
  });
  return (
    <PlayMarkets
      markets={markets}
      bets={bets}
      league={firstLeague ? { name: firstLeague.name } : null}
      leagueRows={leagueRows}
      youId={userId}
    />
  );
}

function PredictionsSkeleton() {
  return (
    <div className="space-y-8" aria-hidden="true">
      <div className="h-24 animate-pulse border border-border bg-surface/40" />
      <div className="h-40 animate-pulse border border-border bg-surface/40" />
    </div>
  );
}
