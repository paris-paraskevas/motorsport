// Route-segment skeleton for /series/[slug]/weekend/[round]/[session] — this
// page is force-dynamic (live classification fetches), so it benefits most
// from an instant placeholder: title block + classification-table rows.
export default function Loading() {
  return (
    <div
      aria-busy="true"
      className="max-w-2xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl 3xl:max-w-[2000px]! mx-auto p-4 md:p-6 lg:p-8 pb-16"
    >
      <div className="mb-8 space-y-4">
        <div className="h-3 w-48 bg-surface/70 animate-pulse" />
        <div className="h-9 w-56 md:h-11 md:w-80 bg-surface animate-pulse" />
        <div className="h-4 w-36 bg-surface/70 animate-pulse" />
      </div>
      <div className="space-y-2">
        {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
          <div key={i} className="h-10 border-y border-border bg-surface/40 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
