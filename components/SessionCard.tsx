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
      className={`group relative flex items-stretch gap-3 pl-3 pr-3 py-3 rounded-lg bg-zinc-900/30 border border-zinc-800/50 mb-1.5 transition-all hover:bg-zinc-900/60 hover:border-zinc-700/80 ${
        isPast ? 'opacity-45' : ''
      }`}
    >
      {/* Left accent bar */}
      <span
        className="self-stretch w-[3px] rounded-full shrink-0"
        style={{ backgroundColor: color, opacity: isPast ? 0.5 : 0.85 }}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[15px] text-zinc-50 font-semibold tracking-tight truncate">
            {session.title}
          </span>
          {isLive && (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-300 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              live
            </span>
          )}
          {session.significance && (
            <span
              className="text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full font-semibold"
              style={{
                backgroundColor: 'rgba(251, 191, 36, 0.10)',
                color: '#fcd34d',
              }}
            >
              {session.significance.tier}
            </span>
          )}
        </div>
        <div className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1.5 min-w-0 tnum">
          <span>{formatLocal(session.start)}</span>
          {session.location && (
            <>
              <span className="text-zinc-700">·</span>
              <MapPin size={11} className="text-zinc-600 shrink-0" />
              <span className="truncate">{session.location}</span>
            </>
          )}
        </div>
        {session.significance?.note && (
          <div className="text-xs text-amber-200/70 mt-1">{session.significance.note}</div>
        )}
      </div>

      <span className="text-xs font-medium text-zinc-400 tnum self-center whitespace-nowrap">
        {formatRelative(session.start)}
      </span>
    </div>
  );
}
