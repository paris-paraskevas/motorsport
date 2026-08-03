// Shared studio plumbing — a plain module (no 'use client') so BOTH the server
// dashboard page and the client action components can import from it. Pure
// helpers + the one fetch wrapper the client handlers call.

import type { PostStatus } from '@/lib/blog';

export type PostAction = 'submit' | 'approve' | 'reject' | 'reschedule';

/** Label + text-color class per status, shared by the dashboard sections, the
 *  row chips and the editor rail so a status never renders two different ways.
 *  Amber = pending-decision (the one semantic amber kept from the old console);
 *  tint = scheduled; live posts read quiet, they need no attention. */
export const STATUS_META: Record<PostStatus, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'text-text-muted' },
  in_review: { label: 'In review', cls: 'text-amber-700 dark:text-amber-300' },
  approved: { label: 'Scheduled', cls: 'text-tint' },
  published: { label: 'Live', cls: 'text-text-faint' },
  rejected: { label: 'Rejected', cls: 'text-red-400' },
};

/** Default publish time ≈ now + 1h, as the LOCAL wall-clock string an
 *  <input type="datetime-local"> expects (it speaks local time; postAction
 *  converts to UTC on send). */
export function defaultLocalDateTime(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}

/** An ISO instant → the LOCAL wall-clock string for a datetime-local input, so a
 *  scheduled post's re-schedule field pre-fills with its current time. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return defaultLocalDateTime();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return defaultLocalDateTime();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Short human timestamp for row metadata ("5 Aug, 09:00"), viewer-local. */
export function fmtWhen(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** POST /api/blog/[id] { action } from a client handler. Approve/reschedule
 *  carry publishAt: the LOCAL datetime-local string converts to UTC ISO here,
 *  at the boundary. Never throws; the caller renders the error string. */
export async function postAction(
  id: string,
  action: PostAction,
  localWhen?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const body: { action: PostAction; publishAt?: string } = { action };
  if (action === 'approve' || action === 'reschedule') {
    const d = new Date(localWhen ?? defaultLocalDateTime());
    if (Number.isNaN(d.getTime())) return { ok: false, error: 'Pick a valid publish time.' };
    body.publishAt = d.toISOString();
  }
  try {
    const res = await fetch(`/api/blog/${id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return { ok: false, error: d.error ?? 'Failed.' };
    return { ok: true };
  } catch {
    return { ok: false, error: 'Network error. Try again.' };
  }
}
