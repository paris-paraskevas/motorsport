import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildEventResultsUrl,
  parseEventResultsHtml,
  fetchGtWorldRaceResult,
  fetchGtWorldSeasonResults,
  parseEventListingHtml,
  parseEventRaceOptions,
  roundForGtWorldEvent,
} from './gt-world';

describe('roundForGtWorldEvent', () => {
  it('maps SRO venue-style event names to canonical rounds via the curated substring map', () => {
    // Live parser names observed 2026-06-13.
    expect(roundForGtWorldEvent('Circuit Paul Ricard')).toBe(1);
    expect(roundForGtWorldEvent('Brands Hatch')).toBe(2);
    expect(roundForGtWorldEvent('Monza')).toBe(3);
    // Accent-bearing venues match on unambiguous fragments.
    expect(roundForGtWorldEvent('Nürburgring')).toBe(7);
    expect(roundForGtWorldEvent('Circuito de Barcelona-Catalunya')).toBe(9);
  });

  it('returns undefined for unmapped events (rows render unlinked)', () => {
    expect(roundForGtWorldEvent('Some Exhibition Event')).toBeUndefined();
  });
});

function entryRow(opts: {
  pos: number;
  car: string;
  cup: string;
  drivers: string;
  team: string;
  carModel: string;
  time?: string;
  laps?: string;
  gap?: string;
}): string {
  return `
    <tr>
      <td>${opts.pos}</td>
      <td>${opts.car}</td>
      <td>${opts.cup}</td>
      <td>${opts.drivers}</td>
      <td>${opts.team}</td>
      <td>${opts.carModel}</td>
      <td>${opts.time ?? ''}</td>
      <td>${opts.laps ?? ''}</td>
      <td>${opts.gap ?? ''}</td>
    </tr>
  `;
}

const PAUL_RICARD_MAIN_RACE_HTML = `
<!DOCTYPE html>
<html><head><title>Race Results 2026 | Circuit Paul Ricard | Main Race | GT World Challenge Europe powered by AWS Endurance Cup | France | GT World Challenge Europe Powered by AWS</title></head>
<body>
<h1>2026 Results</h1>
<h2>Main Race
\t\tCircuit Paul Ricard
\t\t2026 Results</h2>
<table class="table session">
  <tbody>
    <tr><td>Pos</td><td>Car #</td><td>Class</td><td>Drivers</td><td>Team</td><td>Car</td><td>Time</td><td>Laps</td><td>Gap</td></tr>
    ${entryRow({
      pos: 1,
      car: '7',
      cup: 'Pro Cup',
      drivers: 'Mattia Drudi, Marco Sorensen, Nicki Thiim',
      team: 'Comtoyou Racing',
      carModel: 'Aston Martin Vantage AMR GT3 EVO',
      time: '1:54.737',
      laps: '176',
      gap: '',
    })}
    ${entryRow({
      pos: 2,
      car: '48',
      cup: 'Pro Cup',
      drivers: 'Lucas Auer, Luca Stolz, Maro Engel',
      team: 'Mercedes-AMG Team MANN-FILTER',
      carModel: 'Mercedes-AMG GT3 EVO',
      time: '1:55.063',
      laps: '176',
      gap: '0.806',
    })}
    ${entryRow({
      pos: 3,
      car: '58',
      cup: 'Gold Cup',
      drivers: 'Thomas Fleming, Louis Prette, Benjamin Goethe',
      team: 'Garage 59',
      carModel: 'McLaren 720S GT3 EVO',
      time: '1:54.817',
      laps: '176',
      gap: '4.447',
    })}
    ${entryRow({
      pos: 4,
      car: '32',
      cup: 'Pro Cup',
      drivers: 'Kelvin van der Linde, Jordan Pepper, Charles Weerts',
      team: 'Team WRT',
      carModel: 'BMW M4 GT3 EVO',
      time: '1:55.324',
      laps: '176',
      gap: '10.776',
    })}
    ${entryRow({
      pos: 5,
      car: '93',
      cup: 'Silver Cup',
      drivers: 'Ryuichiro Tomita, Charles Clark, Tom Kalender',
      team: 'Sky-Tempesta Racing',
      carModel: 'Ferrari 296 GT3',
      time: '1:55.901',
      laps: '175',
      gap: '1 Lap',
    })}
    ${entryRow({
      pos: 6,
      car: '54',
      cup: 'Bronze Cup',
      drivers: 'Eddie Cheever, Chris Lulham, Conrad Laursen',
      team: 'AF Corse',
      carModel: 'Ferrari 296 GT3',
      time: '1:56.022',
      laps: '174',
      gap: '2 Laps',
    })}
  </tbody>
</table>
</body></html>
`;

