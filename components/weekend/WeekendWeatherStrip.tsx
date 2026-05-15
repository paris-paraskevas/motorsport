import type { Weekend } from '@/lib/types';
import { matchCircuit } from '@/lib/circuits';
import { fetchWeather, forecastFor, venueLocalIsoDate, weatherLabel, type DailyWeather } from '@/lib/weather';

function dayLabel(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export async function WeekendWeatherStrip({ weekend }: { weekend: Weekend }) {
  const location = weekend.sessions.find(s => s.location)?.location;
  const title = weekend.sessions[0]?.title;
  const circuit = await matchCircuit(location, title);
  if (!circuit) return null;

  const forecast = await fetchWeather(circuit.lat, circuit.lon);
  if (!forecast) return null;

  // Derive each session's venue-local date so we don't get bitten by UTC
  // boundary crossings (evening race in COTA == next UTC day).
  const seen = new Set<string>();
  const tiles: Array<{ iso: string; daily: DailyWeather }> = [];
  for (const s of weekend.sessions) {
    const iso = venueLocalIsoDate(forecast, s.start);
    if (seen.has(iso)) continue;
    seen.add(iso);
    const daily = forecastFor(forecast, iso);
    if (daily) tiles.push({ iso, daily });
  }

  if (tiles.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="text-xs uppercase tracking-wider text-zinc-500 mb-3">Weather</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {tiles.map(({ iso, daily }) => {
          const w = weatherLabel(daily.weatherCode);
          return (
            <div
              key={iso}
              className="rounded-2xl bg-zinc-900/40 border border-zinc-800/60 p-3"
            >
              <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-zinc-500">
                {dayLabel(iso)}
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-xl" aria-hidden>{w.emoji}</span>
                <span className="text-zinc-100 text-base font-semibold tabular-nums">
                  {Math.round(daily.maxC)}°
                </span>
                <span className="text-zinc-500 text-sm tabular-nums">
                  {Math.round(daily.minC)}°
                </span>
              </div>
              <div className="mt-1 text-xs text-zinc-400 truncate">{w.label}</div>
              {daily.precipProb >= 30 && (
                <div className="mt-1 text-[11px] text-sky-300 tabular-nums">
                  {Math.round(daily.precipProb)}% rain
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-zinc-600">
        Source: Open-Meteo · {circuit.name}
      </div>
    </section>
  );
}
