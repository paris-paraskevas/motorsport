// End-to-end solo-vs-house flow against the local Supabase stack:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/verify-betting-flow.mts
// grant → create market (priced) → two users bet → settle → check balances.
import { ensureAppUser, grantMonthlyAllowance, getBalance } from '@/lib/betting/credits';
import { createWinnerMarket, settleMarket } from '@/lib/betting/markets';
import { placeBet } from '@/lib/betting/bets';
import { winMultipliers } from '@/lib/betting/pricing';

const u1 = 'user_flow_longshot'; // backs Bottas (longshot)
const u2 = 'user_flow_favourite'; // backs Antonelli (favourite)
const field = [
  { name: 'Antonelli', points: 250 },
  { name: 'Russell', points: 120 },
  { name: 'Bottas', points: 8 },
];
const STAKE = 100;

for (const u of [u1, u2]) {
  await ensureAppUser(u);
  await grantMonthlyAllowance(u); // 1000 (idempotent; fine if already granted)
}
const startU1 = await getBalance(u1);
const startU2 = await getBalance(u2);

const locksAt = new Date(Date.now() + 3600_000).toISOString(); // 1h out
const marketId = await createWinnerMarket({ seriesSlug: 'f1', round: 999, locksAt, field });
const odds = winMultipliers(field);

await placeBet(u1, marketId, { winner: 'Bottas' }, STAKE);
await placeBet(u2, marketId, { winner: 'Antonelli' }, STAKE);

const afterBetU1 = await getBalance(u1);
const afterBetU2 = await getBalance(u2);

// Official result: Bottas wins (the longshot lands).
const summary = await settleMarket(marketId, { winner: 'Bottas' });

const endU1 = await getBalance(u1);
const endU2 = await getBalance(u2);
const expectedU1Payout = Math.floor(STAKE * odds.Bottas);

console.log(JSON.stringify({
  odds, summary,
  u1: { start: startU1, afterBet: afterBetU1, end: endU1, expectedPayout: expectedU1Payout },
  u2: { start: startU2, afterBet: afterBetU2, end: endU2 },
}, null, 2));

const errs: string[] = [];
if (afterBetU1 !== startU1 - STAKE) errs.push('u1 stake not deducted');
if (afterBetU2 !== startU2 - STAKE) errs.push('u2 stake not deducted');
if (endU1 !== afterBetU1 + expectedU1Payout) errs.push('u1 payout wrong');
if (endU2 !== afterBetU2) errs.push('u2 should have lost the stake (no payout)');
if (odds.Bottas <= odds.Antonelli) errs.push('longshot should pay more');
if (errs.length) { console.error('VERIFY FAILED:', errs); process.exit(1); }
console.log('VERIFY OK — stake deducted, longshot paid out big, favourite-backer lost the stake.');
