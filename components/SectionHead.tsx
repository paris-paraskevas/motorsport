// Paddock 2.0 section header — Saira display title with the brand full stop,
// optional mono micro-label right. Shared by the home surface and the series
// hub; series pages adopt it in PR 2c.
export function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="relative mb-3 flex items-baseline justify-between gap-3 pb-3 after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-linear-to-r after:from-border-strong after:via-border after:to-transparent">
      <h2 className="font-display text-3xl md:text-4xl font-extrabold uppercase tracking-wide text-text">
        {title}
        <span className="text-brand">.</span>
      </h2>
      {sub && (
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
          {sub}
        </span>
      )}
    </div>
  );
}
