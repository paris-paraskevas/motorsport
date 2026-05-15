import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import type { Series } from '@/lib/types';
import { loadCuratedDrivers } from '@/lib/series-content';
import { slugify } from '@/lib/slug';

function wikipediaUrl(pageTitle: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`;
}

export async function TeamsTab({ series }: { series: Series }) {
  const curated = await loadCuratedDrivers(series.meta.slug);

  if (!curated || curated.teams.length === 0) {
    return (
      <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/60 p-6 md:p-8 text-center">
        <div className="text-zinc-300 text-base font-medium mb-1">
          No team directory yet
        </div>
        <div className="text-zinc-500 text-sm mb-5 max-w-md mx-auto">
          The {series.meta.season} {series.meta.name} season doesn&apos;t have a
          curated team list. Check the Drivers tab for the season lineup, or the
          official site below.
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link
            href={`/series/${series.meta.slug}?tab=drivers`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-200 bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1.5 transition-colors"
          >
            Drivers tab
          </Link>
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
          {series.meta.seasonPage && (
            <a
              href={wikipediaUrl(series.meta.seasonPage)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-200 bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1.5 transition-colors"
            >
              Season on Wikipedia
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {curated.teams.map((team, idx) => {
          const teamSlug = slugify(team.name);
          return (
            <Link
              key={`${team.name}-${idx}`}
              href={`/teams/${teamSlug}`}
              className="group rounded-xl bg-zinc-900/40 border border-zinc-800/60 p-4 transition-all hover:bg-zinc-900/70 hover:border-zinc-700"
              style={
                team.color
                  ? { borderLeftColor: team.color, borderLeftWidth: '3px' }
                  : undefined
              }
            >
              <div className="flex items-center gap-2 mb-1.5">
                {team.color && (
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: team.color }}
                  />
                )}
                <div className="text-base text-zinc-100 font-semibold group-hover:text-white transition-colors flex-1 min-w-0 truncate">
                  {team.name}
                </div>
              </div>
              <div className="text-xs text-zinc-500">
                {team.drivers.length} {team.drivers.length === 1 ? 'driver' : 'drivers'}
              </div>
            </Link>
          );
        })}
      </div>
      <div className="text-[11px] text-zinc-500">Source: curated</div>
    </div>
  );
}
