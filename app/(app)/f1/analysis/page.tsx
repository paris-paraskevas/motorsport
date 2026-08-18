import Link from 'next/link';
import type { Metadata } from 'next';
import { loadSeries } from '@/lib/series';
import { seriesInk } from '@/lib/site';
import { dateRangeLabel } from '@/lib/rounds';
import { withSocialMeta } from '@/lib/seo';
import { OpenF1Attribution } from '@/components/f1/OpenF1Attribution';
import type { SeriesRoundEntry } from '@/lib/types';
import { PAGE_WIDE } from '@/lib/site';

// Schedule-based, not data-based: this page enumerates the F1 calendar and
// links to per-session telemetry surfaces — it does NOT fetch any OpenF1 data
// itself (the Decoder / Race Story fetch on their own pages). So it's fully
// cacheable. Hourly revalidate is plenty: the only thing that changes is which
// rounds have crossed into the past, and a weekend ending mid-Sunday becoming
// "past" within the hour is immaterial.
export const revalidate = 3600;

const TITLE = 'F1 Telemetry & Analysis';
const DESCRIPTION =
  'Analyse every 2026 Formula 1 weekend — lap-by-lap Qualifying Analysis pole breakdowns and full Race Story strategy timelines, free, for every Grand Prix once the cars have run.';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: '/f1/analysis' },
    ...withSocialMeta({ title: TITLE, description: DESCRIPTION, path: '/f1/analysis' }),
  };
}

// Date-key for a YYYY-MM-DD round date. rounds.json carries date-only strings;
// a round is "past" once its end date is strictly before today's UTC date —
// i.e. the whole weekend has elapsed. (Venue-local cut-off doesn't matter at
// this granularity; the per-session pages gate telemetry on real session end.)
function todayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function isPastRound(r: SeriesRoundEntry, today: string): boolean {
  return !r.cancelled && r.endDate < today;
}

function roundDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export default async function F1AnalysisPage() {
  const series = await loadSeries('f1');
  const color = series.meta.color;
  const season = series.rounds?.season ?? series.meta.season;

  const today = todayKey();
  const allRounds = [...(series.rounds?.rounds ?? [])].sort((a, b) => a.round - b.round);
  const pastRounds = allRounds.filter(r => isPastRound(r, today));
  // The latest weekend's tools lead — nobody browses to round 4 of a finished
  // season (design handoff §4.14, panel 11e).
  const latest = pastRounds[pastRounds.length - 1];

  return (
    <div
      className={`relative ${PAGE_WIDE}`}
      style={{ '--tint': color, '--tint-fill': color, ['--series-color' as string]: color } as React.CSSProperties}
    >
      {/* Series-color hairline — the app-wide on-language accent. */}
      <div
        className="absolute top-0 left-0 right-0 h-px -z-10"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />

      <header className="mb-8">
        <div className="mb-2 flex items-center gap-2.5">
          <span aria-hidden="true" className="h-3.5 w-[3px] shrink-0" style={{ backgroundColor: color }} />
          {/* §4.14: F1-only, and it says so at the top instead of pretending
              to be universal. */}
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: seriesInk(color) }}>
            Formula 1 only · {season} season
          </span>
        </div>
        <h1 className="font-serif text-[40px] font-medium leading-none tracking-[-0.02em] text-text lg:text-[50px]">
          Telemetry &amp; analysis
        </h1>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-text-muted md:text-base">
          Once a Grand Prix weekend has run, its timing data unlocks two free breakdowns —
          the <span className="font-medium text-text">Qualifying Analysis</span> (pole laps
          side by side, corner by corner) and the{' '}
          <span className="font-medium text-text">Race Story</span> (stints, tyre calls,
          pit windows, the moments that turned it).
        </p>
      </header>

      {/* The latest weekend leads (§4.14) — its two tools plus the season-long
          head-to-head as the third card. */}
      {latest && (
        <section aria-label="The latest weekend" className="mb-10 border-[1.5px] border-text bg-surface-elevated p-[18px] lg:p-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3 border-b border-text pb-1">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
              The latest weekend
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
              {latest.name} · R{latest.round}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Link
              href={`/series/f1/weekend/${latest.round}/qualifying`}
              className="group border border-border-strong bg-bg p-3 transition-colors duration-(--duration-fast) hover:border-text"
            >
              <span className="block font-serif text-[17px] font-semibold leading-tight text-text">
                Qualifying Analysis
              </span>
              <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.12em] text-text-faint">
                Pole laps side by side →
              </span>
            </Link>
            <Link
              href={`/series/f1/weekend/${latest.round}/race`}
              className="group border border-border-strong bg-bg p-3 transition-colors duration-(--duration-fast) hover:border-text"
            >
              <span className="block font-serif text-[17px] font-semibold leading-tight text-text">
                Race Story
              </span>
              <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.12em] text-text-faint">
                Strategy, stints &amp; moments →
              </span>
            </Link>
            <Link
              href="/f1/compare"
              className="group border border-border-strong bg-bg p-3 transition-colors duration-(--duration-fast) hover:border-text"
            >
              <span className="block font-serif text-[17px] font-semibold leading-tight text-text">
                Head-to-head
              </span>
              <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.12em] text-text-faint">
                Any two drivers, all season →
              </span>
            </Link>
          </div>
        </section>
      )}

      {/* The full season, one list — unrun weekends dimmed and labelled
          rather than looking broken (§4.14). */}
      <section aria-label="Every round">
        <div className="mb-1 flex items-baseline justify-between border-b border-text pb-1">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
            Every round
          </span>
          <span className="font-mono text-[10px] tabular-nums text-text-faint">{allRounds.length}</span>
        </div>
        {allRounds.map(r => {
          const range = dateRangeLabel(roundDate(r.startDate), roundDate(r.endDate));
          const past = isPastRound(r, today);
          return (
            <div
              key={r.round}
              className={`flex min-h-11 flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-border py-1.5 ${past ? '' : 'opacity-55'}`}
            >
              <span className="w-7 shrink-0 text-right font-mono text-[11px] tabular-nums text-text-faint">
                R{r.round}
              </span>
              <span className="min-w-0 flex-1 truncate font-serif text-[16px] font-semibold text-text">
                {r.name}
              </span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-text-muted">{range}</span>
              {r.cancelled ? (
                <span className="shrink-0 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-text-faint">
                  Cancelled
                </span>
              ) : past ? (
                <span className="flex shrink-0 gap-3">
                  <Link
                    href={`/series/f1/weekend/${r.round}/qualifying`}
                    className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-brand hover:underline"
                  >
                    Qualifying →
                  </Link>
                  <Link
                    href={`/series/f1/weekend/${r.round}/race`}
                    className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-brand hover:underline"
                  >
                    Race story →
                  </Link>
                </span>
              ) : (
                <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-text-faint">
                  When the cars run
                </span>
              )}
            </div>
          );
        })}
      </section>

      <footer className="mt-10 border-t border-border pt-6">
        <OpenF1Attribution />
      </footer>
    </div>
  );
}