const BRANDS_HATCH_R1_HTML = `
<!DOCTYPE html>
<html><head><title>Race Results 2026 | Brands Hatch | Race 1 | GT World Challenge Europe powered by AWS Sprint Cup | UK | GT World Challenge Europe Powered by AWS</title></head>
<body>
<h2>Race 1
\t\tBrands Hatch
\t\t2026 Results</h2>
<table class="table session">
  <tbody>
    <tr><td>Pos</td><td>Car #</td><td>Class</td><td>Drivers</td><td>Team</td><td>Car</td><td>Time</td><td>Laps</td><td>Gap</td></tr>
    ${entryRow({
      pos: 1,
      car: '4',
      cup: 'Pro Cup',
      drivers: 'Maxime Martin, Nicki Thiim',
      team: 'Comtoyou Racing',
      carModel: 'Aston Martin Vantage AMR GT3 EVO',
      time: '1:25.123',
      laps: '40',
      gap: '',
    })}
    ${entryRow({
      pos: 2,
      car: '46',
      cup: 'Pro Cup',
      drivers: 'Valentino Rossi, Maxime Martin',
      team: 'Team WRT',
      carModel: 'BMW M4 GT3 EVO',
      time: '1:25.456',
      laps: '40',
      gap: '2.412',
    })}
    ${entryRow({
      pos: 3,
      car: '88',
      cup: 'Gold Cup',
      drivers: 'Jules Gounon, Maro Engel',
      team: 'AKKodis ASP Team',
      carModel: 'Mercedes-AMG GT3 EVO',
      time: '1:25.789',
      laps: '40',
      gap: '4.123',
    })}
    ${entryRow({
      pos: 4,
      car: '69',
      cup: 'Silver Cup',
      drivers: 'Lorenzo Patrese, Adam Smalley',
      team: 'Boutsen VDS',
      carModel: 'Audi R8 LMS Evo II',
      time: '1:26.001',
      laps: '40',
      gap: '8.567',
    })}
    ${entryRow({
      pos: 5,
      car: '15',
      cup: 'Bronze Cup',
      drivers: 'David Schumacher, Jens Klingmann',
      team: 'BMW Junior Team',
      carModel: 'BMW M4 GT3 EVO',
      time: '1:26.234',
      laps: '40',
      gap: '12.345',
    })}
    ${entryRow({
      pos: 6,
      car: '7',
      cup: 'Pro Cup',
      drivers: 'Mattia Drudi, Marco Sorensen',
      team: 'Comtoyou Racing',
      carModel: 'Aston Martin Vantage AMR GT3 EVO',
      time: '1:25.678',
      laps: '40',
      gap: '15.890',
    })}
  </tbody>
</table>
</body></html>
`;

const PARTIAL_HTML = `
<html><head><title>Race Results | Some Race | GT World Challenge Europe Powered by AWS</title></head>
<body>
<h2>Test Race
Track
2026 Results</h2>
<table>
  <tbody>
    <tr><td>Pos</td><td>Car #</td><td>Class</td><td>Drivers</td><td>Team</td><td>Car</td><td>Time</td><td>Laps</td><td>Gap</td></tr>
    ${entryRow({ pos: 1, car: '1', cup: 'Pro Cup', drivers: 'A B', team: 'X', carModel: 'C', time: '1', laps: '1' })}
    ${entryRow({ pos: 2, car: '2', cup: 'Pro Cup', drivers: 'C D', team: 'Y', carModel: 'D', time: '2', laps: '1' })}
  </tbody>
</table></body></html>
`;

const NO_TABLE_HTML = `<html><head><title>x</title></head><body><h2>x</h2></body></html>`;

