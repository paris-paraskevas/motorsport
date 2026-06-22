import { betDb } from './client';

// Server-only. Placing a bet is atomic in SQL (place_bet): it validates the
// market is open and the user has balance, inserts the bet, and deducts the
// stake from the append-only ledger — all in one transaction, with a per-user
// advisory lock so concurrent bets can't overspend.

/**
 * Place a bet. `selection` is e.g. `{ winner: "Verstappen" }`. Pass `leagueId`
 * for a league peer-pool bet (the user must be a member); omit for solo-vs-house.
 * Returns the bet id.
 */
export async function placeBet(
  userId: string,
  marketId: string,
  selection: object,
  stake: number,
  leagueId?: string,
): Promise<string> {
  const { data, error } = await betDb().rpc('place_bet', {
    p_user_id: userId,
    p_market_id: marketId,
    p_selection: selection,
    p_stake: stake,
    p_league_id: leagueId ?? null,
  });
  if (error) throw new Error(`placeBet failed: ${error.message}`);
  return data as string;
}

export interface UserBet {
  id: string;
  marketId: string;
  seriesSlug: string;
  round: number;
  type: string;
  selection: Record<string, unknown>;
  stake: number;
  multiplier: number | null;
  outcome: string;
  createdAt: string;
}

/** A user's bets, newest first, each joined to the market it was placed on. */
export async function getUserBets(userId: string): Promise<UserBet[]> {
  const { data, error } = await betDb()
    .from('bet')
    .select('id, market_id, selection_json, stake, multiplier, outcome, created_at, market (series_slug, round, type)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`getUserBets failed: ${error.message}`);
  return (data ?? []).map(b => {
    const row = b as Record<string, unknown> & { market?: unknown };
    const mk = (Array.isArray(row.market) ? row.market[0] : row.market) ?? {};
    const m = mk as { series_slug?: string; round?: number; type?: string };
    return {
      id: row.id as string,
      marketId: row.market_id as string,
      seriesSlug: m.series_slug ?? '',
      round: m.round ?? 0,
      type: m.type ?? '',
      selection: (row.selection_json as Record<string, unknown> | null) ?? {},
      stake: row.stake as number,
      multiplier: row.multiplier != null ? Number(row.multiplier) : null,
      outcome: row.outcome as string,
      createdAt: row.created_at as string,
    };
  });
}
