import Link from 'next/link';
import type { Metadata } from 'next';
import { loadAllDrivers, type DriverDetail } from '@/lib/people';
import { loadSeries } from '@/lib/series';
import { loadSnapshotSource } from '@/components/weekend/WeekendStandingsSnapshot';
import { driverSeasonForm, namesMatch, type DriverSeasonForm } from '@/lib/profile-stats';
import { buildSeasonTrendData, type SeasonTrendData } from '@/lib/season-trend';
import { LazySeasonTrendChart } from '@/components/LazySeasonTrendChart';
import { withSocialMeta } from '@/lib/seo';
import type { RaceResult } from '@/lib/types';
import { AnalysisGate } from '@/components/f1/AnalysisGate';
import { auth } from '@clerk/nextjs/server';

// F1 driver head-to-head. Reuses the SAME season-form + trend cumulation the
// driver pages and weekend snapshots use (lib/profile-stats + lib/season-trend
// off loadSnapshotSource), so nothing new is fetched or parsed. F1-only for now
// (both drivers share the F1 feed); extending to other live-standings series is
// a follow-up. Quali H2H is deferred — it needs a per-weekend OpenF1 fan-out.
export const revalidate = 3600;

const TITLE = 'F1 head-to-head';
const DESCRIPTION =
  'Compare any two Formula 1 drivers this season — points, championship position, wins, recent form, their race-by-race head-to-head record and points trajectory.';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: TITLE,
    description: DESCRIPTION,
    // Canonical is the bare page — we don't want every ?a=&b= combination indexed.
    alternates: { canonical: '/f1/compare' },
    ...withSocialMeta({ title: TITLE, description: DESCRIPTION, path: '/f1/compare' }),
  };
}

// Race-by-race head-to-head over the rounds both drivers finished (classified).
function raceH2H(races: RaceResult[], nameA: string, nameB: string): { aAhead: number; bAhead: number; shared: number } {
  let aAhead = 0;
  let bAhead = 0;
  let shared = 0;
  for (const r of races) {
    const ea = r.results.find((e) => namesMatch(e.driverName, nameA));
    const eb = r.results.find((e) => namesMatch(e.driverName, nameB));
    if (!ea || !eb) continue;
    shared++;
    if (ea.position < eb.position) aAhead++;
    else if (eb.position < ea.position) bAhead++;
  }
  return { aAhead, bAhead, shared };
}

// Narrow the full-season trend to just the two drivers so the reused chart
// draws two lines (both stay in its default-visible set). null if either driver
// never appears in the results feed.
function trendForTwo(full: SeasonTrendData, nameA: string, nameB: string): SeasonTrendData | null {
  const dA = full.drivers.find((d) => namesMatch(d.name, nameA));
  const dB = full.drivers.find((d) => namesMatch(d.name, nameB));
  if (!dA || !dB || dA.name === dB.name) return null;
  return {
    data: full.data.map((p) => ({
      round: p.round,
      raceName: p.raceName,
      [dA.name]: p[dA.name] ?? 0,
      [dB.name]: p[dB.name] ?? 0,
    })),
    drivers: [dA, dB],
    totalsByDriver: {
      [dA.name]: full.totalsByDriver[dA.name] ?? 0,
      [dB.name]: full.totalsByDriver[dB.name] ?? 0,
    },
  };
}

// One comparison row: A value · label · B value, with the leading side lit.
// `better` says which side wins ('a' | 'b' | 'tie'); 'lower' metrics (position)
// flip the comparison at the call site.
function StatRow({
  label,
  a,
  b,
  better,
}: {
  label: string;
  a: string;
  b: string;
  better: 'a' | 'b' | 'tie';
}) {
  const cls = (side: 'a' | 'b') =>
    `font-mono text-2xl md:text-3xl font-bold tabular-nums ${better === side ? 'text-text' : 'text-text-faint'}`;
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-border/60 py-3">
      <div className={`text-left ${cls('a')}`}>{a}</div>
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint font-semibold text-center">
        {label}
      </div>
      <div className={`text-right ${cls('b')}`}>{b}</div>
    </div>
  );
}

function DriverHead({ driver, align }: { driver: DriverDetail; align: 'left' | 'right' }) {
  return (
    <div className={align === 'right' ? 'text-right' : 'text-left'}>
      <Link
        href={`/drivers/${driver.slug}`}
        className="font-display text-xl md:text-2xl font-extrabold uppercase tracking-wide text-text hover:text-tint transition-colors duration-(--duration-fast)"
      >
        {driver.name}
      </Link>
      <div
        className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted"
        style={driver.teamColor ? { color: driver.teamColor } : undefined}
      >
        {driver.team}
      </div>
    </div>
  );
}

