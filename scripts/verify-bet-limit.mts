// Per-league bet limit, against the local stack:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/verify-bet-limit.mts
// Owner sets a 100-credit per-bet limit: a 50 bet is allowed, a 200 bet is
// rejected, and after clearing the limit a 300 bet goes through.
import { ensureAppUser, grantMonthlyAllowance } from '@/lib/betting/credits';
import { createWinnerMarket } from '@/lib/betting/markets';
import { placeBet } from '@/lib/betting/bets';
import { createLeague, setBetLimit, betLimitFor, getLeagueDetail } from '@/lib/betting/leagues';

const owner = 'bl_owner';
const field = [
  { name: 'VER', points: 200 },
  { name: 'HAM', points: 150 },
];

await ensureAppUser(owner);
await grantMonthlyAllowance(owner);

const { id: leagueId } = await createLeague(owner, 'Bet Limit Test League');
await setBetLimit(leagueId, owner, 100);

const locksAt = new Date(Date.now() + 3600_000).toISOString();
const marketId = await createWinnerMarket({ seriesSlug: 'f1', round: 997, locksAt, field });

const errs: string[] = [];

const limit = await betLimitFor(leagueId);
if (limit !== 100) errs.push(`betLimitFor expected 100, got ${limit}`);

const detail = await getLeagueDetail(leagueId, owner);
if (detail?.betLimit !== 100) errs.push(`getLeagueDetail.betLimit expected 100, got ${detail?.betLimit}`);

// under the limit → allowed
let underOk = false;
try {
  await placeBet(owner, marketId, { winner: 'VER' }, 50, leagueId);
  underOk = true;
} catch (e) {
  errs.push(`50-credit bet should be allowed: ${(e as Error).message}`);
}

// over the limit → rejected (for the right reason)
let overRejected = false;
try {
  await placeBet(owner, marketId, { winner: 'HAM' }, 200, leagueId);
} catch (e) {
  overRejected = /bet limit/i.test((e as Error).message);
  if (!overRejected) errs.push(`200-credit bet rejected for the wrong reason: ${(e as Error).message}`);
}
if (!overRejected) errs.push('200-credit bet should be rejected (over the 100 limit)');

// clearing the limit lets a big bet through (on a fresh market — one bet per
// market per context is a separate rule).
await setBetLimit(leagueId, owner, null);
const market2 = await createWinnerMarket({ seriesSlug: 'f1', round: 996, locksAt, field });
let afterClearOk = false;
try {
  await placeBet(owner, market2, { winner: 'VER' }, 300, leagueId);
  afterClearOk = true;
} catch (e) {
  errs.push(`with no limit, a 300 bet should be allowed: ${(e as Error).message}`);
}

console.log(JSON.stringify({ limit, detailLimit: detail?.betLimit, underOk, overRejected, afterClearOk }, null, 2));
if (errs.length) {
  console.error('VERIFY FAILED:', errs);
  process.exit(1);
}
console.log('VERIFY OK — owner-set per-bet limit allows under, rejects over, and clears to no-limit.');
