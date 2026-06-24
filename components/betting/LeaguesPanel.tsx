'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Modal } from '@/components/Modal';
import type { UserLeague, LeaderboardRow } from '@/lib/betting/leagues';

// Friend leagues: two discrete buttons open modal popups — Create (name → get a
// share link) and Join (an 8-char code OR a pasted invite link). Below: each
// league's win-rate leaderboard + a copy-invite-link button. Mutations POST to
// /api/bet/league then router.refresh() re-reads the server-rendered data.
export function LeaguesPanel({
  leagues,
  currentUserId,
}: {
  leagues: Array<{ league: UserLeague; rows: LeaderboardRow[] }>;
  currentUserId: string;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<'create' | 'join' | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [invites, setInvites] = useState<Record<string, string>>({});

  function close() {
    setModal(null);
    setName('');
    setCode('');
    setError(null);
    setCreatedLink(null);
    setBusy(false);
  }

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/bet/league', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'create', name: name.trim() }),
      });
      const data = (await res.json()) as { ok?: boolean; id?: string; error?: string };
      if (!res.ok || !data.id) {
        setError(data.error ?? 'Could not create the league.');
        return;
      }
      // Get a shareable invite link to show right away (the "invite friends" step).
      let link: string | null = null;
      try {
        const ir = await fetch('/api/bet/league', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'invite', leagueId: data.id }),
        });
        const id = (await ir.json()) as { token?: string };
        if (id.token) link = `${window.location.origin}/social/leagues/join/${id.token}`;
      } catch {
        /* link is a nice-to-have; the league still exists + shows its code below */
      }
      setCreatedLink(link);
      router.refresh();
    } catch {
      setError('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    const raw = code.trim();
    if (!raw) return;
    setBusy(true);
    setError(null);
    // Accept a pasted invite link (…/join/<token>) or a bare join code.
    const m = raw.match(/join\/([A-Za-z0-9]+)/);
    const body = m ? { action: 'joinByToken', token: m[1] } : { action: 'join', joinCode: raw };
    try {
      const res = await fetch('/api/bet/league', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; id?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not join.');
        return;
      }
      close();
      router.push(data.id ? `/social/leagues/${data.id}` : '/social/leagues');
    } catch {
      setError('Network error — try again.');
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
      const link = `${window.location.origin}/social/leagues/join/${data.token}`;
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
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-display uppercase tracking-wide text-text">Friend leagues</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              close();
              setModal('create');
            }}
            className="rounded bg-brand px-3 py-1.5 font-semibold text-bg"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => {
              close();
              setModal('join');
            }}
            className="rounded border border-white/10 px-3 py-1.5 font-mono text-sm text-text-muted hover:text-text"
          >
            Join
          </button>
        </div>
      </div>

      {error && !modal && <p className="mb-3 font-mono text-xs text-red-400">{error}</p>}

      {leagues.length === 0 ? (
        <p className="font-mono text-sm text-text-muted">No leagues yet — create one and share the link with friends.</p>
      ) : (
        <ul className="space-y-3">
          {leagues.map(({ league, rows }) => (
            <li key={league.id} className="rounded border border-white/10 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <Link
                  href={`/social/leagues/${league.id}`}
                  className="font-display uppercase tracking-wide text-text hover:text-brand"
                >
                  {league.name}
                </Link>
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
                        {i + 1}. {r.userId === currentUserId ? 'You' : r.nickname || r.displayName || `Racer ${r.userId.slice(-4)}`}
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

      {modal === 'create' && (
        <Modal title="Create a league" onClose={close}>
          {createdLink ? (
            <div className="space-y-3">
              <p className="font-mono text-sm text-text">League created. Share this link with friends to invite them:</p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={createdLink}
                  onFocus={e => e.currentTarget.select()}
                  className="min-w-0 flex-1 rounded border border-white/10 bg-white/5 px-2 py-1.5 font-mono text-[11px] text-text-muted"
                />
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(createdLink).catch(() => {})}
                  className="shrink-0 rounded border border-white/10 px-2 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted hover:text-text"
                >
                  Copy
                </button>
              </div>
              <button type="button" onClick={close} className="rounded bg-brand px-4 py-2 font-semibold text-bg">
                Done
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">League name</span>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  maxLength={60}
                  autoFocus
                  placeholder="e.g. Sunday Service"
                  className="mt-1 w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 font-mono text-sm text-text"
                />
              </label>
              <p className="font-mono text-[11px] text-text-faint">
                You&apos;ll get a link to invite friends. (Per-league bet limits + inviting friends directly are coming.)
              </p>
              <button
                type="button"
                onClick={create}
                disabled={busy || !name.trim()}
                className="rounded bg-brand px-4 py-2 font-semibold text-bg disabled:opacity-40"
              >
                {busy ? 'Creating…' : 'Create league'}
              </button>
              {error && <p className="font-mono text-xs text-red-400">{error}</p>}
            </div>
          )}
        </Modal>
      )}

      {modal === 'join' && (
        <Modal title="Join a league" onClose={close}>
          <div className="space-y-3">
            <label className="block">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">Code or invite link</span>
              <input
                value={code}
                onChange={e => setCode(e.target.value)}
                autoFocus
                placeholder="8-char code or pasted link"
                className="mt-1 w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 font-mono text-sm text-text"
              />
            </label>
            <p className="font-mono text-[11px] text-text-faint">
              Paste an invite link a friend sent, or enter the 8-character code.
            </p>
            <button
              type="button"
              onClick={join}
              disabled={busy || !code.trim()}
              className="rounded bg-brand px-4 py-2 font-semibold text-bg disabled:opacity-40"
            >
              {busy ? 'Joining…' : 'Join league'}
            </button>
            {error && <p className="font-mono text-xs text-red-400">{error}</p>}
          </div>
        </Modal>
      )}
    </section>
  );
}
