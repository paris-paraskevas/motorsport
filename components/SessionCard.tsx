import { MapPin } from 'lucide-react';
import { Session } from '@/lib/types';
import { formatLocal, formatRelative } from '@/lib/date';

export function SessionCard({
  session,
  color,
}: {
  session: Session;
  color: string;
}) {
  const now = new Date();
  const isLive = session.start <= now && now <= session.end;
  const isPast = !isLive && session.end < now;

  return (
    <div
      className={`flex items-center gap-3 px-3.5 py-3 rounded-xl bg-zinc-900/40 border border-zinc-800/60 mb-1.5 transition-colors hover:bg-zinc-900/70 ${
        isPast ? 'opacity-50' : ''
      }`}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[15px] text-zinc-100 font-medium truncate">
            {session.title}
          </span>
          {isLive && (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-300 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              live
            </span>
          )}
          {session.significance && (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 font-semibold">
              {session.significance.tier}
            </span>
          )}
        </div>
        <div className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1.5 min-w-0">
          <span className="tabular-nums">{formatLocal(session.start)}</span>
          {session.location && (
            <>
              <span className="text-zinc-700">·</span>
              <MapPin size={11} className="text-zinc-600 shrink-0" />
              <span className="truncate">{session.location}</span>
            </>
          )}
        </div>
        {session.significance?.note && (
          <div className="text-xs text-amber-300/70 mt-1">{session.significance.note}</div>
        )}
      </div>
      <span className="text-xs text-zinc-400 font-medium tabular-nums shrink-0">
        {formatRelative(session.start)}
      </span>
    </div>
  );
}
