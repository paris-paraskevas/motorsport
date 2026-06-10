import Link from 'next/link';
import { LandingMenu } from './LandingMenu';

const ANCHORS = [
  { href: '#inside', label: "What's inside" },
  { href: '#series', label: 'Series' },
  { href: '#disciplines', label: 'Disciplines' },
];

export function LandingNav() {
  return (
    <header className="sticky top-9 z-40 border-b border-border bg-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link
          href="/"
          className="font-display text-lg font-extrabold uppercase tracking-wide text-text"
        >
          Paddock<span className="text-brand">•</span>Tracker
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="Landing sections">
          {ANCHORS.map(a => (
            <a
              key={a.href}
              href={a.href}
              className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
            >
              {a.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <Link
            href="/sign-in"
            className="hidden text-xs font-semibold uppercase tracking-[0.14em] text-text-muted transition-colors duration-(--duration-fast) hover:text-text sm:block"
          >
            Sign in
          </Link>
          <Link
            href="/app"
            className="rounded-full bg-brand px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-black transition-colors duration-(--duration-fast) hover:bg-brand-deep"
          >
            Open app&ensp;→
          </Link>
          <LandingMenu />
        </div>
      </div>
    </header>
  );
}
