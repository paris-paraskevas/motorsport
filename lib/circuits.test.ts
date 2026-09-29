import { describe, it, expect } from 'vitest';
import { loadCircuits, matchCircuitEntry, venueCandidates } from './circuits';

// The case these exist for: the 2026 "Formula 1 Gulf Air Bahrain Grand Prix" runs
// at Sepang International Circuit in Malaysia (formula1.com, 2-4 October 2026).
// The event NAME therefore identifies the wrong country, and the F1 feed publishes
// LOCATION: "" for it, so name-based resolution lands on Sakhir — wrong weather,
// wrong map, wrong coordinates, and a timezone three hours out.
describe('venueCandidates', () => {
  it('uses a curated venue ALONE, ignoring the misleading round name', () => {
    expect(
      venueCandidates({
        venue: 'Sepang International Circuit',
        location: '',
        title: 'Bahrain Grand Prix',
      }),
    ).toEqual(['Sepang International Circuit']);
  });

  it('falls back to session location then title when no venue is curated', () => {
    expect(venueCandidates({ location: 'Hungaroring', title: 'Hungarian Grand Prix' })).toEqual([
      'Hungaroring',
      'Hungarian Grand Prix',
    ]);
  });

  it('still yields the title when the feed publishes no location', () => {
    expect(venueCandidates({ location: undefined, title: 'Belgian Grand Prix' })).toEqual([
      undefined,
      'Belgian Grand Prix',
    ]);
  });
});

describe('matchCircuitEntry with a venue override', () => {
  it('resolves the curated venue to Sepang', async () => {
    const match = await matchCircuitEntry(
      ...venueCandidates({ venue: 'Sepang International Circuit', title: 'Bahrain Grand Prix' }),
    );
    expect(match?.slug).toBe('sepang');
    expect(match?.circuit.countryCode).toBe('MY');
  });

  // Documents WHY the override cannot simply be one candidate among several:
  // matchCircuitEntry returns the longest alias found in ANY candidate, so
  // candidate order carries no priority and the round name would still be live.
  it('resolves the same title to Bahrain when no venue is curated', async () => {
    const match = await matchCircuitEntry(...venueCandidates({ title: 'Bahrain Grand Prix' }));
    expect(match?.circuit.countryCode).toBe('BH');
  });
});

// P2.8, the Countdown's time at the track: every circuit carries an IANA zone
// the runtime knows (scripts/fetch-circuit-timezones.mts wrote them from
// Open-Meteo's timezone=auto answer for the circuit's coordinates). A wrong or
// unknown zone would draw a wrong local time, which is worse than none.
describe('the circuits’ time zones', () => {
  it('names a zone the runtime knows on every circuit', async () => {
    const circuits = await loadCircuits();
    // A zone the runtime can format in: supportedValuesOf lists the canonical names alone and leaves out links such as
    // America/Indiana/Indianapolis, which the formatter accepts all the same.
    const knows = (tz: string): boolean => {
      try {
        new Intl.DateTimeFormat('en-GB', { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    };
    const entries = Object.entries(circuits);
    expect(entries.length).toBeGreaterThan(90);
    for (const [slug, c] of entries) {
      expect(typeof c.tz, slug).toBe('string');
      expect(knows(c.tz!), `${slug}: ${c.tz}`).toBe(true);
    }
    expect(knows('Not/AZone')).toBe(false);
    expect(circuits.bahrain?.tz).toBe('Asia/Bahrain');
    expect(circuits.sepang?.tz).toBe('Asia/Kuala_Lumpur');
    expect(circuits.baku?.tz).toBe('Asia/Baku');
  });
});
