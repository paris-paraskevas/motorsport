import Link from 'next/link';
import { PAGE_READ } from '@/lib/site';

export const dynamic = 'force-static';

// The (app)-group not-found boundary — it also catches root-level misses, so
// it renders inside the app shell and the header's browse-and-search field
// stays available as the recovery path.
export default function NotFound() {
  return (
    <main className={PAGE_READ}>
      <div className="pt-8 md:pt-16">
        <div className="border-t border-text pt-2">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
            Off-track excursion
          </span>
        </div>

        <h1 className="mt-8 font-serif text-[96px] font-semibold leading-none tracking-tight text-text md:text-[136px]">
          404
        </h1>
        <p className="mt-3 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
          Page not found
        </p>

        <p className="mt-8 max-w-[46ch] font-serif text-[19px] leading-relaxed text-text-muted">
          The page you tried to reach isn&apos;t on the grid. The link might be
          stale, or you took the wrong corner.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/app"
            data-heatmap-id="404:home"
            className="flex min-h-11 items-center bg-text px-5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-bg transition-colors duration-(--duration-fast) hover:bg-text-muted"
          >
            See what is on now
          </Link>
          <Link
            href="/calendar"
            data-heatmap-id="404:calendar"
            className="flex min-h-11 items-center border border-border-strong px-5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-text transition-colors duration-(--duration-fast) hover:bg-surface"
          >
            Calendar
          </Link>
        </div>

        <p className="mt-12 border-t border-border pt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
          The field in the header browses and searches the whole site
        </p>
      </div>
    </main>
  );
}
