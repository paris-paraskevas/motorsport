// Route-segment skeleton for /series/[slug] (the calendar landing): mirrors
// SeriesPageView's shape — accent rule + title block, sticky tab rail, then
// content rows (same blocks as its in-page TabLoading) — so the swap to real
// content doesn't jump.
export default function Loading() {
  return (
    <div
      aria-busy="true"
      className="max-w-2xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl 3xl:max-w-[2000px]! mx-auto p-4 md:p-6 lg:p-8 pb-16"
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
