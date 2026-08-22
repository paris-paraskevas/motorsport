import type { Session, Weekend } from '@/lib/types';
import { matchCircuit } from '@/lib/circuits';
import { shortSessionLabel } from '@/lib/weekend';
import {
  fetchWeather,
  forecastFor,
  forecastWindow,
  thinHours,
  venueLocalIsoDate,
  weatherLabel,
  type DailyWeather,
  type HourlyWeather,
  type WeatherForecast,
} from '@/lib/weather';
import { HourlyForecastRows } from '@/components/weekend/HourlyForecastRows';

/** At most this many hourly rows per tile. Four keeps a 90-minute race exact
 *  (start hour through end hour) while a 24-hour race thins to four readings
 *  spanning the whole run rather than truncating to its first morning. */
const MAX_ROWS = 4;

/** "SAT 22 AUG" in venue-local terms. `iso` is already a venue-local date, so
 *  it is formatted as UTC to stop the server's own zone shifting it again. */
function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`)
    .toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    })
    .toUpperCase();
}

function hourLabel(isoHour: string): string {
  return isoHour.slice(11, 16);
}

interface Tile {
  key: string;
  label: string;
  /** SAT 22 AUG · 15:00-16:45, or SAT 22 AUG · TBC */
  when: string;
  hours: HourlyWeather[];
  /** Only for a session with no known hour: the day's own high/low. */
  day: DailyWeather | null;
}

/**
 * Weather for the weekend, read PER SESSION and ACROSS its running (operator,
 * 2026-08-22: "must bring weather based on session time. We don't care if it'll
 * rain on that day", then "the forecast can be for the hours that the sessions
 * hold, e.g. race is 1,5 hours so needs 3-5 forecast").
 *
 * A day-level tile answered the wrong question — Zandvoort showed 98% rain for
 * Saturday when the Sprint hour itself was 94% and Qualifying, four hours later,
 * was 33% — and a single start-hour reading answers only the first minute of a
 * ninety-minute race.
 *
 * A session whose hour is unknown (`dateOnly`, rendered as TBC everywhere else)
 * falls back to its day's high/low, because a day range is the only honest
 * answer when there is no time to read.
 */
export async function WeekendWeatherStrip({ weekend }: { weekend: Weekend }) {
  const location = weekend.sessions.find(s => s.location)?.location;
  const title = weekend.sessions[0]?.title;
  const circuit = await matchCircuit(location, title);
  if (!circuit) return null;

  const forecast = await fetchWeather(circuit.lat, circuit.lon);
  if (!forecast) return null;

  const ordered = [...weekend.sessions].sort((a, b) => a.start.getTime() - b.start.getTime());
  const tiles: Tile[] = [];
  for (const session of ordered) {
    const tile = tileFor(session, forecast);
    if (tile) tiles.push(tile);
  }

  if (tiles.length === 0) return null;

  return (
    <section className="mb-8 border-y border-border py-4">
      <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-3">
        Weather by session
      </h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tiles.map(tile => (
          <div key={tile.key} className="border border-border p-3">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-text">
              {tile.label}
            </div>
            <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-text-faint">
              {tile.when}
            </div>
            {tile.hours.length > 0 ? (
              <HourlyForecastRows hours={tile.hours} className="mt-2" />
            ) : (
              tile.day && <DayFallback daily={tile.day} />
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-text-faint">
        {`Source: Open-Meteo · ${circuit.name} · hour by hour across each session`}
      </div>
    </section>
  );
}

function tileFor(session: Session, forecast: WeatherForecast): Tile | null {
  const dayIso = venueLocalIsoDate(forecast, session.start);
  const label = shortSessionLabel(session.title);

  // A dateOnly session has no hour to read (lib/types.ts), so the day's range is
  // the honest answer and the label says TBC, exactly as the schedule does.
  if (session.dateOnly) {
    const daily = forecastFor(forecast, dayIso);
    if (!daily) return null;
    return { key: session.uid, label, when: `${dayLabel(dayIso)} · TBC`, hours: [], day: daily };
  }

  const hours = thinHours(forecastWindow(forecast, session.start, session.end), MAX_ROWS);
  if (hours.length === 0) {
    // Past Open-Meteo's horizon, or already run and out of its window: better to
    // omit the session than to draw it against a day it did not happen on.
    return null;
  }
  const span =
    hours.length > 1
      ? `${hourLabel(hours[0].time)}-${hourLabel(hours[hours.length - 1].time)}`
      : hourLabel(hours[0].time);
  return { key: session.uid, label, when: `${dayLabel(dayIso)} · ${span}`, hours, day: null };
}

function DayFallback({ daily }: { daily: DailyWeather }) {
  const w = weatherLabel(daily.weatherCode);
  return (
    <>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-xl" aria-hidden>{w.emoji}</span>
        <span className="font-mono text-base font-semibold tabular-nums text-text">
          {Math.round(daily.maxC)}°
        </span>
        <span className="font-mono text-sm tabular-nums text-text-faint">
          {Math.round(daily.minC)}°
        </span>
      </div>
      <div className="mt-1 truncate text-xs text-text-muted">{w.label}</div>
      {daily.precipProb >= 30 && (
        <div className="mt-1 font-mono text-[11px] tabular-nums text-sky-700 dark:text-sky-300">
          {Math.round(daily.precipProb)}% rain
        </div>
      )}
    </>
  );
}
