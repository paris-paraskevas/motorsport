import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import type { DriverStanding, Series } from '@/lib/types';
import { fetchSeasonLineup } from '@/lib/wikipedia-season';
import { loadCuratedDrivers } from '@/lib/series-content';
import { fetchFullDriverStandings } from '@/lib/standings/brief';
import { slugify } from '@/lib/slug';

function wikipediaUrl(pageTitle: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`;
}

// The grid, analysed (Round-3 ⑥, operator: "an indexed separate page analysing
// driver by driver and team by team"): the curated lineup joined with the live
// drivers' championship, so every driver row carries their position, points
// and wins, and teams rank by combined points. The join is fail-soft — no
// standings feed (multi-class or uncovered series, or a fetch failure) renders
// the plain lineup unannotated.

/** Match a curated driver to their standings row: code first (strongest),
 *  then full-name slug, then last name when it's unique in BOTH sets (feeds
 *  write "Andrea Kimi Antonelli" where drivers.json says "Kimi Antonelli";
 *  last-name-only would confuse the Márquez brothers, hence the uniqueness
 *  gate). */
function buildStandingLookup(standings: DriverStanding[]) {
  const byCode = new Map<string, DriverStanding>();
  const bySlug = new Map<string, DriverStanding>();
  const byLast = new Map<string, DriverStanding | null>(); // null = ambiguous
  for (const s of standings) {
    if (s.driverCode) byCode.set(s.driverCode.toUpperCase(), s);
    bySlug.set(slugify(s.driverName), s);
    const last = slugify(s.driverName.split(' ').slice(-1)[0] ?? '');
    if (last) byLast.set(last, byLast.has(last) ? null : s);
  }
  return (name: string, code?: string): DriverStanding | undefined => {
    if (code) {
      const hit = byCode.get(code.toUpperCase());
      if (hit) return hit;
    }
    const full = bySlug.get(slugify(name));
    if (full) return full;
    const last = slugify(name.split(' ').slice(-1)[0] ?? '');
    const byLastHit = last ? byLast.get(last) : undefined;
    return byLastHit ?? undefined;
  };
}

function standingLine(s: DriverStanding): string {
  const parts = [`P${s.position}`, `${s.points} pts`];
  if (typeof s.wins === 'number' && s.wins > 0) parts.push(`${s.wins} ${s.wins === 1 ? 'win' : 'wins'}`);
  return parts.join(' · ');
}

export async function DriversTab({ series }: { series: Series }) {
  const [curated, standings] = await Promise.all([
    loadCuratedDrivers(series.meta.slug),
    fetchFullDriverStandings(series.meta.slug, series.meta.season).catch(() => null),
  ]);

  if (curated && curated.teams.length > 0) {
    const lookup = standings && standings.length > 0 ? buildStandingLookup(standings) : null;

    // Team-by-team analysis: combined points + best placing from the joined
    // rows. Teams rank by combined points when the join covered anyone;
    // curated order (the file's own competitive order) otherwise.
    const teams = curated.teams.map(team => {
      const rows = team.drivers.map(d => ({ d, standing: lookup?.(d.name, d.code) }));
      const joined = rows.filter(r => r.standing);
      const combined = joined.reduce((sum, r) => sum + (r.standing?.points ?? 0), 0);
      const best = joined.reduce<number | null>(
        (b, r) => (b === null || (r.standing?.position ?? Infinity) < b ? (r.standing?.position ?? b) : b),
        null,
      );
      return { team, rows, combined, best, joinedCount: joined.length };
    });
    const anyJoined = teams.some(t => t.joinedCount > 0);
    if (anyJoined) teams.sort((a, b) => b.combined - a.combined);

    const driverCount = curated.teams.reduce((n, t) => n + t.drivers.length, 0);

    return (
      <div>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-faint">
            {driverCount} drivers · {curated.teams.length} teams
            {anyJoined ? ' · ranked by combined points' : ''}
          </span>
          {anyJoined && (
            <Link
              href={`/series/${series.meta.slug}/standings`}
              className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-brand hover:underline"
            >
              Full standings →
            </Link>
          )}
        </div>
        <div className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
          {teams.map(({ team, rows, combined, best, joinedCount }, idx) => {
            const teamSlug = slugify(team.name);
            return (
              <section key={`${team.name}-${idx}`} className="mb-6">
                <div className="flex items-baseline justify-between gap-3 border-b border-text pb-1">
                  <span className="flex min-w-0 items-center gap-2.5">
                    {team.color && (
                      <span aria-hidden="true" className="h-4 w-[3px] shrink-0" style={{ backgroundColor: team.color }} />
                    )}
                    <Link
                      href={`/teams/${teamSlug}`}
                      className="truncate font-serif text-[20px] font-semibold leading-tight text-text transition-colors duration-(--duration-fast) hover:text-brand"
                    >
                      {team.name}
                    </Link>
                  </span>
                  {joinedCount > 0 && (
                    <span className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                      {combined} pts{best != null ? ` · best P${best}` : ''}
                    </span>
                  )}
                </div>
                <ul className="divide-y divide-border">
                  {rows.map(({ d, standing }, i) => {
                    const driverSlug = slugify(d.name);
                    return (
                      <li key={`${d.name}-${i}`} className="flex min-h-10 items-baseline gap-2.5 py-1.5">
                        <span className="w-6 shrink-0 text-right font-mono text-[11px] tabular-nums text-text-faint">
                          {d.number != null ? d.number : ''}
                        </span>
                        <Link
                          href={`/drivers/${driverSlug}`}
                          className="min-w-0 flex-1 truncate font-serif text-[16px] font-semibold text-text transition-colors duration-(--duration-fast) hover:text-brand"
                        >
                          {d.name}
                        </Link>
                        {standing ? (
                          <span className="shrink-0 font-mono text-[11px] tabular-nums text-text-muted">
                            {standingLine(standing)}
                          </span>
                        ) : d.code ? (
                          <span className="shrink-0 border border-border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-text-faint">
                            {d.code}
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
        <div className="text-[11px] text-text-faint">Source: curated{anyJoined ? ' · standings live' : ''}</div>
      </div>
    );
  }

  const seasonPage = series.meta.seasonPage;
  const lineup = seasonPage ? await fetchSeasonLineup(seasonPage) : [];

  if (lineup.length > 0 && seasonPage) {
    const pageUrl = wikipediaUrl(seasonPage);
    return (
      <div>
        <div className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
          {lineup.map((entry, idx) => (
            <section key={`${entry.team}-${idx}`} className="mb-6">
              <div className="border-b border-text pb-1 font-serif text-[20px] font-semibold leading-tight text-text">
                {entry.team}
              </div>
              <ul className="divide-y divide-border">
                {entry.drivers.map((d, i) => (
                  <li key={`${d}-${i}`} className="min-h-10 py-1.5 font-serif text-[16px] font-semibold text-text">
                    {d}
                  </li>
                ))}
              </ul>
            </section>
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
        className="prose dark:prose-invert prose-sm max-w-none border-y border-border py-5"
        dangerouslySetInnerHTML={{ __html: series.drivers }}
      />
    );
  }

  return (
    <div className="border border-border-strong bg-surface p-6 text-center md:p-8">
      <div className="mb-1 font-serif text-[19px] font-semibold text-text">Lineup</div>
      <div className="mx-auto mb-5 max-w-md text-sm text-text-faint">
        We couldn&apos;t parse a clean drivers table for the {series.meta.season}{' '}
        {series.meta.name} season. Check Wikipedia or the official site.
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {seasonPage && (
          <a
            href={wikipediaUrl(seasonPage)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 border border-border-strong px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
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
            className="inline-flex items-center gap-1.5 border border-border-strong px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
          >
            Official site
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  );
}
