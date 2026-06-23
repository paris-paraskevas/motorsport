'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Friend, IncomingRequest, OutgoingRequest, SearchResult, FriendState } from '@/lib/betting/friends';

// Manage friends independently of leagues: search people by name + send requests,
// accept/decline incoming, cancel sent, and remove existing friends. Mutations POST
// to /api/friends; search hits GET /api/friends?q=. router.refresh() re-reads the
// server-rendered lists after a change.
export function FriendsPanel({
  friends,
  incoming,
  outgoing,
  myUserId,
}: {
  friends: Friend[];
  incoming: IncomingRequest[];
  outgoing: OutgoingRequest[];
  myUserId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [linkCopied, setLinkCopied] = useState<string | null>(null);

  async function copyFriendLink() {
    const link = `${window.location.origin}/social/friends/add/${myUserId}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      /* clipboard may be blocked — the link is shown to copy manually */
    }
    setLinkCopied(link);
  }

  // Debounced name search.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/friends?q=${encodeURIComponent(term)}`);
        const d = (await res.json()) as { results?: SearchResult[] };
        setResults(d.results ?? []);
      } catch {
        /* ignore — keep prior results */
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  async function act(body: Record<string, string>, onOk?: () => void) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(d.error ?? 'Request failed.');
        return;
      }
      onOk?.();
      router.refresh();
    } catch {
      setError('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }

  // Optimistically reflect a sent/accepted request in the live search results.
  const bump = (userId: string, state: FriendState) =>
    setResults(rs => rs.map(r => (r.userId === userId ? { ...r, friendState: state } : r)));

  const label = (n: string | null, id: string) => n ?? `Racer ${id.slice(-4)}`;

  return (
    <section className="space-y-6">
      {/* Search + add */}
      <div>
        <h2 className="mb-2 font-display uppercase tracking-wide text-text">Add friends</h2>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search people by name…"
          className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-text"
        />
        {q.trim().length >= 2 && (
          <ul className="mt-2 space-y-1">
            {searching && results.length === 0 && <li className="px-1 font-mono text-xs text-text-muted">Searching…</li>}
            {!searching && results.length === 0 && (
              <li className="px-1 font-mono text-xs text-text-muted">No one found by that name.</li>
            )}
            {results.map(r => (
              <li
                key={r.userId}
                className="flex items-center justify-between rounded border border-white/10 px-3 py-2 font-mono text-sm"
              >
                <span className="text-text">{label(r.displayName, r.userId)}</span>
                {r.friendState === 'none' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act({ action: 'request', userId: r.userId }, () => bump(r.userId, 'pending-out'))}
                    className="text-brand disabled:opacity-40"
                  >
                    Add friend
                  </button>
                )}
                {r.friendState === 'pending-out' && <span className="text-text-muted">Requested</span>}
                {r.friendState === 'pending-in' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act({ action: 'accept', userId: r.userId }, () => bump(r.userId, 'friends'))}
                    className="text-brand disabled:opacity-40"
                  >
                    Accept
                  </button>
                )}
                {r.friendState === 'friends' && <span className="text-text-muted">Friend</span>}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">Or share your link</span>
          <button
            type="button"
            onClick={copyFriendLink}
            className="rounded border border-white/10 px-2 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted hover:border-text-faint"
          >
            {linkCopied ? 'Copied — copy again' : 'Copy friend link'}
          </button>
          {linkCopied && (
            <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-text-muted">{linkCopied}</span>
          )}
        </div>
      </div>

      {error && <p className="font-mono text-xs text-red-400">{error}</p>}

      {/* Incoming requests */}
      {incoming.length > 0 && (
        <div>
          <h2 className="mb-2 font-display uppercase tracking-wide text-text">Requests ({incoming.length})</h2>
          <ul className="space-y-2">
            {incoming.map(r => (
              <li
                key={r.requesterId}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-white/10 px-3 py-2 font-mono text-sm"
              >
                <span className="text-text">{label(r.displayName, r.requesterId)} wants to be friends</span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act({ action: 'accept', userId: r.requesterId })}
                    className="rounded bg-brand px-3 py-1 font-semibold text-bg disabled:opacity-40"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act({ action: 'decline', userId: r.requesterId })}
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

      {/* Sent (pending outgoing) */}
      {outgoing.length > 0 && (
        <div>
          <h2 className="mb-2 font-display uppercase tracking-wide text-text">Sent</h2>
          <ul className="space-y-1">
            {outgoing.map(o => (
              <li
                key={o.addresseeId}
                className="flex items-center justify-between rounded border border-white/10 px-3 py-2 font-mono text-sm"
              >
                <span className="text-text">
                  {label(o.displayName, o.addresseeId)} <span className="text-text-muted">· pending</span>
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act({ action: 'remove', userId: o.addresseeId })}
                  className="text-text-muted hover:text-red-400 disabled:opacity-40"
                >
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Friends */}
      <div>
        <h2 className="mb-2 font-display uppercase tracking-wide text-text">Friends</h2>
        {friends.length === 0 ? (
          <p className="font-mono text-sm text-text-muted">
            No friends yet — search by name above, or join a league via an invite link.
          </p>
        ) : (
          <ul className="space-y-1">
            {friends.map(f => (
              <li
                key={f.userId}
                className="flex items-center justify-between rounded border border-white/10 px-3 py-2 font-mono text-sm"
              >
                <span className="text-text">{label(f.displayName, f.userId)}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act({ action: 'remove', userId: f.userId })}
                  className="text-text-muted hover:text-red-400 disabled:opacity-40"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
