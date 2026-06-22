// Model pricing for solo-vs-house winner markets (no external odds API needed —
// that's a pluggable adapter for later). Win probability is derived from
// championship points, so the leader is the favourite and backmarkers are
// longshots. The displayed multiplier is the inverse of that probability with a
// house margin, clamped to a deliberately narrow band: a thin favourite floor
// (backing the obvious leader shouldn't be lucrative) and a hard longshot cap
// (no four-figure lottery hits — the leaderboard rewards win-rate, not one lucky
// 900× ticket). All tuning lives in the four constants below:
//
//   FORM_EXPONENT  — how steeply points concentrate probability on the leader.
//                    Higher ⇒ cheaper favourite, longer mid/tail.
//   HOUSE_MARGIN   — overround; scales every payout down (the "reduce returns" lever).
//   MIN_MULTIPLIER — favourite floor; even a runaway leader pays at least this.
//   MAX_MULTIPLIER — longshot cap; the most any single pick can ever pay.
//
// Each driver is priced off their OWN win chance, so adding or dropping a
// backmarker barely moves anyone else's odds (unlike an endpoint-anchored curve).

export const FORM_EXPONENT = 2.6;
export const HOUSE_MARGIN = 0.25;
export const MIN_MULTIPLIER = 1.3;
export const MAX_MULTIPLIER = 30;

export interface DriverForm {
  name: string;
  points: number;
}

/** Win probability per driver, summing to 1. weight = (points+1)^FORM_EXPONENT. */
export function winProbabilities(drivers: DriverForm[]): Map<string, number> {
  const weighted = drivers.map(d => ({ name: d.name, w: Math.pow(Math.max(d.points, 0) + 1, FORM_EXPONENT) }));
  const total = weighted.reduce((s, x) => s + x.w, 0) || 1;
  return new Map(weighted.map(x => [x.name, x.w / total]));
}

/**
 * Decimal multiplier from a win probability: inverse probability with a house
 * margin, clamped to [MIN_MULTIPLIER, MAX_MULTIPLIER]. The cap is what stops a
 * 0-point backmarker paying a four-figure jackpot; the floor stops the favourite
 * paying a meaningless ~1×.
 */
export function multiplierFromProb(prob: number, margin = HOUSE_MARGIN): number {
  const p = Math.min(Math.max(prob, 1e-9), 1);
  const raw = (1 - margin) / p;
  const clamped = Math.min(Math.max(raw, MIN_MULTIPLIER), MAX_MULTIPLIER);
  return Math.round(clamped * 100) / 100;
}

/** {driver -> decimal multiplier} for a winner market — the odds snapshot stored on the market. */
export function winMultipliers(drivers: DriverForm[], margin = HOUSE_MARGIN): Record<string, number> {
  const probs = winProbabilities(drivers);
  const out: Record<string, number> = {};
  for (const [name, p] of probs) out[name] = multiplierFromProb(p, margin);
  return out;
}
