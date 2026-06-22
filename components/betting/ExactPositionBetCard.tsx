'use client';

import { useState } from 'react';
import { STANDARD_STAKE, MARKET_TYPE_META, parseExactPositionOdds } from '@/lib/betting/constants';
import type { OpenMarket } from '@/lib/betting/markets';
import type { UserBet } from '@/lib/betting/bets';
import type { UserLeague } from '@/lib/betting/leagues';

// Bet interaction for an EXACT-POSITION market: pick a driver AND their exact
// finishing position. The odds map is keyed `driver@position`, so this is two
// selects + the live multiplier for the chosen pair. POSTs
// { marketId, pick: driver, position } — the server keys it as {driver, position}.
export function ExactPositionBetCard({
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
  const { drivers, positions } = parseExactPositionOdds(market.odds);
  const [driver, setDriver] = useState(drivers[0] ?? '');
  const [position, setPosition] = useState(positions[0] ?? 1);
  const [stake, setStake] = useState(STANDARD_STAKE);
  const [context, setContext] = useState(''); // '' = solo vs house, else a league id
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = MARKET_TYPE_META.exact_position;
  const mult = market.odds[`${driver}@${position}`];

  async function place() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/bet/place', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ marketId: market.id, pick: driver, position, stake, leagueId: context || undefined }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not place bet.');
        return;
      }
      onPlaced();
    } catch {
      setError('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded border border-border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div>
          <h3 className="font-display text-sm font-bold text-text">{meta.label}</h3>
          <p className="font-mono text-[11px] text-text-muted">{meta.blurb}</p>
        </div>
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

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={driver}
          onChange={e => setDriver(e.target.value)}
          className="rounded border border-border bg-surface px-2 py-1.5 font-mono text-sm text-text"
          aria-label="Driver"
        >
          {drivers.map(d => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <span className="font-mono text-xs text-text-muted">to finish</span>
        <select
          value={position}
          onChange={e => setPosition(Number(e.target.value))}
          className="rounded border border-border bg-surface px-2 py-1.5 font-mono text-sm text-text"
          aria-label="Finishing position"
        >
          {positions.map(p => (
            <option key={p} value={p}>
              P{p}
            </option>
          ))}
        </select>
        {mult != null && <span className="font-display font-bold tabular-nums text-brand">×{mult}</span>}
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
          disabled={busy || !driver || mult == null || stake < 1 || stake > balance}
          className="rounded bg-brand px-4 py-1.5 font-semibold text-bg disabled:opacity-40"
        >
          {busy ? 'Placing…' : `Bet ${stake} on ${driver} P${position}`}
        </button>
        {mult != null && (
          <span className="font-mono text-[11px] text-text-muted">
            {context
              ? 'pari-mutuel — winners split the pool'
              : `to win ${Math.floor(stake * mult).toLocaleString()}`}
          </span>
        )}
      </div>
      {error && <p className="font-mono text-xs text-red-400">{error}</p>}

      {bets.length > 0 && (
        <ul className="divide-y divide-border border-t border-border pt-1">
          {bets.map(b => {
            const d = typeof b.selection.driver === 'string' ? b.selection.driver : '?';
            const tone =
              b.outcome === 'won' ? 'text-emerald-400' : b.outcome === 'pending' ? 'text-brand' : 'text-text-muted';
            return (
              <li key={b.id} className="flex items-center justify-between py-1.5 font-mono text-sm">
                <span className="text-text">Your bet · {d} P{String(b.selection.position)} · {b.stake}</span>
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