describe('buildEventResultsUrl', () => {
  it('encodes the slug and embeds the race id', () => {
    expect(
      buildEventResultsUrl({
        year: 2026,
        eventSlug: 'circuit-paul-ricard',
        raceId: 1749,
      }),
    ).toBe(
      'https://www.gt-world-challenge-europe.com/results/2026/circuit-paul-ricard?filter_race_id=1749',
    );
    expect(
      buildEventResultsUrl({
        year: 2026,
        eventSlug: 'nürburgring',
        raceId: 2000,
      }),
    ).toContain('n%C3%BCrburgring');
  });
});

describe('parseEventResultsHtml', () => {
  it('parses a full Endurance Cup main race into typed entries', () => {
    const r = parseEventResultsHtml({
      html: PAUL_RICARD_MAIN_RACE_HTML,
      raceId: 1749,
      eventSlug: 'circuit-paul-ricard',
    });
    expect(r).not.toBeNull();
    expect(r!.raceName).toBe('Main Race');
    expect(r!.eventName).toBe('Circuit Paul Ricard');
    expect(r!.championship).toBe('endurance');
    expect(r!.entries).toHaveLength(6);
    expect(r!.entries[0]).toEqual({
      position: 1,
      carNumber: '7',
      cup: 'pro',
      cupLabel: 'Pro Cup',
      drivers: ['Mattia Drudi', 'Marco Sorensen', 'Nicki Thiim'],
      team: 'Comtoyou Racing',
      car: 'Aston Martin Vantage AMR GT3 EVO',
      time: '1:54.737',
      laps: 176,
      gap: undefined,
    });
    expect(r!.entries[2].cup).toBe('gold');
    expect(r!.entries[4].cup).toBe('silver');
    expect(r!.entries[5].cup).toBe('bronze');
  });

  it('detects a Sprint Cup race from the page title', () => {
    const r = parseEventResultsHtml({
      html: BRANDS_HATCH_R1_HTML,
      raceId: 1800,
      eventSlug: 'brands-hatch',
    });
    expect(r).not.toBeNull();
    expect(r!.championship).toBe('sprint');
    expect(r!.eventName).toBe('Brands Hatch');
    expect(r!.entries).toHaveLength(6);
    // Sprint races have 2-driver crews — verify the comma split handles 2 names.
    expect(r!.entries[0].drivers).toHaveLength(2);
    expect(r!.entries[0].drivers[0]).toBe('Maxime Martin');
  });

  it('returns null when too few entries (sanity floor)', () => {
    const r = parseEventResultsHtml({
      html: PARTIAL_HTML,
      raceId: 1,
      eventSlug: 'x',
    });
    expect(r).toBeNull();
  });

  it('returns null when no results table present', () => {
    const r = parseEventResultsHtml({
      html: NO_TABLE_HTML,
      raceId: 1,
      eventSlug: 'x',
    });
    expect(r).toBeNull();
  });

  it('sorts entries by position even if HTML emits them out of order', () => {
    const reversed = PAUL_RICARD_MAIN_RACE_HTML
      .split('<tbody>')
      .map((part, i) => {
        if (i === 0) return part;
        // Reverse the row order inside tbody (keeping the header row at top).
        const [tbodyInner, ...rest] = part.split('</tbody>');
        const lines = tbodyInner.split('</tr>').filter(s => s.trim().length > 0);
        const reversedRows = [lines[0], ...lines.slice(1).reverse()].join('</tr>') + '</tr>';
        return reversedRows + '</tbody>' + rest.join('</tbody>');
      })
      .join('<tbody>');
    const r = parseEventResultsHtml({
      html: reversed,
      raceId: 1749,
      eventSlug: 'circuit-paul-ricard',
    });
    expect(r).not.toBeNull();
    expect(r!.entries.map(e => e.position)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('fetchGtWorldRaceResult', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('parses the race result on a 200 OK response', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => PAUL_RICARD_MAIN_RACE_HTML,
    })) as unknown as typeof fetch;
    const r = await fetchGtWorldRaceResult({
      year: 2026,
      eventSlug: 'circuit-paul-ricard',
      raceId: 1749,
    });
    expect(r).not.toBeNull();
    expect(r!.entries[0].team).toBe('Comtoyou Racing');
  });

  it('returns null on a 500', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => '',
    })) as unknown as typeof fetch;
    const r = await fetchGtWorldRaceResult({
      year: 2026,
      eventSlug: 'circuit-paul-ricard',
      raceId: 1749,
    });
    expect(r).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const r = await fetchGtWorldRaceResult({
      year: 2026,
      eventSlug: 'circuit-paul-ricard',
      raceId: 1749,
    });
    expect(r).toBeNull();
  });
});

