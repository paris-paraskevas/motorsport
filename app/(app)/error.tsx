'use client';
import Link from 'next/link';
import { useEffect } from 'react';

// Paper error boundary for the app tree (the marketing tree has its sibling).
// Route-level boundaries swallow errors before window.onerror ever fires, so
// the console line below is currently the only report — server Sentry left in
// the 0.288.0 worker-size diet (the re-scope is tracked in IDEAS).
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[paddock] route error', error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-[720px] px-4 py-24 md:px-6">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-brand">
        Red flag
      </p>
      <h1 className="mt-3 font-serif text-[34px] font-medium leading-[1.08] text-text md:text-[44px]">
        Something broke on this page
      </h1>
      <p className="mt-4 max-w-[52ch] font-serif text-[17px] leading-relaxed text-text-muted">
        The error is logged. Try the section again, or head back to the paddock.
      </p>
      {error.digest && (
        <p className="mt-3 font-mono text-[11px] text-text-faint">Reference: {error.digest}</p>
      )}
      <div className="mt-8 flex flex-wrap gap-3 border-t border-text pt-4">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center bg-text px-5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-bg transition-colors duration-(--duration-fast) hover:bg-text-muted"
        >
          Try again
        </button>
        <Link
          href="/app"
          className="inline-flex min-h-11 items-center border border-text px-5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-text transition-colors duration-(--duration-fast) hover:bg-surface"
        >
          Back to the paddock
        </Link>
      </div>
    </div>
  );
}
