import Link from 'next/link';
import { APP_VERSION } from '@/lib/version';

const CONTACT_URL = process.env.NEXT_PUBLIC_CONTACT_URL || 'mailto:paris.paraskevas@skg-t.com';
const COFFEE_URL = process.env.NEXT_PUBLIC_COFFEE_URL || 'https://buymeacoffee.com/parisp';

export function Footer() {
  return (
    <footer className="border-t border-zinc-900/80 mt-12">
      <div className="max-w-2xl lg:max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
        <span className="tnum">Paddock v{APP_VERSION}</span>
        <span className="text-zinc-700">·</span>
        <Link
          href="/changelog"
          className="hover:text-zinc-300 transition-colors"
        >
          Release notes
        </Link>
        <span className="text-zinc-700">·</span>
        <Link
          href="/about"
          className="hover:text-zinc-300 transition-colors"
        >
          About
        </Link>
        <span className="text-zinc-700">·</span>
        <Link
          href="/settings"
          className="hover:text-zinc-300 transition-colors"
        >
          Settings
        </Link>
        <span className="text-zinc-700">·</span>
        <a
          href={CONTACT_URL}
          className="hover:text-zinc-300 transition-colors"
        >
          Contact
        </a>
        <span className="text-zinc-700">·</span>
        <a
          href={COFFEE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-amber-300 transition-colors"
        >
          ☕ Buy me a coffee
        </a>
      </div>
    </footer>
  );
}
