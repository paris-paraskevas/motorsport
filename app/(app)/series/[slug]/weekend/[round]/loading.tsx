import { PAGE_WIDE } from '@/lib/site';

// Route-segment skeleton for /series/[slug]/weekend/[round]: mirrors the
// weekend page's hero (breadcrumb line, big title, date row) + the schedule
// block, so the on-demand ISR render has a stable-shaped placeholder.
export default function Loading() {
  return (
    <div
      aria-busy="true"
      className={PAGE_WIDE}
    >
      <div className="mb-8 space-y-4">
        <div className="h-3 w-40 bg-surface/70 animate-pulse" />
        <div className="h-10 w-64 md:h-12 md:w-96 bg-surface animate-pulse" />
        <div className="h-5 w-44 bg-surface/70 animate-pulse" />
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className="border-y border-border bg-surface/40 animate-pulse"
            style={{ height: i === 0 ? 96 : 56 }}
          />
        ))}
      </div>
    </div>
  );
}
