import Link from 'next/link';
import { APP_VERSION } from '@/lib/version';

export function Footer() {
  return (
    <footer className="border-t border-border mt-12">
      <div className="max-w-2xl lg:max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-faint">
        <span className="tnum font-mono">Paddock v{APP_VERSION}</span>
        <span className="text-text-faint/50">·</span>
        <Link
          href="/changelog"
          className="hover:text-text transition-colors duration-(--duration-fast)"
        >
          Release notes
        </Link>
        <span className="text-text-faint/50">·</span>
        <Link
          href="/about"
          className="hover:text-text transition-colors duration-(--duration-fast)"
        >
          About
        </Link>
        <span className="text-text-faint/50">·</span>
        <Link
          href="/settings"
          className="hover:text-text transition-colors duration-(--duration-fast)"
        >
          Settings
        </Link>
      </div>
    </footer>
  );
}
