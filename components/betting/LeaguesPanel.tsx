'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UserLeague, LeaderboardRow } from '@/lib/betting/leagues';

// Friend leagues: create one (get a share code), join by code, and see each
// league's win-rate leaderboard. Mutations POST to /api/bet/league then
// router.refresh() re-reads the server-rendered data.

export function LeaguesPanel({
  leagues,
  currentUserId,
}: {
  leagues: Array<{ league: UserLeague; rows: LeaderboardRow[] }>;
  currentUserId: string;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invites, setInvites] = useState<Record<string, string>>({});

  async function call(body: Record<string, string>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/bet/league', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Request failed.');
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError('Network error — try again.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function invite(leagueId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/bet/league', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'invite', leagueId }),
      });
      const data = (await res.json()) as { ok?: boolean; token?: string; error?: string };
      if (!res.ok || !data.token) {
        setError(data.error ?? 'Could not create an invite link.');
        return;
      }
      const link = `${window.location.origin}/play/leagues/join/${data.token}`;
      setInvites(prev => ({ ...prev, [leagueId]: link }));
      try {
        await navigator.clipboard.writeText(link);
      } catch {
        /* clipboard may be blocked — the link is shown to copy manually */
      }
    } catch {
      setError('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2 className="mb-3 font-display uppercase tracking-wide text-text">Friend leagues</h2>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <form
          onSubmit={async e => {
            e.preventDefault();
            if (await call({ action: 'create', name })) setName('');
          }}
          className="flex flex-col gap-2 rounded border border-white/10 p-3"
        >
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">Create a league</span>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={60}
              placeholder="League name"
              className="min-w-0 flex-1 rounded border border-white/10 bg-white/5 px-2 py-1.5 font-mono text-sm text-text"
            />
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="rounded bg-brand px-3 py-1.5 font-semibold text-bg disabled:opacity-40"
            >
              Create
            </button>
          </div>
        </form>

        <form
          onSubmit={async e => {
            e.preventDefault();
            if (await call({ action: 'join', joinCode: code })) setCode('');
          }}
          className="flex flex-col gap-2 rounded border border-white/10 p-3"
        >
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">Join by code</span>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              maxLength={8}
              placeholder="8-CHAR CODE"
              className="min-w-0 flex-1 rounded border border-white/10 bg-white/5 px-2 py-1.5 font-mono text-sm uppercase tracking-widest text-text"
            />
            <button
              type="submit"
              disabled={busy || !code.trim()}
              className="rounded bg-brand px-3 py-1.5 font-semibold text-bg disabled:opacity-40"
            >
              Join
            </button>
          </div>
        </form>
      </div>

      {error && <p className="mb-3 font-mono text-xs text-red-400">{error}</p>}

      {leagues.length === 0 ? (
        <p className="font-mono text-sm text-text-muted">No leagues yet — create one and share the code with friends.</p>
      ) : (
        <ul className="space-y-3">
          {leagues.map(({ league, rows }) => (
            <li key={league.id} className="rounded border border-white/10 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display uppercase tracking-wide text-text">{league.name}</span>
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
                  code {league.joinCode} · {league.memberCount} member{league.memberCount === 1 ? '' : 's'}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => invite(league.id)}
                  disabled={busy}
                  className="rounded border border-white/10 px-2 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted hover:border-text-faint disabled:opacity-40"
                >
                  {invites[league.id] ? 'Copied — copy again' : 'Copy invite link'}
                </button>
                {invites[league.id] && (
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-text-muted">{invites[league.id]}</span>
                )}
              </div>
              {rows.length === 0 ? (
                <p className="mt-2 font-mono text-xs text-text-muted">No members yet.</p>
              ) : (
                <ol className="mt-2 space-y-1">
                  {rows.map((r, i) => (
                    <li key={r.userId} className="flex items-center justify-between font-mono text-sm">
                      <span className="text-text">
                        {i + 1}. {r.userId === currentUserId ? 'You' : `Member ${r.userId.slice(-4)}`}
                      </span>
                      <span className="text-text-muted">
                        {r.wins}/{r.placed} · {(r.winRate * 100).toFixed(0)}%
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
