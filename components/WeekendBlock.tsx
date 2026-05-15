import Link from 'next/link';
import { Session, Weekend } from '@/lib/types';
import { formatLocal } from '@/lib/date';

export function WeekendBlock({
  weekend,
  round,
  seriesSlug,
  color,
  showNextTag = false,
}: {
  weekend: Weekend;
  round: number;
  seriesSlug: string;
  color: string;
  showNextTag?: boolean;
}) {
  return (
    <Link
      href={`/series/${seriesSlug}/weekend/${round}`}
      className={`block rounded-xl bg-zinc-900/40 border border-zinc-800/60 p-4 transition-colors hover:bg-zinc-900/70 hover:border-zinc-700 ${
        weekend.isPast ? 'opacity-50 hover:opacity-80' : ''
      }`}
    >
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {weekend.label && (
          <span
            className="inline-flex items-center text-[11px] uppercase tracking-[0.12em] font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${color}26`, color }}
          >
            {weekend.label}
          </span>
        )}
        <span className="text-xs uppercase tracking-wider text-zinc-400 font-medium">
          {weekend.dateRangeLabel}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          {showNextTag && (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-100 font-semibold">
              next
            </span>
          )}
          {weekend.significance && weekend.significance.tier !== 'note' && (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 font-semibold">
              {weekend.significance.tier}
            </span>
          )}
        </span>
      </div>
      <ul className="space-y-0.5">
        {weekend.sessions.map((s: Session) => (
          <li
            key={s.uid}
            className="flex items-center justify-between gap-3 text-sm py-1"
          >
            <span className="text-zinc-200 truncate">{s.title}</span>
            <span className="text-zinc-500 font-medium tabular-nums whitespace-nowrap">
              {formatLocal(s.start)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 text-[10px] uppercase tracking-[0.14em] text-zinc-500 font-semibold">
        Round {round} <span aria-hidden>→</span>
      </div>
    </Link>
  );
}
