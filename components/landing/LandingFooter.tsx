import Link from 'next/link';
import type { SeriesMeta } from '@/lib/types';
import { APP_VERSION } from '@/lib/version';

const COLUMNS: Array<{ heading: string; links: Array<{ href: string; label: string }> }> = [
  {
    heading: 'App',
    links: [
      { href: '/app', label: 'Open paddock' },
      { href: '/calendar', label: 'Calendar' },
      { href: '/blog', label: 'Blog' },
      { href: '/settings', label: 'Settings' },
    ],
  },
  {
    heading: 'Project',
    links: [
      { href: '/about', label: 'About' },
      { href: '/changelog', label: 'Release notes' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
      { href: '/cookies', label: 'Cookies' },
      { href: '/accessibility', label: 'Accessibility' },
      { href: '/do-not-sell', label: 'Do Not Sell or Share' },
      { href: '/imprint', label: 'Imprint' },
    ],
  },
];

// Landing footer. Deliberate copy deviations from the mockup: no "No ads"
// promise (AdSense is planned) and no feeds-status line (needs a health
// endpoint that doesn't exist yet).
export function LandingFooter({ seriesList }: { seriesList: SeriesMeta[] }) {
  const topSeries = seriesList.slice(0, 5);

  return (
    <footer className="bg-bg">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.2fr_repeat(4,minmax(0,1fr))]">
        <div>
          <p className="font-display text-lg font-extrabold uppercase tracking-wide text-text">
            Paddock<span className="text-brand">•</span>Tracker
          </p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-text-muted">
            Independent motorsport companion built in the open. No algorithms,
            no account required to browse.
          </p>
          <p className="mt-4 flex flex-wrap gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-text-faint">
            <span className="rounded-md border border-border px-2 py-1">v {APP_VERSION}</span>
            <span className="rounded-md border border-border px-2 py-1">Built in Greece</span>
          </p>
        </div>

        <div>
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-text-faint">
            Series
          </h2>
          <ul className="mt-3 space-y-2">
            {topSeries.map(s => (
              <li key={s.slug}>
                <Link
                  href={`/series/${s.slug}`}
                  className="text-sm text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
                >
                  {s.name}
                </Link>
              </li>
            ))}
            <li>
              <a
                href="#series"
                className="text-sm text-text-faint transition-colors duration-(--duration-fast) hover:text-text"
              >
                See all {seriesList.length}
              </a>
            </li>
          </ul>
        </div>

        {COLUMNS.map(col => (
          <div key={col.heading}>
            <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-text-faint">
              {col.heading}
            </h2>
            <ul className="mt-3 space-y-2">
              {col.links.map(l => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 font-mono text-[11px] text-text-faint sm:px-6">
          <span>© 2026 Paddock Tracker · paddock-tracker.com</span>
          <span>Every session. Every series. One paddock.</span>
        </div>
      </div>
    </footer>
  );
}
