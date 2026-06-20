import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { findTeamBySlug } from '@/lib/people';
import { loadSeries } from '@/lib/series';
import { loadSnapshotSource, type SnapshotSource } from '@/components/weekend/WeekendStandingsSnapshot';
import {
  driverSeasonForm,
  teamSeasonForm,
  type TeamSeasonForm,
} from '@/lib/profile-stats';
import { withSocialMeta } from '@/lib/seo';

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
  if (!team) return { title: 'Team not found' };
  const description = `${team.name} — ${team.seriesName} lineup, season form and drivers.`;
  return {
    title: team.name,
    description,
    ...withSocialMeta({ title: team.name, description, path: `/teams/${slug}` }),
  };
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
  let teamForm: TeamSeasonForm | null = null;
  let source: SnapshotSource | null = null;
  try {
    const series = await loadSeries(team.seriesSlug);
    source = await loadSnapshotSource(series);
    if (source && source.showTeams) {
      teamForm = teamSeasonForm(source.races, source.extras, team.name);
    }
  } catch {
    teamForm = null;
  }

  const driverRows = team.drivers.map(d => {
    const form = source ? driverSeasonForm(source.races, source.extras, d.name) : null;
    return { ...d, form };
  });
  const anyDriverForm = driverRows.some(d => d.form);

  return (
    <div
      className="relative max-w-2xl lg:max-w-4xl mx-auto p-4 md:p-6 lg:p-8 pb-16"
      style={{ '--tint': accent } as React.CSSProperties}
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
            style={{ color: team.seriesColor }}
          >
            {team.seriesName}
          </Link>
        </div>

        <h1
          className="font-display text-4xl md:text-5xl font-extrabold uppercase tracking-wide leading-[0.95] text-text"
          style={team.color ? { borderLeft: `4px solid ${team.color}`, paddingLeft: '0.75rem' } : undefined}
        >
          {team.name}
          <span style={{ color: accent }}>.</span>
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

      <section className="border-y border-border py-4">
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
    </div>
  );
}
