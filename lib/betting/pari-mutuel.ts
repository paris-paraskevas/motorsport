// Pari-mutuel pool math for league peer pools — the crowd prices it: all stakes
// form a pool, winners split it pro-rata to their stake. The operator's 10-vs-1
// example: if 10 back HAM and 1 backs VER and VER wins, the VER-backer takes the
// whole pool (stake back + the 10 losers' stakes); if HAM wins, the 10 split it
// (stake back + a tenth of the loser's). Pure + unit-tested; integer credits,
// round down, rounding dust → house (remainder). If nobody wins, every stake is
// refunded and those bets are VOID (don't count against win-rate).

export interface PoolBet {
  betId: string;
  userId: string;
  stake: number;
  won: boolean; // did this bet's selection match the official result?
}

export type BetOutcome = 'won' | 'lost' | 'void';

export interface PoolPayout {
  betId: string;
  userId: string;
  outcome: BetOutcome;
  payout: number;
}

export interface PoolResult {
  payouts: PoolPayout[];
  pool: number;
  winnerStake: number;
  distributed: number;
  remainder: number; // rounding dust kept by the house
  refunded: boolean; // true when nobody won → stakes refunded, pool dissolves
}

export function settlePool(bets: PoolBet[]): PoolResult {
  const pool = bets.reduce((s, b) => s + b.stake, 0);
  const winners = bets.filter(b => b.won);
  const winnerStake = winners.reduce((s, b) => s + b.stake, 0);

  // No winner → refund every stake (void), pool dissolves; nobody profits/loses.
  if (winners.length === 0 || winnerStake === 0) {
    return {
      payouts: bets.map(b => ({ betId: b.betId, userId: b.userId, outcome: 'void' as const, payout: b.stake })),
      pool,
      winnerStake: 0,
      distributed: pool,
      remainder: 0,
      refunded: true,
    };
  }

  let distributed = 0;
  const payouts: PoolPayout[] = bets.map(b => {
    if (!b.won) return { betId: b.betId, userId: b.userId, outcome: 'lost' as const, payout: 0 };
    const share = Math.floor((b.stake / winnerStake) * pool); // their stake + share of losers'
    distributed += share;
    return { betId: b.betId, userId: b.userId, outcome: 'won' as const, payout: share };
  });

  return { payouts, pool, winnerStake, distributed, remainder: pool - distributed, refunded: false };
}
