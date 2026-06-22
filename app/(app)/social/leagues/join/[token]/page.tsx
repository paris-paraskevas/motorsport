import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { auth, currentUser } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';
import { ensureAppUser, ensureBettingUser } from '@/lib/betting/credits';
import { getInvite } from '@/lib/betting/leagues';
import { sendFriendRequest, setDisplayNameIfMissing, clerkDisplayName } from '@/lib/betting/friends';
import { JoinLeagueFlow } from '@/components/betting/JoinLeagueFlow';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Join league', robots: { index: false, follow: false } };

function frame(children: ReactNode) {
  return (
    <div className="mx-auto max-w-md p-6 pb-16">
      <h1 className="mb-4 font-display text-2xl font-extrabold uppercase tracking-wide text-text">
        Paddock Betting<span className="text-brand">.</span>
      </h1>
      {children}
    </div>
  );
}

export default async function JoinLeaguePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!isBettingConfigured()) {
    return frame(<p className="font-mono text-sm text-text-muted">Betting isn&apos;t live yet.</p>);
  }

  const invite = await getInvite(token);
  if (!invite) {
    return frame(
      <div className="font-mono text-sm text-text-muted">
        <p className="mb-3">This invite link is invalid or has expired.</p>
        <Link href="/social/leagues" className="text-brand">
          Go to your leagues →
        </Link>
      </div>,
    );
  }

  const inviter = invite.inviterName ?? `Racer ${invite.inviterId.slice(-4)}`;
  const { userId } = await auth();

  if (!userId) {
    const back = encodeURIComponent(`/social/leagues/join/${token}`);
    return frame(
      <div className="space-y-4">
        <p className="font-mono text-sm text-text">
          <b>{inviter}</b> invited you to <b>{invite.leagueName}</b> on Paddock Betting — free credits, friend leagues,
          no cashout.
        </p>
        <div className="flex flex-col gap-2">
          <Link href={`/sign-up?redirect_url=${back}`} className="rounded bg-brand px-4 py-2 text-center font-semibold text-bg">
            Create an account &amp; join
          </Link>
          <Link
            href={`/sign-in?redirect_url=${back}`}
            className="rounded border border-white/10 px-4 py-2 text-center font-mono text-sm text-text-muted"
          >
            I already have an account
          </Link>
        </div>
      </div>,
    );
  }

  if (userId === invite.inviterId) {
    return frame(
      <div className="font-mono text-sm text-text-muted">
        <p className="mb-3">
          This is your own invite link — share it with friends to grow <b>{invite.leagueName}</b>.
        </p>
        <Link href="/social/leagues" className="text-brand">
          Back to your leagues →
        </Link>
      </div>,
    );
  }

  // Signed in and not the inviter: fully onboard the viewer FIRST (app_user row +
  // monthly credits) — arriving straight from sign-up on the invite link, they may
  // never have visited /play, and the friend-request + membership FKs require their
  // app_user row to exist. Then backfill the name and raise the pending friend
  // request (inviter → viewer) so the flow below can accept it.
  const dn = clerkDisplayName(await currentUser());
  await ensureBettingUser(userId, dn ?? undefined);
  await setDisplayNameIfMissing(userId, dn);
  await ensureAppUser(invite.inviterId);
  await sendFriendRequest(invite.inviterId, userId);

  return frame(
    <div className="space-y-4">
      <p className="font-mono text-sm text-text-muted">
        <b className="text-text">{inviter}</b> invited you to <b className="text-text">{invite.leagueName}</b>.
      </p>
      <JoinLeagueFlow
        token={token}
        leagueName={invite.leagueName}
        inviterId={invite.inviterId}
        inviterName={invite.inviterName}
      />
    </div>,
  );
}
