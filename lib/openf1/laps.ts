// Lap + telemetry assembly for the Qualifying Decoder. Given a session, find
// each driver's fastest valid lap, then pull that lap's telemetry (car_data)
// and trace (location) for just its time window — never the whole session, to
// keep payloads + rate-limit cost sane. All historical/immutable → cache hard.

import { fetchOpenF1, OF1_REVALIDATE, op } from './client';
import type { OF1CarData, OF1Lap, OF1Location } from './types';

export interface BestLap {
  driverNumber: number;
  lapNumber: number;
  lapDuration: number; // seconds
  sectors: [number | null, number | null, number | null];
  dateStart: string; // ISO — window anchor for car_data/location
  segments: [number[], number[], number[]]; // minisector status codes
}

export interface TelemetrySample {
  t: number; // seconds from lap start
  speed: number; // km/h
  throttle: number; // 0-100
  brake: number; // 0/100
  gear: number;
  drs: number;
}

/** Every lap for a session (immutable once the session is over). */
export function fetchLaps(sessionKey: number): Promise<OF1Lap[]> {
  return fetchOpenF1<OF1Lap>(
    'laps',
    { session_key: sessionKey },
    { revalidate: OF1_REVALIDATE.immutable },
  );
}

/** Fastest timed, non-pit-out lap per driver. */
export function fastestLapsByDriver(laps: OF1Lap[]): Map<number, BestLap> {
  const best = new Map<number, BestLap>();
  for (const l of laps) {
    if (l.lap_duration == null || l.lap_duration <= 0 || l.is_pit_out_lap) continue;
    const cur = best.get(l.driver_number);
    if (cur && l.lap_duration >= cur.lapDuration) continue;
    best.set(l.driver_number, {
      driverNumber: l.driver_number,
      lapNumber: l.lap_number,
      lapDuration: l.lap_duration,
      sectors: [l.duration_sector_1, l.duration_sector_2, l.duration_sector_3],
      dateStart: l.date_start ?? '',
      segments: [
        l.segments_sector_1 ?? [],
        l.segments_sector_2 ?? [],
        l.segments_sector_3 ?? [],
      ],
    });
  }
  return best;
}

/** End of a lap's time window with a small tail so the line reaches the finish. */
function lapWindowEnd(lap: BestLap): string {
  const end = new Date(lap.dateStart).getTime() + Math.ceil(lap.lapDuration * 1000) + 500;
  return new Date(end).toISOString();
}

/**
 * Telemetry for one lap, normalised to t = 0..lapDuration seconds. Returns []
 * when the lap has no anchor date or OpenF1 has no car_data for the window.
 */
export async function fetchLapTelemetry(
  sessionKey: number,
  lap: BestLap,
): Promise<TelemetrySample[]> {
  if (!lap.dateStart) return [];
  const t0 = new Date(lap.dateStart).getTime();
  const rows = await fetchOpenF1<OF1CarData>(
    'car_data',
    { driver_number: lap.driverNumber, session_key: sessionKey },
    {
      filters: [op('date', '>=', lap.dateStart), op('date', '<=', lapWindowEnd(lap))],
      revalidate: OF1_REVALIDATE.immutable,
    },
  );
  return rows
    .map(r => ({
      t: (new Date(r.date).getTime() - t0) / 1000,
      speed: r.speed,
      throttle: r.throttle,
      brake: r.brake,
      gear: r.n_gear,
      drs: r.drs,
    }))
    .filter(s => s.t >= -0.5 && s.t <= lap.lapDuration + 1)
    .sort((a, b) => a.t - b.t);
}

/** Position trace for one lap window — feeds the self-drawn track + ghost replay. */
export async function fetchLapLocation(
  sessionKey: number,
  lap: BestLap,
): Promise<OF1Location[]> {
  if (!lap.dateStart) return [];
  return fetchOpenF1<OF1Location>(
    'location',
    { driver_number: lap.driverNumber, session_key: sessionKey },
    {
      filters: [op('date', '>=', lap.dateStart), op('date', '<=', lapWindowEnd(lap))],
      revalidate: OF1_REVALIDATE.immutable,
    },
  );
}
