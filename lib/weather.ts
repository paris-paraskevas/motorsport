import { kv } from '@vercel/kv';

export interface DailyWeather {
  date: string; // YYYY-MM-DD
  maxC: number;
  minC: number;
  precipProb: number;   // 0-100
  precipMm: number;
  windKph: number;
  weatherCode: number;
}

export interface WeatherForecast {
  lat: number;
  lon: number;
  fetchedAt: string;
  utcOffsetSeconds: number;
  daily: DailyWeather[];
}

const TTL_SECONDS = 3 * 60 * 60; // 3 hours — Open-Meteo updates roughly hourly

function isKvConfigured(): boolean {
  return Boolean(
    process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
  );
}

function cacheKey(lat: number, lon: number): string {
  return `paddock:weather:${lat.toFixed(3)}:${lon.toFixed(3)}`;
}

interface OpenMeteoResponse {
  utc_offset_seconds?: number;
  daily?: {
    time?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
    precipitation_sum?: number[];
    wind_speed_10m_max?: number[];
    weather_code?: number[];
  };
}

async function fetchOpenMeteo(lat: number, lon: number): Promise<WeatherForecast | null> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,weather_code',
    forecast_days: '7',
    timezone: 'auto',
    wind_speed_unit: 'kmh',
  });
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      // Edge caches for an hour; KV cache wraps this for cross-request reuse.
      next: { revalidate: 3600 },
    } as RequestInit);
    if (!res.ok) return null;
    const data = (await res.json()) as OpenMeteoResponse;
    const d = data.daily;
    if (
      !d ||
      !d.time ||
      !d.temperature_2m_max ||
      !d.temperature_2m_min ||
      !d.precipitation_probability_max ||
      !d.precipitation_sum ||
      !d.wind_speed_10m_max ||
      !d.weather_code
    ) {
      return null;
    }
    const daily: DailyWeather[] = d.time.map((date, i) => ({
      date,
      maxC: d.temperature_2m_max![i],
      minC: d.temperature_2m_min![i],
      precipProb: d.precipitation_probability_max![i],
      precipMm: d.precipitation_sum![i],
      windKph: d.wind_speed_10m_max![i],
      weatherCode: d.weather_code![i],
    }));
    return {
      lat,
      lon,
      fetchedAt: new Date().toISOString(),
      utcOffsetSeconds: data.utc_offset_seconds ?? 0,
      daily,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch a 7-day forecast for a venue, caching in Vercel KV for ~3 hours so
 * repeated requests for the same coordinates don't hammer Open-Meteo.
 */
export async function fetchWeather(
  lat: number,
  lon: number,
): Promise<WeatherForecast | null> {
  if (isKvConfigured()) {
    const cached = await kv.get<WeatherForecast>(cacheKey(lat, lon));
    // Old cache entries pre-date utcOffsetSeconds; refresh them so venue-local
    // date math doesn't trip over a missing field.
    if (cached && typeof cached.utcOffsetSeconds === 'number') return cached;
  }
  const fresh = await fetchOpenMeteo(lat, lon);
  if (!fresh) return null;
  if (isKvConfigured()) {
    await kv.set(cacheKey(lat, lon), fresh, { ex: TTL_SECONDS });
  }
  return fresh;
}

/**
 * Pick the forecast entry that matches a target instant in *venue-local* time.
 * Open-Meteo returns daily entries keyed by venue-local date (timezone=auto),
 * so converting via UTC would pick the wrong day for evening sessions whose
 * UTC date differs from the venue's local date.
 */
export function forecastFor(
  forecast: WeatherForecast,
  at: Date | string,
): DailyWeather | null {
  const iso = typeof at === 'string' ? at : venueLocalIsoDate(forecast, at);
  return forecast.daily.find(d => d.date === iso) ?? null;
}

/** YYYY-MM-DD for the given instant in the forecast's venue-local timezone. */
export function venueLocalIsoDate(forecast: WeatherForecast, at: Date): string {
  const shifted = new Date(at.getTime() + forecast.utcOffsetSeconds * 1000);
  return shifted.toISOString().slice(0, 10);
}

// WMO weather code → short label. https://open-meteo.com/en/docs#weathervariables
const WMO_LABELS: Record<number, { label: string; emoji: string }> = {
  0: { label: 'Clear', emoji: '☀️' },
  1: { label: 'Mostly clear', emoji: '🌤️' },
  2: { label: 'Partly cloudy', emoji: '⛅' },
  3: { label: 'Overcast', emoji: '☁️' },
  45: { label: 'Fog', emoji: '🌫️' },
  48: { label: 'Rime fog', emoji: '🌫️' },
  51: { label: 'Light drizzle', emoji: '🌦️' },
  53: { label: 'Drizzle', emoji: '🌦️' },
  55: { label: 'Heavy drizzle', emoji: '🌧️' },
  61: { label: 'Light rain', emoji: '🌧️' },
  63: { label: 'Rain', emoji: '🌧️' },
  65: { label: 'Heavy rain', emoji: '🌧️' },
  66: { label: 'Freezing rain', emoji: '🌧️' },
  67: { label: 'Freezing rain', emoji: '🌧️' },
  71: { label: 'Light snow', emoji: '🌨️' },
  73: { label: 'Snow', emoji: '🌨️' },
  75: { label: 'Heavy snow', emoji: '❄️' },
  77: { label: 'Snow grains', emoji: '❄️' },
  80: { label: 'Light showers', emoji: '🌦️' },
  81: { label: 'Showers', emoji: '🌧️' },
  82: { label: 'Heavy showers', emoji: '⛈️' },
  85: { label: 'Snow showers', emoji: '🌨️' },
  86: { label: 'Heavy snow showers', emoji: '🌨️' },
  95: { label: 'Thunderstorm', emoji: '⛈️' },
  96: { label: 'Thunderstorm + hail', emoji: '⛈️' },
  99: { label: 'Heavy thunderstorm', emoji: '⛈️' },
};

export function weatherLabel(code: number): { label: string; emoji: string } {
  return WMO_LABELS[code] ?? { label: 'Forecast', emoji: '🌡️' };
}
