import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { auth } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';
import { getUserProfile } from '@/lib/betting/account';
import type { FriendState } from '@/lib/betting/friends';
import { ProfileActions } from '@/components/betting/ProfileActions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Profile', robots: { index: false, follow: false } };

function frame(children: ReactNode) {
  return (
    <div className="mx-auto max-w-2xl lg:max-w-4xl p-4 pb-16 md:p-6 lg:p-8">
      <header className="mb-5 flex items-stretch gap-3">
        <span aria-hidden="true" className="w-1 shrink-0 bg-brand" />
        <h1 className="font-display text-3xl font-extrabold uppercase leading-none tracking-wide text-text md:text-4xl">
          Profile<span className="text-brand">.</span>
        </h1>
      </header>
      {children}
    </div>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <span className="flex flex-col">
      <span className="font-display text-xl font-extrabold tabular-nums text-text">{value}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">{label}</span>
    </span>
  );
}

// A cross-user public profile. Friends (and you) see the user's leagues; everyone
// else sees only name + friend/league counts and an "add friend" prompt. The
// balance is never exposed. Your own /social/users/<you> bounces to Account.
export default async function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isBettingConfigured()) return frame(<p className="font-mono text-sm text-text-muted">Not live yet.</p>);
  const { userId } = await auth();
  if (userId === id) redirect('/settings');

  const profile = await getUserProfile(id, userId);
  if (!profile.exists) {
    return frame(<p className="font-mono text-sm text-text-muted">No racer found for this link.</p>);
  }

  const name = profile.displayName ?? `Racer ${id.slice(-4)}`;
  const joined = profile.joinedAt
    ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
        new Date(profile.joinedAt),
      )
    : '—';
  const isFriend = profile.relationship === 'friends';

  return frame(
    <div>
      <div className="mb-6 border-b border-border pb-5">
        <div className="font-display text-2xl font-extrabold text-text">{name}</div>
        <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-text-faint">Joined {joined}</div>
        <div className="mt-4 flex gap-8">
          <Stat value={profile.friendCount} label="Friends" />
          <Stat value={profile.leagueCount} label="Leagues" />
        </div>
      </div>

      {userId == null ? (
        <div className="font-mono text-sm text-text-muted">
          <p className="mb-3">Sign in to add {name} as a friend.</p>
          <Link href="/sign-in" className="inline-block rounded bg-brand px-4 py-2 font-semibold text-bg">
            Sign in
          </Link>
        </div>
      ) : isFriend ? (
        <section>
          <h2 className="mb-2 font-display uppercase tracking-wide text-text">Leagues</h2>
          {profile.leagues && profile.leagues.length > 0 ? (
            <ul className="divide-y divide-border border-y border-border">
              {profile.leagues.map(l => (
                <li key={l.id} className="py-2.5">
                  <Link href={`/social/leagues/${l.id}`} className="text-sm text-text hover:text-brand">
                    {l.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-mono text-sm text-text-muted">Not in any leagues yet.</p>
          )}
        </section>
      ) : (
        <section className="space-y-3">
          <ProfileActions targetId={id} relationship={profile.relationship as FriendState} />
          <p className="font-mono text-xs text-text-faint">Add {name} as a friend to see their leagues.</p>
        </section>
      )}
    </div>,
  );
}
