'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { STATUSES, type FeedbackStatus } from '@/lib/feedback';

// The two console controls that had an API and no UI.
//
// Feedback triage has shipped four states and a working endpoint since it was
// built, and the only way to move an item was to hand-craft a POST. Thread
// moderation existed but lived inside the PUBLIC /social/threads page, where an
// admin happened to see a pending queue nobody else could.
//
// Both post to the endpoints that already exist and already re-check admin
// server-side — a client control must never be the gate — then router.refresh()
// so the row leaves the server-rendered queue.

const BTN =
  'rounded border border-border px-2.5 py-1 font-mono text-10 uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:border-border-strong hover:text-text disabled:opacity-40';
const BTN_ON = 'rounded border border-brand bg-surface px-2.5 py-1 font-mono text-10 uppercase tracking-[0.12em] text-brand';

function useAction(url: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(body: Record<string, string>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(d.error ?? 'Failed.');
        return;
      }
      router.refresh();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, send };
}

/** Move a feedback item between open / considered / done / closed. The current
 *  state is rendered as the pressed button rather than a separate badge, so the
 *  control and the state cannot disagree. */
export function FeedbackActions({ id, status }: { id: string; status: FeedbackStatus }) {
  const { busy, error, send } = useAction(`/api/feedback/${id}`);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {STATUSES.map(s => (
        <button
          key={s}
          type="button"
          disabled={busy || s === status}
          aria-pressed={s === status}
          onClick={() => send({ status: s })}
          className={s === status ? BTN_ON : BTN}
        >
          {s}
        </button>
      ))}
      {error && <span className="font-mono text-11 text-negative">{error}</span>}
    </div>
  );
}

export function ThreadActions({ id }: { id: string }) {
  const { busy, error, send } = useAction(`/api/threads/${id}`);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" disabled={busy} onClick={() => send({ action: 'approve' })} className={BTN}>
        Approve
      </button>
      <button type="button" disabled={busy} onClick={() => send({ action: 'reject' })} className={BTN}>
        Reject
      </button>
      {error && <span className="font-mono text-11 text-negative">{error}</span>}
    </div>
  );
}
