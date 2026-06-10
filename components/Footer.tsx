import Link from 'next/link';
import { APP_VERSION } from '@/lib/version';
import { SITE_TITLE, SITE_DESCRIPTION } from '@/lib/site';
import { ManageCookiesButton } from '@/components/ManageCookiesButton';

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block py-1 text-text-muted hover:text-text transition-colors duration-(--duration-fast)"
    >
      {children}
    </Link>
  );
}

function ColumnHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-text-faint mb-3">
      {children}
    </h2>
  );
}

export function Footer() {
  const year = 2026;
  return (
    <footer className="border-t border-border mt-12 bg-bg">
      <div className="max-w-2xl lg:max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-10">
        {/* Brand strip — name + short tagline. Sets context above the column
            grid so the footer reads as a real section, not a row of links. */}
        <div className="mb-8 max-w-md">
          <div className="font-display text-base font-extrabold uppercase tracking-wide text-text">
            Paddock<span className="text-brand">•</span>Tracker
          </div>
          <p className="mt-1 text-text-muted text-xs leading-relaxed">
            {SITE_DESCRIPTION}
          </p>
        </div>

        {/* Two-column link grid. Categories tailored to Paddock's actual link
            inventory — Site (navigation + utility) + Legal (compliance pages).
            Not the NVIDIA 3-column template; that density doesn't fit ~10
            real links. Columns stack to single-column on narrow viewports. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs">
          <div>
            <ColumnHeading>Site</ColumnHeading>
            <ul className="space-y-0">
              {/* Full page load by design — the landing lives in the
                  (marketing) root layout. */}
              <li><FooterLink href="/">Landing</FooterLink></li>
              <li><FooterLink href="/about">About</FooterLink></li>
              <li><FooterLink href="/blog">Blog</FooterLink></li>
              <li><FooterLink href="/changelog">Release notes</FooterLink></li>
              <li><FooterLink href="/settings">Account</FooterLink></li>
              {/* Re-opens the CookieConsent modal via the open-cookie-consent
                  custom event. Required by EDPB — users must be able to change
                  consent at any time. The /cookies static page stays linked
                  from the Legal column as the documentary policy. */}
              <li><ManageCookiesButton /></li>
            </ul>
          </div>
          <div>
            <ColumnHeading>Legal</ColumnHeading>
            <ul className="space-y-0">
              <li><FooterLink href="/privacy">Privacy</FooterLink></li>
              <li><FooterLink href="/terms">Terms</FooterLink></li>
              <li><FooterLink href="/cookies">Cookies</FooterLink></li>
              <li><FooterLink href="/accessibility">Accessibility</FooterLink></li>
              <li><FooterLink href="/do-not-sell">Do Not Sell or Share</FooterLink></li>
              <li><FooterLink href="/imprint">Imprint</FooterLink></li>
            </ul>
          </div>
        </div>

        {/* Bottom row: version + copyright. Two-line on mobile, single-row on
            sm+. Same text-faint colour as the previous footer so it doesn't
            compete with the link columns above. */}
        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] text-text-faint">
          <span className="tnum font-mono">{SITE_TITLE} v{APP_VERSION}</span>
          <span>© {year} {SITE_TITLE}. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