describe('parseEventListingHtml', () => {
  const LISTING_HTML = `
    <html><body>
    <select id="filter_meeting_id">
      <option value="0">Meeting</option>
      <option value="246">Circuit Paul Ricard</option>
      <option value="247">Brands Hatch</option>
      <option value="248">Monza</option>
      <option value="249">CrowdStrike 24 Hours of Spa</option>
      <option value="250">Misano</option>
    </select>
    <main>
      <a href="/results/2026/official-test-days">Circuit Paul Ricard</a>
      <a href="/results/2026/circuit-paul-ricard">Circuit Paul Ricard</a>
      <a href="/results/2026/brands-hatch">Brands Hatch</a>
      <a href="/results/2026/crowdstrike-24-hours-of-spa--test-days">CrowdStrike 24 Hours of Spa</a>
      <a href="/results/2026/monza">Monza</a>
      <a href="/results/2026/crowdstrike-24-hours-of-spa">CrowdStrike 24 Hours of Spa</a>
      <a href="/results/2026/misano">Misano</a>
    </main>
    </body></html>
  `;

  it('returns the non-test-days event slugs with their meeting IDs', () => {
    const events = parseEventListingHtml(LISTING_HTML, 2026);
    expect(events.map(e => e.eventSlug)).toEqual([
      'circuit-paul-ricard',
      'brands-hatch',
      'monza',
      'crowdstrike-24-hours-of-spa',
      'misano',
    ]);
    expect(events[0].meetingId).toBe(246);
    expect(events[3].meetingId).toBe(249);
  });
});

describe('parseEventRaceOptions', () => {
  const EVENT_HTML = `
    <html><body>
    <select id="filter_race_id">
      <option value="">Session</option>
      <option value="1749">Main Race</option>
      <option value="1828">Qualifying Combined</option>
      <option value="1827">Qualifying 3</option>
      <option value="1826">Qualifying 2</option>
      <option value="1748">Qualifying 1</option>
      <option value="1825">Free Practice 2</option>
      <option value="1747">Free Practice 1</option>
      <option value="1746">Bronze Test</option>
      <option value="1834">Main Race after 5.30 hours</option>
      <option value="1833">Main race after 4.30 hours</option>
    </select>
    </body></html>
  `;

  it('keeps only FINAL race classifications, drops practice / qualifying / bronze test / hourly checkpoints', () => {
    // The 0.12.13 dispatch tightened the race-name regex to reject
    // intermediate hourly checkpoints — Paul Ricard 1000km's "Main Race
    // after 5.30 hours" / "after 4.30 hours" snapshots are NOT standalone
    // races, they're SRO timing checkpoints whose final values fold into
    // "Main Race".
    const options = parseEventRaceOptions(EVENT_HTML);
    const names = options.map(o => o.raceName);
    expect(names).toContain('Main Race');
    expect(names).not.toContain('Main Race after 5.30 hours');
    expect(names).not.toContain('Main race after 4.30 hours');
    expect(names).not.toContain('Qualifying 1');
    expect(names).not.toContain('Free Practice 1');
    expect(names).not.toContain('Bronze Test');
  });
});

describe('fetchGtWorldSeasonResults', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('drops failed races but returns successful ones', async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes('circuit-paul-ricard')) {
        return {
          ok: true,
          status: 200,
          text: async () => PAUL_RICARD_MAIN_RACE_HTML,
        } as Response;
      }
      if (url.includes('brands-hatch')) {
        return {
          ok: true,
          status: 200,
          text: async () => BRANDS_HATCH_R1_HTML,
        } as Response;
      }
      // any other URL -> 500
      return { ok: false, status: 500, text: async () => '' } as Response;
    }) as unknown as typeof fetch;

    const results = await fetchGtWorldSeasonResults(2026, [
      { year: 2026, eventSlug: 'circuit-paul-ricard', raceId: 1749 },
      { year: 2026, eventSlug: 'brands-hatch', raceId: 1800 },
      { year: 2026, eventSlug: 'monza', raceId: 1900 },
    ]);
    expect(results).toHaveLength(2);
    expect(results.map(r => r.eventSlug)).toEqual([
      'circuit-paul-ricard',
      'brands-hatch',
    ]);
  });

  it('returns an empty array when no races are given', async () => {
    const results = await fetchGtWorldSeasonResults(2026, []);
    expect(results).toEqual([]);
  });
});

