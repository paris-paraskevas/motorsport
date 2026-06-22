// End-to-end league-prizes (P4) flow against the local stack:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/verify-league-prizes.mts
// Run against a freshly-reset local DB (`npx supabase db reset`) — it creates
// markets on fixed rounds, which collide with a prior run otherwise.
//
// 4 members bet across 3 winner markets; VER wins all 3. By win-rate the top 3
// (min 3 placed) are A(3/3) > B(2/3) > C(0/3); D(1/1) is excluded (under the
// min). awardLeaguePrizes snapshots the period podium; getLeagueDetail surfaces
// medals on members + an honours list; a re-run awards nothing (idempotent).
import { ensureAppUser, grantMonthlyAllowance } from '@/lib/betting/credits';
import { createWinnerMarket } from '@/lib/betting/markets';
import { placeBet } from '@/lib/betting/bets';
import { createLeague, joinLeague, awardLeaguePrizes, getLeagueDetail, formatPeriodLabel } from '@/lib/betting/leagues';
import { settleLeagueMarket } from '@/lib/betting/settlement';

const A = 'verify_lp_a'; // VER ×3            → 3/3 = 100%
const B = 'verify_lp_b'; // VER, VER, HAM     → 2/3 = 67%
const C = 'verify_lp_c'; // HAM ×3            → 0/3 = 0%
const D = 'verify_lp_d'; // 1 bet (VER, wins) → 1/1, under the min-placed floor
const field = [{ name: 'VER', points: 200 }, { name: 'HAM', points: 150 }];
const ROUNDS = [992, 993, 994];
const STAKE = 50;

for (const u of [A, B, C, D]) { await ensureAppUser(u); await grantMonthlyAllowance(u); }

const { id: leagueId, joinCode } = await createLeague(A, 'Prize Test League');
for (const u of [B, C, D]) await joinLeague(u, joinCode);

const lock = new Date(Date.now() + 3600_000); // future → bets are accepted
const picks: Record<string, string[]> = {
  [A]: ['VER', 'VER', 'VER'],
  [B]: ['VER', 'VER', 'HAM'],
  [C]: ['HAM', 'HAM', 'HAM'],
};
for (let i = 0; i < ROUNDS.length; i++) {
  const marketId = await createWinnerMarket({ seriesSlug: 'f1', round: ROUNDS[i], locksAt: lock.toISOString(), field });
  for (const u of [A, B, C]) await placeBet(u, marketId, { winner: picks[u][i] }, STAKE, leagueId);
  if (i === 0) await placeBet(D, marketId, { winner: 'VER' }, STAKE, leagueId); // D bets only the first round
  await settleLeagueMarket(marketId, leagueId, { winner: 'VER' });
}

// Period = the calendar month containing the markets' lock time.
const start = new Date(Date.UTC(lock.getUTCFullYear(), lock.getUTCMonth(), 1));
const end = new Date(Date.UTC(lock.getUTCFullYear(), lock.getUTCMonth() + 1, 1));
const period = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`;
const label = formatPeriodLabel(period);

const first = await awardLeaguePrizes(period, label, start.toISOString(), end.toISOString(), 3);
const again = await awardLeaguePrizes(period, label, start.toISOString(), end.toISOString(), 3); // idempotent
const detail = await getLeagueDetail(leagueId, A);

console.log(
  JSON.stringify(
    {
      period,
      label,
      first,
      again,
      honours: detail?.honours,
      members: detail?.members.map(m => ({ u: m.userId, wins: m.wins, placed: m.placed, awards: m.awards })),
    },
    null,
    2,
  ),
);

const errs: string[] = [];
if (first.awarded !== 3) errs.push(`expected 3 awards, got ${first.awarded}`);
if (again.awarded !== 0) errs.push(`re-run should award 0, got ${again.awarded}`);
const honour = detail?.honours.find(h => h.period === period);
if (!honour) errs.push('honours missing the period');
const podium = honour?.podium ?? [];
if (podium[0]?.userId !== A) errs.push('rank 1 should be A (3/3)');
if (podium[1]?.userId !== B) errs.push('rank 2 should be B (2/3)');
if (podium[2]?.userId !== C) errs.push('rank 3 should be C (0/3)');
if (podium.some(p => p.userId === D)) errs.push('D (1 placed) should be excluded by min-placed');
if (podium[0] && podium[0].title !== `${label} Champion`) errs.push(`rank-1 title wrong: ${podium[0].title}`);
const aRow = detail?.members.find(m => m.userId === A);
if (!aRow?.awards.some(x => x.rank === 1 && x.period === period)) errs.push('A member row should carry the rank-1 medal');
if (errs.length) { console.error('VERIFY FAILED:', errs); process.exit(1); }
console.log('VERIFY OK — top-3 by win-rate awarded (min-placed excludes D), titles set, badges + honours surfaced, idempotent.');
