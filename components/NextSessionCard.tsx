import Link from 'next/link';
import { ChevronRight, MapPin } from 'lucide-react';
import { Session } from '@/lib/types';
import { formatLocal, formatRelative } from '@/lib/date';

export function NextSessionCard({
  session,
  color,
  seriesName,
  seriesSlug,
}: {
  session: Session;
  color: string;
  seriesName: string;
  seriesSlug: string;
}) {
  return (
    <Link
      href={`/series/${seriesSlug}`}
      className="group relative block mb-10 rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900/60 transition-all hover:bg-zinc-900 hover:border-zinc-700"
    >
      <div
        className="absolute inset-0 opacity-[0.10] pointer-events-none"
        style={{ background: `linear-gradient(135deg, ${color} 0%, transparent 55%)` }}
      />

      <div className="relative p-5">
        <div className="flex items-center justify-between mb-4">
          <span
            className="inline-flex items-center text-[11px] uppercase tracking-[0.14em] font-semibold px-2.5 py-1 rounded-full"
            style={{ backgroundColor: `${color}26`, color }}
          >
            {seriesName}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-200 font-semibold">
              next
            </span>
            <ChevronRight size={16} className="text-zinc-600 group-hover:text-zinc-300 transition-colors" />
          </div>
        </div>

        <h2 className="text-2xl text-zinc-50 font-bold leading-[1.15] tracking-tight">
          {session.title}
        </h2>

        <div className="mt-4 text-sm text-zinc-300 font-medium tabular-nums">
          {formatRelative(session.start)}
        </div>

        <div className="mt-1 text-sm text-zinc-500 flex items-center gap-1.5 flex-wrap">
          <span className="tabular-nums">{formatLocal(session.start)}</span>
          {session.location && (
            <>
              <span className="text-zinc-700">·</span>
              <MapPin size={12} className="text-zinc-600 shrink-0" />
              <span>{session.location}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
