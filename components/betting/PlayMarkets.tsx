import Link from 'next/link';
import type { OpenMarket } from '@/lib/betting/markets';
import type { UserBet } from '@/lib/betting/bets';
import { MARKET_TYPE_META, formatBetSelection } from '@/lib/betting/constants';
import { Accordion } from '@/components/Accordion';

// Betting hub view (the /play page): balance, your bets, and a pointer to each
// open race weekend's page — where the bet is actually placed (MarketBetCard).
// Open markets are grouped per race weekend into one collapsible "Round N" bar
// that expands to show all of that weekend's markets (winner / podium / top-10).
export function PlayMarkets({
  balance,
  markets,
  bets,
}: {
  balance: number;
  markets: OpenMarket[];
  bets: UserBet[];
}) {
  // Group open markets by race weekend (series + round). `markets` arrives
  // soonest-locking first, so the groups (and the bars) stay in that order.
  const rounds = new Map<string, OpenMarket[]>();
  for (const m of markets) {
    const key = `${m.seriesSlug}#${m.round}`;
    const arr = rounds.get(key);
    if (arr) arr.push(m);
    else rounds.set(key, [m]);
  }
  const roundGroups = [...rounds.values()];

  return (
    <div className="space-y-8">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">Balance</span>
        <span className="font-display text-2xl font-extrabold tabular-nums text-brand">{balance.toLocaleString()}</span>
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">credits</span>
      </div>

      <section>
        <h2 className="mb-3 font-display uppercase tracking-wide text-text">Open markets</h2>
        {roundGroups.length === 0 ? (
          <p className="font-mono text-sm text-text-muted">
            No open markets — check back when a race weekend is coming up.
          </p>
        ) : (
          <div className="border-t border-border">
            {roundGroups.map(group => {
              const { seriesSlug, round } = group[0];
              return (
                <Accordion
                  key={`${seriesSlug}#${round}`}
                  title={`${seriesSlug.toUpperCase()} · Round ${round}`}
                  count={`${group.length} ${group.length === 1 ? 'market' : 'markets'}`}
                  defaultOpen={false}
                >
                  <ul className="divide-y divide-white/10">
                    {group.map(m => (
                      <li key={m.id} className="flex items-center justify-between py-2">
                        <span className="font-mono text-sm text-text">
                          {MARKET_TYPE_META[m.type]?.label ?? m.type}
                        </span>
                        <span className="font-mono text-[11px] text-text-muted">
                          {Object.keys(m.odds).length} runners
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={`/series/${seriesSlug}/weekend/${round}?tab=bets`}
                    className="mt-3 inline-block font-mono text-[11px] uppercase tracking-[0.14em] text-brand hover:underline"
                  >
                    Bet on the weekend page →
                  </Link>
                </Accordion>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display uppercase tracking-wide text-text">Your bets</h2>
        {bets.length === 0 ? (
          <p className="font-mono text-sm text-text-muted">No bets yet — open a race weekend to back the winner.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {bets.map(b => {
              const sel = formatBetSelection(b.type, b.selection);
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
