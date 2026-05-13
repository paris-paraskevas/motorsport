import { Session } from '@/lib/types';
import { formatLocal, formatRelative } from '@/lib/date';

export function NextSessionCard({
  session,
  color,
  seriesName,
}: {
  session: Session;
  color: string;
  seriesName: string;
}) {
  return (
    <div className="flex items-stretch gap-3 p-4 mb-6 border border-zinc-800 rounded-lg">
      <div className="w-1 rounded" style={{ backgroundColor: color }} />
      <div className="flex-1 min-w-0">
        <div className="text-xs uppercase tracking-wider mb-1" style={{ color }}>
          {seriesName} · next
        </div>
        <div className="text-lg text-zinc-100">{session.title}</div>
        <div className="text-sm text-zinc-400 mt-1">
          {formatLocal(session.start)}
          {session.location ? ` · ${session.location}` : ''}
        </div>
        <div className="text-sm text-zinc-500 mt-2">{formatRelative(session.start)}</div>
      </div>
    </div>
  );
}
