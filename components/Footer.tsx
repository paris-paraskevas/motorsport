import Link from 'next/link';
import { APP_VERSION } from '@/lib/version';

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="hover:text-text transition-colors duration-(--duration-fast)"
    >
      {children}
    </Link>
  );
}

function Sep() {
  return <span className="text-text-faint/50">·</span>;
}

export function Footer() {
  return (
    <footer className="border-t border-border mt-12">
      <div className="max-w-2xl lg:max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-faint">
        <span className="tnum font-mono">Paddock Tracker v{APP_VERSION}</span>
        <Sep />
        <FooterLink href="/changelog">Release notes</FooterLink>
        <Sep />
        <FooterLink href="/about">About</FooterLink>
        <Sep />
        <FooterLink href="/settings">Settings</FooterLink>
        <Sep />
        <FooterLink href="/privacy">Privacy</FooterLink>
        <Sep />
        <FooterLink href="/terms">Terms</FooterLink>
        <Sep />
        <FooterLink href="/cookies">Cookies</FooterLink>
        <Sep />
        <FooterLink href="/accessibility">Accessibility</FooterLink>
        <Sep />
        <FooterLink href="/do-not-sell">Do Not Sell or Share</FooterLink>
        <Sep />
        <FooterLink href="/imprint">Imprint</FooterLink>
      </div>
    </footer>
  );
}
