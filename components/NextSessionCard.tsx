import Link from 'next/link';
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
      className="block mb-8 rounded-xl bg-zinc-900/60 border border-zinc-800 overflow-hidden hover:bg-zinc-900 transition-colors"
    >
      <div className="h-1 w-full" style={{ backgroundColor: color }} />
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-[11px] uppercase tracking-[0.15em] font-medium"
            style={{ color }}
          >
            {seriesName}
          </span>
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-medium">
            next
          </span>
        </div>
        <h2 className="text-2xl text-zinc-50 font-semibold leading-tight tracking-tight">
          {session.title}
        </h2>
        <div className="mt-3 text-sm text-zinc-400">
          {formatLocal(session.start)}
          {session.location ? <> · <span className="text-zinc-500">{session.location}</span></> : null}
        </div>
        <div className="mt-1 text-sm font-medium text-zinc-300">
          {formatRelative(session.start)}
        </div>
      </div>
    </Link>
  );
}
