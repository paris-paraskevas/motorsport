import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import type { Series } from '@/lib/types';
import { fetchSeasonLineup } from '@/lib/wikipedia-season';
import { loadCuratedDrivers } from '@/lib/series-content';
import { slugify } from '@/lib/slug';

function wikipediaUrl(pageTitle: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`;
}

export async function DriversTab({ series }: { series: Series }) {
  const curated = await loadCuratedDrivers(series.meta.slug);
  if (curated && curated.teams.length > 0) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {curated.teams.map((team, idx) => {
            const teamSlug = slugify(team.name);
            return (
              <div
                key={`${team.name}-${idx}`}
                className="rounded-xl bg-surface/40 border border-border/60 p-4"
                style={team.color ? { borderLeftColor: team.color, borderLeftWidth: '3px' } : undefined}
              >
                <Link
                  href={`/teams/${teamSlug}`}
                  className="block text-base text-text font-semibold mb-2 hover:text-tint transition-colors duration-(--duration-fast)"
                >
                  {team.name}
                </Link>
                <ul className="space-y-0.5">
                  {team.drivers.map((d, i) => {
                    const driverSlug = slugify(d.name);
                    return (
                      <li key={`${d.name}-${i}`} className="text-sm flex items-baseline gap-2">
                        {d.number != null ? (
                          <span className="text-[10px] tabular-nums font-mono text-text-faint w-5 text-right">
                            {d.number}
                          </span>
                        ) : null}
                        <Link
                          href={`/drivers/${driverSlug}`}
                          className="flex-1 text-text-muted hover:text-text transition-colors duration-(--duration-fast)"
                        >
                          {d.name}
                        </Link>
                        {d.code ? (
                          <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-text-faint bg-border/60 px-1.5 py-0.5 rounded font-mono">
                            {d.code}
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
        <div className="text-[11px] text-text-faint">Source: curated</div>
      </div>
    );
  }

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
              className="rounded-xl bg-surface/40 border border-border/60 p-4"
            >
              <div className="text-base text-text font-semibold mb-2">
                {entry.team}
              </div>
              <ul className="space-y-0.5">
                {entry.drivers.map((d, i) => (
                  <li key={`${d}-${i}`} className="text-sm text-text-muted">
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="text-[11px] text-text-faint">
          <a
            href={pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-text-muted transition-colors duration-(--duration-fast)"
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
        className="prose prose-invert prose-sm max-w-none rounded-xl bg-surface/40 border border-border/60 p-5"
        dangerouslySetInnerHTML={{ __html: series.drivers }}
      />
    );
  }

  return (
    <div className="rounded-2xl bg-surface/40 border border-border/60 p-6 md:p-8 text-center">
      <div className="text-text text-base font-medium mb-1">Lineup</div>
      <div className="text-text-faint text-sm mb-5 max-w-md mx-auto">
        We couldn&apos;t parse a clean drivers table for the {series.meta.season}{' '}
        {series.meta.name} season. Check Wikipedia or the official site.
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {seasonPage && (
          <a
            href={wikipediaUrl(seasonPage)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text bg-surface hover:bg-surface-elevated border border-border rounded-full px-3 py-1.5 transition-colors duration-(--duration-fast)"
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
            className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text bg-surface hover:bg-surface-elevated border border-border rounded-full px-3 py-1.5 transition-colors duration-(--duration-fast)"
          >
            Official site
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  );
}
