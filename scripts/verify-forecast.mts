// End-to-end forecast settlement against the local Supabase stack:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/verify-forecast.mts
// grant → create forecast market (per-pair odds) → two users bet ≥2 legs (one all
// correct, one with a wrong leg) → settle → assert the all-correct forecast paid at
// the clamped PRODUCT of its legs' odds and the wrong-leg one lost. Run after
// applying the forecast enum + settlement migrations, before enabling forecast
// market opening.
import { ensureAppUser, grantMonthlyAllowance, getBalance } from '@/lib/betting/credits';
import { createForecastMarket, settleMarket } from '@/lib/betting/markets';
import { placeBet } from '@/lib/betting/bets';
import { exactPositionMultipliers, forecastMultiplier, MAX_MULTIPLIER } from '@/lib/betting/pricing';

const hit = 'verify_fc_hit';   // P1→1 + P2→2, both correct → wins
const miss = 'verify_fc_miss'; // P1→1 + P3→2, P3 finishes 3rd → loses
const field = Array.from({ length: 12 }, (_, i) => ({ name: `P${i + 1}`, points: 240 - i * 20 }));
const STAKE = 100;

for (const u of [hit, miss]) {
  await ensureAppUser(u);
  await grantMonthlyAllowance(u);
}
const odds = exactPositionMultipliers(field);
const locksAt = new Date(Date.now() + 3600_000).toISOString();
const marketId = await createForecastMarket({ seriesSlug: 'f1', round: 988, locksAt, field });

const hitLegs = [{ driver: 'P1', position: 1 }, { driver: 'P2', position: 2 }];
const missLegs = [{ driver: 'P1', position: 1 }, { driver: 'P3', position: 2 }];
await placeBet(hit, marketId, { legs: hitLegs }, STAKE);
await placeBet(miss, marketId, { legs: missLegs }, STAKE);

const beforeHit = await getBalance(hit);
const beforeMiss = await getBalance(miss);

const positions: Record<string, number> = {};
field.forEach((d, i) => { positions[d.name] = i + 1; }); // finish in points order: P1→1, P2→2, …
const summary = await settleMarket(marketId, { positions });

const afterHit = await getBalance(hit);
const afterMiss = await getBalance(miss);

// Settlement multiplier = least(product of the legs' per-pair odds, 500).
const combined = Math.min(odds['P1@1'] * odds['P2@2'], MAX_MULTIPLIER);
const expectedPayout = Math.floor(STAKE * combined + 1e-6);
const uiMult = forecastMultiplier(odds, hitLegs); // what the card shows

console.log(JSON.stringify({ combined, uiMult, expectedPayout, summary,
  hit: { before: beforeHit, after: afterHit }, miss: { before: beforeMiss, after: afterMiss } }, null, 2));

const errs: string[] = [];
if (afterHit !== beforeHit + expectedPayout) errs.push(`hit payout wrong: ${afterHit} != ${beforeHit}+${expectedPayout}`);
if (afterMiss !== beforeMiss) errs.push('miss should have won nothing');
if (summary.won !== 1 || summary.lost !== 1) errs.push(`summary expected 1W/1L, got ${summary.won}W/${summary.lost}L`);
if (errs.length) {
  console.error('VERIFY FAILED:', errs);
  process.exit(1);
}
console.log('VERIFY OK — all-correct forecast paid the clamped product; the wrong-leg forecast lost the stake.');
