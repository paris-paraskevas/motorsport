import type { Metadata } from 'next';
import { APP_VERSION } from '@/lib/version';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbLd } from '@/lib/json-ld';
import { SITE_URL, PAGE_WIDE } from '@/lib/site';
import { loadReleaseGroups, releasesFilePath } from './releases';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Changelog',
  description:
    'What shipped recently in Paddock Tracker — the currently running version plus a public log of fixes, features, and improvements.',
};

// Prose treatment for each body. Mirrors the tokens the page used when it
// rendered RELEASES.md as one blob, minus the heading rules (the release name
// and the version are chrome now, and the bodies are prose + bullet lists only).
const RELEASE_PROSE =
  'prose prose-sm dark:prose-invert prose-zinc max-w-none ' +
  'prose-p:my-0 prose-p:text-text-muted prose-p:leading-relaxed ' +
  'prose-ul:my-2 prose-li:my-1 prose-li:text-text-muted ' +
  'prose-strong:text-text prose-a:text-tint';

const EYEBROW = 'font-mono text-[10px] font-semibold uppercase tracking-[0.16em]';

// Compact per-entry date, e.g. "2026-07-01" → "1 Jul". The release header
// already carries the span, so an entry only needs the day and month; the full
// ISO stays in the <time dateTime>/title for machines and hover. UTC to match.
function formatDay(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateISO;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export default async function ChangelogPage() {
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
            // The running version lives in exactly one release; badge that one so
            // a reader can see which release they are on without opening it. The
            // per-entry badge below is what pins the precise push.
            const isRunning = release.entries.some(e => e.version === APP_VERSION);
            const count = release.entries.length;
            return (
              <details key={release.key} open={i === 0} className="group border-b border-border">
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
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className={`${EYEBROW} text-text-muted`}>{release.key}</span>
                      {release.dateRange && (
                        <span className={`${EYEBROW} text-text-faint tnum`}>{release.dateRange}</span>
                      )}
                      {isRunning && (
                        <span
                          className={`${EYEBROW} inline-flex items-center gap-1.5 border border-brand/50 bg-brand-fill/10 px-2 py-0.5 text-brand`}
                        >
                          <span aria-hidden="true" className="h-1.5 w-1.5 bg-brand-fill" />
                          Running
                        </span>
                      )}
                    </div>
                    <h2 className="font-serif text-[22px] font-semibold leading-snug text-text">
                      {release.label}
                    </h2>
                    {release.storyHtml && (
                      <div
                        className={`${RELEASE_PROSE} mt-1.5`}
                        dangerouslySetInnerHTML={{ __html: release.storyHtml }}
                      />
                    )}
                    <div className={`${EYEBROW} mt-2 text-text-faint tnum`}>
                      {release.versionSpan}
                      {count > 0 && ` · ${count} ${count === 1 ? 'update' : 'updates'}`}
                    </div>
                  </div>
                </summary>

                {count > 0 && (
                  <details className="group/all mb-5 ml-7 border-l border-border pl-4">
                    <summary
                      className={`${EYEBROW} inline-flex cursor-pointer list-none select-none items-center gap-1.5 py-1 text-text-muted hover:text-text [&::-webkit-details-marker]:hidden`}
                    >
                      <span aria-hidden="true" className="group-open/all:hidden">
                        +
                      </span>
                      <span aria-hidden="true" className="hidden group-open/all:inline">
                        –
                      </span>
                      Every update in this release
                    </summary>
                    <ul className="mt-2 space-y-4">
                      {release.entries.map(e => {
                        const entryRunning = e.version === APP_VERSION;
                        return (
                          <li key={e.version}>
                            <div className="mb-1 flex items-baseline gap-3 flex-wrap">
                              <h3
                                className={
                                  'font-mono text-sm font-semibold tracking-tight tnum ' +
                                  (entryRunning ? 'text-brand' : 'text-text')
                                }
                              >
                                {/* Only a real version number takes the "v"
                                    prefix: the oldest entry is "Pre-0.8.0". */}
                                {/^\d/.test(e.version) ? `v${e.version}` : e.version}
                              </h3>
                              {e.dateISO && (
                                <time
                                  dateTime={e.dateISO}
                                  title={e.dateISO}
                                  className={`${EYEBROW} text-text-faint tnum`}
                                >
                                  {formatDay(e.dateISO)}
                                </time>
                              )}
                            </div>
                            {e.bodyHtml && (
                              <div
                                className={RELEASE_PROSE}
                                dangerouslySetInnerHTML={{ __html: e.bodyHtml }}
                              />
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                )}
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
