import type { Series } from '@/lib/types';
import { fetchSeasonLineup } from '@/lib/wikipedia-season';
import { PlaceholderTab } from './PlaceholderTab';

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

  return <PlaceholderTab tabLabel="Drivers & Teams" />;
}
