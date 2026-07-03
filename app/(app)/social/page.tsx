import type { Metadata } from 'next';
import { type ReactNode } from 'react';
import Link from 'next/link';
import { Coins, Trophy, Users, BookOpen, MessagesSquare, ArrowUpRight } from 'lucide-react';
import { auth } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Social — predictions, leagues & friends',
  description:
    'Predict race results with free monthly virtual credits, build private leagues with friends, and climb the win-rate leaderboard on Paddock Tracker. No cash, just bragging rights.',
};

// Social hub: a launcher of destinations — play (solo → /play, with-friends →
// /social/leagues), Friends (→ /social/friends), and community (blog + threads).
// Rendered as the app's flat divider-row list (mirrors /settings) rather than a
// boxed-card grid, so Social reads as the same app as everywhere else (operator
// 2026-07-03). No per-user data loads here.
function frame(children: ReactNode) {
  return (
    <div className="mx-auto max-w-2xl lg:max-w-4xl p-4 pb-16 md:p-6 lg:p-8">
      <header className="mb-5 flex items-stretch gap-3">
        <span aria-hidden="true" className="w-1 shrink-0 bg-brand" />
        <h1 className="font-display text-3xl font-extrabold uppercase leading-none tracking-wide text-text md:text-4xl">
          Social<span className="text-brand">.</span>
        </h1>
      </header>
      {children}
    </div>
  );
}

const rowClass =
  'group flex items-center gap-3 border-b border-border py-4 transition-colors duration-(--duration-fast) hover:bg-surface';

function Row({ href, icon, eyebrow, title, desc }: {
  href: string;
  icon: ReactNode;
  eyebrow: string;
  title: string;
  desc: string;
}) {
  return (
    <Link href={href} className={rowClass}>
      <span className="shrink-0 text-text-muted">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-brand">
          {eyebrow}
        </span>
        <span className="block text-base font-semibold text-text">{title}</span>
        <span className="block text-xs text-text-faint">{desc}</span>
      </span>
      <ArrowUpRight size={16} className="shrink-0 text-text-faint group-hover:text-text-muted" />
    </Link>
  );
}

export default async function SocialPage() {
  if (!isBettingConfigured()) return frame(<p className="font-mono text-sm text-text-muted">Not live yet.</p>);
  const { userId } = await auth();
  const signedIn = Boolean(userId);
  // Teaser landing: a guest sees the same destinations (a public, indexable
  // preview) with the play/friends actions routing to sign-in; a signed-in user
  // gets the live pages. Blog + Threads are public either way.
  return frame(
    <>
      {!signedIn && (
        <div className="mb-6 border-y border-border py-4">
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Free to play</div>
          <p className="mt-1 max-w-xl text-sm text-text-muted">
            Predict race results with free monthly virtual credits, build private leagues with friends, and
            climb the win-rate leaderboard. No cash, no catch — just bragging rights.
          </p>
          <Link
            href="/sign-in"
            className="mt-3 inline-flex items-center gap-2 rounded bg-brand px-4 py-2 font-semibold text-bg transition-opacity duration-(--duration-fast) hover:opacity-90"
          >
            Sign in — it’s free
          </Link>
        </div>
      )}

      <nav className="border-t border-border">
        <Row
          href={signedIn ? '/play' : '/sign-in'}
          icon={<Coins size={18} />}
          eyebrow="Play solo"
          title="Back the grid"
          desc="Spend your monthly virtual credits predicting race results, solo against the house."
        />
        <Row
          href={signedIn ? '/social/leagues' : '/sign-in'}
          icon={<Trophy size={18} />}
          eyebrow="Play with friends"
          title="Private leagues"
          desc="Create or join a league, share an invite link, climb the win-rate leaderboard."
        />
        <Row
          href={signedIn ? '/social/friends' : '/sign-in'}
          icon={<Users size={18} />}
          eyebrow="Friends"
          title="Your racers"
          desc="Add friends, accept requests and share your invite link."
        />
        <Row
          href="/blog"
          icon={<BookOpen size={18} />}
          eyebrow="Read"
          title="Blog"
          desc="Analysis, recaps and championship deep-dives."
        />
        <Row
          href="/threads"
          icon={<MessagesSquare size={18} />}
          eyebrow="Discuss"
          title="Threads"
          desc="Fan discussion, lightly moderated — start one or join in."
        />
      </nav>
    </>,
  );
}
