import 'server-only';
import { clerkClient } from '@clerk/nextjs/server';
import type { Account } from './client';
import { accountFromClerkUser } from './server';

// The account seam's directory (PA A1a): what the site reads about accounts other than the signed-in one, the four Backend
// API reads of before behind one module. Over Clerk here; A3 reads three service-role functions over auth.users instead.
// The phase's id rule: an app id (Account.id) is resolved here and is never handed to a provider's admin call as the
// provider's own id once the switch has made the two differ (A3 resolves a legacy id first). A read that fails throws, as
// the provider's calls do: each caller keeps its own fail-soft rule.

/** An account by its app id; null when the provider knows none. */
export async function accountById(id: string): Promise<Account | null> {
  return accountFromClerkUser(await (await clerkClient()).users.getUser(id));
}

/** The newest accounts, newest first, each with its creation time (epoch ms): the Data workspace's card. */
export async function latestAccounts(limit: number): Promise<(Account & { createdAt: number })[]> {
  const { data } = await (await clerkClient()).users.getUserList({ limit, orderBy: '-created_at' });
  return data.flatMap(u => {
    const account = accountFromClerkUser(u);
    return account ? [{ ...account, createdAt: u.createdAt }] : [];
  });
}

/** How many accounts there are. */
export async function accountCount(): Promise<number> {
  return (await clerkClient()).users.getCount();
}

/** The app ids of every admin, the role the site's own gate reads (lib/threads.ts isAdmin). One page of 100 covers the
 *  user base. */
export async function adminAccountIds(): Promise<Set<string>> {
  const { data } = await (await clerkClient()).users.getUserList({ limit: 100 });
  return new Set(data.filter(u => accountFromClerkUser(u)?.role === 'admin').map(u => u.id));
}
