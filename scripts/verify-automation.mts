// Verify market automation against the configured Supabase stack: open upcoming
// winner markets (idempotent), then list what's open. Point it at local or the
// cloud project via SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/verify-automation.mts
import { openUpcomingMarkets } from '../lib/betting/automation';
import { getOpenMarkets } from '../lib/betting/markets';
import { betDb } from '../lib/betting/client';
import { computeMonthlyAllowance } from '../lib/betting/allowance';

// LOCAL ONLY: clear F1 winner markets first so the open path re-runs from clean
// (set VERIFY_RESET=1). NEVER set this against the cloud project.
if (process.env.VERIFY_RESET) {
  const db = betDb();
  const { data: f1 } = await db.from('market').select('id').eq('series_slug', 'f1').eq('type', 'winner');
  for (const m of f1 ?? []) {
    await db.from('bet').delete().eq('market_id', m.id);
    await db.from('settlement').delete().eq('market_id', m.id);
    await db.from('market').delete().eq('id', m.id);
  }
  console.log(`(reset) cleared ${(f1 ?? []).length} F1 winner market(s)`);
}

const summary = await openUpcomingMarkets();
console.log('OPEN SUMMARY:', JSON.stringify(summary, null, 2));

const markets = await getOpenMarkets();
console.log(`\nOPEN MARKETS (${markets.length}):`);
for (const m of markets) {
  const odds = Object.entries(m.odds).sort((a, b) => a[1] - b[1]);
  const favourite = odds[0] ? `${odds[0][0]} ×${odds[0][1]}` : 'n/a';
  console.log(`  ${m.seriesSlug} R${m.round} ${m.type} — ${odds.length} selections, fav ${favourite}, locks ${m.locksAt}`);
}
// Lean monthly grant scales to that month's F1 race weekends.
const june = computeMonthlyAllowance(new Date('2026-06-15T00:00:00Z'));
const jan = computeMonthlyAllowance(new Date('2026-01-15T00:00:00Z'));
console.log(`\nALLOWANCE: June 2026 = ${june} (expect 350), Jan 2026 = ${jan} (expect 50)`);
if (june !== 350) throw new Error(`June allowance ${june} != 350`);
if (jan !== 50) throw new Error(`Jan allowance ${jan} != 50`);

console.log('VERIFY OK — automation ran (lock at quali−1h); allowance scales to race weekends.');
