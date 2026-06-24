'use client';

import { useState } from 'react';
import { STANDARD_STAKE, MARKET_TYPE_META, parseExactPositionOdds } from '@/lib/betting/constants';
import { forecastMultiplier } from '@/lib/betting/pricing';
import type { OpenMarket } from '@/lib/betting/markets';
import type { UserBet } from '@/lib/betting/bets';
import type { UserLeague } from '@/lib/betting/leagues';

interface Leg {
  driver: string;
  position: number;
}

// Build a forecast: ≥2 driver→position legs, all-or-nothing. Reuses the
// exact-position per-pair odds; the combined price is the clamped product of the
// picked legs (forecastMultiplier). A driver / position already used in another
// leg is disabled. POSTs { legs } to /api/bet/place.
export function ForecastBetCard({
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
  const [legs, setLegs] = useState<Leg[]>([
    { driver: '', position: 0 },
    { driver: '', position: 0 },
  ]);
  const [stake, setStake] = useState(STANDARD_STAKE);
  const [context, setContext] = useState(''); // '' = solo vs house, else a league id
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = MARKET_TYPE_META.forecast;
  const complete = legs.filter(l => l.driver && l.position > 0);
  const usedDrivers = new Set(legs.map(l => l.driver).filter(Boolean));
  const usedPositions = new Set(legs.map(l => l.position).filter(p => p > 0));
  const mult = forecastMultiplier(market.odds, complete);
  const valid = complete.length >= 2 && mult > 0;

  const setLeg = (i: number, patch: Partial<Leg>) => setLegs(ls => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLeg = () => setLegs(ls => [...ls, { driver: '', position: 0 }]);
  const removeLeg = (i: number) => setLegs(ls => (ls.length > 2 ? ls.filter((_, idx) => idx !== i) : ls));

  async function place() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/bet/place', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ marketId: market.id, legs: complete, stake, leagueId: context || undefined }),
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

      <div className="space-y-2">
        {legs.map((leg, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <select
              value={leg.driver}
              onChange={e => setLeg(i, { driver: e.target.value })}
              className="rounded border border-border bg-surface px-2 py-1.5 font-mono text-sm text-text"
              aria-label={`Driver ${i + 1}`}
            >
              <option value="">Driver…</option>
              {drivers.map(d => (
                <option key={d} value={d} disabled={leg.driver !== d && usedDrivers.has(d)}>
                  {d}
                </option>
              ))}
            </select>
            <span className="font-mono text-xs text-text-muted">→</span>
            <select
              value={leg.position}
              onChange={e => setLeg(i, { position: Number(e.target.value) })}
              className="rounded border border-border bg-surface px-2 py-1.5 font-mono text-sm text-text"
              aria-label={`Finishing position ${i + 1}`}
            >
              <option value={0}>Pos…</option>
              {positions.map(p => (
                <option key={p} value={p} disabled={leg.position !== p && usedPositions.has(p)}>
                  P{p}
                </option>
              ))}
            </select>
            {legs.length > 2 && (
              <button
                type="button"
                onClick={() => removeLeg(i)}
                aria-label={`Remove leg ${i + 1}`}
                className="font-mono text-xs text-text-faint hover:text-red-400"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addLeg}
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted hover:text-text"
        >
          + Add another
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {mult > 0 && <span className="font-display font-bold tabular-nums text-brand">×{mult}</span>}
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
          disabled={busy || !valid || stake < 1 || stake > balance}
          className="rounded bg-brand px-4 py-1.5 font-semibold text-bg disabled:opacity-40"
        >
          {busy ? 'Placing…' : valid ? `Bet ${stake}` : 'Pick 2+ legs'}
        </button>
        {valid && (
          <span className="font-mono text-[11px] text-text-muted">
            {context ? 'pari-mutuel — winners split the pool' : `to win ${Math.floor(stake * mult).toLocaleString()}`}
          </span>
        )}
      </div>
      {error && <p className="font-mono text-xs text-red-400">{error}</p>}

      {bets.length > 0 && (
        <ul className="divide-y divide-border border-t border-border pt-1">
          {bets.map(b => {
            const ls = Array.isArray((b.selection as { legs?: unknown }).legs)
              ? (b.selection as { legs: Leg[] }).legs
              : [];
            const label = ls.map(l => `${l.driver} P${l.position}`).join(', ') || '?';
            const tone =
              b.outcome === 'won' ? 'text-emerald-400' : b.outcome === 'pending' ? 'text-brand' : 'text-text-muted';
            return (
              <li key={b.id} className="flex items-center justify-between gap-2 py-1.5 font-mono text-sm">
                <span className="min-w-0 truncate text-text">Your bet · {label} · {b.stake}</span>
                <span className={`shrink-0 text-[11px] uppercase tracking-[0.14em] ${tone}`}>
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
