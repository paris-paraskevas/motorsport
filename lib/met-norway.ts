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

const URL_BASE = 'https://api.met.no/weatherapi/locationforecast/2.0/complete';
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

/** The step a session starts in: the one whose hours hold its start; null when the forecast does not reach it. */
export function stepFor(steps: readonly ForecastStep[], startIso: string): ForecastStep | null {
  const at = Date.parse(startIso);
  if (!Number.isFinite(at)) return null;
  for (const s of steps) {
    const from = Date.parse(s.t);
    if (at >= from && at < from + s.hours * 3_600_000) return s;
  }
  return null;
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

/**
 * A circuit's forecast, from MET Norway or from what is kept. Kept and not yet expired: kept, no request. Otherwise a
 * request with If-Modified-Since; 304 keeps the steps (re-trimmed to now) with the new Expires. Any failure keeps what
 * was kept (null when nothing was), so a refused or broken answer never empties a page.
 */
export async function venueForecast(
  lat: number,
  lon: number,
  kept: VenueForecast | null,
  now: Date,
  fetcher: typeof fetch = fetch,
): Promise<VenueForecast | null> {
  if (kept?.expires && Date.parse(kept.expires) > now.getTime()) return kept;
  const url = `${URL_BASE}?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;
  const headers: Record<string, string> = { 'User-Agent': MET_USER_AGENT, Accept: 'application/json' };
  if (kept?.lastModified) headers['If-Modified-Since'] = kept.lastModified;
  try {
    const res = await fetcher(url, { headers, signal: AbortSignal.timeout(20_000) });
    const expires = res.headers.get('expires');
    const lastModified = res.headers.get('last-modified');
    if (res.status === 304 && kept) {
      const from = now.getTime() - 3_600_000;
      return { ...kept, expires, steps: kept.steps.filter(s => Date.parse(s.t) >= from) };
    }
    if (!res.ok) return kept;
    const steps = parseLocationforecast(await res.json(), now);
    return steps.length ? { fetched: now.toISOString(), expires, lastModified, steps } : kept;
  } catch {
    return kept;
  }
}
