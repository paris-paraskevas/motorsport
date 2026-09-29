import type { Weekend } from '@/lib/types';
import { matchCircuit, venueCandidates } from '@/lib/circuits';
import { shortSessionLabel } from '@/lib/weekend';
import { fetchWeather, sessionTiles, weatherLabel, type DailyWeather } from '@/lib/weather';
import { HourlyForecastRows } from '@/components/weekend/HourlyForecastRows';
import { isBuildOptionIncluded } from '@/lib/design/build-options';

/** At most this many hourly rows per tile. Four keeps a 90-minute race exact
 *  (start hour through end hour) while a 24-hour race thins to four readings
 *  spanning the whole run rather than truncating to its first morning. */
const MAX_ROWS = 4;

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
 * answer when there is no time to read. The tiles themselves are built by
 * lib/weather.ts sessionTiles, shared with the Weather component (P2.14).
 *
 * The circuit resolves through the round's curated venue first, as the rest of
 * the weekend page does (P2.14): by name alone the 2026 Bahrain Grand Prix, run
 * at Sepang, read Sakhir's forecast.
 */
export async function WeekendWeatherStrip({ weekend, venue }: { weekend: Weekend; venue?: string }) {
  // The Weather build option (the designer's Build Options): excluded, the strip
  // renders nothing, exactly as a weekend without a forecast does.
  if (!(await isBuildOptionIncluded('weather'))) return null;

  const location = weekend.sessions.find(s => s.location)?.location;
  const title = weekend.sessions[0]?.title;
  const circuit = await matchCircuit(...venueCandidates({ venue, location, title }));
  if (!circuit) return null;

  const forecast = await fetchWeather(circuit.lat, circuit.lon);
  if (!forecast) return null;

  const tiles = sessionTiles(weekend.sessions, forecast, MAX_ROWS, shortSessionLabel);
  if (tiles.length === 0) return null;

  return (
    <section className="mb-8 border-y border-border py-4">
      <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-3">
        Weather by session
      </h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tiles.map(tile => (
          <div key={tile.key} className="border border-border p-3">
            <div className="font-mono text-11 font-semibold uppercase tracking-[0.12em] text-text">
              {tile.label}
            </div>
            <div className="mt-0.5 font-mono text-10 uppercase tracking-[0.1em] text-text-faint">
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
      <div className="mt-2 text-10 uppercase tracking-[0.14em] text-text-faint">
        {`Source: Open-Meteo · ${circuit.name} · hour by hour across each session`}
      </div>
    </section>
  );
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
        <div className="mt-1 font-mono text-11 tabular-nums text-sky-700 dark:text-sky-300">
          {Math.round(daily.precipProb)}% rain
        </div>
      )}
    </>
  );
}
