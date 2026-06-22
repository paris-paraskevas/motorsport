// Dev seed — create one OPEN F1 "winner" market priced from current standings,
// so the local /play page has something to bet on. NOT production (real markets
// are opened by automation later). Idempotent: clears any prior seed first.
//
//   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<local key> \
//     npx tsx scripts/seed-market.mts
import { fetchF1Standings } from '../lib/standings/f1';
import { createWinnerMarket } from '../lib/betting/markets';
import { betDb } from '../lib/betting/client';

const SEED_ROUND = 99; // out of the real-round range, so it can't collide

const standings = await fetchF1Standings();
if (!standings || standings.drivers.length === 0) {
  throw new Error('could not fetch F1 standings to price the market');
}
const field = standings.drivers.map(d => ({ name: d.driverName, points: d.points }));

// Clear any prior seed (bets + settlement first for the FKs), so re-runs are clean.
const db = betDb();
const { data: prior } = await db
  .from('market')
  .select('id')
  .eq('series_slug', 'f1')
  .eq('round', SEED_ROUND)
  .eq('type', 'winner');
for (const m of prior ?? []) {
  await db.from('bet').delete().eq('market_id', m.id);
  await db.from('settlement').delete().eq('market_id', m.id);
  await db.from('market').delete().eq('id', m.id);
}

const locksAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // ~1 week out
const id = await createWinnerMarket({ seriesSlug: 'f1', round: SEED_ROUND, locksAt, field });

console.log(JSON.stringify({ marketId: id, drivers: field.length, locksAt }, null, 2));
console.log('SEED OK — one open F1 winner market created.');
