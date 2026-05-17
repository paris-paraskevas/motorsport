import Link from 'next/link';
import { Home, Calendar } from 'lucide-react';

export const dynamic = 'force-static';

export default function NotFound() {
  return (
    <div className="max-w-2xl lg:max-w-4xl mx-auto px-4 md:px-6 lg:px-8 py-20 md:py-28">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-surface/60 p-10 md:p-14">
        {/* Subtle accent corners */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.18] pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 0% 0%, #e10600 0%, transparent 45%), radial-gradient(circle at 100% 100%, #38bdf8 0%, transparent 45%)',
          }}
        />
        <div className="relative">
          <div className="text-[11px] uppercase tracking-[0.18em] text-text-faint font-semibold mb-3">
            Off-track excursion
          </div>
          <div className="flex items-baseline gap-4 mb-4">
            <span className="text-text text-6xl md:text-7xl font-bold tnum font-mono tracking-tight">
              404
            </span>
            <span className="text-text-faint text-sm uppercase tracking-[0.16em] font-semibold">
              Page not found
            </span>
          </div>
          <p className="text-text-muted text-base leading-relaxed max-w-md">
            The page you tried to reach isn&apos;t on the grid. The link might
            be stale, or you took the wrong corner.
          </p>

          <div className="mt-8 flex flex-wrap gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-bg bg-text hover:bg-text-muted rounded-full px-4 py-2 transition-colors duration-(--duration-fast)"
            >
              <Home size={14} />
              Home
            </Link>
            <Link
              href="/calendar"
              className="inline-flex items-center gap-2 text-sm font-medium text-text bg-surface hover:bg-surface-elevated border border-border rounded-full px-4 py-2 transition-colors duration-(--duration-fast)"
            >
              <Calendar size={14} />
              Calendar
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
