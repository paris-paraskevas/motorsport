import { weatherLabel, type HourlyWeather } from '@/lib/weather';

/** Rain chance worth colouring. Below this it is background noise and reads as
 *  clutter in a dense row. */
const WET = 30;

/** The venue-local clock time out of an hour key ("2026-08-22T15:00" → "15:00"). */
function hourLabel(isoHour: string): string {
  return isoHour.slice(11, 16);
}

/**
 * One row per forecast hour: time, icon, temperature, rain chance. Shared by the
 * weekend page's per-session tiles and the session page's wider window, so a
 * reading cannot be formatted two different ways on two surfaces.
 *
 * Server component on purpose — nothing here is interactive, and the values are
 * already venue-local strings by the time they arrive.
 */
export function HourlyForecastRows({
  hours,
  className = '',
}: {
  hours: HourlyWeather[];
  className?: string;
}) {
  if (hours.length === 0) return null;
  return (
    <ul className={className}>
      {hours.map(h => {
        const w = weatherLabel(h.weatherCode);
        return (
          <li
            key={h.time}
            className="flex items-baseline gap-2 border-b border-border py-1 last:border-b-0"
          >
            <span className="w-[38px] shrink-0 font-mono text-[11px] tabular-nums text-text-faint">
              {hourLabel(h.time)}
            </span>
            <span className="shrink-0 text-[13px]" aria-hidden>{w.emoji}</span>
            <span className="w-[30px] shrink-0 font-mono text-[12px] font-semibold tabular-nums text-text">
              {Math.round(h.tempC)}°
            </span>
            <span
              className={`shrink-0 font-mono text-[11px] tabular-nums ${
                h.precipProb >= WET ? 'text-sky-700 dark:text-sky-300' : 'text-text-faint'
              }`}
            >
              {Math.round(h.precipProb)}%
            </span>
            <span className="min-w-0 truncate text-[11px] text-text-muted">{w.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
