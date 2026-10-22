import { describe, expect, it, vi } from 'vitest';
import { MET_USER_AGENT, parseLocationforecast, stepFor, symbolLabel, venueForecast, type VenueForecast } from './met-norway';

// Austin's forecast as MET Norway shaped it on 22 October 2026: hourly to the Saturday, then six-hour blocks.
const answer = {
  properties: {
    timeseries: [
      { time: '2026-10-23T17:00:00Z', data: { instant: { details: { air_temperature: 27.1 } }, next_1_hours: { summary: { symbol_code: 'partlycloudy_day' }, details: { precipitation_amount: 0 } }, next_6_hours: { summary: { symbol_code: 'clearsky_day' }, details: { precipitation_amount: 0 } } } },
      { time: '2026-10-23T18:00:00Z', data: { instant: { details: { air_temperature: 27.9 } }, next_1_hours: { summary: { symbol_code: 'partlycloudy_day' }, details: { precipitation_amount: 0.2 } } } },
      { time: '2026-10-25T18:00:00Z', data: { instant: { details: { air_temperature: 27 } }, next_6_hours: { summary: { symbol_code: 'partlycloudy_day' }, details: { precipitation_amount: 0 } } } },
      { time: '2026-11-05T18:00:00Z', data: { instant: { details: { air_temperature: 20 } }, next_6_hours: { summary: { symbol_code: 'cloudy' } } } },
      { time: '2026-10-24T00:00:00Z', data: { next_1_hours: { summary: { symbol_code: 'rain' } } } },
    ],
  },
};
const NOW = new Date('2026-10-22T09:00:00Z');

describe('parseLocationforecast', () => {
  it('keeps the steps of the next ten days with a temperature, each with its hourly block when there is one', () => {
    expect(parseLocationforecast(answer, NOW)).toEqual([
      { t: '2026-10-23T17:00:00.000Z', air: 27, symbol: 'partlycloudy_day', mm: 0, hours: 1 },
      { t: '2026-10-23T18:00:00.000Z', air: 28, symbol: 'partlycloudy_day', mm: 0.2, hours: 1 },
      { t: '2026-10-25T18:00:00.000Z', air: 27, symbol: 'partlycloudy_day', mm: 0, hours: 6 },
    ]);
  });

  it('gives nothing for an answer without a time series', () => {
    expect(parseLocationforecast({ error: 'x' }, NOW)).toEqual([]);
    expect(parseLocationforecast(null, NOW)).toEqual([]);
  });
});

describe('stepFor', () => {
  const steps = parseLocationforecast(answer, NOW);

  it('takes the step whose hours hold the start: an hour, or a six-hour block further out', () => {
    expect(stepFor(steps, '2026-10-23T17:30:00Z')?.t).toBe('2026-10-23T17:00:00.000Z');
    expect(stepFor(steps, '2026-10-25T20:00:00Z')?.t).toBe('2026-10-25T18:00:00.000Z');
  });

  it('gives nothing past the forecast or between steps it does not cover', () => {
    expect(stepFor(steps, '2026-10-24T05:00:00Z')).toBeNull();
    expect(stepFor(steps, 'not a time')).toBeNull();
  });
});

describe('symbolLabel', () => {
  it('names a symbol in words, whatever the time of day', () => {
    expect(symbolLabel('partlycloudy_day')).toBe('Partly cloudy');
    expect(symbolLabel('lightrainshowers_night')).toBe('Light showers');
    expect(symbolLabel('heavyrainandthunder')).toBe('Thunderstorms');
    expect(symbolLabel('dust')).toBe('Dust');
    expect(symbolLabel('')).toBe('');
  });
});

describe('venueForecast', () => {
  const kept: VenueForecast = { fetched: '2026-10-22T08:00:00.000Z', expires: 'Thu, 22 Oct 2026 08:30:00 GMT', lastModified: 'Thu, 22 Oct 2026 08:24:17 GMT', steps: parseLocationforecast(answer, NOW) };
  const reply = (status: number, body: unknown = answer, headers: Record<string, string> = {}) =>
    vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => new Response(status === 304 ? null : JSON.stringify(body), { status, headers }));

  it('asks nothing while the kept answer has not expired', async () => {
    const f = reply(200);
    const fresh = { ...kept, expires: 'Thu, 22 Oct 2026 09:30:00 GMT' };
    expect(await venueForecast(30.1328, -97.6411, fresh, NOW, f as unknown as typeof fetch)).toBe(fresh);
    expect(f).not.toHaveBeenCalled();
  });

  it('asks with its name, four decimals and If-Modified-Since, and keeps the steps on 304', async () => {
    const f = reply(304, null, { expires: 'Thu, 22 Oct 2026 09:40:00 GMT' });
    const got = await venueForecast(30.13281, -97.641149, kept, NOW, f as unknown as typeof fetch);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=30.1328&lon=-97.6411');
    expect((init?.headers as Record<string, string>)['User-Agent']).toBe(MET_USER_AGENT);
    expect((init?.headers as Record<string, string>)['If-Modified-Since']).toBe(kept.lastModified);
    expect(got).toEqual({ ...kept, expires: 'Thu, 22 Oct 2026 09:40:00 GMT' });
  });

  it('takes a new answer with its headers', async () => {
    const f = reply(200, answer, { expires: 'Thu, 22 Oct 2026 09:40:00 GMT', 'last-modified': 'Thu, 22 Oct 2026 09:10:00 GMT' });
    const got = await venueForecast(30.1328, -97.6411, null, NOW, f as unknown as typeof fetch);
    expect(got).toEqual({ fetched: NOW.toISOString(), expires: 'Thu, 22 Oct 2026 09:40:00 GMT', lastModified: 'Thu, 22 Oct 2026 09:10:00 GMT', steps: kept.steps });
  });

  it('keeps what it had when MET refuses, breaks or cannot be reached', async () => {
    expect(await venueForecast(1, 2, kept, NOW, reply(429) as unknown as typeof fetch)).toBe(kept);
    expect(await venueForecast(1, 2, kept, NOW, reply(200, { nothing: true }) as unknown as typeof fetch)).toBe(kept);
    const down = vi.fn(async () => { throw new Error('offline'); });
    expect(await venueForecast(1, 2, null, NOW, down as unknown as typeof fetch)).toBeNull();
  });
});
