import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ExternalLink } from 'lucide-react';
import { seriesInk } from '@/lib/site';
import { findTeamBySlug } from '@/lib/people';
import { loadSeries } from '@/lib/series';
import { loadSnapshotSource, type SnapshotSource } from '@/components/weekend/WeekendStandingsSnapshot';
import {
  driverSeasonForm,
  namesMatch,
  teamSeasonForm,
  type TeamSeasonForm,
} from '@/lib/profile-stats';
import {
  aggregateTeamsTrend,
  buildSeasonTrendData,
  type SeasonTrendData,
} from '@/lib/season-trend';
import { LazySeasonTrendChart } from '@/components/LazySeasonTrendChart';
import { loadCuratedDrivers } from '@/lib/series-content';
import { fetchWikipediaBio, type WikipediaBio } from '@/lib/wikipedia-bio';
import { fetchNews, filterNewsByMention, newsMentionAliases } from '@/lib/news';
import type { NewsItem } from '@/lib/types';
import { withSocialMeta } from '@/lib/seo';
import { PAGE_WIDE } from '@/lib/site';

// ISR: team pages edge-cache (was force-dynamic). Same cached snapshot feeds
// as driver pages (WEC excluded → no no-store).
export const revalidate = 3600;

// On-demand generation + cache on first request. The sitemap still lists them.
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const team = await findTeamBySlug(slug);
  // notFound() in metadata, not a fallback title: the streamed shell flushes
  // before the body's notFound() can 404 (soft-404 class, weekend/[round]).
  if (!team) notFound();
  // ~190 chars: Bing WMT flagged the old one-liner as too short (2026-08-20).
  const description = `${team.name} in ${team.seriesName} — the current driver lineup with numbers and codes, championship form and points for every driver, race-by-race results and the latest team news, updated through the season.`;
  return {
    title: team.name,
    description,
    ...withSocialMeta({ title: team.name, description, path: `/teams/${slug}` }),
  };
}

// Build EVERY constructor's cumulative-points trajectory for the series (via the
// tested aggregateTeamsTrend), so a team page shows the championship battle with
// this team in context — a lone one-team line reads as pointless (operator). The
// chart emphasizes the current team. Each team's curated members resolve to their
// results-feed names with namesMatch (drivers.json vs feed drift); teams with no
// feed presence drop out. Sums of member points, not championship countback (the
// aggregateTeamsTrend caveat) — fine for a trajectory read. null when nothing charts.
function allTeamsTrend(
  full: SeasonTrendData,
  curatedTeams: Array<{ name: string; drivers: Array<{ name: string }> }>,
): SeasonTrendData | null {
  const inputs = curatedTeams
    .map(t => {
      const memberNames: string[] = [];
      let feedTeam: string | undefined;
      for (const d of t.drivers) {
        const fd = full.drivers.find(x => namesMatch(x.name, d.name));
        if (fd) {
          memberNames.push(fd.name);
          feedTeam ??= fd.team;
        }
      }
      return { name: t.name, feedTeam, memberNames };
    })
    .filter(t => t.memberNames.length > 0);
  if (inputs.length === 0) return null;
  return aggregateTeamsTrend(full, inputs);
}

