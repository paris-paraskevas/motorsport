import Link from 'next/link';
import path from 'path';
import type { OpenMarket } from '@/lib/betting/markets';
import type { UserBet } from '@/lib/betting/bets';
import type { LeaderboardRow } from '@/lib/betting/leagues';
import {
  MARKET_TYPE_META,
  MARKET_TYPE_ORDER,
  formatBetSelection,
  PER_WEEKEND_CREDITS,
  BASE_CREDITS,
  BETTABLE_SERIES,
} from '@/lib/betting/constants';
import { loadRounds } from '@/lib/rounds-loader';
import { LocalTime } from '@/components/LocalTime';

// The predictions surface (design handoff §4.13, panel 10c): leads with what
// people bet ON — the soonest-locking round's market cards and when they lock —
// not with what a bet is; open calls beneath, the league rail ranked on WIN
// RATE (not credit pile, so a latecomer stays competitive), and the house
// rules in plain type at the foot. Every number comes from
// lib/betting/constants.ts. Bets are still PLACED on the race-weekend pages.
//
// The mock's "table resets on the 1st" is NOT rendered: league wins/placed are
// all-time in league_member — never claim a reset the system doesn't do.
export async function PlayMarkets({
  markets,
  bets,
  league,
  leagueRows,
  youId,
}: {
  markets: OpenMarket[];
  bets: UserBet[];
  league: { name: string } | null;
  leagueRows: LeaderboardRow[];
  youId: string;
}) {
  // Group open markets by race weekend (series + round), soonest-locking first
  // (the feed arrives in that order). The first group is the OPEN NOW panel.
  const rounds = new Map<string, OpenMarket[]>();
  for (const m of markets) {
    const key = `${m.seriesSlug}#${m.round}`;
    const arr = rounds.get(key);
    if (arr) arr.push(m);
    else rounds.set(key, [m]);
  }
  const roundGroups = [...rounds.values()];
  const lead = roundGroups[0] ?? null;
  const alsoOpen = roundGroups.slice(1);

  // Name the lead round from curated rounds.json where it has one.
  let leadName: string | null = null;
  if (lead) {
    const { seriesSlug, round } = lead[0];
    const curated = await loadRounds(path.join(process.cwd(), 'content', 'series', seriesSlug)).catch(() => null);
    leadName = curated?.rounds.find(r => r.round === round)?.name ?? `${seriesSlug.toUpperCase()} · Round ${round}`;
  }
  const leadLock = lead
    ? lead.map(m => new Date(m.locksAt).getTime()).sort((a, b) => a - b)[0]
    : null;
  const leadOrdered = lead
    ? [...lead].sort(
        (a, b) => MARKET_TYPE_ORDER.indexOf(a.type) - MARKET_TYPE_ORDER.indexOf(b.type),
      )
    : [];

  const openCalls = bets.filter(b => b.outcome === 'pending');
  const settled = bets.filter(b => b.outcome !== 'pending');

  return (
    <div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          {/* OPEN NOW — the window you must not miss. */}
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-text pb-1">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-brand">
              Open now{leadName ? ` · ${leadName}` : ''}
            </span>
            {leadLock != null && (
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
                Locks <LocalTime instant={leadLock} />
              </span>
            )}
          </div>
          {lead ? (
            <>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {leadOrdered.map(m => {
                  const meta = MARKET_TYPE_META[m.type];
                  return (
                    <Link
                      key={m.id}
                      href={`/series/${m.seriesSlug}/weekend/${m.round}?tab=bets`}
                      data-heatmap-id={`predictions:market:${m.type}`}
                      className="block border border-border-strong p-3 transition-colors duration-(--duration-fast) hover:border-text hover:bg-surface"
                    >
                      <span className="block font-serif text-[17px] font-semibold leading-tight text-text">
                        {meta?.label ?? m.type}
                      </span>
                      <span className="mt-1 block text-xs leading-snug text-text-muted">
                        {meta?.blurb ?? ''}
                      </span>
                    </Link>
                  );
                })}
              </div>
              {alsoOpen.length > 0 && (
                <p className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
                  <span>Also open</span>
                  {alsoOpen.map(g => (
                    <Link
                      key={`${g[0].seriesSlug}#${g[0].round}`}
                      href={`/series/${g[0].seriesSlug}/weekend/${g[0].round}?tab=bets`}
                      className="text-text-muted hover:text-text transition-colors duration-(--duration-fast)"
                    >
                      {g[0].seriesSlug.toUpperCase()} · Round {g[0].round} →
                    </Link>
                  ))}
                </p>
              )}
            </>
          ) : (
            <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
              No open markets — they open as a race weekend approaches.
            </p>
          )}

          {/* YOUR OPEN CALLS — live positions, then the settled ledger. */}
          <div className="mt-8 border-b border-text pb-1">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
              Your open calls
            </span>
          </div>
          {openCalls.length === 0 ? (
            <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-text-faint">
              None open — back a call on a race weekend page before it locks.
            </p>
          ) : (
            <ul>
              {openCalls.map(b => (
                <li key={b.id} className="flex items-baseline gap-3 border-b border-border py-2">
                  <span aria-hidden="true" className="h-3 w-[3px] shrink-0 self-center bg-brand" />
                  <span className="min-w-0 flex-1 truncate font-serif text-[16px] font-semibold text-text">
                    {formatBetSelection(b.type, b.selection)} — {b.seriesSlug.toUpperCase()} R{b.round}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-text-muted">
                    {b.stake} staked
                  </span>
                </li>
              ))}
            </ul>
          )}
          {settled.length > 0 && (
            <details className="group mt-3">
              <summary className="cursor-pointer select-none font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">Settled · {settled.length} →</span>
                <span className="hidden group-open:inline">Settled · {settled.length}</span>
              </summary>
              <ul>
                {settled.map(b => {
                  const tone =
                    b.outcome === 'won' ? 'text-brand' : 'text-text-faint';
                  return (
                    <li key={b.id} className="flex items-baseline gap-3 border-b border-border py-1.5 font-mono text-[12px]">
                      <span className="min-w-0 flex-1 truncate text-text-muted">
                        {formatBetSelection(b.type, b.selection)} — {b.seriesSlug.toUpperCase()} R{b.round}
                      </span>
                      <span className="shrink-0 tabular-nums text-text-faint">{b.stake}</span>
                      <span className={`w-20 shrink-0 text-right text-[10px] uppercase tracking-[0.14em] ${tone}`}>
                        {b.outcome}
                        {b.multiplier ? ` ×${b.multiplier}` : ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </details>
          )}
        </div>

        {/* YOUR LEAGUE — ranked on win rate, not winnings. */}
        <aside>
          <div className="border-b border-text pb-1">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
              {league ? `Your league · ${league.name}` : 'Your league'}
            </span>
          </div>
          {league && leagueRows.length > 0 ? (
            <>
              <ul>
                {leagueRows.slice(0, 6).map((row, i) => {
                  const you = row.userId === youId;
                  return (
                    <li key={row.userId} className="flex items-baseline gap-3 border-b border-border py-1.5">
                      <span className="w-4 shrink-0 text-right font-mono text-[11px] tabular-nums text-text-faint">
                        {i + 1}
                      </span>
                      <span className={`min-w-0 flex-1 truncate font-serif text-[15px] ${you ? 'font-bold' : 'font-semibold'} text-text`}>
                        {you ? 'You' : row.nickname ?? row.displayName ?? 'Racer'}
                      </span>
                      <span className={`shrink-0 font-mono text-[12px] tabular-nums ${you ? 'font-bold text-text' : 'text-text-muted'}`}>
                        {Math.round(row.winRate * 100)}%
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.14em] text-text-faint">
                Win rate, not winnings
              </p>
              <Link
                href="/social/friends"
                className="mt-2 inline-block font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-brand hover:text-text transition-colors duration-(--duration-fast)"
              >
                Invite a friend →
              </Link>
            </>
          ) : (
            <div className="mt-2">
              <p className="text-sm leading-snug text-text-muted">
                No league yet — make one, share the invite link, and the
                win-rate table starts itself.
              </p>
              <Link
                href="/social/leagues"
                className="mt-2 inline-block font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-brand hover:text-text transition-colors duration-(--duration-fast)"
              >
                Start a league →
              </Link>
            </div>
          )}
        </aside>
      </div>

      {/* HOUSE RULES — plain type, every number from constants.ts. */}
      <p className="mt-8 border-t border-text pt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
        House rules · {PER_WEEKEND_CREDITS} credits a weekend · {BASE_CREDITS} floor in empty months ·{' '}
        {BETTABLE_SERIES.map(s => s.toUpperCase()).join(' and ')} only · No money in, none out
      </p>
    </div>
  );
}
