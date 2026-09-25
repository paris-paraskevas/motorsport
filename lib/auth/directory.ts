import 'server-only';
import { betDb } from '@/lib/betting/client';
import type { Account } from './client';

// The account seam's directory (PA A1a; over Supabase Auth since A3): what the site reads about accounts other than the
// signed-in one, through the three service-role functions over auth.users (supabase/migrations/20260924200000_accounts.sql)
// and never a query. The phase's id rule: an app id (Account.id) is a legacy id for an imported account and the Supabase
// id for a newer one; the functions match either, and no app id is ever handed to a provider's admin call as the
// provider's own id (a person's own actions use the session's sub, app/api/account). A read that fails throws: each
// caller keeps its own fail-soft rule.

interface DirectoryRow {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
  email: string | null;
  role: string | null;
  donor: boolean | null;
}
interface Stats {
  total: number;
  newest: { id: string; role: string | null; created_at: string }[];
}

/** An Account of a directory row. */
export function accountFromDirectory(r: DirectoryRow): Account {
  return { id: r.id, email: r.email ?? null, name: r.name ?? null, username: r.username ?? null, imageUrl: r.image ?? null, role: r.role ?? null, donor: r.donor === true };
}

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await betDb().rpc(fn, args);
  if (error) throw new Error(`${fn} failed: ${error.message}`);
  return data as T;
}

/** The accounts behind app ids, by id; an id nobody holds is absent. */
export async function accountsByIds(ids: string[]): Promise<Map<string, Account>> {
  if (ids.length === 0) return new Map();
  const rows = (await call<DirectoryRow[] | null>('account_directory', { p_ids: ids })) ?? [];
  return new Map(rows.map(r => [r.id, accountFromDirectory(r)]));
}

/** An account by its app id; null when the provider knows none. */
export async function accountById(id: string): Promise<Account | null> {
  return (await accountsByIds([id])).get(id) ?? null;
}

/** The newest accounts, newest first, each with its creation time (epoch ms): the Data workspace's card. */
export async function latestAccounts(limit: number): Promise<(Account & { createdAt: number })[]> {
  const stats = await call<Stats | null>('account_stats');
  const newest = (stats?.newest ?? []).slice(0, limit);
  const accounts = await accountsByIds(newest.map(n => n.id));
  return newest.flatMap(n => {
    const account = accounts.get(n.id);
    return account ? [{ ...account, createdAt: Date.parse(n.created_at) }] : [];
  });
}

/** How many accounts there are. */
export async function accountCount(): Promise<number> {
  return (await call<Stats | null>('account_stats'))?.total ?? 0;
}

/** The app ids of every admin, the role the site's own gate reads (lib/threads.ts isAdmin). PostgREST hands a set of
 *  scalars as the values or as one-key rows, by version; both are read. */
export async function adminAccountIds(): Promise<Set<string>> {
  const rows = (await call<(string | { account_admins: string })[] | null>('account_admins')) ?? [];
  return new Set(rows.map(r => (typeof r === 'string' ? r : r.account_admins)).filter((r): r is string => typeof r === 'string'));
}
