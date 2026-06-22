'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// The signed-in invite landing: step 1 accept/skip the inviter's friend request,
// step 2 join the league. Sequential, both explicit (the operator's flow). The
// pending friend request was already raised server-side when this page loaded.
export function JoinLeagueFlow({
  token,
  leagueName,
  inviterId,
  inviterName,
}: {
  token: string;
  leagueName: string;
  inviterId: string;
  inviterName: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<'friend' | 'league'>('friend');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inviter = inviterName ?? `Racer ${inviterId.slice(-4)}`;

  async function friend(accept: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: accept ? 'accept' : 'decline', userId: inviterId }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        setError(d.error ?? 'Could not respond.');
        return;
      }
      setStep('league');
    } catch {
      setError('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/bet/league', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'joinByToken', token }),
      });
      const d = (await res.json()) as { ok?: boolean; id?: string; error?: string };
      if (!res.ok) {
        setError(d.error ?? 'Could not join.');
        return;
      }
      router.push(d.id ? `/social/leagues/${d.id}` : '/social/leagues');
    } catch {
      setError('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {step === 'friend' ? (
        <div className="space-y-3 rounded border border-white/10 p-4">
          <p className="font-mono text-sm text-text">
            <b>{inviter}</b> wants to be friends.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => friend(true)}
              disabled={busy}
              className="rounded bg-brand px-4 py-2 font-semibold text-bg disabled:opacity-40"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => friend(false)}
              disabled={busy}
              className="rounded border border-white/10 px-4 py-2 font-mono text-sm text-text-muted disabled:opacity-40"
            >
              Skip
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 rounded border border-white/10 p-4">
          <p className="font-mono text-sm text-text">
            Join <b>{leagueName}</b>?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={join}
              disabled={busy}
              className="rounded bg-brand px-4 py-2 font-semibold text-bg disabled:opacity-40"
            >
              Join league
            </button>
            <button
              type="button"
              onClick={() => router.push('/social/leagues')}
              disabled={busy}
              className="rounded border border-white/10 px-4 py-2 font-mono text-sm text-text-muted disabled:opacity-40"
            >
              Not now
            </button>
          </div>
        </div>
      )}
      {error && <p className="font-mono text-xs text-red-400">{error}</p>}
    </div>
  );
}
