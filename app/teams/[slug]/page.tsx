import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronLeft } from 'lucide-react';
import { findTeamBySlug, loadAllTeams } from '@/lib/people';
import { withSocialMeta } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  const teams = await loadAllTeams();
  return teams.map(t => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const team = await findTeamBySlug(slug);
  if (!team) return { title: 'Team not found' };
  const description = `${team.name} — ${team.seriesName} lineup and details.`;
  return {
    title: team.name,
    description,
    ...withSocialMeta({ title: team.name, description }),
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

  return (
    <div
      className="relative max-w-2xl lg:max-w-4xl mx-auto p-4 md:p-6 lg:p-8 pb-16"
      style={{ '--tint': accent } as React.CSSProperties}
    >
      <div
        className="absolute inset-x-0 top-0 h-72 -z-10 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 80% 100% at 50% 0%, ${accent}1f 0%, transparent 70%)`,
        }}
      />
      <div
        className="absolute top-0 left-0 right-0 h-px -z-10"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
        }}
      />

      <Link
        href={`/series/${team.seriesSlug}?tab=drivers`}
        className="inline-flex items-center gap-1 text-xs font-medium text-text-faint hover:text-text-muted transition-colors duration-(--duration-fast) mb-6"
      >
        <ChevronLeft size={14} />
        Back to {team.seriesName} drivers
      </Link>

      <header className="mb-8">
        <div className="flex items-center gap-2.5 mb-3">
          <span
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: team.seriesColor,
              boxShadow: `0 0 12px ${team.seriesColor}`,
            }}
          />
          <Link
            href={`/series/${team.seriesSlug}`}
            className="text-[11px] uppercase tracking-[0.18em] font-semibold hover:underline underline-offset-4"
            style={{ color: team.seriesColor }}
          >
            {team.seriesName}
          </Link>
        </div>

        <h1
          className="text-text text-4xl md:text-5xl font-bold tracking-tight leading-tight"
          style={team.color ? { borderLeft: `4px solid ${team.color}`, paddingLeft: '0.75rem' } : undefined}
        >
          {team.name}
        </h1>
      </header>

      <section className="rounded-2xl bg-surface/40 border border-border/60 p-5 md:p-6">
        <div className="text-[10px] uppercase tracking-[0.16em] text-text-faint font-semibold mb-3">
          Drivers
        </div>
        <ul className="space-y-1">
          {team.drivers.map(d => (
            <li key={d.slug}>
              <Link
                href={`/drivers/${d.slug}`}
                className="group flex items-baseline gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-surface transition-colors duration-(--duration-fast)"
              >
                {d.number != null && (
                  <span className="text-[11px] tabular-nums font-mono text-text-faint w-8 text-right">
                    #{d.number}
                  </span>
                )}
                <span className="flex-1 text-text text-base font-medium group-hover:text-tint transition-colors duration-(--duration-fast)">
                  {d.name}
                </span>
                {d.code && (
                  <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-text-faint bg-border/60 px-1.5 py-0.5 rounded font-mono">
                    {d.code}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