function Last5Column({ form, align }: { form: DriverSeasonForm; align: 'left' | 'right' }) {
  return (
    <ul className="divide-y divide-border/60">
      {form.last5.map((r) => (
        <li
          key={`${r.round}-${r.raceName}`}
          className={`flex items-baseline gap-2 py-1.5 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}
        >
          <span className="w-8 shrink-0 font-mono text-[11px] font-semibold tabular-nums text-tint">R{r.round}</span>
          <span className="flex-1 min-w-0 truncate text-sm text-text-muted">{r.raceName}</span>
          <span className="font-mono text-sm tabular-nums text-text">P{r.position}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function F1ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { a, b } = await searchParams;

  const f1Drivers = (await loadAllDrivers())
    .filter((d) => d.seriesSlug === 'f1')
    .sort((x, y) => x.name.localeCompare(y.name));

  const driverA = a ? f1Drivers.find((d) => d.slug === a) ?? null : null;
  const driverB = b ? f1Drivers.find((d) => d.slug === b) ?? null : null;
  const canCompare = Boolean(driverA && driverB && driverA.slug !== driverB.slug);
  // Head-to-head is gated (signed-in only), leak-free: the comparison is only
  // computed when unlocked, so an anonymous client never receives the stats.
  // The picker itself stays public so the page is indexable + markets the tool.
  const { userId } = await auth();
  const ready = canCompare && Boolean(userId);

  let formA: DriverSeasonForm | null = null;
  let formB: DriverSeasonForm | null = null;
  let trend: SeasonTrendData | null = null;
  let h2h: { aAhead: number; bAhead: number; shared: number } | null = null;

  if (ready && driverA && driverB) {
    try {
      const series = await loadSeries('f1');
      const source = await loadSnapshotSource(series);
      if (source) {
        formA = driverSeasonForm(source.races, source.extras, driverA.name);
        formB = driverSeasonForm(source.races, source.extras, driverB.name);
        h2h = raceH2H(source.races, driverA.name, driverB.name);
        trend = trendForTwo(buildSeasonTrendData(source.races, source.extras ?? []), driverA.name, driverB.name);
      }
    } catch {
      /* degrade to identity-only compare */
    }
  }

  const color = f1Drivers[0]?.seriesColor ?? '#e10600';

  return (
    <div
      className="relative max-w-2xl lg:max-w-4xl mx-auto p-4 md:p-6 lg:p-8 pb-16"
      style={{ '--tint': color, ['--series-color' as string]: color } as React.CSSProperties}
    >
      <div
        className="absolute top-0 left-0 right-0 h-px -z-10"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />

      <header className="mb-8 border-b border-border pb-6">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-faint font-semibold mb-2">
          Formula 1 · Head-to-head
        </div>
        <h1 className="font-display text-4xl md:text-5xl font-extrabold uppercase tracking-wide leading-[0.95] text-text">
          Compare drivers<span style={{ color }}>.</span>
        </h1>
        <p className="mt-3 max-w-prose text-sm text-text-muted">
          Pick two drivers to see this season side by side — points, position, wins, recent form, their race-by-race
          record and points trajectory.
        </p>
      </header>

      {/* Picker — a native GET form, so it works without client JS. */}
      <form method="get" action="/f1/compare" className="mb-8 flex flex-wrap items-end gap-3">
        <label className="flex-1 min-w-[9rem]">
          <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint font-semibold mb-1">
            Driver A
          </span>
          <select
            name="a"
            defaultValue={driverA?.slug ?? ''}
            className="w-full border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-border-strong"
          >
            <option value="">Select driver…</option>
            {f1Drivers.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.name} · {d.team}
              </option>
            ))}
          </select>
        </label>
        <label className="flex-1 min-w-[9rem]">
          <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint font-semibold mb-1">
            Driver B
          </span>
          <select
            name="b"
            defaultValue={driverB?.slug ?? ''}
            className="w-full border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-border-strong"
          >
            <option value="">Select driver…</option>
            {f1Drivers.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.name} · {d.team}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="border border-border-strong bg-surface px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-text hover:border-tint transition-colors duration-(--duration-fast)"
        >
          Compare
        </button>
      </form>

      {canCompare && !userId ? (
        <AnalysisGate
          title="Head-to-head"
          blurb="Sign in to compare any two F1 drivers this season — points, position, wins, their race-by-race record and a points trajectory."
        />
      ) : !ready ? (
        <p className="border-y border-border py-10 text-center text-sm text-text-muted">
          {driverA && driverB && driverA.slug === driverB.slug
            ? 'Pick two different drivers.'
            : 'Choose two drivers above to compare their seasons.'}
        </p>
      ) : !formA || !formB ? (
        <p className="border-y border-border py-10 text-center text-sm text-text-muted">
          Season data isn’t available for one of these drivers yet.
        </p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-6">
            <DriverHead driver={driverA!} align="left" />
            <DriverHead driver={driverB!} align="right" />
          </div>

          <section className="mb-8">
            <StatRow label="Position" a={`P${formA.position}`} b={`P${formB.position}`} better={formA.position === formB.position ? 'tie' : formA.position < formB.position ? 'a' : 'b'} />
            <StatRow label="Points" a={String(formA.points)} b={String(formB.points)} better={formA.points === formB.points ? 'tie' : formA.points > formB.points ? 'a' : 'b'} />
            <StatRow label="Wins" a={String(formA.wins)} b={String(formB.wins)} better={formA.wins === formB.wins ? 'tie' : formA.wins > formB.wins ? 'a' : 'b'} />
            {h2h && h2h.shared > 0 && (
              <StatRow
                label={`Ahead in races · ${h2h.shared} shared`}
                a={String(h2h.aAhead)}
                b={String(h2h.bAhead)}
                better={h2h.aAhead === h2h.bAhead ? 'tie' : h2h.aAhead > h2h.bAhead ? 'a' : 'b'}
              />
            )}
          </section>

          {trend && (
            <section className="mb-8">
              <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-3">
                Points trajectory
              </h2>
              <LazySeasonTrendChart {...trend} />
            </section>
          )}

          <section className="mb-4">
            <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-3">
              Last {Math.max(formA.last5.length, formB.last5.length)} races
            </h2>
            <div className="grid grid-cols-2 gap-6">
              <Last5Column form={formA} align="left" />
              <Last5Column form={formB} align="right" />
            </div>
          </section>

          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
            From race results · quali head-to-head coming later
          </p>
        </>
      )}
    </div>
  );
}
