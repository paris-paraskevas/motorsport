// End-to-end league peer-pool flow against the local stack:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/verify-league-flow.mts
// 3 friends in a league: 2 back HAM, 1 backs VER. VER wins → the VER backer
// takes the whole pool; the leaderboard ranks by win-rate.
import { ensureAppUser, grantMonthlyAllowance, getBalance } from '@/lib/betting/credits';
import { createWinnerMarket } from '@/lib/betting/markets';
import { placeBet } from '@/lib/betting/bets';
import { createLeague, joinLeague, getLeaderboard, setMemberProfile } from '@/lib/betting/leagues';
import { settleLeagueMarket } from '@/lib/betting/settlement';

const owner = 'lg_owner_ver';   // backs VER (the winner)
const f1 = 'lg_friend_ham1';    // backs HAM
const f2 = 'lg_friend_ham2';    // backs HAM
const field = [
  { name: 'VER', points: 200 },
  { name: 'HAM', points: 150 },
];
const STAKE = 100;

for (const u of [owner, f1, f2]) { await ensureAppUser(u); await grantMonthlyAllowance(u); }

const { id: leagueId, joinCode } = await createLeague(owner, 'Paddock Test League');
await joinLeague(f1, joinCode);
await joinLeague(f2, joinCode);
await setMemberProfile(leagueId, owner, f1, { nickname: 'Hammer' }); // owner sets f1's per-league nickname

const locksAt = new Date(Date.now() + 3600_000).toISOString();
const marketId = await createWinnerMarket({ seriesSlug: 'f1', round: 998, locksAt, field });

await placeBet(owner, marketId, { winner: 'VER' }, STAKE, leagueId);
await placeBet(f1, marketId, { winner: 'HAM' }, STAKE, leagueId);
await placeBet(f2, marketId, { winner: 'HAM' }, STAKE, leagueId);

const afterBet = { owner: await getBalance(owner), f1: await getBalance(f1), f2: await getBalance(f2) };

const summary = await settleLeagueMarket(marketId, leagueId, { winner: 'VER' });

const end = { owner: await getBalance(owner), f1: await getBalance(f1), f2: await getBalance(f2) };
const board = await getLeaderboard(leagueId);

console.log(JSON.stringify({ summary, afterBet, end, leaderboard: board }, null, 2));

const errs: string[] = [];
// owner backed the winner: pool was 300, owner takes it all → +200 net vs afterBet (+300 payout)
if (end.owner !== afterBet.owner + 300) errs.push('owner should take the 300 pool');
if (end.f1 !== afterBet.f1) errs.push('f1 lost the stake (no payout)');
if (end.f2 !== afterBet.f2) errs.push('f2 lost the stake (no payout)');
if (summary.won !== 1 || summary.lost !== 2 || summary.paidCredits !== 300) errs.push('summary wrong');
if (board[0]?.userId !== owner || board[0]?.winRate !== 1) errs.push('owner should top the leaderboard at 100%');
if (board.find(r => r.userId === f1)?.nickname !== 'Hammer') errs.push('leaderboard should surface the per-league nickname');
if (errs.length) { console.error('VERIFY FAILED:', errs); process.exit(1); }
console.log('VERIFY OK — pari-mutuel pool paid the lone winner, losers lost the stake, leaderboard by win-rate.');
