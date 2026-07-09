import { PAGE_WIDE } from '@/lib/site';

// Route-segment skeleton for /news: header (accent rule + title) + story
// rows, matching NewsPage's container and rough rhythm.
export default function Loading() {
  return (
    <div aria-busy="true" className={PAGE_WIDE}>
      <div className="mb-6 flex items-stretch gap-3">
        <span aria-hidden="true" className="w-1 shrink-0 bg-surface animate-pulse" />
        <div className="space-y-2">
          <div className="h-8 w-32 md:h-9 md:w-40 bg-surface animate-pulse" />
          <div className="h-3 w-64 bg-surface/70 animate-pulse" />
        </div>
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} className="border-y border-border bg-surface/40 animate-pulse" style={{ height: 72 }} />
        ))}
      </div>
    </div>
  );
}
