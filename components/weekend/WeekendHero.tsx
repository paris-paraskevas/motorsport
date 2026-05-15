import Link from 'next/link';
import { ArrowLeft, MapPin } from 'lucide-react';
import type { Weekend } from '@/lib/types';
import { formatRelative } from '@/lib/date';
import { weekendIsLive, weekendLabel, weekendStartEnd } from '@/lib/weekend';

export function WeekendHero({
  weekend,
  round,
  seriesSlug,
  seriesName,
  color,
}: {
  weekend: Weekend;
  round: number;
  seriesSlug: string;
  seriesName: string;
  color: string;
}) {
  const now = new Date();
  const { start, end } = weekendStartEnd(weekend);
  const isLive = weekendIsLive(weekend, now);
  const isPast = !isLive && end.getTime() < now.getTime();
  const location = weekend.sessions.find(s => s.location)?.location;
  const { title, subtitle } = weekendLabel(weekend, round);

  return (
    <section className="relative mb-8 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/40">
      <div
        className="absolute inset-0 opacity-[0.22] pointer-events-none"
        style={{ background: `radial-gradient(circle at 0% 0%, ${color} 0%, transparent 55%)` }}
      />
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ backgroundColor: color, opacity: 0.6 }}
      />

      <div className="relative p-6 md:p-8">
        <Link
          href={`/series/${seriesSlug}?tab=calendar`}
          className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] font-semibold text-zinc-400 hover:text-zinc-100 transition-colors mb-5"
        >
          <ArrowLeft size={12} />
          {seriesName}
        </Link>

        <div className="flex items-center gap-2.5 mb-4">
          <span
            className="text-[11px] uppercase tracking-[0.18em] font-semibold tabular-nums"
            style={{ color }}
          >
            Round {round}
          </span>
          {isLive && (
            <>
              <span className="text-zinc-700">·</span>
              <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                live
              </span>
            </>
          )}
          {isPast && (
            <>
              <span className="text-zinc-700">·</span>
              <span className="text-[10px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-full bg-zinc-800/60 text-zinc-400 font-semibold">
                past
              </span>
            </>
          )}
          {weekend.significance && weekend.significance.tier !== 'note' && (
            <>
              <span className="text-zinc-700">·</span>
              <span className="text-[10px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 font-semibold">
                {weekend.significance.tier}
              </span>
            </>
          )}
        </div>

        <h1 className="text-zinc-50 text-3xl md:text-4xl font-bold leading-[1.05] tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 text-zinc-400 text-base">{subtitle}</p>
        )}

        <div className="mt-5 flex items-baseline gap-4 flex-wrap">
          <span className="text-lg md:text-xl font-semibold text-zinc-100 tnum">
            {weekend.dateRangeLabel}
          </span>
          {!isPast && (
            <span className="text-sm text-zinc-500 tnum">
              {isLive ? 'underway' : formatRelative(start)}
            </span>
          )}
        </div>

        {location && (
          <div className="mt-2 flex items-center gap-1.5 text-sm text-zinc-500">
            <MapPin size={13} className="text-zinc-600" />
            <span>{location}</span>
          </div>
        )}

        {weekend.significance?.note && (
          <p className="mt-4 text-sm text-amber-200/80 leading-relaxed">
            {weekend.significance.note}
          </p>
        )}
      </div>
    </section>
  );
}
