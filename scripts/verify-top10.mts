// End-to-end top-10 settlement against the local Supabase stack:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/verify-top10.mts
// grant → create top-10 market (priced) → two users bet (one in / one out of the
// top 10) → settle → assert the in-top-10 pick paid at its odds and the other lost.
// Run after applying the top-10 settlement migration to a DB, before enabling
// top-10 market opening (the go-live gate).
import { ensureAppUser, grantMonthlyAllowance, getBalance } from '@/lib/betting/credits';
import { createTop10Market, settleMarket } from '@/lib/betting/markets';
import { placeBet } from '@/lib/betting/bets';
import { topTenMultipliers } from '@/lib/betting/pricing';

const inUser = 'verify_top10_in'; // backs P8 → finishes 8th → in the top 10 → wins
const outUser = 'verify_top10_out'; // backs P13 → 13th → outside → loses
const field = Array.from({ length: 15 }, (_, i) => ({ name: `P${i + 1}`, points: 300 - i * 20 }));
const STAKE = 100;

for (const u of [inUser, outUser]) {
  await ensureAppUser(u);
  await grantMonthlyAllowance(u);
}
const odds = topTenMultipliers(field);
const locksAt = new Date(Date.now() + 3600_000).toISOString();
const marketId = await createTop10Market({ seriesSlug: 'f1', round: 990, locksAt, field });

await placeBet(inUser, marketId, { driver: 'P8' }, STAKE);
await placeBet(outUser, marketId, { driver: 'P13' }, STAKE);

const beforeIn = await getBalance(inUser);
const beforeOut = await getBalance(outUser);

const top10 = field.slice(0, 10).map(d => d.name); // P1..P10
const summary = await settleMarket(marketId, { top10 });

const afterIn = await getBalance(inUser);
const afterOut = await getBalance(outUser);
const expectedPayout = Math.floor(STAKE * odds.P8);

console.log(JSON.stringify({ oddsP8: odds.P8, top10, summary, expectedPayout,
  in: { before: beforeIn, after: afterIn }, out: { before: beforeOut, after: afterOut } }, null, 2));

const errs: string[] = [];
if (afterIn !== beforeIn + expectedPayout) errs.push(`in payout wrong: ${afterIn} != ${beforeIn}+${expectedPayout}`);
if (afterOut !== beforeOut) errs.push('out-of-top10 should have won nothing');
if (summary.won !== 1 || summary.lost !== 1) errs.push(`summary expected 1W/1L, got ${summary.won}W/${summary.lost}L`);
if (errs.length) { console.error('VERIFY FAILED:', errs); process.exit(1); }
console.log('VERIFY OK — top-10 pick inside the top ten paid at its odds; outside pick lost the stake.');
