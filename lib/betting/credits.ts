import { betDb } from './client';

// Server-only credit operations over the append-only ledger. The DB is the
// source of truth: balance = SUM(credit_ledger.delta); the monthly grant's
// once-per-month guarantee is enforced in the `grant_monthly` SQL function.

// Deliberately lean (design doc §8): enough to stay engaged, not enough to feel
// rich. Persistent bankroll, so this is the only recurring inflow besides wins.
export const MONTHLY_ALLOWANCE = 1000;

/** Mirror a Clerk user into app_user (no-op if already present; never clobbers). */
export async function ensureAppUser(clerkUserId: string, displayName?: string): Promise<void> {
  const { error } = await betDb()
    .from('app_user')
    .upsert(
      { clerk_user_id: clerkUserId, display_name: displayName ?? null },
      { onConflict: 'clerk_user_id', ignoreDuplicates: true },
    );
  if (error) throw new Error(`ensureAppUser failed: ${error.message}`);
}

/** Spendable balance = SUM of the user's ledger deltas (0 if none). */
export async function getBalance(clerkUserId: string): Promise<number> {
  const { data, error } = await betDb()
    .from('user_balance')
    .select('balance')
    .eq('user_id', clerkUserId)
    .maybeSingle();
  if (error) throw new Error(`getBalance failed: ${error.message}`);
  return Number(data?.balance ?? 0);
}

/**
 * Grant this month's free allowance. Idempotent per calendar month (enforced in
 * SQL). Returns true if granted now, false if the user already had it.
 */
export async function grantMonthlyAllowance(
  clerkUserId: string,
  amount: number = MONTHLY_ALLOWANCE,
): Promise<boolean> {
  const { data, error } = await betDb().rpc('grant_monthly', {
    p_user_id: clerkUserId,
    p_amount: amount,
  });
  if (error) throw new Error(`grantMonthlyAllowance failed: ${error.message}`);
  return data != null;
}

/**
 * Grant this month's allowance to EVERY user, in one set-based statement (the
 * cron entrypoint). Idempotent per calendar month, so safe to run daily.
 * Returns how many users were granted this run.
 */
export async function grantMonthlyToAll(amount: number = MONTHLY_ALLOWANCE): Promise<number> {
  const { data, error } = await betDb().rpc('grant_monthly_all', { p_amount: amount });
  if (error) throw new Error(`grantMonthlyToAll failed: ${error.message}`);
  return Number(data ?? 0);
}
