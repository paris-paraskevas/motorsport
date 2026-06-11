import Link from 'next/link';
import { BigCountdown } from './BigCountdown';

export interface MarqueeEventData {
  seriesName: string;
  seriesColor: string;
  eventName: string;
  sessionTitle: string;
  start: Date;
  location?: string;
  weekendHref?: string;
}

// The featured-event band — the mockup's "110th Indianapolis 500" treatment,
// driven by whatever marquee event is next on the real calendar.
export function MarqueeEvent({ event }: { event: MarqueeEventData }) {
  const dateLine = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(event.start);

  return (
    <section className="relative overflow-hidden border-b border-border">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 80% at 80% 50%, rgb(255 180 0 / 0.16) 0%, transparent 65%)',
        }}
      />
      <div className="relative mx-auto flex max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl flex-wrap items-center gap-x-12 gap-y-8 px-4 py-12 sm:px-6 lg:py-16">
        <div className="min-w-0 flex-1 basis-72">
          <p className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: event.seriesColor }}
              aria-hidden="true"
            />
            Marquee event · {event.seriesName}
          </p>
          <h2 className="mt-3 font-display text-4xl font-extrabold uppercase leading-[0.95] tracking-tight text-text sm:text-5xl lg:text-6xl">
            {event.eventName}
          </h2>
          <p className="mt-3 text-sm text-text-muted">
            {event.sessionTitle} · {dateLine}
            {event.location ? ` · ${event.location}` : ''}
          </p>
          {event.weekendHref && (
            <Link
              href={event.weekendHref}
              className="mt-6 inline-block rounded-full border border-border-strong px-5 py-2.5 text-xs font-bold uppercase tracking-[0.08em] text-text transition-colors duration-(--duration-fast) hover:border-brand hover:text-brand"
            >
              Open the weekend&ensp;→
            </Link>
          )}
        </div>
        <BigCountdown target={event.start.toISOString()} label={event.eventName} />
      </div>
    </section>
  );
}
