// Local integration check for the betting data layer (Phase 1a).
// Run against the local Supabase stack:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/verify-betting.mts
// Exercises: ensureAppUser → grant (true) → grant again (idempotent false) → balance.
import {
  ensureAppUser,
  grantMonthlyAllowance,
  getBalance,
  MONTHLY_ALLOWANCE,
} from '@/lib/betting/credits';

const user = 'user_verify_demo';

await ensureAppUser(user, 'Verify Bot');
const first = await grantMonthlyAllowance(user);
const second = await grantMonthlyAllowance(user);
const balance = await getBalance(user);

console.log(JSON.stringify({ user, firstGrant: first, secondGrant: second, balance, expected: MONTHLY_ALLOWANCE }, null, 2));

if (!first) throw new Error('first grant should have happened');
if (second) throw new Error('second grant must be a no-op this month (idempotency broken)');
if (balance !== MONTHLY_ALLOWANCE) throw new Error(`balance ${balance} != ${MONTHLY_ALLOWANCE}`);

console.log('VERIFY OK — granted once, idempotent within the month, balance correct.');
