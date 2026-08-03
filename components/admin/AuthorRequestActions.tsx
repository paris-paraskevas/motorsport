'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Approve / decline buttons on an /admin/users author-application row. Approve
// grants the contributor role and emails the applicant; decline just emails.
// Success router.refresh()es so the row leaves the server-rendered queue.
export function AuthorRequestActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(action: 'approve' | 'decline') {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/author-requests/${id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => decide('approve')}
        className="rounded bg-brand-fill px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        Approve as contributor
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => decide('decline')}
        className="rounded border border-border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:text-text disabled:opacity-40"
      >
        Decline
      </button>
      {error && <span className="font-mono text-xs text-red-400">{error}</span>}
    </div>
  );
}
