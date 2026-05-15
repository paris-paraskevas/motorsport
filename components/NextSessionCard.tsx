import Link from 'next/link';
import { ArrowUpRight, MapPin } from 'lucide-react';
import { Session } from '@/lib/types';
import type { DailyWeather } from '@/lib/weather';
import { weatherLabel } from '@/lib/weather';
import { formatLocal, formatRelative } from '@/lib/date';

export function NextSessionCard({
  session,
  color,
  seriesName,
  seriesSlug,
  weather,
}: {
  session: Session;
  color: string;
  seriesName: string;
  seriesSlug: string;
  weather?: DailyWeather;
}) {
  const w = weather ? weatherLabel(weather.weatherCode) : null;
  return (
    <Link
      href={`/series/${seriesSlug}`}
      className="group relative block mb-10 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/40 transition-all duration-300 hover:bg-zinc-900/70 hover:border-zinc-700"
    >
      {/* Series-color gradient corner — subtle but distinctive */}
      <div
        className="absolute inset-0 opacity-[0.18] pointer-events-none"
        style={{ background: `radial-gradient(circle at 0% 0%, ${color} 0%, transparent 55%)` }}
      />
      {/* Top accent line in series color */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ backgroundColor: color, opacity: 0.6 }} />

      <div className="relative p-6 md:p-8">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: color, boxShadow: `0 0 12px ${color}` }}
            />
            <span
              className="text-[11px] uppercase tracking-[0.18em] font-semibold"
              style={{ color }}
            >
              {seriesName}
            </span>
          </div>
          <span className="text-[10px] uppercase tracking-[0.16em] font-semibold text-zinc-500">
            Up next
          </span>
        </div>

        <h2 className="text-2xl md:text-3xl text-zinc-50 font-bold leading-[1.1] tracking-tight">
          {session.title}
        </h2>

        <div className="mt-6 flex items-baseline gap-4 flex-wrap">
          <span className="text-lg md:text-xl font-semibold text-zinc-100 tnum">
            {formatRelative(session.start)}
          </span>
          <span className="text-sm text-zinc-500 tnum">
            {formatLocal(session.start)}
          </span>
        </div>

        {session.location && (
          <div className="mt-2 flex items-center gap-1.5 text-sm text-zinc-500">
            <MapPin size={13} className="text-zinc-600" />
            <span>{session.location.split(',')[0].trim()}</span>
          </div>
        )}

        {weather && w && (
          <div className="mt-4 inline-flex items-center gap-2 text-xs text-zinc-300 bg-zinc-900/60 border border-zinc-800 rounded-full px-3 py-1.5">
            <span aria-hidden>{w.emoji}</span>
            <span className="font-medium">{w.label}</span>
            <span className="text-zinc-500">·</span>
            <span className="tabular-nums">
              {Math.round(weather.maxC)}° / {Math.round(weather.minC)}°
            </span>
            {weather.precipProb >= 30 && (
              <>
                <span className="text-zinc-500">·</span>
                <span className="tabular-nums text-sky-300">
                  {Math.round(weather.precipProb)}% rain
                </span>
              </>
            )}
          </div>
        )}

        <div className="mt-6 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 group-hover:text-zinc-200 transition-colors">
          Open series
          <ArrowUpRight size={14} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
      </div>
    </Link>
  );
}
