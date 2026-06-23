'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// The signed-in friend-link landing: accept or decline the pending request that
// was raised server-side (owner → viewer) when this page loaded. Mirrors the
// friend step of JoinLeagueFlow, standalone (no league).
export function FriendInviteFlow({ ownerId, ownerName }: { ownerId: string; ownerName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function respond(accept: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: accept ? 'accept' : 'decline', userId: ownerId }),
      });
      const d = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(d.error ?? 'Could not respond.');
        return;
      }
      router.push('/social/friends');
    } catch {
      setError('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded border border-white/10 p-4">
      <p className="font-mono text-sm text-text">
        <b>{ownerName}</b> wants to be friends.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => respond(true)}
          disabled={busy}
          className="rounded bg-brand px-4 py-2 font-semibold text-bg disabled:opacity-40"
        >
          Accept
        </button>
        <button
          type="button"
          onClick={() => respond(false)}
          disabled={busy}
          className="rounded border border-white/10 px-4 py-2 font-mono text-sm text-text-muted disabled:opacity-40"
        >
          Decline
        </button>
      </div>
      {error && <p className="font-mono text-xs text-red-400">{error}</p>}
    </div>
  );
}
