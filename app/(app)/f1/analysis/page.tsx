import Link from 'next/link';
import type { Metadata } from 'next';
import { loadSeries } from '@/lib/series';
import { dateRangeLabel } from '@/lib/rounds';
import { withSocialMeta } from '@/lib/seo';
import { OpenF1Attribution } from '@/components/f1/OpenF1Attribution';
import type { SeriesRoundEntry } from '@/lib/types';

// Schedule-based, not data-based: this page enumerates the F1 calendar and
// links to per-session telemetry surfaces — it does NOT fetch any OpenF1 data
// itself (the Decoder / Race Story fetch on their own pages). So it's fully
// cacheable. Hourly revalidate is plenty: the only thing that changes is which
// rounds have crossed into the past, and a weekend ending mid-Sunday becoming
// "past" within the hour is immaterial.
export const revalidate = 3600;

const TITLE = 'F1 Telemetry & Analysis';
const DESCRIPTION =
  'Decode every 2026 Formula 1 weekend — lap-by-lap Qualifying Decoder pole breakdowns and full Race Story strategy timelines, free, for every Grand Prix once the cars have run.';

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
  const pastRounds = (series.rounds?.rounds ?? [])
    .filter(r => isPastRound(r, today))
    .sort((a, b) => b.round - a.round); // most-recent first

  return (
    <div
      className="relative max-w-2xl lg:max-w-4xl mx-auto p-4 md:p-6 lg:p-8 pb-16"
      style={{ '--tint': color, ['--series-color' as string]: color } as React.CSSProperties}
    >
      {/* Series-color hairline — the app-wide on-language accent. */}
      <div
        className="absolute top-0 left-0 right-0 h-px -z-10"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />

      <header className="mb-10 border-b border-border pb-8">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-faint font-semibold mb-2">
          Formula 1 · {season} Season
        </div>
        <h1 className="font-display text-4xl md:text-5xl font-extrabold uppercase tracking-wide leading-[0.95] text-text">
          F1 Telemetry &amp; Analysis
          <span style={{ color }}>.</span>
        </h1>
        <p className="mt-4 max-w-prose text-sm md:text-base text-text-muted leading-relaxed">
          Once a Grand Prix weekend has run, every session unlocks two free
          breakdowns built from the timing data. The{' '}
          <span className="text-text font-medium">Qualifying Decoder</span> puts
          pole laps side by side — sector, mini-sector and corner-by-corner
          delta. The{' '}
          <span className="text-text font-medium">Race Story</span> charts the
          strategy that decided Sunday — stints, tyre choices, pit windows and
          the moments that turned the race. Pick a round below.
        </p>
      </header>

      {pastRounds.length === 0 ? (
        <section className="border-y border-border py-10 text-center">
          <p className="text-text-muted text-sm">
            No completed {season} rounds yet. Analysis appears here the moment
            the first weekend has run.
          </p>
        </section>
      ) : (
        <ul className="space-y-3">
          {pastRounds.map(r => {
            const range = dateRangeLabel(roundDate(r.startDate), roundDate(r.endDate));
            return (
              <li
                key={r.round}
                className="group border border-border hover:border-border-strong transition-colors duration-(--duration-fast) p-4 md:p-5"
              >
                <div className="flex items-baseline justify-between gap-3 mb-3">
                  <h2 className="font-display text-xl md:text-2xl font-extrabold uppercase tracking-wide text-text leading-tight">
                    {r.name}
                  </h2>
                  <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] tabular-nums text-text-faint">
                    R{r.round} · {range}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  <Link
                    href={`/series/f1/weekend/${r.round}/qualifying`}
                    className="inline-flex items-center gap-1.5 border border-border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] font-semibold text-text-muted hover:text-text hover:border-tint transition-colors duration-(--duration-fast)"
                  >
                    <span aria-hidden style={{ color }}>
                      ▸
                    </span>
                    Qualifying Decoder
                  </Link>
                  <Link
                    href={`/series/f1/weekend/${r.round}/race`}
                    className="inline-flex items-center gap-1.5 border border-border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] font-semibold text-text-muted hover:text-text hover:border-tint transition-colors duration-(--duration-fast)"
                  >
                    <span aria-hidden style={{ color }}>
                      ▸
                    </span>
                    Race Story
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <footer className="mt-10 border-t border-border pt-6">
        <OpenF1Attribution />
      </footer>
    </div>
  );
}
