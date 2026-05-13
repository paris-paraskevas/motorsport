import { Weekend } from '@/lib/types';
import { Session } from '@/lib/types';
import { formatLocal } from '@/lib/date';

export function WeekendBlock({
  weekend,
  color,
  showNextTag = false,
}: {
  weekend: Weekend;
  color: string;
  showNextTag?: boolean;
}) {
  return (
    <div className={weekend.isPast ? 'opacity-50' : ''}>
      <div className="flex items-center gap-2 mb-2">
        <span className="w-0.5 self-stretch min-h-4" style={{ backgroundColor: color }} />
        <h3 className="text-sm uppercase tracking-wider text-zinc-100 flex-1">
          {weekend.label ? `${weekend.label} · ` : ''}
          <span className="text-zinc-400">{weekend.dateRangeLabel}</span>
        </h3>
        {showNextTag && (
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-900/40 text-red-300">
            next
          </span>
        )}
        {weekend.significance && (
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300">
            {weekend.significance.tier}
          </span>
        )}
      </div>
      <ul className="pl-3 space-y-1">
        {weekend.sessions.map((s: Session) => (
          <li key={s.uid} className="flex justify-between gap-3 text-sm">
            <span className="text-zinc-300 truncate">{s.title}</span>
            <span className="text-zinc-500 whitespace-nowrap">{formatLocal(s.start)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
