// Route-segment skeleton for /blog: eyebrow + title header, then post-list
// rows (date line + title + summary), matching BlogIndexPage's container.
export default function Loading() {
  return (
    <div aria-busy="true" className="max-w-2xl lg:max-w-4xl mx-auto p-4 md:p-6 lg:p-8 pb-16">
      <div className="mb-8 space-y-3">
        <div className="h-3 w-20 bg-surface/70 animate-pulse" />
        <div className="h-9 w-32 bg-surface animate-pulse" />
        <div className="h-3 w-72 bg-surface/70 animate-pulse" />
      </div>
      <div className="space-y-6">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="space-y-2 border-b border-border/60 pb-5">
            <div className="h-3 w-28 bg-surface/70 animate-pulse" />
            <div className="h-6 w-3/4 bg-surface animate-pulse" />
            <div className="h-4 w-full bg-surface/40 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
