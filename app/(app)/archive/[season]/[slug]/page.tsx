import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadSeasonArchive, listArchivePairs, isArchiveLiveSeason } from '@/lib/season-archive';
import { ArchiveStandings } from '@/components/ArchiveStandings';
import { withSocialMeta } from '@/lib/seo';
import { PAGE_READ } from '@/lib/site';

// A finished season never changes, and the archive it reads lives in `data/`,
// outside the Worker's content bundle — so this MUST be build-time only. Give
// it a `revalidate` and it will try to read those files on workerd, where unenv
// has no fs, and every page fail-softs to a 404. Same contract as /changelog.
export const dynamic = 'force-static';

export async function generateStaticParams() {
  return (await listArchivePairs()).map(p => ({ season: String(p.season), slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ season: string; slug: string }>;
}): Promise<Metadata> {
  const { season, slug } = await params;
  const archive = await loadSeasonArchive(Number(season), slug);
  if (!archive) return { title: 'Season not archived' };
  const live = await isArchiveLiveSeason(slug, Number(season));
  const title = `${archive.seriesName} ${archive.season} season archive`;
  const description = `Every ${archive.seriesName} race weekend of ${archive.season} — ${archive.weekends.length} rounds, with session times and the final classifications.`;
  return {
    title,
    description,
    alternates: { canonical: live ? `/series/${slug}` : `/archive/${season}/${slug}` },
    ...(live ? { robots: { index: false, follow: true } } : {}),
    ...withSocialMeta({ title, description, path: `/archive/${season}/${slug}` }),
  };
}

export default async function ArchiveSeasonPage({
  params,
}: {
  params: Promise<{ season: string; slug: string }>;
}) {
  const { season, slug } = await params;
  const archive = await loadSeasonArchive(Number(season), slug);
  if (!archive) notFound();
  const live = await isArchiveLiveSeason(slug, Number(season));

  return (
    <div className={PAGE_READ}>
      <Link
        href="/archive"
        className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint hover:text-text"
      >
        ← Archive
      </Link>

      <h1 className="mt-3 font-serif text-3xl font-semibold leading-tight text-text md:text-4xl">
        {archive.seriesName} {archive.season}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-text-muted">
        {archive.weekends.length} race weekends, captured as they were run.{' '}
        {live ? (
          <>
            This season is still running —{' '}
            <Link href={`/series/${slug}`} className="text-brand hover:underline">
              the live {archive.seriesName} pages
            </Link>{' '}
            are the ones to follow.
          </>
        ) : null}
      </p>

      <section aria-label="Race weekends" className="mt-8">
        <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-faint">
          Race weekends
        </h2>
        <ul className="mt-3 border-t border-border">
          {archive.weekends.map(w => (
            <li key={w.round} className="border-b border-border">
              <Link
                href={`/archive/${season}/${slug}/weekend/${w.round}`}
                className="flex items-baseline gap-3 py-2.5 hover:bg-surface-elevated"
              >
                <span className="w-10 shrink-0 font-mono text-[11px] text-text-faint">
                  R{w.round}
                </span>
                <span className="min-w-0 flex-1 text-[15px] text-text">
                  {w.roundName ?? w.label ?? `Round ${w.round}`}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-text-faint">
                  {w.dateRangeLabel}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <ArchiveStandings standings={archive.standings} />

      {/* Honest about what the snapshot holds. `none` means no fetcher exists
          for that series at all — ADAC and NLS are curated families — rather
          than a capture that failed. */}
      <p className="mt-10 font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint">
        Archived {archive.capturedAt.slice(0, 10)} · standings{' '}
        {archive.captured.standings === 'ok' ? 'as at capture' : 'not recorded for this series'}
      </p>
    </div>
  );
}
