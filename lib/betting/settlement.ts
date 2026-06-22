import { betDb } from './client';
import { settlePool, type PoolBet } from './pari-mutuel';

// Server-only. Settle one (market, league) peer pool: load the league's bets,
// compute the pari-mutuel split in TS (pure, tested), apply atomically in SQL.
// Provisional-is-final — call this with the OFFICIAL classification; it settles
// once (the SQL refuses to re-settle a pool).

interface BetRow {
  id: string;
  user_id: string;
  selection_json: Record<string, unknown> | null;
  stake: number;
  outcome: string;
}

export interface LeagueSettlement {
  won: number;
  lost: number;
  paidCredits: number;
}

export async function settleLeagueMarket(
  marketId: string,
  leagueId: string,
  result: { winner?: string },
): Promise<LeagueSettlement> {
  const db = betDb();
  const { data: market, error: mErr } = await db.from('market').select('type').eq('id', marketId).single();
  if (mErr) throw new Error(`settleLeagueMarket: market load failed: ${mErr.message}`);

  const { data: betsData, error: bErr } = await db
    .from('bet')
    .select('id, user_id, selection_json, stake, outcome')
    .eq('market_id', marketId)
    .eq('league_id', leagueId);
  if (bErr) throw new Error(`settleLeagueMarket: bets load failed: ${bErr.message}`);

  const pending = ((betsData ?? []) as BetRow[]).filter(b => b.outcome === 'pending');
  if (pending.length === 0) return { won: 0, lost: 0, paidCredits: 0 };

  const isWinner = (sel: Record<string, unknown> | null): boolean =>
    (market as { type: string }).type === 'winner' && !!sel && sel.winner === result.winner;

  const poolBets: PoolBet[] = pending.map(b => ({
    betId: b.id,
    userId: b.user_id,
    stake: b.stake,
    won: isWinner(b.selection_json),
  }));
  const { payouts } = settlePool(poolBets);

  const { data, error } = await db.rpc('apply_league_settlement', {
    p_market_id: marketId,
    p_league_id: leagueId,
    p_result: result,
    p_payouts: payouts.map(p => ({ bet_id: p.betId, user_id: p.userId, outcome: p.outcome, payout: p.payout })),
  });
  if (error) throw new Error(`apply_league_settlement failed: ${error.message}`);
  return data as LeagueSettlement;
}
