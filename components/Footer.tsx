import Link from 'next/link';
import { APP_VERSION } from '@/lib/version';
import { SITE_TITLE } from '@/lib/site';
import { ManageCookiesButton } from '@/components/ManageCookiesButton';
import { ContactFooterButton } from '@/components/ContactModal';
import { InstallApp } from '@/components/landing/InstallApp';

const COFFEE_URL = process.env.NEXT_PUBLIC_COFFEE_URL || 'https://buymeacoffee.com/parisp';

function FooterLink({
  href,
  dataHeatmapId,
  children,
}: {
  href: string;
  dataHeatmapId?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      data-heatmap-id={dataHeatmapId}
      className="block py-1 text-text-muted hover:text-text transition-colors duration-(--duration-fast)"
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
      <div className="w-full px-4 md:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-2 gap-6 text-xs sm:gap-8">
          <div>
            <ColumnHeading>Site</ColumnHeading>
            {/* "Home", not "Landing": the marketing landing page was retired in
                0.334.42 and `/` IS the home page now. The heatmap id keeps its
                old value on purpose so the recorded history stays comparable. */}
            <FooterLink href="/" dataHeatmapId="footer:landing">Home</FooterLink>
            <FooterLink href="/about" dataHeatmapId="footer:about">About</FooterLink>
            <FooterLink href="/information" dataHeatmapId="footer:learn">Learn</FooterLink>
            <FooterLink href="/news" dataHeatmapId="footer:news">News</FooterLink>
            <FooterLink href="/blog" dataHeatmapId="footer:blog">Blog</FooterLink>
            <FooterLink href="/write-for-us" dataHeatmapId="footer:write-for-us">Write for Paddock</FooterLink>
            <FooterLink href="/social/threads" dataHeatmapId="footer:threads">Threads</FooterLink>
            <FooterLink href="/changelog" dataHeatmapId="footer:changelog">Release notes</FooterLink>
            <FooterLink href="/archive" dataHeatmapId="footer:archive">Season archive</FooterLink>
            <FooterLink href="/settings" dataHeatmapId="footer:account">Account</FooterLink>
            {/* Contact + coffee moved here from the header pills (four-door shell). */}
            <ContactFooterButton />
            <a
              href={COFFEE_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-heatmap-id="footer:coffee"
              className="block py-1 text-text-muted hover:text-text transition-colors duration-(--duration-fast)"
            >
              Buy me a coffee
            </a>
            <ManageCookiesButton />
          </div>
          <div>
            <ColumnHeading>Legal</ColumnHeading>
            <FooterLink href="/privacy" dataHeatmapId="footer:privacy">Privacy</FooterLink>
            <FooterLink href="/terms" dataHeatmapId="footer:terms">Terms</FooterLink>
            <FooterLink href="/cookies" dataHeatmapId="footer:cookies">Cookies</FooterLink>
            <FooterLink href="/accessibility" dataHeatmapId="footer:accessibility">Accessibility</FooterLink>
            <FooterLink href="/do-not-sell" dataHeatmapId="footer:do-not-sell">Do Not Sell or Share</FooterLink>
            <FooterLink href="/imprint" dataHeatmapId="footer:imprint">Imprint</FooterLink>
          </div>
        </div>
        {/* Install, and the one line saying what this is.
            Both re-homed here in 0.334.42 when the marketing landing was retired
            (operator: "we might not even need it"). InstallApp was that page's
            second hero button and is the ONLY install path on the site —
            Chromium's `beforeinstallprompt` can only be re-triggered by
            something that captured it, so dropping the landing without moving
            this would have removed app installation rather than relocated it.
            The footer renders on every page, which is more reach than the
            landing ever had. */}
        <div className="mt-6 flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-sm text-[12px] leading-relaxed text-text-muted">
            Independent motorsport companion, built in the open. Fifteen
            championships, every session in your own time zone. No account needed
            to browse.
          </p>
          <InstallApp />
        </div>
        <div className="mt-5 flex flex-col gap-1 border-t border-border pt-4 text-[11px] text-text-faint sm:flex-row sm:items-center sm:justify-between">
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
