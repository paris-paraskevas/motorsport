// Route-segment skeleton for /series/[slug]/weekend/[round]: mirrors the
// weekend page's hero (breadcrumb line, big title, date row) + the schedule
// block, so the on-demand ISR render has a stable-shaped placeholder.
export default function Loading() {
  return (
    <div
      aria-busy="true"
      className="max-w-2xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl 3xl:max-w-[2000px]! mx-auto p-4 md:p-6 lg:p-8 pb-16"
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
