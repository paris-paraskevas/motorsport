import Link from 'next/link';
import { NextRaceCountdown } from '@/components/NextRaceCountdown';
import { formatRelative } from '@/lib/date';
import { cleanSessionTitle } from './clean-title';
import { CircuitSlideshow } from './CircuitSlideshow';

export interface HeroSession {
  seriesSlug: string;
  seriesName: string;
  seriesColor: string;
  title: string;
  start: Date;
  end: Date;
  location?: string;
  dateOnly?: boolean;
  weekendHref?: string;
}

// Hero — racing-poster headline left, live next-sessions widget right
// (operator decision 2026-06-10: real product data in the hero, not the
// mockup's stock photo), and the NEXT UP countdown strip underneath.
export function Hero({ sessions, now }: { sessions: HeroSession[]; now: Date }) {
  const next = sessions[0];
  const widget = sessions.slice(0, 3);

  return (
    <section className="relative overflow-hidden">
      {/* Faint brand glow anchored top-right, like the mockup's hero wash. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 50% 60% at 85% 0%, rgb(255 180 0 / 0.15) 0%, transparent 60%)',
        }}
      />

      <div className="relative mx-auto grid max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl gap-10 px-4 pb-12 pt-12 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:pt-20">
        <div className="p2-fade-up">
          <p className="mb-5 flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">
            <span className="live-pulse h-2 w-2 rounded-full bg-live" aria-hidden="true" />
            Live · the 2026 motorsport season
          </p>

          <h1 className="font-display text-[clamp(2.8rem,8vw,5.5rem)] font-extrabold uppercase leading-[0.95] tracking-tight text-text">
            Every <span className="text-brand">session.</span>
            <br />
            Every <span className="italic">series.</span>
            <br />
            One paddock.
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-text-muted">
            F1, MotoGP, WEC, IndyCar, NASCAR, WRC and 9 more — the live
            calendar, race-day weather, news and standings for the whole world
            of motorsport, in your local time. No account required.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/app"
              className="rounded-full bg-brand px-6 py-3 text-sm font-bold uppercase tracking-[0.08em] text-black transition-colors duration-(--duration-fast) hover:bg-brand-deep"
            >
              Open the paddock&ensp;→
            </Link>
            <a
              href="#inside"
              className="rounded-full border border-border-strong px-6 py-3 text-sm font-bold uppercase tracking-[0.08em] text-text transition-colors duration-(--duration-fast) hover:border-brand hover:text-brand"
            >
              What&apos;s inside
            </a>
          </div>
        </div>

        {/* Right column: circuit photography slideshow (the mockup's hero
            photo card) + the live next-sessions widget below it. */}
        <div className="p2-fade-up space-y-4">
          <CircuitSlideshow />
          <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-text-faint">
            Next on track
          </p>
          <ol className="space-y-3">
            {widget.map(s => (
              <li key={`${s.seriesSlug}-${s.title}-${s.start.getTime()}`}>
                <Link
                  href={s.weekendHref ?? `/series/${s.seriesSlug}`}
                  className="group flex items-center gap-3 rounded-lg border border-transparent px-2 py-1.5 transition-colors duration-(--duration-fast) hover:border-border hover:bg-surface-elevated"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: s.seriesColor }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-text">
                      {cleanSessionTitle(s.seriesName, s.title)}
                    </span>
                    <span className="block truncate text-xs text-text-muted">
                      {s.seriesName}
                      {s.location ? ` · ${s.location}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-xs text-text-muted">
                    {s.dateOnly ? 'TBC' : formatRelative(s.start, now)}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
          </div>
        </div>
      </div>

      {/* NEXT UP countdown strip. */}
      {next && !next.dateOnly && (
        <div className="relative border-y border-border bg-surface/60">
          <div className="mx-auto flex max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4 sm:px-6">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-text-faint">
              Next up · in your time
            </span>
            <span className="flex items-center gap-2 text-sm font-semibold text-text">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: next.seriesColor }}
                aria-hidden="true"
              />
              {next.seriesName} — {cleanSessionTitle(next.seriesName, next.title)}
            </span>
            <span className="ml-auto">
              <NextRaceCountdown
                target={next.start.toISOString()}
                label={`${next.seriesName} — ${cleanSessionTitle(next.seriesName, next.title)}`}
                color={next.seriesColor}
              />
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
