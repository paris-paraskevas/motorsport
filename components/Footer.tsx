import Link from 'next/link';
import { APP_VERSION } from '@/lib/version';
import { SITE_TITLE } from '@/lib/site';
import { ManageCookiesButton } from '@/components/ManageCookiesButton';

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-text-muted hover:text-text transition-colors duration-(--duration-fast)">
      {children}
    </Link>
  );
}

// Compact footer: two organised rows — Site + Legal, each a wrapped line of links
// behind a small label — over a thin version / copyright line. Replaces the
// page-tall two-column grid (and the earlier one-line jumble).
export function Footer() {
  const year = 2026;
  return (
    <footer className="border-t border-border mt-12 bg-bg">
      <div className="max-w-2xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl mx-auto px-4 md:px-6 lg:px-8 py-6">
        <div className="space-y-2 font-mono text-[11px] uppercase tracking-[0.12em]">
          <nav aria-label="Site" className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="w-12 shrink-0 font-semibold text-text-faint">Site</span>
            <FooterLink href="/">Landing</FooterLink>
            <FooterLink href="/about">About</FooterLink>
            <FooterLink href="/blog">Blog</FooterLink>
            <FooterLink href="/changelog">Release notes</FooterLink>
            <FooterLink href="/settings">Account</FooterLink>
            <ManageCookiesButton />
          </nav>
          <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="w-12 shrink-0 font-semibold text-text-faint">Legal</span>
            <FooterLink href="/privacy">Privacy</FooterLink>
            <FooterLink href="/terms">Terms</FooterLink>
            <FooterLink href="/cookies">Cookies</FooterLink>
            <FooterLink href="/accessibility">Accessibility</FooterLink>
            <FooterLink href="/do-not-sell">Do Not Sell or Share</FooterLink>
            <FooterLink href="/imprint">Imprint</FooterLink>
          </nav>
        </div>
        <div className="mt-4 flex flex-col gap-1 border-t border-border pt-4 text-[11px] text-text-faint sm:flex-row sm:items-center sm:justify-between">
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
