'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { MarketBetCard } from '@/components/betting/MarketBetCard';
import type { OpenMarket } from '@/lib/betting/markets';
import type { UserBet } from '@/lib/betting/bets';
import type { UserLeague } from '@/lib/betting/leagues';

// Betting embed for a FUTURE race-weekend page (F1 only at the call site). A
// self-contained client island so it never busts the page's ISR cache: it fetches
// the round's open market from /api/bet/market and renders the bet card (signed
// in), an odds teaser + sign-in CTA (signed out), or a "opens near qualifying"
// note. Renders nothing for past weekends or when betting isn't live.
interface MarketResponse {
  available: boolean;
  signedIn?: boolean;
  market?: OpenMarket | null;
  balance?: number;
  bets?: UserBet[];
  leagues?: UserLeague[];
}

export function WeekendBetting({
  seriesSlug,
  round,
  isPast,
}: {
  seriesSlug: string;
  round: number;
  isPast: boolean;
}) {
  const [data, setData] = useState<MarketResponse | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Fetch only — returns the payload, never sets state, so the effect body stays
  // setState-free; the .then callbacks below own the updates (the recommended
  // "set state when the external fetch resolves" pattern).
  const fetchMarket = useCallback(async (): Promise<MarketResponse> => {
    try {
      const res = await fetch(`/api/bet/market?series=${encodeURIComponent(seriesSlug)}&round=${round}`);
      return (await res.json()) as MarketResponse;
    } catch {
      return { available: false };
    }
  }, [seriesSlug, round]);

  const refresh = useCallback(() => {
    fetchMarket().then(d => {
      setData(d);
      setLoaded(true);
    });
  }, [fetchMarket]);

  useEffect(() => {
    if (isPast) return;
    let active = true;
    fetchMarket().then(d => {
      if (!active) return;
      setData(d);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [isPast, fetchMarket]);

  if (isPast) return null; // betting closes with the weekend
  if (!loaded || !data?.available) return null; // not loaded yet / betting not live in this env

  const market = data.market ?? null;

  return (
    <section className="mb-8 border-y border-border py-4">
      <h2 className="mb-3 font-display text-sm font-extrabold uppercase tracking-wide text-text">
        Paddock Betting<span className="text-brand">.</span>
      </h2>
      {!market ? (
        <p className="font-mono text-xs text-text-muted">
          The winner market opens closer to the weekend — bet before qualifying, free Paddock credits, no cashout.
        </p>
      ) : data.signedIn ? (
        <MarketBetCard
          market={market}
          balance={data.balance ?? 0}
          bets={data.bets ?? []}
          leagues={data.leagues ?? []}
          onPlaced={refresh}
        />
      ) : (
        <SignedOutTeaser market={market} />
      )}
    </section>
  );
}

function SignedOutTeaser({ market }: { market: OpenMarket }) {
  const drivers = Object.entries(market.odds)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 6);
  return (
    <div className="space-y-3">
      <p className="font-mono text-xs text-text-muted">Back the race winner with free Paddock credits — no cashout.</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {drivers.map(([name, mult]) => (
          <div
            key={name}
            className="flex items-center justify-between rounded border border-border px-3 py-2 text-sm text-text-muted"
          >
            <span className="truncate font-mono">{name}</span>
            <span className="font-display font-bold tabular-nums text-brand">×{mult}</span>
          </div>
        ))}
      </div>
      <Link href="/sign-in" className="inline-block rounded bg-brand px-4 py-1.5 font-semibold text-bg">
        Sign in to back the winner
      </Link>
    </div>
  );
}
