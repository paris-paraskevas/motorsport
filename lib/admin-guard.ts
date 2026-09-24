import 'server-only';
import { notFound } from 'next/navigation';
import { currentAccount } from '@/lib/auth/server';
import type { Account } from '@/lib/auth/client';
import { isAdmin, canAuthor } from '@/lib/threads';

// Admin gate for a Server Component / layout: calls notFound() (→ 404) unless the
// signed-in account is an admin. Same role check as isAdmin, but it reads the
// account itself (lib/auth), so an admin page/layout can `await requireAdmin()`
// as its first line.
//
// SERVER-ONLY (enforced by the import above). This deliberately lives OUTSIDE
// lib/threads.ts: threads.ts is pulled into a CLIENT bundle (the ThreadComposer
// client component imports its TITLE_MAX/BODY_MAX constants), and the seam's
// server half carries `server-only`, which a client-reachable module may not
// import. Keeping the session read here keeps threads.ts client-safe.
export async function requireAdmin(): Promise<void> {
  if (!isAdmin(await currentAccount())) notFound();
}

/** Author gate (contributor | writer | admin — canAuthor's ladder) for the
 *  /studio surface. 404s everyone else, INCLUDING anonymous visitors, so the
 *  route's existence leaks nothing. Returns the account: studio pages need the
 *  id to scope queries (a non-admin sees only their own posts) and the role for
 *  admin-only controls. */
export async function requireAuthor(): Promise<Account> {
  const account = await currentAccount();
  if (!account || !canAuthor(account)) notFound();
  return account;
}
