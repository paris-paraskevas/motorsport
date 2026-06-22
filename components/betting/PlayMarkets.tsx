import Link from 'next/link';
import type { OpenMarket } from '@/lib/betting/markets';
import type { UserBet } from '@/lib/betting/bets';

// Betting hub view (the /play page): balance, your bets, and a pointer to each
// open market's race-weekend page — where the bet is actually placed. The
// betting UI itself lives on the weekend pages (MarketBetCard); /play is the
// account/social hub. Leagues + win-rate leaderboard render below via
// <LeaguesPanel>. Pure render (no client state) — no 'use client' needed.
export function PlayMarkets({
  balance,
  markets,
  bets,
}: {
  balance: number;
  markets: OpenMarket[];
  bets: UserBet[];
}) {
  return (
    <div className="space-y-8">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">Balance</span>
        <span className="font-display text-2xl font-extrabold tabular-nums text-brand">{balance.toLocaleString()}</span>
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">credits</span>
      </div>

      <section>
        <h2 className="mb-3 font-display uppercase tracking-wide text-text">Open markets</h2>
        {markets.length === 0 ? (
          <p className="font-mono text-sm text-text-muted">No open markets — check back when a race weekend is coming up.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {markets.map(m => (
              <li key={m.id} className="flex items-center justify-between py-2">
                <span className="font-display uppercase tracking-wide text-text">
                  {m.seriesSlug.toUpperCase()} · R{m.round} · {m.type}
                </span>
                <Link
                  href={`/series/${m.seriesSlug}/weekend/${m.round}`}
                  className="font-mono text-[11px] uppercase tracking-[0.14em] text-brand hover:underline"
                >
                  Bet on the weekend page →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display uppercase tracking-wide text-text">Your bets</h2>
        {bets.length === 0 ? (
          <p className="font-mono text-sm text-text-muted">No bets yet — open a race weekend to back the winner.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {bets.map(b => {
              const sel = typeof b.selection.winner === 'string' ? b.selection.winner : JSON.stringify(b.selection);
              const tone =
                b.outcome === 'won'
                  ? 'text-emerald-400'
                  : b.outcome === 'pending'
                    ? 'text-brand'
                    : 'text-text-muted';
              return (
                <li key={b.id} className="flex items-center justify-between py-2 font-mono text-sm">
                  <span className="text-text">
                    {b.seriesSlug.toUpperCase()} R{b.round} · {sel}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="tabular-nums text-text-muted">{b.stake}</span>
                    <span className={`text-[11px] uppercase tracking-[0.14em] ${tone}`}>
                      {b.outcome}
                      {b.multiplier ? ` ×${b.multiplier}` : ''}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
