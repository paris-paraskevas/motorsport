import { betDb } from './client';
import { winMultipliers, type DriverForm } from './pricing';

// Server-only. Create/settle betting markets. Odds are priced once here and
// stored on the market (server-authoritative, fixed for the window).

/** Create a 'winner' market, pricing its odds from current standings. Returns market id. */
export async function createWinnerMarket(opts: {
  seriesSlug: string;
  round: number;
  sessionUid?: string;
  locksAt: string; // ISO; bets reject at/after this (session start)
  field: DriverForm[];
}): Promise<string> {
  const { data, error } = await betDb()
    .from('market')
    .insert({
      series_slug: opts.seriesSlug,
      round: opts.round,
      session_uid: opts.sessionUid ?? null,
      type: 'winner',
      locks_at: opts.locksAt,
      status: 'open',
      odds_json: winMultipliers(opts.field),
    })
    .select('id')
    .single();
  if (error) throw new Error(`createWinnerMarket failed: ${error.message}`);
  return data.id as string;
}

export interface SettlementSummary {
  won: number;
  lost: number;
  paidCredits: number;
}

/**
 * Settle a market once against the official final classification (provisional is
 * final — no claw-back). For a winner market, `result` is `{ winner: <name> }`.
 */
export async function settleMarket(marketId: string, result: object): Promise<SettlementSummary> {
  const { data, error } = await betDb().rpc('settle_market', {
    p_market_id: marketId,
    p_result: result,
  });
  if (error) throw new Error(`settleMarket failed: ${error.message}`);
  return data as SettlementSummary;
}
