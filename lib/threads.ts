import { betDb, isBettingConfigured } from './betting/client';
import { displayNames } from './betting/friends';

// Server-only. Community threads (W7): signed-in users submit top-level posts
// (title + body) that are public only after an admin approves. RLS-on /
// no-policies / service_role-only, like the rest of the betting schema; all
// access goes through here. Display names resolve at read time (never stored).

export type ThreadStatus = 'pending' | 'approved' | 'rejected';

export interface Thread {
  id: string;
  authorId: string;
  authorName: string | null;
  title: string;
  body: string;
  status: ThreadStatus;
  /** Optional series tag (a slug from content/series/<slug>). null = untagged. */
  seriesSlug: string | null;
  createdAt: string;
}

export const TITLE_MAX = 140;
export const BODY_MAX = 5000;

/** Admin = Clerk `publicMetadata.role === 'admin'` (no Organizations product). */
export function isAdmin(user: { publicMetadata?: { role?: unknown } } | null | undefined): boolean {
  return user?.publicMetadata?.role === 'admin';
}

function toThread(r: Record<string, unknown>, name: string | null): Thread {
  return {
    id: r.id as string,
    authorId: r.author_id as string,
    authorName: name,
    title: r.title as string,
    body: r.body as string,
    status: r.status as ThreadStatus,
    seriesSlug: (r.series_slug as string | null) ?? null,
    createdAt: r.created_at as string,
  };
}

/** Submit a thread (lands `pending`). Caller must be an onboarded app_user.
 *  `seriesSlug` is optional — null/empty tags the thread as general discussion.
 *  Slug validity is the caller's job (the API checks it against lib/series). */
export async function createThread(
  authorId: string,
  title: string,
  body: string,
  seriesSlug?: string | null,
): Promise<string> {
  const t = title.trim();
  const b = body.trim();
  if (!t || t.length > TITLE_MAX) throw new Error(`title must be 1–${TITLE_MAX} characters`);
  if (!b || b.length > BODY_MAX) throw new Error(`body must be 1–${BODY_MAX} characters`);
  const slug = seriesSlug?.trim() || null;
  const { data, error } = await betDb()
    .from('thread')
    .insert({ author_id: authorId, title: t, body: b, series_slug: slug })
    .select('id')
    .single();
  if (error) throw new Error(`createThread failed: ${error.message}`);
  return data.id as string;
}

/** Threads in a given status, newest first, author names resolved.
 *  Pass `seriesSlug` to return only threads tagged with that series. */
export async function listThreads(status: ThreadStatus, seriesSlug?: string): Promise<Thread[]> {
  let q = betDb()
    .from('thread')
    .select('id, author_id, title, body, status, series_slug, created_at')
    .eq('status', status);
  if (seriesSlug) q = q.eq('series_slug', seriesSlug);
  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) throw new Error(`listThreads failed: ${error.message}`);
  const rows = data ?? [];
  const names = await displayNames([...new Set(rows.map(r => r.author_id as string))]);
  return rows.map(r => toThread(r, names.get(r.author_id as string) ?? null));
}

/** Slugs of series that have >=1 APPROVED thread — lets a series page show a
 *  "Threads" link only when there's something to read. One cheap aggregate over
 *  the (status, series_slug) index. Fail-soft: returns an empty set if Supabase
 *  isn't configured or the query errors, so the series page never breaks on it. */
export async function seriesWithThreads(): Promise<Set<string>> {
  if (!isBettingConfigured()) return new Set();
  try {
    const { data, error } = await betDb()
      .from('thread')
      .select('series_slug')
      .eq('status', 'approved')
      .not('series_slug', 'is', null);
    if (error || !data) return new Set();
    return new Set(data.map(r => r.series_slug as string).filter(Boolean));
  } catch {
    return new Set();
  }
}

/** One thread (any status), or null. The page gates who may see a non-approved one. */
export async function getThread(id: string): Promise<Thread | null> {
  const { data, error } = await betDb()
    .from('thread')
    .select('id, author_id, title, body, status, series_slug, created_at')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  const names = await displayNames([data.author_id as string]);
  return toThread(data, names.get(data.author_id as string) ?? null);
}

/** Approve or reject a pending thread (admin only — the caller must be verified
 *  admin before this is reached). Records who decided + when. */
export async function decideThread(id: string, adminId: string, approve: boolean): Promise<void> {
  // Only a PENDING thread can be decided — a second decision (double-click / race)
  // hits zero rows, so it can't flip an already-decided thread or clobber its
  // decided_at/decided_by audit trail.
  const { error, count } = await betDb()
    .from('thread')
    .update(
      { status: approve ? 'approved' : 'rejected', decided_at: new Date().toISOString(), decided_by: adminId },
      { count: 'exact' },
    )
    .eq('id', id)
    .eq('status', 'pending');
  if (error) throw new Error(`decideThread failed: ${error.message}`);
  if (!count) throw new Error('thread is not pending (already decided?)');
}
