'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Thread } from '@/lib/threads';

// Admin-only pending queue. Approve → public; reject → hidden. POSTs to
// /api/threads/[id] (admin-gated server-side); router.refresh() re-reads.
export function ThreadModeration({ threads }: { threads: Thread[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(id: string, action: 'approve' | 'reject') {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/threads/${id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const d = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(d.error ?? 'Failed.');
        return;
      }
      router.refresh();
    } catch {
      setError('Network error — try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <ul className="space-y-3">
        {threads.map(t => (
          <li key={t.id} className="rounded border border-border p-3">
            <div className="font-semibold text-text">{t.title}</div>
            <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.12em] text-text-faint">
              {t.authorName ?? `Racer ${t.authorId.slice(-4)}`}
            </div>
            <p className="mb-2 whitespace-pre-wrap text-sm text-text-muted">{t.body}</p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy === t.id}
                onClick={() => decide(t.id, 'approve')}
                className="rounded bg-brand px-3 py-1 font-semibold text-bg disabled:opacity-40"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={busy === t.id}
                onClick={() => decide(t.id, 'reject')}
                className="rounded border border-border px-3 py-1 font-mono text-sm text-text-muted disabled:opacity-40"
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 font-mono text-xs text-red-400">{error}</p>}
    </>
  );
}
