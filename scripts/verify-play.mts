// Verify the /play server-side flow against the local Supabase stack: onboard a
// signed-in user (mirror + monthly grant), list open markets, place a solo
// winner bet, and confirm balance + bet list. Run AFTER seed-market.mts.
//
//   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<local key> \
//     npx tsx scripts/verify-play.mts
import { ensureBettingUser, getBalance } from '../lib/betting/credits';
import { getOpenMarkets } from '../lib/betting/markets';
import { placeBet, getUserBets } from '../lib/betting/bets';
import { createLeague, getUserLeagues } from '../lib/betting/leagues';

const user = `play_verify_${Date.now()}`; // fresh user each run → clean grant + one-bet-per-market
const stake = 50;

const startBal = await ensureBettingUser(user, 'Play Demo');
const markets = await getOpenMarkets();
const market = markets.find(m => m.type === 'winner');
if (!market) throw new Error('no open winner market — run scripts/seed-market.mts first');

const pick = Object.keys(market.odds)[0];
if (!pick) throw new Error('seeded market has no priced selections');
const betId = await placeBet(user, market.id, { winner: pick }, stake);

const afterBal = await getBalance(user);
const bets = await getUserBets(user);

console.log(
  JSON.stringify(
    { startBal, picked: pick, multiplier: market.odds[pick], stake, betId, afterBal, expected: startBal - stake, latest: bets[0] },
    null,
    2,
  ),
);
if (startBal !== 1000) throw new Error(`fresh user should start at 1000, got ${startBal}`);
if (afterBal !== startBal - stake) throw new Error(`balance wrong: ${afterBal} != ${startBal - stake}`);
if (!bets.some(b => b.id === betId)) throw new Error('placed bet not returned by getUserBets');
if (bets[0]?.seriesSlug !== 'f1') throw new Error('bet→market join did not resolve the series');

const { id: leagueId, joinCode } = await createLeague(user, 'Verify League');
const myLeagues = await getUserLeagues(user);
if (!myLeagues.some(l => l.id === leagueId)) throw new Error('created league not in getUserLeagues');
console.log(`LEAGUE OK — created league ${joinCode} appears in getUserLeagues (${myLeagues.length}).`);

console.log('VERIFY OK — onboarded, market listed, solo bet placed, balance + joined bet list + leagues correct.');
