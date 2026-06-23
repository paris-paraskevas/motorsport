import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';
import { ensureAppUser, ensureBettingUser } from '@/lib/betting/credits';
import { displayNames, sendFriendRequest } from '@/lib/betting/friends';
import { FriendInviteFlow } from '@/components/betting/FriendInviteFlow';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Add friend', robots: { index: false, follow: false } };

// A shareable friend-request link. The path id is the inviter's (opaque) user id
// — knowing it only lets you send/accept a friend request to them (every API
// still checks the requester's own auth), so no token table is needed.
function frame(children: ReactNode) {
  return (
    <div className="mx-auto max-w-md p-6 pb-16">
      <h1 className="mb-4 font-display text-2xl font-extrabold uppercase tracking-wide text-text">
        Paddock<span className="text-brand">.</span>
      </h1>
      {children}
    </div>
  );
}

export default async function AddFriendPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isBettingConfigured()) {
    return frame(<p className="font-mono text-sm text-text-muted">Social isn&apos;t live yet.</p>);
  }

  // The inviter must be a known Paddock user, else the link is invalid.
  const names = await displayNames([id]);
  if (!names.has(id)) {
    return frame(
      <div className="font-mono text-sm text-text-muted">
        <p className="mb-3">This friend link is invalid or has expired.</p>
        <Link href="/social/friends" className="text-brand">
          Go to your friends →
        </Link>
      </div>,
    );
  }
  const ownerName = names.get(id) ?? `Racer ${id.slice(-4)}`;

  const { userId } = await auth();
  if (!userId) {
    const back = encodeURIComponent(`/social/friends/add/${id}`);
    return frame(
      <div className="space-y-4">
        <p className="font-mono text-sm text-text">
          <b>{ownerName}</b> wants to be friends on Paddock — friend leagues, win-rate bragging rights, no cashout.
        </p>
        <div className="flex flex-col gap-2">
          <Link href={`/sign-up?redirect_url=${back}`} className="rounded bg-brand px-4 py-2 text-center font-semibold text-bg">
            Create an account &amp; add
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

  if (userId === id) {
    return frame(
      <div className="font-mono text-sm text-text-muted">
        <p className="mb-3">This is your own friend link — share it with anyone to add them.</p>
        <Link href="/social/friends" className="text-brand">
          Back to your friends →
        </Link>
      </div>,
    );
  }

  // Onboard the viewer (FK + credits), ensure the owner row, and raise the pending
  // request (owner → viewer) so the flow below can accept it. No currentUser() on
  // the critical path — that backend hop can 500 a fresh sign-in (the 0.61.2 fix).
  await ensureBettingUser(userId);
  await ensureAppUser(id);
  await sendFriendRequest(id, userId);

  return frame(
    <div className="space-y-4">
      <p className="font-mono text-sm text-text-muted">
        <b className="text-text">{ownerName}</b> invited you to be friends on Paddock.
      </p>
      <FriendInviteFlow ownerId={id} ownerName={ownerName} />
    </div>,
  );
}
