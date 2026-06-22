// Verify settlement end-to-end against the local Supabase stack: build a market
// for a finished F1 round, place solo + league bets (winner & loser on each),
// make it due, settle, and assert the solo fixed-odds book + the league
// pari-mutuel pool both resolved correctly.
//
//   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<local> \
//     npx tsx scripts/verify-settle.mts
import { betDb } from '../lib/betting/client';
import { ensureBettingUser, getBalance } from '../lib/betting/credits';
import { placeBet, getUserBets } from '../lib/betting/bets';
import { createWinnerMarket } from '../lib/betting/markets';
import { createLeague, joinLeague, getLeaderboard } from '../lib/betting/leagues';
import { settleDueMarkets } from '../lib/betting/automation';
import { fetchF1SeasonResults } from '../lib/results/f1';

const ts = Date.now();
const db = betDb();

// 1. A finished F1 race + its real winner + a loser.
const races = await fetchF1SeasonResults();
const race = races.find(r => (r.results?.length ?? 0) >= 3);
if (!race) throw new Error('no finished F1 race with a full classification');
const winner = race.results.find(e => e.position === 1)!.driverName;
const loser = race.results.find(e => e.position >= 2)!.driverName;
const round = race.round;
console.log(`F1 R${round}: winner=${winner}, loser=${loser}`);

// 2. Clear any prior market for this round, then create one (future lock so
//    place_bet accepts), priced from the field.
const { data: prior } = await db.from('market').select('id').eq('series_slug', 'f1').eq('round', round).eq('type', 'winner');
for (const m of prior ?? []) {
  await db.from('bet').delete().eq('market_id', m.id);
  await db.from('settlement').delete().eq('market_id', m.id);
  await db.from('market').delete().eq('id', m.id);
}
const field = race.results.slice(0, 10).map(e => ({ name: e.driverName, points: Math.max(0, 30 - e.position) }));
const marketId = await createWinnerMarket({
  seriesSlug: 'f1',
  round,
  locksAt: new Date(ts + 3_600_000).toISOString(),
  field,
});

// 3. Solo: A backs the winner, B backs a loser.
const A = `settle_A_${ts}`, B = `settle_B_${ts}`;
await ensureBettingUser(A);
await ensureBettingUser(B);
await placeBet(A, marketId, { winner }, 100);
await placeBet(B, marketId, { winner: loser }, 100);

// 4. League: C + D in a pool; C backs the winner, D a loser.
const C = `settle_C_${ts}`, D = `settle_D_${ts}`;
await ensureBettingUser(C);
await ensureBettingUser(D);
const { joinCode } = await createLeague(C, `Settle ${ts}`);
const leagueId = await joinLeague(D, joinCode);
await placeBet(C, marketId, { winner }, 100, leagueId);
await placeBet(D, marketId, { winner: loser }, 100, leagueId);

// 5. Make it due (lock in the past), then settle.
await db.from('market').update({ locks_at: new Date(ts - 3_600_000).toISOString() }).eq('id', marketId);
const summary = await settleDueMarkets();
console.log('SETTLE SUMMARY:', JSON.stringify(summary, null, 2));

// 6. Assertions.
const [balA, balB, balC, balD] = await Promise.all([getBalance(A), getBalance(B), getBalance(C), getBalance(D)]);
const aBet = (await getUserBets(A))[0];
console.log({ balA, balB, balC, balD, aOutcome: aBet?.outcome, aMult: aBet?.multiplier });
if (aBet?.outcome !== 'won') throw new Error(`A (solo winner) should be won, got ${aBet?.outcome}`);
if (balA <= 1000) throw new Error(`A (solo winner) should profit (>1000), got ${balA}`);
if (balB !== 900) throw new Error(`B (solo loser) should be 900, got ${balB}`);
if (balC !== 1100) throw new Error(`C (league winner) should take the 200 pool → 1100, got ${balC}`);
if (balD !== 900) throw new Error(`D (league loser) should be 900, got ${balD}`);
const board = await getLeaderboard(leagueId, 0);
console.log('LEADERBOARD:', JSON.stringify(board));
if (!board.some(r => r.userId === C && r.wins === 1)) throw new Error('C should have 1 league win');
console.log('VERIFY OK — solo fixed-odds + league pari-mutuel settled correctly, market closed.');
