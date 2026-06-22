import { betDb } from './client';
import { winMultipliers, podiumMultipliers, topTenMultipliers, exactPositionMultipliers, type DriverForm } from './pricing';
import { MARKET_TYPE_META } from './constants';

// Server-only. Create/settle betting markets. Odds are priced once here and
// stored on the market (server-authoritative, fixed for the window).

interface CreateMarketOpts {
  seriesSlug: string;
  round: number;
  sessionUid?: string;
  locksAt: string; // ISO; bets reject at/after this (session start)
  field: DriverForm[];
}

// Shared market insert — winner/podium/top10 differ only in `type` and how the
// field is priced into the {selection -> multiplier} odds snapshot on the row.
async function createMarket(
  type: 'winner' | 'podium' | 'top10' | 'exact_position',
  odds: Record<string, number>,
  opts: CreateMarketOpts,
): Promise<string> {
  const { data, error } = await betDb()
    .from('market')
    .insert({
      series_slug: opts.seriesSlug,
      round: opts.round,
      session_uid: opts.sessionUid ?? null,
      type,
      locks_at: opts.locksAt,
      status: 'open',
      odds_json: odds,
    })
    .select('id')
    .single();
  if (error) throw new Error(`create ${type} market failed: ${error.message}`);
  return data.id as string;
}

/** Create a 'winner' market, pricing its odds from current standings. Returns market id. */
export function createWinnerMarket(opts: CreateMarketOpts): Promise<string> {
  return createMarket('winner', winMultipliers(opts.field), opts);
}

/** Create a 'podium' (top-3 finish) market, pricing its odds from current standings. Returns market id. */
export function createPodiumMarket(opts: CreateMarketOpts): Promise<string> {
  return createMarket('podium', podiumMultipliers(opts.field), opts);
}

/** Create a 'top10' (top-10 finish) market, pricing its odds from current standings. Returns market id. */
export function createTop10Market(opts: CreateMarketOpts): Promise<string> {
  return createMarket('top10', topTenMultipliers(opts.field), opts);
}

/** Create an 'exact_position' market (every driver × finishing position priced).
 *  Odds are keyed `driver@position`; a bet's selection is `{driver, position}`. */
export function createExactPositionMarket(opts: CreateMarketOpts): Promise<string> {
  return createMarket('exact_position', exactPositionMultipliers(opts.field), opts);
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

export interface OpenMarket {
  id: string;
  seriesSlug: string;
  round: number;
  sessionUid: string | null;
  type: string;
  locksAt: string;
  odds: Record<string, number>;
}

/** Open markets not yet past their lock time, soonest-locking first. */
export async function getOpenMarkets(): Promise<OpenMarket[]> {
  const { data, error } = await betDb()
    .from('market')
    .select('id, series_slug, round, session_uid, type, locks_at, odds_json')
    .eq('status', 'open')
    .gt('locks_at', new Date().toISOString())
    .order('locks_at', { ascending: true });
  if (error) throw new Error(`getOpenMarkets failed: ${error.message}`);
  return (data ?? []).map(m => ({
    id: m.id as string,
    seriesSlug: m.series_slug as string,
    round: m.round as number,
    sessionUid: (m.session_uid as string | null) ?? null,
    type: m.type as string,
    locksAt: m.locks_at as string,
    odds: (m.odds_json as Record<string, number> | null) ?? {},
  }));
}

/**
 * The selection JSON for a `pick` on a market, keyed per the market's type so it
 * matches what settlement reads ({winner} for winner, {driver} for podium). The
 * server owns this mapping — clients send only the picked driver name.
 */
export async function selectionForMarket(
  marketId: string,
  pick: string,
  position?: number,
): Promise<Record<string, string | number>> {
  const { data, error } = await betDb().from('market').select('type').eq('id', marketId).single();
  if (error || !data) throw new Error('market not found');
  const type = (data as { type: string }).type;
  if (type === 'exact_position') {
    if (!Number.isInteger(position) || (position as number) < 1) throw new Error('position required');
    return { driver: pick, position: position as number };
  }
  const key = MARKET_TYPE_META[type]?.selectionKey ?? 'winner';
  return { [key]: pick };
}
