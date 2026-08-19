'use client';

import Link from 'next/link';

// Minimal branded error boundary for the marketing tree. The landing has no
// data dependencies that should realistically throw; this is a safety net.
export default function MarketingError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="font-display text-4xl font-extrabold uppercase tracking-tight">
        Red flag.
      </p>
      <p className="text-text-muted max-w-md">
        Something broke while loading this page. Try again, or head straight
        into the paddock.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:border-brand hover:text-brand transition-colors"
        >
          Try again
        </button>
        <Link
          href="/app"
          className="bg-text px-5 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-bg transition-colors duration-(--duration-fast) hover:bg-text-muted"
        >
          Open the paddock
        </Link>
      </div>
    </div>
  );
}
