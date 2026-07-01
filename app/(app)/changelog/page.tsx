import type { Metadata } from 'next';
import { APP_VERSION } from '@/lib/version';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbLd } from '@/lib/json-ld';
import { SITE_URL } from '@/lib/site';
import { loadReleaseGroups, releasesFilePath } from './releases';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Changelog',
  description:
    'What shipped recently in Paddock Tracker — the currently running version plus a public log of fixes, features, and improvements.',
};

// Prose treatment for each release body. Mirrors the tokens the page used when
// it rendered RELEASES.md as one blob, minus the h2/h3 rules (the version is now
// the card header, and RELEASES bodies are prose + bullet lists only).
const RELEASE_PROSE =
  'prose prose-sm dark:prose-invert prose-zinc max-w-none ' +
  'prose-p:my-0 prose-p:text-text-muted prose-p:leading-relaxed ' +
  'prose-ul:my-2 prose-li:my-1 prose-li:text-text-muted ' +
  'prose-strong:text-text prose-a:text-tint';

// Compact per-card date, e.g. "2026-07-01" → "1 Jul". The month is already the
// group header, so the card only needs the day; the full ISO stays in the
// <time dateTime>/title for machines and hover. UTC to match the group label.
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
  const groups = await loadReleaseGroups(releasesFilePath());

  return (
    <div className="max-w-2xl lg:max-w-4xl mx-auto p-4 md:p-6 lg:p-8 pb-16">
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', url: SITE_URL },
          { name: 'Changelog', url: `${SITE_URL}/changelog` },
        ])}
      />
      <header className="mb-8">
        <div className="text-[11px] uppercase tracking-[0.18em] text-text-faint font-semibold mb-2">
          Release notes
        </div>
        <h1 className="text-text text-3xl md:text-4xl font-bold tracking-tight leading-tight">
          Changelog
        </h1>
        <p className="mt-3 text-sm text-text-muted">
          Currently running{' '}
          <span className="text-text font-medium tnum font-mono">v{APP_VERSION}</span>.
        </p>
      </header>

      {groups.length === 0 ? (
        <div className="rounded-2xl bg-surface/40 border border-border/60 p-8 text-center">
          <div className="text-text text-base font-medium mb-1">Nothing here yet</div>
          <div className="text-text-faint text-sm">Release notes are on the way.</div>
        </div>
      ) : (
        <div className="space-y-10">
          {groups.map((group) => (
            <section key={group.key} aria-labelledby={`month-${group.key}`}>
              <div className="mb-4 flex items-baseline gap-3 border-b border-border/60 pb-2">
                <h2
                  id={`month-${group.key}`}
                  className="text-text text-lg font-semibold tracking-tight"
                >
                  {group.label}
                </h2>
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-faint font-semibold tnum">
                  {group.releases.length}{' '}
                  {group.releases.length === 1 ? 'release' : 'releases'}
                </span>
              </div>

              <ul className="space-y-3">
                {group.releases.map((release) => {
                  const isRunning = release.version === APP_VERSION;
                  return (
                    <li
                      key={release.version}
                      className={
                        'rounded-2xl border p-5 transition-colors duration-(--duration-fast) ' +
                        (isRunning
                          ? 'border-brand/50 bg-brand/5 ring-1 ring-brand/30'
                          : 'border-border/60 bg-surface/40')
                      }
                    >
                      <div className="mb-2 flex items-baseline gap-3 flex-wrap">
                        <h3 className="text-text font-mono text-sm font-semibold tracking-tight tnum">
                          v{release.version}
                        </h3>
                        {release.dateISO && (
                          <time
                            dateTime={release.dateISO}
                            title={release.dateISO}
                            className="text-[11px] uppercase tracking-[0.16em] text-text-faint font-semibold tnum font-mono"
                          >
                            {formatDay(release.dateISO)}
                          </time>
                        )}
                        {isRunning && (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/50 bg-brand/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] font-semibold text-brand">
                            <span
                              aria-hidden="true"
                              className="h-1.5 w-1.5 rounded-full bg-brand"
                            />
                            Running
                          </span>
                        )}
                      </div>
                      {release.bodyHtml && (
                        <div
                          className={RELEASE_PROSE}
                          dangerouslySetInnerHTML={{ __html: release.bodyHtml }}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
