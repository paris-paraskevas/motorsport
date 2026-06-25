import { betDb, isBettingConfigured } from './betting/client';
import { displayNames } from './betting/friends';

// Server-only. Staff-only feedback board (bugs / feature requests / comments),
// posted + read by staff (admin + moderator); everyday users can't reach the
// page or its API (gated by isStaff in lib/threads). RLS-on / no-policies /
// service_role-only; names resolve at read time. Mirrors lib/threads.

export type FeedbackKind = 'bug' | 'feature' | 'comment';
export type FeedbackStatus = 'open' | 'considered' | 'done' | 'closed';

export interface FeedbackItem {
  id: string;
  authorId: string;
  authorName: string | null;
  kind: FeedbackKind;
  title: string;
  body: string;
  status: FeedbackStatus;
  createdAt: string;
}

export const KINDS: FeedbackKind[] = ['bug', 'feature', 'comment'];
export const STATUSES: FeedbackStatus[] = ['open', 'considered', 'done', 'closed'];
export const TITLE_MAX = 140;
export const BODY_MAX = 5000;

function toItem(r: Record<string, unknown>, name: string | null): FeedbackItem {
  return {
    id: r.id as string,
    authorId: r.author_id as string,
    authorName: name,
    kind: r.kind as FeedbackKind,
    title: r.title as string,
    body: r.body as string,
    status: r.status as FeedbackStatus,
    createdAt: r.created_at as string,
  };
}

/** Post a feedback item (staff only — the caller must be verified staff). */
export async function createFeedback(
  authorId: string,
  kind: FeedbackKind,
  title: string,
  body: string,
): Promise<string> {
  const t = title.trim();
  const b = body.trim();
  const k: FeedbackKind = KINDS.includes(kind) ? kind : 'comment';
  if (!t || t.length > TITLE_MAX) throw new Error(`title must be 1–${TITLE_MAX} characters`);
  if (!b || b.length > BODY_MAX) throw new Error(`body must be 1–${BODY_MAX} characters`);
  const { data, error } = await betDb()
    .from('feedback')
    .insert({ author_id: authorId, kind: k, title: t, body: b })
    .select('id')
    .single();
  if (error) throw new Error(`createFeedback failed: ${error.message}`);
  return data.id as string;
}

/** All feedback, newest first, names resolved (staff-only caller). Fail-soft. */
export async function listFeedback(): Promise<FeedbackItem[]> {
  if (!isBettingConfigured()) return [];
  try {
    const { data, error } = await betDb()
      .from('feedback')
      .select('id, author_id, kind, title, body, status, created_at')
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    const names = await displayNames([...new Set(data.map(r => r.author_id as string))]);
    return data.map(r => toItem(r, names.get(r.author_id as string) ?? null));
  } catch {
    return [];
  }
}

/** Move an item's status (admin only — the caller must be verified admin). */
export async function setFeedbackStatus(id: string, status: FeedbackStatus): Promise<void> {
  if (!STATUSES.includes(status)) throw new Error('unknown status');
  const { error } = await betDb()
    .from('feedback')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(`setFeedbackStatus failed: ${error.message}`);
}
