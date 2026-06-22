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
