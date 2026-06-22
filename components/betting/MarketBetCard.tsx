'use client';

import { useState } from 'react';
import { STANDARD_STAKE } from '@/lib/betting/constants';
import type { OpenMarket } from '@/lib/betting/markets';
import type { UserBet } from '@/lib/betting/bets';
import type { UserLeague } from '@/lib/betting/leagues';

// The bet interaction for ONE winner market: balance, an optional Solo/league
// context selector, driver picks (odds), a stake, and your existing bets on this
// market. Solo = fixed-odds (the shown multiplier); a league = pari-mutuel pool.
// POSTs to /api/bet/place, then calls onPlaced() so the host re-fetches.
export function MarketBetCard({
  market,
  balance,
  bets,
  leagues,
  onPlaced,
}: {
  market: OpenMarket;
  balance: number;
  bets: UserBet[];
  leagues: UserLeague[];
  onPlaced: () => void;
}) {
  const [pick, setPick] = useState<string | null>(null);
  const [stake, setStake] = useState(STANDARD_STAKE);
  const [context, setContext] = useState(''); // '' = solo vs house, else a league id
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const drivers = Object.entries(market.odds).sort((a, b) => a[1] - b[1]);

  async function place() {
    if (!pick) {
      setError('Pick a driver first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/bet/place', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ marketId: market.id, winner: pick, stake, leagueId: context || undefined }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not place bet.');
        return;
      }
      setPick(null);
      onPlaced();
    } catch {
      setError('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">Balance</span>
        <span className="font-display text-xl font-extrabold tabular-nums text-brand">{balance.toLocaleString()}</span>
        {leagues.length > 0 && (
          <select
            value={context}
            onChange={e => setContext(e.target.value)}
            className="rounded border border-border bg-surface px-2 py-1 font-mono text-sm text-text"
            aria-label="Bet context"
          >
            <option value="">Solo vs house</option>
            {leagues.map(l => (
              <option key={l.id} value={l.id}>
                {l.name} (pool)
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {drivers.map(([name, mult]) => (
          <button
            type="button"
            key={name}
            onClick={() => setPick(name)}
            className={`flex items-center justify-between rounded border px-3 py-2 text-sm ${
              pick === name
                ? 'border-brand bg-brand/10 text-text'
                : 'border-border text-text-muted hover:border-text-faint'
            }`}
          >
            <span className="truncate font-mono">{name}</span>
            <span className="font-display font-bold tabular-nums text-brand">×{mult}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          min={1}
          max={balance}
          value={stake}
          onChange={e => setStake(Math.max(1, Math.floor(Number(e.target.value) || 0)))}
          className="w-24 rounded border border-border bg-surface px-2 py-1.5 font-mono text-sm text-text"
          aria-label="Stake"
        />
        <button
          type="button"
          onClick={place}
          disabled={busy || !pick || stake < 1 || stake > balance}
          className="rounded bg-brand px-4 py-1.5 font-semibold text-bg disabled:opacity-40"
        >
          {busy ? 'Placing…' : pick ? `Bet ${stake} on ${pick}` : 'Pick a driver'}
        </button>
        {pick && (
          <span className="font-mono text-[11px] text-text-muted">
            {context
              ? 'pari-mutuel — winners split the pool'
              : `to win ${Math.floor(stake * (market.odds[pick] ?? 1)).toLocaleString()}`}
          </span>
        )}
      </div>
      {error && <p className="font-mono text-xs text-red-400">{error}</p>}

      {bets.length > 0 && (
        <ul className="divide-y divide-border border-t border-border pt-1">
          {bets.map(b => {
            const sel = typeof b.selection.winner === 'string' ? b.selection.winner : JSON.stringify(b.selection);
            const tone =
              b.outcome === 'won' ? 'text-emerald-400' : b.outcome === 'pending' ? 'text-brand' : 'text-text-muted';
            return (
              <li key={b.id} className="flex items-center justify-between py-1.5 font-mono text-sm">
                <span className="text-text">Your bet · {sel} · {b.stake}</span>
                <span className={`text-[11px] uppercase tracking-[0.14em] ${tone}`}>
                  {b.outcome}
                  {b.multiplier ? ` ×${b.multiplier}` : ''}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