// Real-fixture coverage layered on top of the synthetic-HTML tests above.
// Captured 2026-05-22 from gt-world-challenge-europe.com. Per the Phase 2
// real-bytes-only rule, these guard against schema drift that synthetic
// rows would miss (e.g. the per-event cup distribution, name encoding).
describe('GT-World — real captured 2026 fixtures', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readFileSync } = require('node:fs') as typeof import('node:fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('node:path') as typeof import('node:path');
  const FIXTURE_DIR = path.join(process.cwd(), 'tests', 'fixtures');
  const loadFixture = (name: string) =>
    readFileSync(path.join(FIXTURE_DIR, name), 'utf8');

  it('parses the season listing — 10 events for 2026', () => {
    const events = parseEventListingHtml(
      loadFixture('gtw-results-listing-2026.html'),
      2026,
    );
    expect(events).toHaveLength(10);
    const slugs = events.map(e => e.eventSlug);
    expect(slugs).toContain('circuit-paul-ricard');
    expect(slugs).toContain('crowdstrike-24-hours-of-spa');
    expect(slugs).toContain('nürburgring');
  });

  it('parses Paul Ricard event page — 1 final race (intermediate hourly checkpoints filtered)', () => {
    // Paul Ricard 1000km exposes 7 race options on the source page (1
    // final "Main Race" + 6 intermediate "Main Race after N.NN hours"
    // checkpoints). Per the tightened RACE_NAME_PATTERN, only the final
    // race promotes — checkpoint snapshots are not standalone race
    // results.
    const opts = parseEventRaceOptions(
      loadFixture('gtw-event-paulricard-2026.html'),
    );
    expect(opts).toHaveLength(1);
    expect(opts[0].raceName).toBe('Main Race');
    expect(opts[0].raceId).toBe(1749);
  });

  it('parses Brands Hatch event page — Race 1 + Race 2', () => {
    const opts = parseEventRaceOptions(
      loadFixture('gtw-event-brandshatch-2026.html'),
    );
    expect(opts).toHaveLength(2);
    expect(opts.map(o => o.raceName).sort()).toEqual(['Race 1', 'Race 2']);
  });

  it('parses Paul Ricard 1000km Main Race — 49 entries across 4 cups, endurance championship', () => {
    const result = parseEventResultsHtml({
      html: loadFixture('gtw-race-paulricard-main-2026.html'),
      raceId: 1749,
      eventSlug: 'circuit-paul-ricard',
    });
    expect(result).not.toBeNull();
    expect(result!.championship).toBe('endurance');
    expect(result!.eventName).toBe('Circuit Paul Ricard');
    expect(result!.raceName).toBe('Main Race');
    expect(result!.entries).toHaveLength(49);

    const p1 = result!.entries[0];
    expect(p1.position).toBe(1);
    expect(p1.carNumber).toBe('7');
    expect(p1.cup).toBe('pro');
    expect(p1.team).toBe('Comtoyou Racing');
    expect(p1.drivers).toEqual([
      'Mattia Drudi',
      'Marco Sorensen',
      'Nicki Thiim',
    ]);

    const cupSet = new Set(result!.entries.map(e => e.cup));
    expect(cupSet).toEqual(new Set(['pro', 'gold', 'silver', 'bronze']));
  });

  it('parses Brands Hatch Race 1 — sprint championship, no Bronze entries', () => {
    const result = parseEventResultsHtml({
      html: loadFixture('gtw-race-brandshatch-r1-2026.html'),
      raceId: 1755,
      eventSlug: 'brands-hatch',
    });
    expect(result).not.toBeNull();
    expect(result!.championship).toBe('sprint');
    expect(result!.entries).toHaveLength(31);

    const p1 = result!.entries[0];
    expect(p1.carNumber).toBe('50');
    expect(p1.team).toBe('AF Corse');
    expect(p1.drivers).toEqual(['Arthur Leclerc', 'Thomas Neubauer']);

    // Brands Hatch is the round Bronze Cup entries skip per the SRO
    // 2026 schedule.
    const cupSet = new Set(result!.entries.map(e => e.cup));
    expect(cupSet).not.toContain('bronze');
  });
});
