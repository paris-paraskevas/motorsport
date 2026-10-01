import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_VERSION } from '@/lib/version';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbLd } from '@/lib/json-ld';
import { SITE_URL, PAGE_WIDE } from '@/lib/site';
import { EYEBROW, ReleaseHeading, ReleaseUpdates } from '@/components/changelog/ReleaseEntries';
import { loadReleaseGroups, releaseSlug, releasesFilePath } from './releases';
import { pageMetadata, withPageGate } from '@/lib/design/page-frame';

export const dynamic = 'force-static';

const BASE_METADATA: Metadata = {
  title: 'Changelog',
  description:
    'What shipped recently in Paddock Tracker — the currently running version plus a public log of fixes, features, and improvements.',
};
export const generateMetadata = pageMetadata('/changelog', BASE_METADATA);

/** The newest release shows this many of its newest updates here; every update
 *  of every release lives on the release's own page (X6 A: the page carried
 *  all 1,014 updates twice, as markup and as the flight payload, 2.1 MB). */
const NEWEST_INLINE = 30;

async function ChangelogPage() {
  const releases = await loadReleaseGroups(releasesFilePath());

  return (
    <div className={PAGE_WIDE}>
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', url: SITE_URL },
          { name: 'Changelog', url: `${SITE_URL}/changelog` },
        ])}
      />
      <header className="mb-8">
        <div className={`${EYEBROW} text-text-faint mb-2`}>Release notes</div>
        <h1 className="text-text text-3xl md:text-4xl font-bold tracking-tight leading-tight">
          Changelog
        </h1>
        <p className="mt-3 text-sm text-text-muted">
          Currently running{' '}
          <span className="text-text font-medium tnum font-mono">v{APP_VERSION}</span>.
        </p>
      </header>

      {releases.length === 0 ? (
        <div className="border border-border bg-surface/40 p-8 text-center">
          <div className="text-text text-base font-medium mb-1">Nothing here yet</div>
          <div className="text-text-faint text-sm">Release notes are on the way.</div>
        </div>
      ) : (
        <div className="border-t border-text">
          {releases.map((release, i) => {
            const count = release.entries.length;
            const href = `/changelog/${releaseSlug(release)}`;
            const newest = i === 0;
            return (
              <details key={release.key} open={newest} className="group border-b border-border">
                <summary className="flex cursor-pointer list-none select-none items-start gap-3 py-5 [&::-webkit-details-marker]:hidden">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mt-1.5 h-4 w-4 shrink-0 text-text-faint transition-transform duration-(--duration-fast) group-open:rotate-90"
                  >
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                  <ReleaseHeading release={release} level="h2" />
                </summary>

                {count > 0 && (
                  <div className="mb-5 ml-7 border-l border-border pl-4">
                    {newest && <ReleaseUpdates release={release} limit={NEWEST_INLINE} />}
                    {(!newest || count > NEWEST_INLINE) && (
                      <Link
                        href={href}
                        className={`${EYEBROW} inline-flex items-center gap-1.5 py-1 text-text-muted hover:text-text ${newest ? 'mt-4' : ''}`}
                      >
                        {newest ? `All ${count} updates` : 'Every update in this release'} →
                      </Link>
                    )}
                  </div>
                )}
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default withPageGate('/changelog', ChangelogPage);
