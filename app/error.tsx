'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { Home, RefreshCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to the console so dev sessions surface the cause; production
    // also has Vercel Analytics + Speed Insights catching uncaught errors.
    console.error('[paddock] route error', error);
  }, [error]);

  return (
    <div className="max-w-2xl lg:max-w-4xl mx-auto px-4 md:px-6 lg:px-8 py-20 md:py-28">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-surface/60 p-10 md:p-14">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.18] pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 0% 0%, #ef4444 0%, transparent 45%), radial-gradient(circle at 100% 100%, #f59e0b 0%, transparent 45%)',
          }}
        />
        <div className="relative">
          <div className="text-[11px] uppercase tracking-[0.18em] text-text-faint font-semibold mb-3">
            Yellow flag
          </div>
          <div className="flex items-baseline gap-4 mb-4 flex-wrap">
            <span className="text-text text-5xl md:text-6xl font-bold tracking-tight">
              Something broke
            </span>
          </div>
          <p className="text-text-muted text-base leading-relaxed max-w-md">
            Hit an error on this page. We&apos;ve logged it. Try reloading the
            section, or head back to the grid.
          </p>

          {error.digest && (
            <p className="mt-4 text-text-faint text-xs font-mono">
              Reference: {error.digest}
            </p>
          )}

          <div className="mt-8 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-2 text-sm font-medium text-bg bg-text hover:bg-text-muted rounded-full px-4 py-2 transition-colors duration-(--duration-fast)"
            >
              <RefreshCw size={14} />
              Try again
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-text bg-surface hover:bg-surface-elevated border border-border rounded-full px-4 py-2 transition-colors duration-(--duration-fast)"
            >
              <Home size={14} />
              Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
