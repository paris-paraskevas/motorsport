import Link from 'next/link';

// Small presentational pieces shared by the information hub + topic index pages.

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
      className="group block border border-border rounded-lg p-4 hover:border-border-strong hover:bg-surface transition-colors duration-(--duration-fast)"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-base font-extrabold uppercase tracking-wide text-text group-hover:text-tint transition-colors duration-(--duration-fast)">
          {label}
        </h3>
        {count > 0 && (
          <span className="font-mono text-[10px] tabular-nums text-text-faint shrink-0">
            {count}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-text-muted leading-snug">{blurb}</p>
    </Link>
  );
}

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
      className="group block py-3.5 px-2 -mx-2 rounded-md hover:bg-surface transition-colors duration-(--duration-fast)"
    >
      <div className="flex items-baseline gap-2">
        <h3 className="text-[15px] md:text-base font-semibold leading-snug tracking-tight text-text group-hover:text-tint transition-colors duration-(--duration-fast)">
          {question}
        </h3>
        {draft && (
          <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-text-faint bg-surface border border-border rounded px-1 py-0.5">
            Draft
          </span>
        )}
      </div>
      {summary && (
        <p className="mt-1 text-sm text-text-muted leading-relaxed line-clamp-2">{summary}</p>
      )}
    </Link>
  );
}
