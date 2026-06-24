import Link from 'next/link';
import { APP_VERSION } from '@/lib/version';
import { SITE_TITLE } from '@/lib/site';
import { ManageCookiesButton } from '@/components/ManageCookiesButton';

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block py-0.5 text-text-muted hover:text-text transition-colors duration-(--duration-fast)"
    >
      {children}
    </Link>
  );
}

function ColumnHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-text-faint">{children}</h2>
  );
}

// Two-column footer — Site | Legal side by side, each a short vertical link list,
// over a thin version / copyright line. No tall brand strip (that's what made the
// original run a full screen).
export function Footer() {
  const year = 2026;
  return (
    <footer className="border-t border-border mt-12 bg-bg">
      <div className="max-w-2xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl mx-auto px-4 md:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-2 gap-6 text-xs sm:gap-8">
          <div>
            <ColumnHeading>Site</ColumnHeading>
            <FooterLink href="/">Landing</FooterLink>
            <FooterLink href="/about">About</FooterLink>
            <FooterLink href="/blog">Blog</FooterLink>
            <FooterLink href="/threads">Threads</FooterLink>
            <FooterLink href="/changelog">Release notes</FooterLink>
            <FooterLink href="/settings">Account</FooterLink>
            <ManageCookiesButton />
          </div>
          <div>
            <ColumnHeading>Legal</ColumnHeading>
            <FooterLink href="/privacy">Privacy</FooterLink>
            <FooterLink href="/terms">Terms</FooterLink>
            <FooterLink href="/cookies">Cookies</FooterLink>
            <FooterLink href="/accessibility">Accessibility</FooterLink>
            <FooterLink href="/do-not-sell">Do Not Sell or Share</FooterLink>
            <FooterLink href="/imprint">Imprint</FooterLink>
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-1 border-t border-border pt-4 text-[11px] text-text-faint sm:flex-row sm:items-center sm:justify-between">
          <span className="font-display font-extrabold uppercase tracking-wide text-text">
            Paddock<span className="text-brand">•</span>Tracker
            <span className="ml-2 font-mono font-normal tracking-normal text-text-faint">v{APP_VERSION}</span>
          </span>
          <span>© {year} {SITE_TITLE}. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
