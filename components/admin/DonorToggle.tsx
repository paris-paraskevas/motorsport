'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Supporter-flag toggle on an /admin/users sign-up row. Sets Clerk
// publicMetadata.donor via PATCH /api/admin/users/[id]; the flag unlocks the
// studio's AI tools for that account. Mirrors AuthorRequestActions: success
// router.refresh()es so the server-rendered row shows the new state.
export function DonorToggle({ userId, donor }: { userId: string; donor: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function toggle() {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ donor: !donor }),
      });
      if (!res.ok) {
        setError(true);
        return;
      }
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={toggle}
      title={donor ? 'Remove the supporter flag' : 'Mark as supporter (unlocks AI tools)'}
      className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors duration-(--duration-fast) disabled:opacity-40 ${
        error
          ? 'border-red-400 text-red-400'
          : donor
            ? 'border-brand text-brand'
            : 'border-border text-text-faint hover:text-text'
      }`}
    >
      {error ? 'failed' : donor ? 'supporter ✓' : 'mark supporter'}
    </button>
  );
}
