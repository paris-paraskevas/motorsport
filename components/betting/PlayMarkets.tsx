'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { OpenMarket } from '@/lib/betting/markets';
import type { UserBet } from '@/lib/betting/bets';
import type { UserLeague } from '@/lib/betting/leagues';

// Betting surface: balance, a Solo/league context selector, open winner markets
// (pick a driver → stake → place), and your bets. The server component owns the
// data; placing a bet POSTs to /api/bet/place then router.refresh() re-reads it.
// Solo bets are fixed-odds (the market multiplier); league bets pool pari-mutuel.

export function PlayMarkets({
  balance,
  markets,
  bets,
  leagues,
}: {
  balance: number;
  markets: OpenMarket[];
  bets: UserBet[];
  leagues: UserLeague[];
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(markets[0]?.id ?? null);
  const [pick, setPick] = useState<string | null>(null);
  const [stake, setStake] = useState(50);
  const [context, setContext] = useState(''); // '' = solo vs house, else a league id
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function place(marketId: string) {
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
        body: JSON.stringify({ marketId, winner: pick, stake, leagueId: context || undefined }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not place bet.');
        return;
      }
      setPick(null);
      router.refresh();
    } catch {
      setError('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">Balance</span>
          <span className="font-display text-2xl font-extrabold tabular-nums text-brand">{balance.toLocaleString()}</span>
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">credits</span>
        </div>
        {leagues.length > 0 && (
          <label className="flex items-center gap-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">Betting as</span>
            <select
              value={context}
              onChange={e => setContext(e.target.value)}
              className="rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-sm text-text"
            >
              <option value="">Solo vs house</option>
              {leagues.map(l => (
                <option key={l.id} value={l.id}>
                  {l.name} (pool)
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <section>
        <h2 className="mb-3 font-display uppercase tracking-wide text-text">Open markets</h2>
        {markets.length === 0 ? (
          <p className="font-mono text-sm text-text-muted">No open markets right now — check back when a weekend is live.</p>
        ) : (
          <ul className="space-y-3">
            {markets.map(m => {
              const drivers = Object.entries(m.odds).sort((a, b) => a[1] - b[1]);
              const isOpen = openId === m.id;
              return (
                <li key={m.id} className="rounded border border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenId(isOpen ? null : m.id);
                      setPick(null);
                      setError(null);
                    }}
                    className="flex w-full items-center justify-between px-4 py-3 text-left"
                  >
                    <span className="font-display uppercase tracking-wide text-text">
                      {m.seriesSlug.toUpperCase()} · R{m.round} · {m.type}
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
                      locks {new Date(m.locksAt).toLocaleDateString()}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-white/10 px-4 pb-4 pt-3">
                      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {drivers.map(([name, mult]) => (
                          <button
                            type="button"
                            key={name}
                            onClick={() => setPick(name)}
                            className={`flex items-center justify-between rounded border px-3 py-2 text-sm ${
                              pick === name
                                ? 'border-brand bg-brand/10 text-text'
                                : 'border-white/10 text-text-muted hover:border-white/30'
                            }`}
                          >
                            <span className="font-mono">{name}</span>
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
                          className="w-24 rounded border border-white/10 bg-white/5 px-2 py-1.5 font-mono text-sm text-text"
                          aria-label="Stake"
                        />
                        <button
                          type="button"
                          onClick={() => place(m.id)}
                          disabled={busy || !pick || stake < 1 || stake > balance}
                          className="rounded bg-brand px-4 py-1.5 font-semibold text-bg disabled:opacity-40"
                        >
                          {busy ? 'Placing…' : pick ? `Bet ${stake} on ${pick}` : 'Pick a driver'}
                        </button>
                        {pick && (
                          <span className="font-mono text-[11px] text-text-muted">
                            {context
                              ? 'pari-mutuel — winners split the pool'
                              : `to win ${Math.floor(stake * (m.odds[pick] ?? 1)).toLocaleString()}`}
                          </span>
                        )}
                      </div>
                      {error && isOpen && <p className="mt-2 font-mono text-xs text-red-400">{error}</p>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display uppercase tracking-wide text-text">Your bets</h2>
        {bets.length === 0 ? (
          <p className="font-mono text-sm text-text-muted">No bets yet — pick a market above.</p>
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
