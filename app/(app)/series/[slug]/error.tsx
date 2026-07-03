'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { Home, RefreshCw } from 'lucide-react';

// Segment-scoped boundary: a failing series tab/weekend render degrades to
// this card inside the shell instead of blanking the whole (app) group.
export default function SeriesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[paddock] series segment error', error);
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-16">
      <div className="rounded-2xl border border-border bg-surface/60 p-8">
        <div className="text-[11px] uppercase tracking-[0.18em] text-text-faint font-semibold mb-2">
          Yellow flag
        </div>
        <h1 className="text-text text-2xl font-bold tracking-tight mb-2">
          Couldn&apos;t load this series section
        </h1>
        <p className="text-text-muted text-sm leading-relaxed">
          Hit an error fetching this part of the series. It&apos;s logged — try
          reloading the section, or head back to the grid.
        </p>
        {error.digest && (
          <p className="mt-3 text-text-faint text-xs font-mono">Reference: {error.digest}</p>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 text-sm font-medium text-bg bg-text hover:bg-text-muted rounded-full px-4 py-2 transition-colors duration-(--duration-fast)"
          >
            <RefreshCw size={14} />
            Try again
          </button>
          <Link
            href="/app"
            className="inline-flex items-center gap-2 text-sm font-medium text-text bg-surface hover:bg-surface-elevated border border-border rounded-full px-4 py-2 transition-colors duration-(--duration-fast)"
          >
            <Home size={14} />
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
