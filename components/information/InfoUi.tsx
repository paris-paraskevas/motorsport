import Link from 'next/link';

// Small presentational pieces shared by the information hub + topic index pages.
//
// These carry the /app design language rather than a language of their own: a
// bordered bg-surface panel, a display-scale section head with the accent full
// stop, and body copy that isn't 10px. The hub previously ran its section heads
// at 14px directly under a 48px h1 and used no surface panel anywhere on the
// page, which is what made a page of good content read as a wall.

/** Section head in the /app idiom (mirrors HomeContent's CollapsibleSectionHead,
 *  minus the collapse). Used by the hub and every topic index, which is why it
 *  lives here rather than being inlined twice. */
export function SectionHead({
  title,
  sub,
  href,
}: {
  title: string;
  sub?: string;
  href?: string;
}) {
  const label = (
    <span className="font-display text-2xl md:text-3xl font-extrabold uppercase tracking-wide text-text">
      {title}
      <span className="text-tint">.</span>
    </span>
  );
  return (
    <h2 className="mb-4">
      <span className="relative flex w-full items-baseline justify-between gap-3 pb-2.5 after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-linear-to-r after:from-border-strong after:via-border after:to-border">
        {href ? (
          <Link href={href} className="hover:text-tint transition-colors duration-(--duration-fast)">
            {label}
          </Link>
        ) : (
          label
        )}
        {sub && (
          <span className="shrink-0 font-mono text-[11px] leading-none uppercase tracking-[0.12em] text-text-muted">
            {sub}
          </span>
        )}
      </span>
    </h2>
  );
}

/** A tappable tag. WCAG 2.2 SC 2.5.8 asks 24×24 CSS px of target; the links this
 *  replaces measured 50×15, which fails outright — and at 10px they were hard to
 *  read before they were hard to hit. */
export function PillLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-[32px] items-center gap-1 border border-border px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:border-border-strong hover:bg-surface-elevated hover:text-text"
    >
      {children}
    </Link>
  );
}

export function TopicCard({
  id,
  label,
  blurb,
  count,
}: {
  id: string;
  label: string;
  blurb: string;
  count: number;
}) {
  return (
    <Link
      href={`/information/${id}`}
      // Square, like every other surface in the app — the old rounded-lg made
      // this page look like it came from a different product.
      className="group flex h-full flex-col border border-border bg-surface p-4 transition-colors duration-(--duration-fast) hover:border-border-strong hover:bg-surface-elevated md:p-5"
    >
      <h3 className="font-display text-lg md:text-xl font-extrabold uppercase tracking-wide leading-tight text-text transition-colors duration-(--duration-fast) group-hover:text-tint">
        {label}
      </h3>
      <p className="mt-1.5 flex-1 text-sm md:text-[15px] leading-snug text-text-muted">{blurb}</p>
      {count > 0 && (
        /* Was a bare 10px numeral in the corner, which said nothing about what it
           counted. Only verified entries are tallied, so the label is honest. */
        <span className="mt-3 inline-flex w-fit items-center border border-border px-2 py-1 font-mono text-[11px] leading-none uppercase tracking-[0.12em] text-text-muted tnum">
          {count} {count === 1 ? 'answer' : 'answers'}
        </span>
      )}
    </Link>
  );
}

/** One question. A card rather than a bare row: ten of these across three narrow
 *  columns with no container gave ragged, unreadable text blocks. `h-full` so a
 *  grid row lines up instead of each column drifting. */
export function EntryRow({
  href,
  question,
  summary,
  draft = false,
}: {
  href: string;
  question: string;
  summary?: string;
  draft?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col border border-border bg-surface-elevated p-4 transition-colors duration-(--duration-fast) hover:border-border-strong hover:bg-surface"
    >
      <div className="flex items-baseline gap-2">
        <h3 className="text-base md:text-[17px] font-semibold leading-snug tracking-tight text-text transition-colors duration-(--duration-fast) group-hover:text-tint">
          {question}
        </h3>
        {draft && (
          <span className="shrink-0 border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint">
            Draft
          </span>
        )}
      </div>
      {summary && (
        <p className="mt-2 text-sm md:text-[15px] leading-relaxed text-text-muted line-clamp-3">
          {summary}
        </p>
      )}
    </Link>
  );
}
