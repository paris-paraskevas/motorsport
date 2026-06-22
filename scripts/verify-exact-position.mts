// End-to-end exact-position settlement against the local Supabase stack:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/verify-exact-position.mts
// grant → create exact-position market (every driver×position priced) → two users
// bet (one correct driver+position, one wrong) → settle → assert the exact hit
// paid at its odds and the miss lost. Run after applying the exact-position
// settlement migration, before enabling exact-position market opening.
import { ensureAppUser, grantMonthlyAllowance, getBalance } from '@/lib/betting/credits';
import { createExactPositionMarket, settleMarket } from '@/lib/betting/markets';
import { placeBet } from '@/lib/betting/bets';
import { exactPositionMultipliers } from '@/lib/betting/pricing';

const hit = 'verify_exact_hit'; // backs P3 to finish 3rd → correct → wins
const miss = 'verify_exact_miss'; // backs P5 to finish 2nd → wrong (P5 is 5th) → loses
const field = Array.from({ length: 12 }, (_, i) => ({ name: `P${i + 1}`, points: 240 - i * 20 }));
const STAKE = 100;

for (const u of [hit, miss]) {
  await ensureAppUser(u);
  await grantMonthlyAllowance(u);
}
const odds = exactPositionMultipliers(field);
const locksAt = new Date(Date.now() + 3600_000).toISOString();
const marketId = await createExactPositionMarket({ seriesSlug: 'f1', round: 989, locksAt, field });

await placeBet(hit, marketId, { driver: 'P3', position: 3 }, STAKE);
await placeBet(miss, marketId, { driver: 'P5', position: 2 }, STAKE);

const beforeHit = await getBalance(hit);
const beforeMiss = await getBalance(miss);

const positions: Record<string, number> = {};
field.forEach((d, i) => { positions[d.name] = i + 1; }); // finish in points order
const summary = await settleMarket(marketId, { positions });

const afterHit = await getBalance(hit);
const afterMiss = await getBalance(miss);
// + epsilon so JS float (100 * 4.64 = 463.9999…) matches Postgres exact numeric.
const expectedPayout = Math.floor(STAKE * odds['P3@3'] + 1e-6);

console.log(JSON.stringify({ oddsP3at3: odds['P3@3'], summary, expectedPayout,
  hit: { before: beforeHit, after: afterHit }, miss: { before: beforeMiss, after: afterMiss } }, null, 2));

const errs: string[] = [];
if (afterHit !== beforeHit + expectedPayout) errs.push(`hit payout wrong: ${afterHit} != ${beforeHit}+${expectedPayout}`);
if (afterMiss !== beforeMiss) errs.push('miss should have won nothing');
if (summary.won !== 1 || summary.lost !== 1) errs.push(`summary expected 1W/1L, got ${summary.won}W/${summary.lost}L`);
if (errs.length) { console.error('VERIFY FAILED:', errs); process.exit(1); }
console.log('VERIFY OK — exact driver+position hit paid at its odds; the miss lost the stake.');
