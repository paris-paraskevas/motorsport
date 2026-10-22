// MET Norway's forecast for a circuit (slot O19): Locationforecast 2.0, free under CC BY 4.0 with the credit "Data from
// MET Norway", also for a site that carries advertising (https://api.met.no/doc/TermsOfService, /doc/License). Its
// terms ask for an identifying User-Agent, coordinates of four decimals at most, and caching: no new request before the
// answer's Expires, and If-Modified-Since with its Last-Modified. The publisher keeps each circuit's answer, trimmed to
// the steps ahead, on the paddock-data branch and picks the step a session starts in when it draws the page.

export interface ForecastStep {
  /** The step's start (ISO, UTC). */
  t: string;
  /** Air temperature at the step, whole degrees Celsius. */
  air: number;
  /** MET's symbol for the step's hours ("partlycloudy_day"); "" when the step has none. */
  symbol: string;
  /** Rain over the step's hours in millimetres; null when MET gives none. */
  mm: number | null;
  /** The hours the symbol and rain cover: 1 for about the first two and a half days, then 6. */
  hours: 1 | 6;
}

export interface VenueForecast {
  /** When MET answered (ISO). */
  fetched: string;
  /** MET's Expires and Last-Modified headers, as sent. */
  expires: string | null;
  lastModified: string | null;
  steps: ForecastStep[];
}

/** `compact` carries every field used here (air temperature, the symbol, rain) and is the lighter answer. */
const URL_BASE = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
export const MET_USER_AGENT = 'paddock-tracker.com https://github.com/paris-paraskevas/motorsport';
const HORIZON_MS = 10 * 86_400_000;

interface MetDetails { air_temperature?: number; precipitation_amount?: number }
interface MetBlock { summary?: { symbol_code?: string }; details?: MetDetails }
interface MetStep { time?: string; data?: { instant?: { details?: MetDetails }; next_1_hours?: MetBlock; next_6_hours?: MetBlock } }

/** The steps from now to ten days ahead, each with the one-hour block when MET gives it, else the six-hour one. */
export function parseLocationforecast(json: unknown, now: Date): ForecastStep[] {
  const series = (json as { properties?: { timeseries?: MetStep[] } } | null)?.properties?.timeseries;
  if (!Array.isArray(series)) return [];
  const from = now.getTime() - 3_600_000;
  const to = now.getTime() + HORIZON_MS;
  const out: ForecastStep[] = [];
  for (const s of series) {
    const at = Date.parse(s.time ?? '');
    const air = s.data?.instant?.details?.air_temperature;
    if (!Number.isFinite(at) || at < from || at > to || typeof air !== 'number') continue;
    const one = s.data?.next_1_hours;
    const block = one ?? s.data?.next_6_hours;
    const mm = block?.details?.precipitation_amount;
    out.push({ t: new Date(at).toISOString(), air: Math.round(air), symbol: block?.summary?.symbol_code ?? '', mm: typeof mm === 'number' ? mm : null, hours: one ? 1 : 6 });
  }
  return out;
}

/** The forecast for a session's start: the sky and the rain of the step whose hours hold it (one hour near, six further
 *  out), with the air of the step nearest to it, since a six-hour step's temperature is its first hour's. Null when no
 *  step with a sky or a rain figure holds the start: MET's last steps carry a temperature alone. */
export function stepFor(steps: readonly ForecastStep[], startIso: string): ForecastStep | null {
  const at = Date.parse(startIso);
  if (!Number.isFinite(at)) return null;
  const block = steps.find(s => {
    const from = Date.parse(s.t);
    return at >= from && at < from + s.hours * 3_600_000 && (s.symbol !== '' || s.mm !== null);
  });
  if (!block) return null;
  let near = block;
  for (const s of steps) if (Math.abs(Date.parse(s.t) - at) < Math.abs(Date.parse(near.t) - at)) near = s;
  return { ...block, air: near.air };
}

/** MET's symbol in words ("partlycloudy_day" → "Partly cloudy"). */
export function symbolLabel(symbol: string): string {
  const base = symbol.replace(/_(day|night|polartwilight)$/, '');
  const known: Record<string, string> = {
    clearsky: 'Clear', fair: 'Fair', partlycloudy: 'Partly cloudy', cloudy: 'Cloudy', fog: 'Fog',
    lightrainshowers: 'Light showers', rainshowers: 'Showers', heavyrainshowers: 'Heavy showers',
    lightrain: 'Light rain', rain: 'Rain', heavyrain: 'Heavy rain',
    lightrainshowersandthunder: 'Showers and thunder', rainshowersandthunder: 'Showers and thunder', heavyrainshowersandthunder: 'Thunderstorms',
    lightrainandthunder: 'Rain and thunder', rainandthunder: 'Rain and thunder', heavyrainandthunder: 'Thunderstorms',
    lightsleet: 'Light sleet', sleet: 'Sleet', heavysleet: 'Heavy sleet', lightsnow: 'Light snow', snow: 'Snow', heavysnow: 'Heavy snow',
  };
  return known[base] ?? (base ? base.charAt(0).toUpperCase() + base.slice(1) : '');
}

/** A kept forecast is used, without asking, for at least this long after MET answered, and for as long as its Expires
 *  allows when that is longer: the publisher runs every half hour, and a forecast a few hours old is still the
 *  forecast, while a new answer each run would mean a commit each run on the data branch. */
const KEEP_MS = 3 * 3_600_000;

/** What became of a request: kept without asking, not modified, a new answer, refused, or nothing usable. */
export type ForecastStatus = 'kept' | 'not modified' | 'new' | 'empty' | 'error' | `refused ${number}`;

/**
 * A circuit's forecast, from MET Norway or from what is kept. Kept within its time: kept, no request. Otherwise a
 * request with If-Modified-Since; a 304 keeps what was kept unchanged. A refusal (429, 403) holds the kept forecast
 * three hours longer, so MET is not asked again at once; any failure keeps what was kept (null when nothing was), so a
 * refused or broken answer never empties a page.
 */
export async function venueForecast(
  lat: number,
  lon: number,
  kept: VenueForecast | null,
  now: Date,
  fetcher: typeof fetch = fetch,
): Promise<{ value: VenueForecast | null; status: ForecastStatus }> {
  const t = now.getTime();
  if (kept && t < Math.max(Date.parse(kept.expires ?? '') || 0, Date.parse(kept.fetched) + KEEP_MS)) return { value: kept, status: 'kept' };
  const url = `${URL_BASE}?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;
  const headers: Record<string, string> = { 'User-Agent': MET_USER_AGENT, Accept: 'application/json' };
  if (kept?.lastModified) headers['If-Modified-Since'] = kept.lastModified;
  try {
    const res = await fetcher(url, { headers, signal: AbortSignal.timeout(20_000) });
    if (res.status === 304) return { value: kept, status: 'not modified' };
    if (res.status === 429 || res.status === 403) {
      return { value: kept ? { ...kept, expires: new Date(t + KEEP_MS).toUTCString() } : null, status: `refused ${res.status}` };
    }
    if (!res.ok) return { value: kept, status: 'error' };
    const steps = parseLocationforecast(await res.json(), now);
    if (!steps.length) return { value: kept, status: 'empty' };
    return { value: { fetched: now.toISOString(), expires: res.headers.get('expires'), lastModified: res.headers.get('last-modified'), steps }, status: 'new' };
  } catch {
    return { value: kept, status: 'error' };
  }
}
