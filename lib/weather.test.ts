import { describe, it, expect } from 'vitest';
import {
  forecastAtSession,
  forecastFor,
  venueLocalIsoDate,
  venueLocalIsoHour,
  weatherLabel,
  type WeatherForecast,
} from './weather';

/** Zandvoort in August: UTC+2. Hourly rows are venue-local, as Open-Meteo
 *  returns them under timezone=auto (verified against the live API 2026-08-22). */
function forecast(utcOffsetSeconds = 7200): WeatherForecast {
  const hours = ['12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
  return {
    lat: 52.389,
    lon: 4.541,
    fetchedAt: '2026-08-22T08:00:00.000Z',
    utcOffsetSeconds,
    daily: [
      { date: '2026-08-22', maxC: 18, minC: 13, precipProb: 98, precipMm: 6.4, windKph: 30, weatherCode: 61 },
      { date: '2026-08-23', maxC: 19, minC: 14, precipProb: 33, precipMm: 0.8, windKph: 22, weatherCode: 51 },
    ],
    hourly: hours.map((hhmm, i) => ({
      time: `2026-08-22T${hhmm}`,
      tempC: 15 + i,
      precipProb: i * 10,
      precipMm: i * 0.2,
      windKph: 20 + i,
      weatherCode: i === 3 ? 61 : 2,
    })),
  };
}

describe('venueLocalIsoHour', () => {
  it('rounds to the nearest venue-local hour', () => {
    const f = forecast();
    // 13:00Z is 15:00 at the venue.
    expect(venueLocalIsoHour(f, new Date('2026-08-22T13:00:00Z'))).toBe('2026-08-22T15:00');
    expect(venueLocalIsoHour(f, new Date('2026-08-22T12:55:00Z'))).toBe('2026-08-22T15:00');
    expect(venueLocalIsoHour(f, new Date('2026-08-22T13:29:00Z'))).toBe('2026-08-22T15:00');
    expect(venueLocalIsoHour(f, new Date('2026-08-22T13:30:00Z'))).toBe('2026-08-22T16:00');
  });

  it('keeps a late session on its venue-local day, not the UTC one', () => {
    // COTA, CDT (UTC-5): a 01:30Z Monday start is 20:30 Sunday at the track.
    const f = forecast(-5 * 3600);
    expect(venueLocalIsoHour(f, new Date('2026-10-26T01:30:00Z'))).toBe('2026-10-25T21:00');
    expect(venueLocalIsoDate(f, new Date('2026-10-26T01:30:00Z'))).toBe('2026-10-25');
  });
});

describe('forecastAtSession', () => {
  it('reads the hour the session runs in, not the day', () => {
    const f = forecast();
    const race = forecastAtSession(f, { start: new Date('2026-08-22T13:00:00Z') });
    expect(race).not.toBeNull();
    expect(race!.time).toBe('2026-08-22T15:00');
    expect(race!.weatherCode).toBe(61);
    // The day says 98% rain; the 12:00 hour says 0. That gap is the whole point.
    expect(forecastFor(f, '2026-08-22')!.precipProb).toBe(98);
    expect(forecastAtSession(f, { start: new Date('2026-08-22T10:00:00Z') })!.precipProb).toBe(0);
  });

  it('returns null for a session with no known hour', () => {
    const f = forecast();
    expect(forecastAtSession(f, { start: new Date('2026-08-22T13:00:00Z'), dateOnly: true })).toBeNull();
  });

  it('returns null outside the forecast horizon', () => {
    const f = forecast();
    expect(forecastAtSession(f, { start: new Date('2026-09-30T13:00:00Z') })).toBeNull();
  });

  it('survives a forecast with no hourly block', () => {
    const f = { ...forecast(), hourly: [] };
    expect(forecastAtSession(f, { start: new Date('2026-08-22T13:00:00Z') })).toBeNull();
    // The daily fallback the callers use is still there.
    expect(forecastFor(f, '2026-08-22')).not.toBeNull();
  });
});

describe('weatherLabel', () => {
  it('maps known WMO codes and falls back for unknown ones', () => {
    expect(weatherLabel(61).label).toBe('Light rain');
    expect(weatherLabel(0).label).toBe('Clear');
    expect(weatherLabel(1234).label).toBe('Forecast');
  });
});
