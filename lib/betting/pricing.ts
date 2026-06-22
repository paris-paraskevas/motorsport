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

export const PODIUM_SLOTS = 3;

/**
 * Probability each driver finishes in the top PODIUM_SLOTS, via the Harville /
 * Plackett-Luce model: P(top-3) = P(1st) + P(2nd) + P(3rd), where each finishing
 * position is drawn without replacement proportional to the same form weights
 * used for the winner market. Exact (under the PL assumption), not a heuristic —
 * the per-driver probabilities sum to exactly PODIUM_SLOTS across the field
 * (three podium slots). O(n³), trivial for a ~22-car grid.
 */
export function podiumProbabilities(drivers: DriverForm[]): Map<string, number> {
  const ds = drivers.map(d => ({ name: d.name, w: Math.pow(Math.max(d.points, 0) + 1, FORM_EXPONENT) }));
  const W = ds.reduce((s, x) => s + x.w, 0) || 1;
  const out = new Map<string, number>();
  for (const i of ds) {
    let p = i.w / W; // P(i = 1st)
    for (const a of ds) {
      if (a === i) continue;
      const denom2 = W - a.w; // field after `a` takes 1st
      if (denom2 <= 0) continue;
      const pa = a.w / W;
      p += pa * (i.w / denom2); // P(a 1st, i 2nd)
      for (const b of ds) {
        if (b === a || b === i) continue;
        const denom3 = W - a.w - b.w; // field after a, b take 1st/2nd
        if (denom3 <= 0) continue;
        p += pa * (b.w / denom2) * (i.w / denom3); // P(a 1st, b 2nd, i 3rd)
      }
    }
    out.set(i.name, Math.min(p, 1));
  }
  return out;
}

/** {driver -> decimal multiplier} for a podium (top-3) market — same clamp band as winner. */
export function podiumMultipliers(drivers: DriverForm[], margin = HOUSE_MARGIN): Record<string, number> {
  const probs = podiumProbabilities(drivers);
  const out: Record<string, number> = {};
  for (const [name, p] of probs) out[name] = multiplierFromProb(p, margin);
  return out;
}

export const TOP10_SLOTS = 10;

/**
 * Probability each driver finishes in the top `k`, for `k` too large for the
 * exact Harville sum (O(nᵏ)). Mean-field sequential Plackett-Luce: fill k slots
 * in turn; each slot a driver is picked ∝ its weight among those not yet picked,
 * and the field's total weight is reduced by the expected weight removed. Slot
 * picks are normalised to sum to 1, so the per-driver probabilities sum to ~k
 * (a clamped driver can shave a little off). Exact for k=1 (= winProbabilities);
 * a close, monotonic approximation for larger k. O(n·k).
 */
export function topKProbabilities(drivers: DriverForm[], k: number): Map<string, number> {
  const ds = drivers.map(d => ({ name: d.name, w: Math.pow(Math.max(d.points, 0) + 1, FORM_EXPONENT) }));
  const cum = new Map<string, number>(ds.map(d => [d.name, 0]));
  let remainingW = ds.reduce((s, x) => s + x.w, 0) || 1;
  const slots = Math.min(k, ds.length);
  for (let slot = 0; slot < slots; slot++) {
    const raw = ds.map(d => (d.w / remainingW) * (1 - cum.get(d.name)!));
    const rawTotal = raw.reduce((s, x) => s + x, 0);
    if (rawTotal <= 0) break;
    let removedW = 0;
    ds.forEach((d, i) => {
      const pick = raw[i] / rawTotal; // this slot's picks sum to 1
      cum.set(d.name, Math.min(1, cum.get(d.name)! + pick));
      removedW += pick * d.w;
    });
    remainingW = Math.max(remainingW - removedW, 1e-9);
  }
  return cum;
}

/** {driver -> decimal multiplier} for a top-10 finish market — same clamp band as winner. */
export function topTenMultipliers(drivers: DriverForm[], margin = HOUSE_MARGIN): Record<string, number> {
  const probs = topKProbabilities(drivers, TOP10_SLOTS);
  const out: Record<string, number> = {};
  for (const [name, p] of probs) out[name] = multiplierFromProb(p, margin);
  return out;
}
