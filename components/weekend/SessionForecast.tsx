import type { Session, Weekend } from '@/lib/types';
import { matchCircuit } from '@/lib/circuits';
import { fetchWeather, forecastWindow, thinHours } from '@/lib/weather';
import { HourlyForecastRows } from '@/components/weekend/HourlyForecastRows';

/** How far either side of the running to reach (operator, 2026-08-22: "a couple
 *  hours before until a couple hours after the session"). Two hours before is
 *  what a reader planning to watch wants; two after covers a red flag, a delay,
 *  and the walk back to the car. */
const PAD_MS = 2 * 3_600_000;

/** Enough rows for a 90-minute race plus both pads (six hours) without a wall of
 *  numbers; a longer session thins across its whole span. */
const MAX_ROWS = 7;

/**
 * The weather around one session, on the session's own page. Wider than the
 * weekend tile on purpose: here the reader has committed to this session, so the
 * approach and the aftermath matter, not just the running.
 *
 * Renders nothing at all when there is no circuit match, no forecast, or the
 * session sits outside Open-Meteo's 16-day horizon — which is every session more
 * than a fortnight past, where a "forecast" would be meaningless anyway.
 */
export async function SessionForecast({
  session,
  weekend,
}: {
  session: Session;
  weekend: Weekend;
}) {
  if (session.dateOnly) return null; // no hour to build a window around
  // Individual ICS entries often carry no LOCATION while their siblings do, so
  // fall back to the weekend's, which is how the rest of this page resolves the
  // venue too.
  const location = session.location ?? weekend.sessions.find(s => s.location)?.location;
  const circuit = await matchCircuit(location, session.title);
  if (!circuit) return null;

  const forecast = await fetchWeather(circuit.lat, circuit.lon);
  if (!forecast) return null;

  const hours = thinHours(
    forecastWindow(
      forecast,
      new Date(session.start.getTime() - PAD_MS),
      new Date(session.end.getTime() + PAD_MS),
    ),
    MAX_ROWS,
  );
  if (hours.length === 0) return null;

  return (
    <section className="mt-6 border-y border-border py-4">
      <h2 className="mb-1 font-display text-sm font-extrabold uppercase tracking-wide text-text">
        Weather around the session
      </h2>
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
        Venue local time · two hours either side
      </p>
      <HourlyForecastRows hours={hours} className="max-w-md" />
      <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-text-faint">
        {`Source: Open-Meteo · ${circuit.name}`}
      </div>
    </section>
  );
}
