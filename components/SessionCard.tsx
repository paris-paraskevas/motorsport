import { Session } from '@/lib/types';
import { formatLocal, formatRelative } from '@/lib/date';

export function SessionCard({
  session,
  color,
}: {
  session: Session;
  color: string;
}) {
  return (
    <div className="flex items-stretch gap-3 py-3 border-b border-zinc-800">
      <div className="w-1 rounded" style={{ backgroundColor: color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-zinc-100 truncate">{session.title}</span>
          {session.significance && (
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300">
              {session.significance.tier}
            </span>
          )}
        </div>
        <div className="text-sm text-zinc-400">
          {formatLocal(session.start)}
          {session.location ? ` · ${session.location}` : ''}
        </div>
        {session.significance && (
          <div className="text-xs text-amber-300/80 mt-1">{session.significance.note}</div>
        )}
      </div>
      <div className="text-sm text-zinc-500 whitespace-nowrap self-center">
        {formatRelative(session.start)}
      </div>
    </div>
  );
}
