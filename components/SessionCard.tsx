import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { Session } from '@/lib/types';
import type { DailyWeather } from '@/lib/weather';
import { weatherLabel } from '@/lib/weather';
import { formatLocal, formatLocalDay, formatRelative } from '@/lib/date';

export function SessionCard({
  session,
  color,
  round,
  weather,
}: {
  session: Session;
  color: string;
  round?: number;
  weather?: DailyWeather;
}) {
  const now = new Date();
  const isLive = !session.dateOnly && session.start <= now && now <= session.end;
  const isPast = !isLive && session.end < now;
  const href = round
    ? `/series/${session.seriesSlug}/weekend/${round}`
    : `/series/${session.seriesSlug}?tab=calendar`;
  const w = weather ? weatherLabel(weather.weatherCode) : null;

  return (
    <Link
      href={href}
      // min-w-0 is load-bearing: as a GRID item this card otherwise demands
      // its min-content width (a long nowrap session title), inflating the
      // whole day-group's track past the viewport — every card in the group
      // then renders cut off on phones (Le Mans week regression, 0.13.3).
      className={`group relative flex min-w-0 items-stretch gap-3 overflow-hidden pl-3 pr-3 py-3 rounded-lg bg-surface/40 border border-border/60 mb-1.5 transition-all duration-(--duration-fast) hover:bg-surface hover:border-border-strong ${
        isPast ? 'opacity-45' : ''
      }`}
    >
      {/* Left accent bar — series color */}
      <span
        className="self-stretch w-[3px] rounded-full shrink-0"
        style={{ backgroundColor: color, opacity: isPast ? 0.5 : 0.85 }}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-[15px] text-text font-semibold tracking-tight truncate min-w-0 flex-1 basis-full">
            {session.title}
          </span>
          {isLive && (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-300 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 live-pulse" />
              live
            </span>
          )}
          {session.significance && (
            <span
              className="font-mono text-[9px] uppercase tracking-[0.14em] px-1.5 py-0.5 border border-brand/40 text-brand font-semibold"
            >
              {session.significance.tier}
            </span>
          )}
        </div>
        <div className="text-xs text-text-faint mt-0.5 flex items-center gap-1.5 min-w-0 tnum font-mono">
          <time
            dateTime={
              session.dateOnly
                ? session.start.toISOString().slice(0, 10)
                : session.start.toISOString()
            }
          >
            {session.dateOnly ? formatLocalDay(session.start) : formatLocal(session.start)}
          </time>
          {session.location && (
            <>
              <span className="text-border-strong">·</span>
              <MapPin size={11} className="text-text-faint shrink-0" />
              <span className="truncate font-sans">{session.location.split(',')[0].trim()}</span>
            </>
          )}
        </div>
        {session.significance?.note && (
          <div className="text-xs text-brand/70 mt-1">{session.significance.note}</div>
        )}
        {weather && w && !isPast && (
          <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-text-muted">
            <span aria-hidden>{w.emoji}</span>
            <span className="tabular-nums font-mono">
              {Math.round(weather.maxC)}°/{Math.round(weather.minC)}°
            </span>
            {weather.precipProb >= 30 && (
              <span className="tabular-nums font-mono text-sky-300">
                · {Math.round(weather.precipProb)}% rain
              </span>
            )}
          </div>
        )}
      </div>

      <span className="text-xs font-medium text-text-muted tnum font-mono self-center whitespace-nowrap">
        {session.dateOnly ? 'TBC' : formatRelative(session.start)}
      </span>
    </Link>
  );
}
