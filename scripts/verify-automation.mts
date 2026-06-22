// Verify market automation against the configured Supabase stack: open upcoming
// winner markets (idempotent), then list what's open. Point it at local or the
// cloud project via SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/verify-automation.mts
import { openUpcomingMarkets } from '../lib/betting/automation';
import { getOpenMarkets } from '../lib/betting/markets';

const summary = await openUpcomingMarkets();
console.log('OPEN SUMMARY:', JSON.stringify(summary, null, 2));

const markets = await getOpenMarkets();
console.log(`\nOPEN MARKETS (${markets.length}):`);
for (const m of markets) {
  const odds = Object.entries(m.odds).sort((a, b) => a[1] - b[1]);
  const favourite = odds[0] ? `${odds[0][0]} ×${odds[0][1]}` : 'n/a';
  console.log(`  ${m.seriesSlug} R${m.round} ${m.type} — ${odds.length} selections, fav ${favourite}, locks ${m.locksAt}`);
}
console.log('\nVERIFY OK — automation ran; see summary above.');
