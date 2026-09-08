import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  loadSeasonArchive,
  listArchivePairs,
  isArchiveLiveSeason,
  type ArchivedWeekend,
} from '@/lib/season-archive';
import { loadWeekendNotes, weekendNoteKey } from '@/lib/series-content';
import { WeekendNote } from '@/components/weekend/WeekendNote';
import { withSocialMeta } from '@/lib/seo';
import { PAGE_READ } from '@/lib/site';
import { pageMetadata, withPageGate } from '@/lib/design/page-frame';

// Build-time only — see the note on the season page. `data/` is not readable on
// workerd, deliberately.
export const dynamic = 'force-static';

export async function generateStaticParams() {
  const out: { season: string; slug: string; round: string }[] = [];
  for (const { season, slug } of await listArchivePairs()) {
    const archive = await loadSeasonArchive(season, slug);
    for (const w of archive?.weekends ?? []) {
      out.push({ season: String(season), slug, round: String(w.round) });
    }
  }
  return out;
}

async function resolve(season: string, slug: string, round: string) {
  const archive = await loadSeasonArchive(Number(season), slug);
  if (!archive) return null;
  const weekend = archive.weekends.find(w => w.round === Number(round));
  return weekend ? { archive, weekend } : null;
}

const titleOf = (w: ArchivedWeekend) => w.roundName ?? w.label ?? `Round ${w.round}`;

async function baseMetadata({
  params,
}: {
  params: Promise<{ season: string; slug: string; round: string }>;
}): Promise<Metadata> {
  const { season, slug, round } = await params;
  const found = await resolve(season, slug, round);
  if (!found) return { title: 'Not archived' };
  const { archive, weekend } = found;
  const live = await isArchiveLiveSeason(slug, Number(season));
  const title = `${archive.seriesName} ${archive.season} · ${titleOf(weekend)}`;
  const description = `${titleOf(weekend)}, round ${weekend.round} of the ${archive.season} ${archive.seriesName} season — ${weekend.dateRangeLabel}, with every session as it was scheduled.`;
  return {
    title,
    description,
    alternates: {
      canonical: live
        ? `/series/${slug}/weekend/${weekend.round}`
        : `/archive/${season}/${slug}/weekend/${weekend.round}`,
    },
    ...(live ? { robots: { index: false, follow: true } } : {}),
    ...withSocialMeta({
      title,
      description,
      path: `/archive/${season}/${slug}/weekend/${weekend.round}`,
    }),
  };
}
export const generateMetadata = pageMetadata('/archive/[season]/[slug]/weekend/[round]', baseMetadata);

/** The archive stores ISO instants. Rendered in UTC on purpose: a static page
 *  cannot know the reader's zone, and quietly showing the build machine's zone
 *  would be worse than labelling the one we mean. The live weekend pages do
 *  local time; this is a record of what was scheduled. */
const UTC = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
});

async function ArchiveWeekendPage({
  params,
}: {
  params: Promise<{ season: string; slug: string; round: string }>;
}) {
  const { season, slug, round } = await params;
  const found = await resolve(season, slug, round);
  if (!found) notFound();
  const { archive, weekend } = found;
  const live = await isArchiveLiveSeason(slug, Number(season));
  // The SAME note the live weekend page renders — keyed by season and round, so
  // it stays attached to this race once the season rolls over and the live URL
  // has moved on to a different one.
  const note = (await loadWeekendNotes(slug))?.[weekendNoteKey(Number(season), weekend.round)];

  return (
    <div className={PAGE_READ}>
      <Link
        href={`/archive/${season}/${slug}`}
        className="font-mono text-10 font-semibold uppercase tracking-[0.16em] text-text-faint hover:text-text"
      >
        ← {archive.seriesName} {archive.season}
      </Link>

      <p className="mt-3 font-mono text-10 font-semibold uppercase tracking-[0.16em] text-brand">
        Round {weekend.round} · {weekend.dateRangeLabel}
      </p>
      <h1 className="mt-1.5 font-serif text-3xl font-semibold leading-tight text-text md:text-4xl">
        {titleOf(weekend)}
      </h1>

      {live ? (
        <p className="mt-2 text-sm leading-relaxed text-text-muted">
          The {archive.season} season is still running.{' '}
          <Link href={`/series/${slug}/weekend/${weekend.round}`} className="text-brand hover:underline">
            The live page for this weekend
          </Link>{' '}
          has results, standings and times in your own zone.
        </p>
      ) : null}

      {note ? (
        <div className="mt-8">
          <WeekendNote note={note} />
        </div>
      ) : null}

      <section aria-label="Sessions" className="mt-8">
        <h2 className="font-mono text-10 font-semibold uppercase tracking-[0.18em] text-text-faint">
          Sessions · times in UTC
        </h2>
        {weekend.sessions.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">No sessions were recorded for this round.</p>
        ) : (
          <ul className="mt-3 border-t border-border">
            {weekend.sessions.map(s => (
              <li
                key={`${s.title}-${s.start}`}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border py-2.5"
              >
                <span className="min-w-0 flex-1 text-15 text-text">{s.title}</span>
                <span className="shrink-0 font-mono text-11 text-text-faint">
                  {UTC.format(new Date(s.start))}
                </span>
              </li>
            ))}
          </ul>
        )}
        {weekend.sessions[0]?.location ? (
          <p className="mt-3 text-13 text-text-muted">{weekend.sessions[0].location}</p>
        ) : null}
      </section>

      <p className="mt-10 font-mono text-10 uppercase tracking-[0.12em] text-text-faint">
        Archived {archive.capturedAt.slice(0, 10)}
      </p>
    </div>
  );
}

export default withPageGate('/archive/[season]/[slug]/weekend/[round]', ArchiveWeekendPage);
