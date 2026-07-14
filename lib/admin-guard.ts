import 'server-only';
import { currentUser } from '@clerk/nextjs/server';
import { notFound } from 'next/navigation';
import { isAdmin } from '@/lib/threads';

// Admin gate for a Server Component / layout: calls notFound() (→ 404) unless the
// current Clerk user is an admin. Same role check as isAdmin, but it resolves the
// current Clerk user itself, so an admin page/layout can `await requireAdmin()` as
// its first line.
//
// SERVER-ONLY (enforced by the import above). This deliberately lives OUTSIDE
// lib/threads.ts: threads.ts is pulled into a CLIENT bundle (the ThreadComposer
// client component imports its TITLE_MAX/BODY_MAX constants), and
// `@clerk/nextjs/server` carries `server-only`, which a client-reachable module
// may not import. Keeping the Clerk dependency here keeps threads.ts client-safe.
export async function requireAdmin(): Promise<void> {
  if (!isAdmin(await currentUser())) notFound();
}
