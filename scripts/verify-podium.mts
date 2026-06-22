// End-to-end podium settlement against the local Supabase stack:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/verify-podium.mts
// grant → create podium market (priced) → two users bet (one in / one out of the
// top 3) → settle → assert the in-podium pick paid at its odds and the other lost.
// Run this after applying the podium settlement migration to a DB, before
// enabling podium market opening (the go-live gate).
import { ensureAppUser, grantMonthlyAllowance, getBalance } from '@/lib/betting/credits';
import { createPodiumMarket, settleMarket } from '@/lib/betting/markets';
import { placeBet } from '@/lib/betting/bets';
import { podiumMultipliers } from '@/lib/betting/pricing';

const onPodium = 'verify_podium_on'; // backs 'Third' → finishes P3 → wins
const offPodium = 'verify_podium_off'; // backs 'Fourth' → P4 → loses
const field = [
  { name: 'Pole', points: 300 },
  { name: 'Second', points: 200 },
  { name: 'Third', points: 150 },
  { name: 'Fourth', points: 100 },
  { name: 'Tail', points: 2 },
];
const STAKE = 100;

for (const u of [onPodium, offPodium]) {
  await ensureAppUser(u);
  await grantMonthlyAllowance(u);
}
const odds = podiumMultipliers(field);
const locksAt = new Date(Date.now() + 3600_000).toISOString();
const marketId = await createPodiumMarket({ seriesSlug: 'f1', round: 991, locksAt, field });

await placeBet(onPodium, marketId, { driver: 'Third' }, STAKE);
await placeBet(offPodium, marketId, { driver: 'Fourth' }, STAKE);

const beforeOn = await getBalance(onPodium);
const beforeOff = await getBalance(offPodium);

const summary = await settleMarket(marketId, { podium: ['Pole', 'Second', 'Third'] });

const afterOn = await getBalance(onPodium);
const afterOff = await getBalance(offPodium);
const expectedPayout = Math.floor(STAKE * odds.Third);

console.log(JSON.stringify({ odds, summary, expectedPayout,
  on: { before: beforeOn, after: afterOn }, off: { before: beforeOff, after: afterOff } }, null, 2));

const errs: string[] = [];
if (afterOn !== beforeOn + expectedPayout) errs.push(`on-podium payout wrong: ${afterOn} != ${beforeOn}+${expectedPayout}`);
if (afterOff !== beforeOff) errs.push('off-podium should have won nothing');
if (summary.won !== 1 || summary.lost !== 1) errs.push(`summary expected 1W/1L, got ${summary.won}W/${summary.lost}L`);
if (errs.length) { console.error('VERIFY FAILED:', errs); process.exit(1); }
console.log('VERIFY OK — podium pick in top-3 paid out at its odds; off-podium pick lost the stake.');
