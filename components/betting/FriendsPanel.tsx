'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Friend, IncomingRequest } from '@/lib/betting/friends';

// Your friends + incoming friend requests. Accept/decline POST to /api/friends
// then router.refresh() re-reads the server-rendered lists (the LeaguesPanel
// pattern). Sending requests happens from a league (P2/P3), not here.
export function FriendsPanel({ friends, incoming }: { friends: Friend[]; incoming: IncomingRequest[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function respond(requesterId: string, action: 'accept' | 'decline') {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, userId: requesterId }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Request failed.');
        return;
      }
      router.refresh();
    } catch {
      setError('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }

  const label = (n: string | null, id: string) => n ?? `Racer ${id.slice(-4)}`;

  return (
    <section>
      <h2 className="mb-3 font-display uppercase tracking-wide text-text">Friends</h2>

      {incoming.length > 0 && (
        <div className="mb-4 rounded border border-white/10 p-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
            Requests ({incoming.length})
          </span>
          <ul className="mt-2 space-y-2">
            {incoming.map(r => (
              <li key={r.requesterId} className="flex flex-wrap items-center justify-between gap-2 font-mono text-sm">
                <span className="text-text">{label(r.displayName, r.requesterId)} wants to be friends</span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => respond(r.requesterId, 'accept')}
                    className="rounded bg-brand px-3 py-1 font-semibold text-bg disabled:opacity-40"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => respond(r.requesterId, 'decline')}
                    className="rounded border border-white/10 px-3 py-1 text-text-muted disabled:opacity-40"
                  >
                    Decline
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="mb-3 font-mono text-xs text-red-400">{error}</p>}

      {friends.length === 0 ? (
        <p className="font-mono text-sm text-text-muted">
          No friends yet — join a league via an invite link, or add members from a league page.
        </p>
      ) : (
        <ul className="space-y-1">
          {friends.map(f => (
            <li
              key={f.userId}
              className="flex items-center justify-between rounded border border-white/10 px-3 py-2 font-mono text-sm"
            >
              <span className="text-text">{label(f.displayName, f.userId)}</span>
              <span className="text-[11px] uppercase tracking-[0.14em] text-text-muted">friend</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
