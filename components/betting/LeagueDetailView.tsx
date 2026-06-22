'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LeagueDetail, LeagueMemberDetail } from '@/lib/betting/leagues';

const FALLBACK_COLOR = '#9ca3af';

// The dedicated league page: ranked members (colour + nickname + win-rate), an
// invite link, owner rename, per-member profile editing (anyone can set any
// member's nickname/colour), and friend actions. Mutations POST to /api/bet/league
// or /api/friends, then router.refresh() re-reads the server-rendered detail.
export function LeagueDetailView({ league, currentUserId }: { league: LeagueDetail; currentUserId: string }) {
  void currentUserId;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(league.name);
  const [confirmDisband, setConfirmDisband] = useState(false);

  async function call(url: string, body: Record<string, string>, refresh = true): Promise<Record<string, unknown> | null> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        setError((data.error as string) ?? 'Request failed.');
        return null;
      }
      if (refresh) router.refresh();
      return data;
    } catch {
      setError('Network error — try again.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite() {
    const data = await call('/api/bet/league', { action: 'invite', leagueId: league.id }, false);
    const token = data?.token as string | undefined;
    if (token) {
      const link = `${window.location.origin}/play/leagues/join/${token}`;
      setInvite(link);
      try {
        await navigator.clipboard.writeText(link);
      } catch {
        /* clipboard blocked — link shown to copy manually */
      }
    }
  }

  async function disband() {
    const r = await call('/api/bet/league', { action: 'disband', leagueId: league.id }, false);
    if (r) router.push('/play');
  }

  const memberName = (m: LeagueMemberDetail) => m.nickname || m.displayName || `Racer ${m.userId.slice(-4)}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {renaming && league.isOwner ? (
          <form
            onSubmit={async e => {
              e.preventDefault();
              if (await call('/api/bet/league', { action: 'rename', leagueId: league.id, name })) setRenaming(false);
            }}
            className="flex gap-2"
          >
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={60}
              className="rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-sm text-text"
            />
            <button type="submit" disabled={busy} className="rounded bg-brand px-3 py-1 font-semibold text-bg disabled:opacity-40">
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setRenaming(false);
                setName(league.name);
              }}
              className="rounded border border-white/10 px-3 py-1 font-mono text-sm text-text-muted"
            >
              Cancel
            </button>
          </form>
        ) : (
          <h1 className="font-display text-2xl font-extrabold uppercase tracking-wide text-text">
            {league.name}
            {league.isOwner && (
              <button
                type="button"
                onClick={() => setRenaming(true)}
                className="ml-2 align-middle font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted hover:text-text"
              >
                edit
              </button>
            )}
          </h1>
        )}
        <button
          type="button"
          onClick={copyInvite}
          disabled={busy}
          className="rounded border border-white/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted hover:border-text-faint disabled:opacity-40"
        >
          {invite ? 'Copied — copy again' : 'Copy invite link'}
        </button>
      </div>
      {invite && <p className="truncate font-mono text-[11px] text-text-muted">{invite}</p>}
      {error && <p className="font-mono text-xs text-red-400">{error}</p>}

      <ol className="space-y-2">
        {league.members.map((m, i) => (
          <li key={m.userId} className="rounded border border-white/10 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2 font-mono text-sm text-text">
                <span className="text-text-muted">{i + 1}.</span>
                <span
                  className="inline-block h-3 w-3 rounded-full border border-white/20"
                  style={{ backgroundColor: m.color || FALLBACK_COLOR }}
                />
                {memberName(m)}
                {m.isYou && <span className="text-text-muted"> (you)</span>}
              </span>
              <span className="flex items-center gap-3 font-mono text-xs text-text-muted">
                <span>
                  {m.wins}/{m.placed} · {(m.winRate * 100).toFixed(0)}%
                </span>
                <button type="button" onClick={() => setEditing(editing === m.userId ? null : m.userId)} className="hover:text-text">
                  edit
                </button>
                {!m.isYou && m.friendState === 'none' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => call('/api/friends', { action: 'request', userId: m.userId })}
                    className="text-brand disabled:opacity-40"
                  >
                    add friend
                  </button>
                )}
                {!m.isYou && m.friendState === 'pending-out' && <span>requested</span>}
                {!m.isYou && m.friendState === 'pending-in' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => call('/api/friends', { action: 'accept', userId: m.userId })}
                    className="text-brand disabled:opacity-40"
                  >
                    accept
                  </button>
                )}
                {!m.isYou && m.friendState === 'friends' && <span>friend</span>}
                {league.isOwner && !m.isYou && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => call('/api/bet/league', { action: 'kick', leagueId: league.id, targetUserId: m.userId })}
                    className="text-red-400/80 hover:text-red-400 disabled:opacity-40"
                  >
                    kick
                  </button>
                )}
              </span>
            </div>
            {editing === m.userId && (
              <ProfileEditor
                member={m}
                busy={busy}
                onSave={(nickname, color) =>
                  call('/api/bet/league', { action: 'setProfile', leagueId: league.id, targetUserId: m.userId, nickname, color }).then(
                    r => {
                      if (r) setEditing(null);
                    },
                  )
                }
              />
            )}
          </li>
        ))}
      </ol>

      {league.isOwner &&
        (confirmDisband ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
            <span className="font-mono text-xs text-red-400">Disband {league.name} for everyone?</span>
            <button
              type="button"
              onClick={disband}
              disabled={busy}
              className="rounded bg-red-500/80 px-3 py-1 font-semibold text-bg disabled:opacity-40"
            >
              Confirm disband
            </button>
            <button
              type="button"
              onClick={() => setConfirmDisband(false)}
              className="rounded border border-white/10 px-3 py-1 font-mono text-sm text-text-muted"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="border-t border-white/10 pt-3">
            <button
              type="button"
              onClick={() => setConfirmDisband(true)}
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-red-400/80 hover:text-red-400"
            >
              Disband league
            </button>
          </div>
        ))}
    </div>
  );
}

function ProfileEditor({
  member,
  onSave,
  busy,
}: {
  member: LeagueMemberDetail;
  onSave: (nickname: string, color: string) => void;
  busy: boolean;
}) {
  const [nickname, setNickname] = useState(member.nickname ?? '');
  const [color, setColor] = useState(member.color ?? '#888888');
  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        onSave(nickname, color);
      }}
      className="mt-2 flex flex-wrap items-center gap-2 border-t border-white/10 pt-2"
    >
      <input
        value={nickname}
        onChange={e => setNickname(e.target.value)}
        maxLength={40}
        placeholder="Nickname"
        className="min-w-0 flex-1 rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-sm text-text"
      />
      <input
        type="color"
        value={color}
        onChange={e => setColor(e.target.value)}
        className="h-8 w-10 rounded border border-white/10 bg-transparent"
        aria-label="Colour"
      />
      <button type="submit" disabled={busy} className="rounded bg-brand px-3 py-1 font-semibold text-bg disabled:opacity-40">
        Save
      </button>
    </form>
  );
}
