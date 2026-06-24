'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FriendState } from '@/lib/betting/friends';

// Relationship-aware friend control on a user's profile: send a request, accept
// an incoming one, or reflect a sent/already-friends state. POSTs to /api/friends
// and router.refresh() re-reads the (server-rendered) profile gate.
export function ProfileActions({ targetId, relationship }: { targetId: string; relationship: FriendState }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: 'request' | 'accept') {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, userId: targetId }),
      });
      const d = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(d.error ?? 'Request failed.');
        return;
      }
      router.refresh();
    } catch {
      setError('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {relationship === 'none' && (
        <button
          type="button"
          disabled={busy}
          onClick={() => act('request')}
          className="rounded bg-brand px-4 py-2 font-semibold text-bg disabled:opacity-40"
        >
          Add friend
        </button>
      )}
      {relationship === 'pending-out' && <p className="font-mono text-sm text-text-muted">Friend request sent.</p>}
      {relationship === 'pending-in' && (
        <button
          type="button"
          disabled={busy}
          onClick={() => act('accept')}
          className="rounded bg-brand px-4 py-2 font-semibold text-bg disabled:opacity-40"
        >
          Accept friend request
        </button>
      )}
      {error && <p className="font-mono text-xs text-red-400">{error}</p>}
    </div>
  );
}