// Short "About" bio (Wikipedia intro) + "In the news" mentions. Twins of the
// sections on app/(app)/drivers/[slug]/page.tsx — duplicated because page
// modules can't export shared components and these two pages are the only
// consumers (no-premature-helper rule).
function AboutSection({ bio }: { bio: WikipediaBio }) {
  return (
    <section className="mb-8 border-y border-border py-4">
      <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-3">
        About
      </h2>
      <div className="space-y-3">
        {bio.paragraphs.map((p, i) => (
          <p key={i} className="text-sm text-text-muted leading-relaxed">
            {p}
          </p>
        ))}
      </div>
      <div className="mt-3 text-xs text-text-faint">
        Source:{' '}
        <a
          href={bio.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-muted hover:text-text underline underline-offset-2 transition-colors duration-(--duration-fast)"
        >
          Wikipedia &rarr;
        </a>
      </div>
    </section>
  );
}

function NewsMentionsSection({ items }: { items: NewsItem[] }) {
  return (
    <section className="mb-8 border-y border-border py-4">
      <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-3">
        In the news
      </h2>
      <div className="divide-y divide-border/60">
        {items.map(item => {
          const excerpt = item.description
            ? item.description.length > 140
              ? item.description.slice(0, 137).trimEnd() + '…'
              : item.description
            : null;
          return (
            <a
              key={item.link}
              href={item.link}
              target="_blank"
              rel="nofollow noopener noreferrer"
              className="group block py-3.5 px-2 -mx-2 transition-colors duration-(--duration-fast) hover:bg-surface"
            >
              <div className="flex items-center gap-2 mb-1 min-w-0">
                <time
                  dateTime={item.pubDate.toISOString()}
                  className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint tnum shrink-0"
                >
                  {item.pubDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </time>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint shrink-0">
                  · motorsport.com
                </span>
                <ExternalLink
                  size={12}
                  className="ml-auto shrink-0 text-text-faint group-hover:text-text-muted transition-colors duration-(--duration-fast)"
                />
              </div>
              <h3 className="text-[15px] md:text-base font-semibold leading-snug tracking-tight text-text">
                {item.title}
              </h3>
              {excerpt && (
                <p className="mt-1 text-sm text-text-muted leading-relaxed line-clamp-2">
                  {excerpt}
                </p>
              )}
            </a>
          );
        })}
      </div>
      <div className="pt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
        Source:{' '}
        <a
          href="https://www.motorsport.com/"
          target="_blank"
          rel="nofollow noopener noreferrer"
          className="text-text-muted hover:text-text underline underline-offset-2 transition-colors duration-(--duration-fast)"
        >
          motorsport.com ↗
        </a>
      </div>
    </section>
  );
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const team = await findTeamBySlug(slug);
  if (!team) notFound();

  const accent = team.color ?? team.seriesColor;

  // Season form from the series' results feeds (same path as driver pages
  // and weekend snapshots). Team standings render only where a per-team sum
  // IS that series' championship — the snapshot source's showTeams flag.
  // Wikipedia bio + series news load in parallel; each independently
  // fail-soft (absent section, never an error).
  const [seasonData, bio, seriesNews] = await Promise.all([
    (async (): Promise<{
      teamForm: TeamSeasonForm | null;
      source: SnapshotSource | null;
      trend: SeasonTrendData | null;
    }> => {
      try {
        const series = await loadSeries(team.seriesSlug);
        const source = await loadSnapshotSource(series);
        const teamForm =
          source && source.showTeams
            ? teamSeasonForm(source.races, source.extras, team.name)
            : null;
        // All constructors' trajectories (this team emphasized in the chart),
        // only where the feed's per-race points are championship-canonical (the
        // same pointsExact gate the driver trend uses); winners-only /
        // derived-points feeds would draw a false line.
        let trend: SeasonTrendData | null = null;
        if (source && source.pointsExact) {
          const curated = await loadCuratedDrivers(team.seriesSlug);
          if (curated) {
            trend = allTeamsTrend(
              buildSeasonTrendData(source.races, source.extras ?? []),
              curated.teams,
            );
          }
        }
        return { teamForm, source, trend };
      } catch {
        return { teamForm: null, source: null, trend: null };
      }
    })(),
    fetchWikipediaBio(team.name),
    fetchNews(team.seriesSlug),
  ]);
  const { teamForm, source, trend } = seasonData;
  const mentions = filterNewsByMention(seriesNews, newsMentionAliases('team', team.name));

  const driverRows = team.drivers.map(d => {
    const form = source ? driverSeasonForm(source.races, source.extras, d.name) : null;
    return { ...d, form };
  });
  const anyDriverForm = driverRows.some(d => d.form);

  return (
    <div
      className={`relative ${PAGE_WIDE}`}
      style={{ '--tint': accent, '--tint-fill': accent } as React.CSSProperties}
    >
      <div
        className="absolute top-0 left-0 right-0 h-px -z-10"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
        }}
      />

      <header className="mb-8 border-y border-border py-5 md:py-6">
        <div className="flex items-center gap-2.5 mb-3 font-mono text-[11px] uppercase tracking-[0.18em] font-semibold">
          <Link
            href={`/series/${team.seriesSlug}`}
            className="hover:underline underline-offset-4"
            style={{ color: seriesInk(team.seriesColor) }}
          >
            {team.seriesName}
          </Link>
        </div>

        <h1
          className="font-display text-4xl md:text-5xl font-extrabold uppercase tracking-wide leading-[0.95] text-text"
          style={team.color ? { borderLeft: `4px solid ${team.color}`, paddingLeft: '0.75rem' } : undefined}
        >
          {team.name}
          <span style={{ color: seriesInk(accent) }}>.</span>
        </h1>
      </header>

      {teamForm && (
        <section className="mb-8 border-y border-border py-4">
          <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-3">
            Season so far
          </h2>
          <div className="flex gap-10 flex-wrap">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint font-semibold">
                Position
              </div>
              <div className="mt-1 font-mono text-2xl md:text-3xl font-bold tabular-nums text-text">
                P{teamForm.position}
              </div>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint font-semibold">
                Points
              </div>
              <div className="mt-1 font-mono text-2xl md:text-3xl font-bold tabular-nums text-text">
                {teamForm.points}
              </div>
            </div>
          </div>
          <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
            of {teamForm.fieldSize} teams · from race results
          </div>
        </section>
      )}

      {trend && (
        <section className="mb-8 border-y border-border py-4">
          <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-3">
            Points trajectory
          </h2>
          <LazySeasonTrendChart {...trend} emphasize={team.name} />
          <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
            Constructors&apos; points by round · {team.name} highlighted · from race results
          </div>
        </section>
      )}

      <section className="mb-8 border-y border-border py-4">
        <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-3">
          Drivers
        </h2>
        <ul className="divide-y divide-border/60">
          {driverRows.map(d => (
            <li key={d.slug}>
              <Link
                href={`/drivers/${d.slug}`}
                className="group flex items-baseline gap-3 py-2.5"
              >
                {d.number != null && (
                  <span className="text-[11px] tabular-nums font-mono text-text-faint w-8 text-right shrink-0">
                    #{d.number}
                  </span>
                )}
                <span className="flex-1 min-w-0 text-text text-base font-medium truncate group-hover:text-tint transition-colors duration-(--duration-fast)">
                  {d.name}
                </span>
                {d.code && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] font-semibold text-text-faint border border-border px-1.5 py-0.5">
                    {d.code}
                  </span>
                )}
                {d.form && (
                  <span className="font-mono text-sm tabular-nums text-text-muted">
                    P{d.form.position} · {d.form.points} pts
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
        {anyDriverForm && (
          <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
            Positions and points from race results
          </div>
        )}
      </section>

      {bio && <AboutSection bio={bio} />}

      {mentions.length > 0 && <NewsMentionsSection items={mentions} />}
    </div>
  );
}
