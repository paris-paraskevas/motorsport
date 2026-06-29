import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { findDriverBySlug } from '@/lib/people';
import { loadSeries } from '@/lib/series';
import { loadSnapshotSource } from '@/components/weekend/WeekendStandingsSnapshot';
import { driverSeasonForm, type DriverSeasonForm } from '@/lib/profile-stats';
import { f1HeadshotsByNumber } from '@/lib/openf1/headshots';
import { withSocialMeta } from '@/lib/seo';

// ISR: profile pages edge-cache (was force-dynamic). Season form comes from
// the cached results fetchers (loadSnapshotSource excludes WEC's no-store).
export const revalidate = 3600;

// On-demand generation + cache on first request (no build-time prerender of
// ~600 driver pages). The sitemap still lists them.
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const driver = await findDriverBySlug(slug);
  if (!driver) return { title: 'Driver not found' };
  const description = `${driver.name}, ${driver.team} (${driver.seriesName}) — season form, results, team.`;
  return {
    title: driver.name,
    description,
    ...withSocialMeta({ title: driver.name, description, path: `/drivers/${slug}` }),
  };
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint font-semibold">
        {label}
      </div>
      <div className="mt-1 font-mono text-2xl md:text-3xl font-bold tabular-nums text-text">
        {value}
      </div>
    </div>
  );
}

function SeasonForm({ form }: { form: DriverSeasonForm }) {
  return (
    <>
      <section className="mb-8 border-y border-border py-4">
        <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-3">
          Season so far
        </h2>
        <div className="flex gap-10 flex-wrap">
          <StatBlock label="Position" value={`P${form.position}`} />
          <StatBlock label="Points" value={String(form.points)} />
          <StatBlock label="Wins" value={String(form.wins)} />
        </div>
        <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
          of {form.fieldSize} classified this season · from race results
        </div>
      </section>

      {form.last5.length > 0 && (
        <section className="mb-8 border-y border-border py-4">
          <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-3">
            Last {form.last5.length} races
          </h2>
          <ul className="divide-y divide-border/60">
            {form.last5.map(r => (
              <li key={`${r.round}-${r.raceName}`} className="flex items-baseline gap-3 py-2">
                <span className="w-9 shrink-0 text-right font-mono text-[11px] font-semibold tabular-nums text-tint">
                  R{r.round}
                </span>
                <span className="flex-1 min-w-0 text-text text-sm font-medium truncate">
                  {r.raceName}
                </span>
                <span className="font-mono text-sm tabular-nums text-text">
                  P{r.position}
                </span>
                <span className="w-10 text-right font-mono text-sm tabular-nums text-text-muted">
                  {r.points}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export default async function DriverPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const driver = await findDriverBySlug(slug);
  if (!driver) notFound();

  // Season form from the series' results feeds — the same cumulation the
  // weekend snapshots use. Null (no feed / no points / name unmatched)
  // degrades to the identity-only page.
  let form: DriverSeasonForm | null = null;
  try {
    const series = await loadSeries(driver.seriesSlug);
    const source = await loadSnapshotSource(series);
    if (source) form = driverSeasonForm(source.races, source.extras, driver.name);
  } catch {
    form = null;
  }

  // F1-only headshot (official F1 media via OpenF1 — see lib/openf1/headshots).
  // KV-cached + fail-soft; absent for non-F1 series or any lookup miss, in which
  // case the header renders exactly as before (no image).
  let headshotUrl: string | null = null;
  if (driver.seriesSlug === 'f1' && driver.number != null) {
    const headshots = await f1HeadshotsByNumber();
    headshotUrl = headshots.get(driver.number) ?? null;
  }

  return (
    <div
      className="relative max-w-2xl lg:max-w-4xl mx-auto p-4 md:p-6 lg:p-8 pb-16"
      style={{
        '--tint': driver.seriesColor,
        ['--series-color' as string]: driver.seriesColor,
      } as React.CSSProperties}
    >
      <div
        className="absolute top-0 left-0 right-0 h-px -z-10"
        style={{
          background: `linear-gradient(90deg, transparent, ${driver.seriesColor}, transparent)`,
        }}
      />

      <header className="mb-8 border-y border-border py-5 md:py-6">
        <div className="flex items-start gap-5 md:gap-6">
          {headshotUrl && (
            <figure className="shrink-0">
              {/* Plain <img>, not next/image: OpenF1 headshots are remote F1-CDN
                  hosts and next.config deliberately configures no
                  images.remotePatterns, so next/image would throw. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={headshotUrl}
                alt={driver.name}
                width={176}
                height={176}
                loading="lazy"
                decoding="async"
                className="h-32 w-32 md:h-44 md:w-44 rounded-2xl object-cover bg-surface border border-border"
              />
              <figcaption className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint">
                Photo: Formula 1 via OpenF1
              </figcaption>
            </figure>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2.5 mb-3 flex-wrap font-mono text-[11px] uppercase tracking-[0.18em] font-semibold">
              <Link
                href={`/series/${driver.seriesSlug}`}
                className="text-tint hover:underline underline-offset-4"
              >
                {driver.seriesName}
              </Link>
              <span className="text-border-strong">·</span>
              <Link
                href={`/teams/${driver.teamSlug}`}
                className="text-text-muted hover:text-text transition-colors duration-(--duration-fast)"
              >
                {driver.team}
              </Link>
            </div>

            <h1 className="font-display text-4xl md:text-5xl font-extrabold uppercase tracking-wide leading-[0.95] text-text">
              {driver.name}
              <span style={{ color: driver.seriesColor }}>.</span>
            </h1>

            <div className="mt-4 flex items-baseline gap-3 flex-wrap">
              {driver.number != null && (
                <span className="text-2xl font-mono tabular-nums text-text-muted">
                  #{driver.number}
                </span>
              )}
              {driver.code && (
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] font-semibold text-text-muted border border-border px-2 py-1">
                  {driver.code}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {form && <SeasonForm form={form} />}

      <section className="border-y border-border py-4">
        <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-3">
          Team
        </h2>
        <Link
          href={`/teams/${driver.teamSlug}`}
          className="group inline-flex items-center gap-3"
          style={
            driver.teamColor
              ? { borderLeft: `3px solid ${driver.teamColor}`, paddingLeft: '0.75rem' }
              : undefined
          }
        >
          <span className="text-text text-xl font-semibold group-hover:text-tint transition-colors duration-(--duration-fast)">
            {driver.team}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-faint group-hover:text-text-muted transition-colors duration-(--duration-fast)">
            View team →
          </span>
        </Link>
      </section>
    </div>
  );
}
