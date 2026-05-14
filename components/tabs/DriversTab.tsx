import { ExternalLink } from 'lucide-react';
import type { Series } from '@/lib/types';
import { fetchSeasonLineup } from '@/lib/wikipedia-season';

function wikipediaUrl(pageTitle: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`;
}

export async function DriversTab({ series }: { series: Series }) {
  const seasonPage = series.meta.seasonPage;
  const lineup = seasonPage ? await fetchSeasonLineup(seasonPage) : [];

  if (lineup.length > 0 && seasonPage) {
    const pageUrl = wikipediaUrl(seasonPage);
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {lineup.map((entry, idx) => (
            <div
              key={`${entry.team}-${idx}`}
              className="rounded-xl bg-zinc-900/40 border border-zinc-800/60 p-4"
            >
              <div className="text-base text-zinc-100 font-semibold mb-2">
                {entry.team}
              </div>
              <ul className="space-y-0.5">
                {entry.drivers.map((d, i) => (
                  <li key={`${d}-${i}`} className="text-sm text-zinc-300">
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="text-[11px] text-zinc-500">
          <a
            href={pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-300"
          >
            Source: Wikipedia &rarr;
          </a>
        </div>
      </div>
    );
  }

  if (series.drivers && series.drivers.trim().length > 0) {
    return (
      <article
        className="prose prose-invert prose-sm max-w-none rounded-xl bg-zinc-900/40 border border-zinc-800/60 p-5"
        dangerouslySetInnerHTML={{ __html: series.drivers }}
      />
    );
  }

  // No parseable lineup, no curated content. Show a clean link-out to
  // Wikipedia + official site rather than a generic "Coming soon".
  return (
    <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/60 p-6 md:p-8 text-center">
      <div className="text-zinc-300 text-base font-medium mb-1">Lineup</div>
      <div className="text-zinc-500 text-sm mb-5 max-w-md mx-auto">
        We couldn&apos;t parse a clean drivers table for the {series.meta.season}{' '}
        {series.meta.name} season. Check Wikipedia or the official site.
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {seasonPage && (
          <a
            href={wikipediaUrl(seasonPage)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-200 bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1.5 transition-colors"
          >
            Season on Wikipedia
            <ExternalLink size={12} />
          </a>
        )}
        {series.meta.officialSite && (
          <a
            href={series.meta.officialSite}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-200 bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1.5 transition-colors"
          >
            Official site
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  );
}
