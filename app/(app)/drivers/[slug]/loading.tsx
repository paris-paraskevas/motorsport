// Route-segment skeleton for /drivers/[slug]: profile pages generate
// on-demand (no build-time prerender), so first hits render this shape —
// name block, stat row (Season so far), then content rows.
export default function Loading() {
  return (
    <div
      aria-busy="true"
      className="max-w-2xl lg:max-w-4xl mx-auto p-4 md:p-6 lg:p-8 pb-16"
    >
      <div className="mb-8 space-y-3">
        <div className="h-3 w-36 bg-surface/70 animate-pulse" />
        <div className="h-10 w-60 md:h-12 md:w-80 bg-surface animate-pulse" />
        <div className="h-4 w-44 bg-surface/70 animate-pulse" />
      </div>
      <div className="mb-8 border-y border-border py-4 flex gap-10 flex-wrap">
        {[0, 1, 2].map(i => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-16 bg-surface/70 animate-pulse" />
            <div className="h-8 w-20 bg-surface animate-pulse" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-14 border-y border-border bg-surface/40 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
