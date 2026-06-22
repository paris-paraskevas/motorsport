// Model pricing for solo-vs-house markets (no external odds API needed — that's
// a pluggable adapter for later). Win probability is derived from championship
// points so the leader is the favourite and backmarkers are longshots; the
// multiplier is the inverse probability with a house margin. This is what makes
// "Bottas to win" pay far more than "Antonelli to win".

export const HOUSE_MARGIN = 0.1;

export interface DriverForm {
  name: string;
  points: number;
}

/** Win probability per driver, summing to 1. weight = (points+1)^1.5 (form-biased). */
export function winProbabilities(drivers: DriverForm[]): Map<string, number> {
  const weighted = drivers.map(d => ({ name: d.name, w: Math.pow(Math.max(d.points, 0) + 1, 1.5) }));
  const total = weighted.reduce((s, x) => s + x.w, 0) || 1;
  return new Map(weighted.map(x => [x.name, x.w / total]));
}

/** Decimal multiplier from a probability: (1 - margin) / p, floored so every pick pays something. */
export function multiplierFromProb(prob: number, margin = HOUSE_MARGIN): number {
  const p = Math.min(Math.max(prob, 0.001), 0.999);
  return Math.max(1.01, Math.round(((1 - margin) / p) * 100) / 100);
}

/** {driver -> decimal multiplier} for a winner market — the odds snapshot stored on the market. */
export function winMultipliers(drivers: DriverForm[], margin = HOUSE_MARGIN): Record<string, number> {
  const probs = winProbabilities(drivers);
  const out: Record<string, number> = {};
  for (const [name, p] of probs) out[name] = multiplierFromProb(p, margin);
  return out;
}
