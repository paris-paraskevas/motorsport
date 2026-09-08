'use client';
import Link from 'next/link';
import { APP_VERSION } from '@/lib/version';
import { SITE_TITLE } from '@/lib/site';
import { resolveDestination, type NavEntry } from '@/lib/design/destinations';
import type { AuthzScheme } from '@/lib/design/authz-defaults';
import type { ChromeText } from '@/lib/design/text-defaults';
import { useVisibleEntries } from '@/components/useVisitor';
import { ManageCookiesButton } from '@/components/ManageCookiesButton';
import { ContactFooterButton } from '@/components/ContactModal';
import { InstallApp } from '@/components/landing/InstallApp';

// Heatmap ids that predate the rows and stay as they were so the recorded
// history keeps comparing: "Home" was the marketing landing (footer:landing),
// the support link was the coffee link (footer:coffee).
const HEATMAP_ID: Record<string, string> = { home: 'footer:landing', 'external:support': 'footer:coffee' };

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
    <h2 className="mb-2 font-mono text-11 font-semibold uppercase tracking-[0.2em] text-text-faint">{children}</h2>
  );
}

// One footer entry from the list: a route is a link, the support link opens in a
// new tab, and the two actions place components that carry their own text and
// behaviour (the entry's label is the designer's name for them, not the button's).
function FooterEntry({ entry }: { entry: NavEntry }) {
  const dest = resolveDestination(entry.dest);
  if (!dest) return null;
  const heat = HEATMAP_ID[entry.dest] ?? `footer:${entry.dest}`;
  if (dest.kind === 'route') {
    return (
      <FooterLink href={dest.href} dataHeatmapId={heat}>
        {entry.label}
      </FooterLink>
    );
  }
  if (dest.kind === 'external') {
    return (
      <a
        href={dest.href}
        target="_blank"
        rel="noopener noreferrer"
        data-heatmap-id={heat}
        className="block py-1 text-text-muted hover:text-text transition-colors duration-(--duration-fast)"
      >
        {entry.label}
      </a>
    );
  }
  return dest.action === 'contact' ? <ContactFooterButton /> : <ManageCookiesButton />;
}

// Two-column footer — Site | Legal side by side, each a short vertical link list,
// over a thin version / copyright line. No tall brand strip (that's what made the
// original run a full screen). Since Phase 2 the two columns are the
// `footer-site` and `footer-legal` lists (lib/design/lists.ts).
// The headings, the blurb and the install label are text messages (lib/design/text.ts).
// An entry asking for an authorization scheme shows only to a visitor who
// passes it (Phase 3 step 4); with no schemes given (the designer's preview)
// every entry shows.
export function Footer({
  site,
  legal,
  text,
  schemes,
  wordmark = null,
  installPrompt = true,
  siteName = SITE_TITLE,
}: {
  site: NavEntry[];
  legal: NavEntry[];
  text: ChromeText;
  schemes?: readonly AuthzScheme[];
  /** From the Application Definition: null keeps the shipped Paddock•Tracker. */
  wordmark?: string | null;
  /** From the Application Definition: the Install as an app button. */
  installPrompt?: boolean;
  /** From the Application Definition: the copyright line's name. */
  siteName?: string;
}) {
  const year = 2026;
  const visibleSite = useVisibleEntries(site, schemes);
  const visibleLegal = useVisibleEntries(legal, schemes);
  return (
    <footer className="border-t border-border mt-12 bg-bg">
      <div className="w-full px-4 md:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-2 gap-6 text-xs sm:gap-8">
          <div>
            <ColumnHeading>{text['footer.site']}</ColumnHeading>
            {visibleSite.map((entry, i) => (
              <FooterEntry key={`${entry.dest}-${i}`} entry={entry} />
            ))}
          </div>
          <div>
            <ColumnHeading>{text['footer.legal']}</ColumnHeading>
            {visibleLegal.map((entry, i) => (
              <FooterEntry key={`${entry.dest}-${i}`} entry={entry} />
            ))}
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
          <p className="max-w-sm text-12 leading-relaxed text-text-muted">{text['footer.blurb']}</p>
          {installPrompt && <InstallApp label={text['footer.install']} />}
        </div>
        <div className="mt-5 flex flex-col gap-1 border-t border-border pt-4 text-11 text-text-faint sm:flex-row sm:items-center sm:justify-between">
          <span className="font-display font-extrabold uppercase tracking-wide text-text">
            {wordmark ?? (
              <>
                Paddock<span className="text-brand">•</span>Tracker
              </>
            )}
            <span className="ml-2 font-mono font-normal tracking-normal text-text-faint">v{APP_VERSION}</span>
          </span>
          <span>© {year} {siteName}. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
