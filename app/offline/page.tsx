import { WifiOff } from 'lucide-react';

// Branded offline fallback, served by the service worker for document
// navigations when the network is unavailable (see app/sw.ts `fallbacks`).
// Keep it static and self-contained — it renders from the precache.
export default function OfflinePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="mb-5 flex items-stretch gap-3">
          <span aria-hidden="true" className="w-1 shrink-0 bg-brand" />
          <h1 className="font-display text-4xl md:text-5xl font-extrabold uppercase tracking-wide leading-none text-text">
            You&apos;re offline<span className="text-brand">.</span>
          </h1>
        </div>
        <div className="mb-4 flex items-center gap-2 text-text-muted">
          <WifiOff size={16} aria-hidden="true" />
          <span className="font-mono text-[11px] uppercase tracking-[0.16em]">
            No connection
          </span>
        </div>
        <p className="mb-6 text-sm text-text-muted leading-relaxed">
          Paddock needs a connection for live schedules, standings and results.
          Reconnect and try again — the page reloads automatically when
          you&apos;re back online.
        </p>
        {/* Plain anchor on purpose: a full document navigation is the only way
            to escape the precached offline fallback once connectivity returns —
            a client-side <Link/> transition would run inside the stale shell. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/app"
          className="inline-flex items-center gap-2 text-sm font-medium font-bold text-black bg-brand hover:bg-brand-deep px-4 py-2 transition-colors"
        >
          Try again
        </a>
      </div>
    </main>
  );
}
