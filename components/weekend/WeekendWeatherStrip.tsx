import type { Session, Weekend } from '@/lib/types';
import { matchCircuit } from '@/lib/circuits';
import { shortSessionLabel } from '@/lib/weekend';
import {
  fetchWeather,
  forecastAtSession,
  forecastFor,
  venueLocalIsoDate,
  venueLocalIsoHour,
  weatherLabel,
  type DailyWeather,
  type HourlyWeather,
  type WeatherForecast,
} from '@/lib/weather';

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

/** The venue-local clock time a session starts at, from the hour key. */
function hourLabel(isoHour: string): string {
  return isoHour.slice(11, 16);
}

interface Tile {
  key: string;
  label: string;      // FP1 / SPRINT / RACE
  when: string;       // SAT 22 AUG · 15:00, or SAT 22 AUG · TBC
  emoji: string;
  description: string;
  /** Single reading for an hour, or the day's high/low when there is no hour. */
  tempC: number;
  lowC: number | null;
  precipProb: number;
}

function hourTile(session: Session, forecast: WeatherForecast, hour: HourlyWeather): Tile {
  const w = weatherLabel(hour.weatherCode);
  return {
    key: session.uid,
    label: shortSessionLabel(session.title),
    when: `${dayLabel(venueLocalIsoDate(forecast, session.start))} · ${hourLabel(venueLocalIsoHour(forecast, session.start))}`,
    emoji: w.emoji,
    description: w.label,
    tempC: hour.tempC,
    lowC: null,
    precipProb: hour.precipProb,
  };
}

function dayTile(session: Session, forecast: WeatherForecast, daily: DailyWeather): Tile {
  const w = weatherLabel(daily.weatherCode);
  return {
    key: session.uid,
    label: shortSessionLabel(session.title),
    when: `${dayLabel(daily.date)} · TBC`,
    emoji: w.emoji,
    description: w.label,
    tempC: daily.maxC,
    lowC: daily.minC,
    precipProb: daily.precipProb,
  };
}

/**
 * Weather for the weekend, read PER SESSION rather than per day (operator,
 * 2026-08-22: "must bring weather based on session time. We don't care if it'll
 * rain on that day"). A day-level tile answered the wrong question — Zandvoort
 * showed 98% rain for Saturday when the Sprint hour itself was dry.
 *
 * A session whose hour is unknown (`dateOnly`, rendered as TBC everywhere else)
 * falls back to its day's high/low and is labelled TBC, because a day range is
 * the only honest answer when there is no time to read.
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
    const hour = forecastAtSession(forecast, session);
    if (hour) {
      tiles.push(hourTile(session, forecast, hour));
      continue;
    }
    // No hour available: either the session has no known time, or it sits past
    // Open-Meteo's 16-day horizon. The day's forecast still carries the first
    // case; the second yields nothing and the session is simply omitted.
    const daily = forecastFor(forecast, venueLocalIsoDate(forecast, session.start));
    if (daily) tiles.push(dayTile(session, forecast, daily));
  }

  if (tiles.length === 0) return null;

  return (
    <section className="mb-8 border-y border-border py-4">
      <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-3">
        Weather by session
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {tiles.map(tile => (
          <div key={tile.key} className="border border-border p-3">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-text">
              {tile.label}
            </div>
            <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-text-faint">
              {tile.when}
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-xl" aria-hidden>{tile.emoji}</span>
              <span className="font-mono text-base font-semibold tabular-nums text-text">
                {Math.round(tile.tempC)}°
              </span>
              {tile.lowC !== null && (
                <span className="font-mono text-sm tabular-nums text-text-faint">
                  {Math.round(tile.lowC)}°
                </span>
              )}
            </div>
            <div className="mt-1 truncate text-xs text-text-muted">{tile.description}</div>
            {tile.precipProb >= 30 && (
              <div className="mt-1 font-mono text-[11px] tabular-nums text-sky-700 dark:text-sky-300">
                {Math.round(tile.precipProb)}% rain
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-text-faint">
        {/* One template string, not text-around-an-interpolation: React's SSR
            ate the space after `{circuit.name}` and shipped "Zandvoort· forecast"
            to prod. Same trap as the grep-across-a-JSX-interpolation one. */}
        {`Source: Open-Meteo · ${circuit.name} · forecast for each session's start hour`}
      </div>
    </section>
  );
}
