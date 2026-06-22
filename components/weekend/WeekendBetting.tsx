'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { MarketBetCard } from '@/components/betting/MarketBetCard';
import { ExactPositionBetCard } from '@/components/betting/ExactPositionBetCard';
import { MARKET_TYPE_META } from '@/lib/betting/constants';
import type { OpenMarket } from '@/lib/betting/markets';
import type { UserBet } from '@/lib/betting/bets';
import type { UserLeague } from '@/lib/betting/leagues';

// Betting embed for a FUTURE race-weekend page (F1 only at the call site). A
// self-contained client island so it never busts the page's ISR cache: it fetches
// the round's open markets from /api/bet/market and renders a bet card per market
// (winner/podium/top-10 in the flat card; exact-position in its own driver+position
// picker) when signed in, an odds teaser + sign-in CTA per market when signed out,
// or a "opens near qualifying" note. Renders nothing for past weekends or when
// betting isn't live.
interface MarketResponse {
  available: boolean;
  signedIn?: boolean;
  markets?: OpenMarket[];
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
  const fetchMarkets = useCallback(async (): Promise<MarketResponse> => {
    try {
      const res = await fetch(`/api/bet/market?series=${encodeURIComponent(seriesSlug)}&round=${round}`);
      return (await res.json()) as MarketResponse;
    } catch {
      return { available: false };
    }
  }, [seriesSlug, round]);

  const refresh = useCallback(() => {
    fetchMarkets().then(d => {
      setData(d);
      setLoaded(true);
    });
  }, [fetchMarkets]);

  useEffect(() => {
    if (isPast) return;
    let active = true;
    fetchMarkets().then(d => {
      if (!active) return;
      setData(d);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [isPast, fetchMarkets]);

  if (isPast) return null; // betting closes with the weekend
  if (!loaded || !data?.available) return null; // not loaded yet / betting not live in this env

  const markets = data.markets ?? [];

  return (
    <section className="mb-8 border-y border-border py-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text">
          Paddock Betting<span className="text-brand">.</span>
        </h2>
        {data.signedIn && (
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
            Balance{' '}
            <span className="font-display text-base font-extrabold tabular-nums text-brand">
              {(data.balance ?? 0).toLocaleString()}
            </span>
          </span>
        )}
      </div>

      {markets.length === 0 ? (
        <p className="font-mono text-xs text-text-muted">
          Markets open closer to the weekend — bet before qualifying, free Paddock credits, no cashout.
        </p>
      ) : data.signedIn ? (
        <div className="space-y-4">
          {markets.map(m => {
            const shared = {
              market: m,
              balance: data.balance ?? 0,
              bets: (data.bets ?? []).filter(b => b.marketId === m.id),
              leagues: data.leagues ?? [],
              onPlaced: refresh,
            };
            return m.type === 'exact_position' ? (
              <ExactPositionBetCard key={m.id} {...shared} />
            ) : (
              <MarketBetCard key={m.id} {...shared} />
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {markets.map(m => (
            <SignedOutTeaser key={m.id} market={m} />
          ))}
        </div>
      )}
    </section>
  );
}

function SignedOutTeaser({ market }: { market: OpenMarket }) {
  const meta = MARKET_TYPE_META[market.type] ?? MARKET_TYPE_META.winner;
  // exact-position odds are keyed `driver@position` — a flat top-6 list would be
  // gibberish, so its teaser is heading + CTA only.
  const preview =
    market.type === 'exact_position'
      ? []
      : Object.entries(market.odds)
          .sort((a, b) => a[1] - b[1])
          .slice(0, 6);
  return (
    <div className="space-y-3 rounded border border-border p-3">
      <div>
        <h3 className="font-display text-sm font-bold text-text">{meta.label}</h3>
        <p className="font-mono text-xs text-text-muted">Sign in to {meta.cta} with free Paddock credits — no cashout.</p>
      </div>
      {preview.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {preview.map(([name, mult]) => (
            <div
              key={name}
              className="flex items-center justify-between rounded border border-border px-3 py-2 text-sm text-text-muted"
            >
              <span className="truncate font-mono">{name}</span>
              <span className="font-display font-bold tabular-nums text-brand">×{mult}</span>
            </div>
          ))}
        </div>
      )}
      <Link href="/sign-in" className="inline-block rounded bg-brand px-4 py-1.5 font-semibold text-bg">
        Sign in to {meta.cta}
      </Link>
    </div>
  );
}
