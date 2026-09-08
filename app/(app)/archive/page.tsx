import type { Metadata } from 'next';
import Link from 'next/link';
import { listArchivedSeasons, listArchivedSeries, loadSeasonArchive } from '@/lib/season-archive';
import { withSocialMeta } from '@/lib/seo';
import { PAGE_READ } from '@/lib/site';

// Build-time only — the archive lives in `data/`, outside the Worker bundle.
export const dynamic = 'force-static';

const TITLE = 'Season archive';
const DESCRIPTION =
  'Past seasons as they were run — every race weekend of every championship we track, with session schedules and final classifications.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/archive' },
  ...withSocialMeta({ title: TITLE, description: DESCRIPTION, path: '/archive' }),
};

export default async function ArchiveIndexPage() {
  const seasons = await listArchivedSeasons();
  const groups = await Promise.all(
    seasons.map(async season => {
      const slugs = await listArchivedSeries(season);
      const entries = await Promise.all(
        slugs.map(async slug => {
          const a = await loadSeasonArchive(season, slug);
          return a ? { slug, name: a.seriesName, rounds: a.weekends.length } : null;
        }),
      );
      return { season, entries: entries.filter(Boolean) as { slug: string; name: string; rounds: number }[] };
    }),
  );

  return (
    <div className={PAGE_READ}>
      <h1 className="font-serif text-3xl font-semibold leading-tight text-text md:text-4xl">
        {TITLE}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-text-muted">
        Race weekend pages are built from live calendar feeds, and most of those feeds only carry
        the current year. These are the seasons we have captured before they rolled over.
      </p>

      {groups.length === 0 ? (
        <p className="mt-8 text-sm text-text-muted">Nothing archived yet.</p>
      ) : (
        groups.map(({ season, entries }) => (
          <section key={season} aria-label={`${season} season`} className="mt-8">
            <h2 className="font-mono text-10 font-semibold uppercase tracking-[0.18em] text-text-faint">
              {season}
            </h2>
            <ul className="mt-3 border-t border-border">
              {entries.map(e => (
                <li key={e.slug} className="border-b border-border">
                  <Link
                    href={`/archive/${season}/${e.slug}`}
                    className="flex items-baseline gap-3 py-2.5 hover:bg-surface-elevated"
                  >
                    <span className="min-w-0 flex-1 text-15 text-text">{e.name}</span>
                    <span className="shrink-0 font-mono text-11 text-text-faint">
                      {e.rounds} rounds
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
