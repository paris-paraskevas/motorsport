import { PAGE_WIDE } from '@/lib/site';

// Route-segment skeleton for /series/[slug]/[tab] — same shell shape as the
// bare-series skeleton (header + tab rail + content rows). Deliberately
// duplicated rather than abstracted: two ~25-line loading files beat a shared
// skeleton component (repo rule: no new abstraction without a real second
// consumer that would evolve together — these won't; tabs may grow their own
// shapes).
export default function Loading() {
  return (
    <div
      aria-busy="true"
      className={PAGE_WIDE}
    >
      <div className="mb-5 flex items-stretch gap-3">
        <span aria-hidden="true" className="w-1 shrink-0 bg-surface animate-pulse" />
        <div className="space-y-2">
          <div className="h-8 w-52 md:h-10 md:w-72 bg-surface animate-pulse" />
          <div className="h-3 w-28 bg-surface/70 animate-pulse" />
        </div>
      </div>
      <div className="-mx-4 md:-mx-6 lg:-mx-8 mb-6 h-11 border-y border-border bg-surface/40 animate-pulse" />
      <div className="space-y-3">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="border-y border-border bg-surface/40 animate-pulse"
            style={{ height: i === 0 ? 96 : 64 }}
          />
        ))}
      </div>
    </div>
  );
}
