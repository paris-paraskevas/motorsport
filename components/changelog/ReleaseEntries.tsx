import { APP_VERSION } from '@/lib/version';
import type { ReleaseGroup } from '@/app/(app)/changelog/releases';

// The changelog's release markup (X6 A), drawn by two pages: /changelog lists
// every release with its heading and, for the newest, its newest updates;
// /changelog/<release> draws one release's heading and every update. The
// markup is the fold's of 1.0.223, moved here as it was.

// Prose treatment for each body. Mirrors the tokens the page used when it
// rendered RELEASES.md as one blob, minus the heading rules (the release name
// and the version are chrome now, and the bodies are prose + bullet lists only).
const RELEASE_PROSE =
  'prose prose-sm dark:prose-invert prose-zinc max-w-none ' +
  'prose-p:my-0 prose-p:text-text-muted prose-p:leading-relaxed ' +
  'prose-ul:my-2 prose-li:my-1 prose-li:text-text-muted ' +
  'prose-strong:text-text prose-a:text-tint';

export const EYEBROW = 'font-mono text-10 font-semibold uppercase tracking-[0.16em]';

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

/** The running version lives in exactly one release; badge that one so a reader
 *  can see which release they are on without opening it. */
export function isRunningRelease(release: ReleaseGroup): boolean {
  return release.entries.some(e => e.version === APP_VERSION);
}

/** A release's heading block: the key, the date range, the Running badge, the
 *  name (an h1 on the release's own page, an h2 in the changelog's list), the
 *  story, the version span and the count. */
export function ReleaseHeading({ release, level }: { release: ReleaseGroup; level: 'h1' | 'h2' }) {
  const count = release.entries.length;
  const H = level;
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={`${EYEBROW} text-text-muted`}>{release.key}</span>
        {release.dateRange && <span className={`${EYEBROW} text-text-faint tnum`}>{release.dateRange}</span>}
        {isRunningRelease(release) && (
          <span className={`${EYEBROW} inline-flex items-center gap-1.5 border border-brand/50 bg-brand-fill/10 px-2 py-0.5 text-brand`}>
            <span aria-hidden="true" className="h-1.5 w-1.5 bg-brand-fill" />
            Running
          </span>
        )}
      </div>
      <H className={level === 'h1' ? 'font-serif text-3xl md:text-4xl font-semibold leading-tight text-text' : 'font-serif text-22 font-semibold leading-snug text-text'}>
        {release.label}
      </H>
      {release.storyHtml && <div className={`${RELEASE_PROSE} mt-1.5`} dangerouslySetInnerHTML={{ __html: release.storyHtml }} />}
      <div className={`${EYEBROW} mt-2 text-text-faint tnum`}>
        {release.versionSpan}
        {count > 0 && ` · ${count} ${count === 1 ? 'update' : 'updates'}`}
      </div>
    </div>
  );
}

/** The updates of a release, newest first as the file lists them; `limit` keeps
 *  the changelog's list light (the newest release shows its newest few, the
 *  rest live on the release's own page). */
export function ReleaseUpdates({ release, limit }: { release: ReleaseGroup; limit?: number }) {
  const entries = limit === undefined ? release.entries : release.entries.slice(0, limit);
  return (
    <ul className="mt-2 space-y-4">
      {entries.map(e => {
        const entryRunning = e.version === APP_VERSION;
        return (
          <li key={e.version}>
            <div className="mb-1 flex items-baseline gap-3 flex-wrap">
              <h3 className={'font-mono text-sm font-semibold tracking-tight tnum ' + (entryRunning ? 'text-brand' : 'text-text')}>
                {/* Only a real version number takes the "v" prefix: the oldest entry is "Pre-0.8.0". */}
                {/^\d/.test(e.version) ? `v${e.version}` : e.version}
              </h3>
              {e.dateISO && (
                <time dateTime={e.dateISO} title={e.dateISO} className={`${EYEBROW} text-text-faint tnum`}>
                  {formatDay(e.dateISO)}
                </time>
              )}
            </div>
            {e.bodyHtml && <div className={RELEASE_PROSE} dangerouslySetInnerHTML={{ __html: e.bodyHtml }} />}
          </li>
        );
      })}
    </ul>
  );
}
