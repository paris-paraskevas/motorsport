import Link from 'next/link';
import { NavPanel } from '@/components/NavPanel';
import type { NavSeriesMeta } from '@/lib/types';
import { SignedInOnly, SignedOutOnly } from './LandingAuth';

// Panel 10a header: the serif wordmark, the one menu-and-search field (the
// same NavPanel the app shell renders), and the account state — nothing else.
// The anchor row, the Open-app pill and the burger menu died with the
// carousel landing.
export function LandingNav({
  seriesList,
  bettingEnabled,
}: {
  seriesList: NavSeriesMeta[];
  bettingEnabled: boolean;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex h-[50px] w-full max-w-[1200px] items-center gap-4 px-4 md:px-6">
        <Link
          href="/"
          className="shrink-0 font-serif text-[19px] font-semibold tracking-tight text-text"
        >
          Paddock Tracker
        </Link>
        <NavPanel seriesList={seriesList} bettingEnabled={bettingEnabled} />
        <div className="ml-auto flex shrink-0 items-center gap-4 font-mono text-[10px] font-semibold uppercase tracking-[0.16em]">
          <SignedOutOnly>
            <Link
              href="/sign-in"
              className="text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
            >
              Sign in
            </Link>
          </SignedOutOnly>
          <SignedInOnly>
            <Link
              href="/app"
              className="text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
            >
              Open app →
            </Link>
          </SignedInOnly>
        </div>
      </div>
    </header>
  );
}
