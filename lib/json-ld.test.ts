import { describe, it, expect } from 'vitest';
import { qaPageLd, sportsEventLd } from './json-ld';
import type { Series, Weekend } from './types';

// JSON-LD builders emit `object`; round-trip through JSON to assert on the
// actual serialized shape (this is what ships in the page <head>).
type Json = { [k: string]: unknown };
const asJson = (o: object): Json => JSON.parse(JSON.stringify(o)) as Json;

describe('qaPageLd', () => {
  const ld = asJson(
    qaPageLd({
      question: 'Who won the 2025 F1 title?',
      answerText: 'Lando Norris.',
      url: 'https://paddock-tracker.com/information/general/q',
      dateModified: '2026-07-07',
    }),
  );
  const q = ld.mainEntity as Json;
  const answer = q.acceptedAnswer as Json;

  it('is a QAPage wrapping a Question', () => {
    expect(ld['@type']).toBe('QAPage');
    expect(q['@type']).toBe('Question');
  });

  it('populates every field Search Console flagged as missing', () => {
    // critical
    expect(q.answerCount).toBe(1);
    // question recommended
    expect(q.text).toBeTruthy();
    expect((q.author as Json)['@type']).toBe('Person');
    expect(q.datePublished).toBe('2026-07-07T00:00:00+00:00');
    // answer recommended
    expect(answer.text).toBe('Lando Norris.');
    expect(answer.upvoteCount).toBe(0);
    expect((answer.author as Json)['@type']).toBe('Person');
    expect(answer.datePublished).toBe('2026-07-07T00:00:00+00:00');
  });

  it('normalises a bare date to a timezoned datetime', () => {
    expect(String(q.dateModified)).toBe('2026-07-07T00:00:00+00:00');
  });

  it('stays valid (answerCount present) when no date is supplied', () => {
    const q2 = (asJson(qaPageLd({ question: 'Q', answerText: 'A', url: 'u' })).mainEntity) as Json;
    expect(q2.answerCount).toBe(1);
    expect(q2.dateModified).toBeUndefined();
  });
});

describe('sportsEventLd', () => {
  const series: Series = {
    meta: {
      slug: 'f1', name: 'Formula 1', color: '#e10600', icsUrl: '',
      season: 2026, category: 'formula', officialSite: 'https://www.formula1.com',
    },
    sessions: [], overview: '', drivers: '', significance: '',
    fetchedAt: new Date('2026-01-01'), stale: false, configured: true,
  };
  const weekend: Weekend = {
    key: 'r9', dateRangeLabel: '4-6 Jul 2026',
    sessions: [{
      uid: 's1', seriesSlug: 'f1', title: 'Race',
      start: new Date('2026-07-05T14:00:00Z'), end: new Date('2026-07-05T16:00:00Z'),
      location: 'Silverstone Circuit',
    }],
    isPast: true, round: 9, roundName: 'British Grand Prix',
  };

  const ld = asJson(
    sportsEventLd({
      weekend, series, slug: 'f1', round: 9,
      title: 'Formula 1 — British Grand Prix',
      startDate: new Date('2026-07-05T14:00:00Z'),
      endDate: new Date('2026-07-05T16:00:00Z'),
      description: 'Round 9 of the 2026 Formula 1 season — the British Grand Prix at Silverstone Circuit.',
      organizerUrl: 'https://www.formula1.com',
      performers: ['Mercedes', 'Ferrari'],
      addressCountry: 'GB',
      geo: { lat: 52.0786, lon: -1.0169 },
    }),
  );

  it('emits the recommended enhancement fields', () => {
    expect(ld['@type']).toBe('SportsEvent');
    expect(ld.description).toBeTruthy();
    expect(ld.image).toBeTruthy();
    expect((ld.organizer as Json).url).toBe('https://www.formula1.com');
    const performer = ld.performer as Json[];
    expect(performer).toHaveLength(2);
    expect(performer[0]['@type']).toBe('SportsTeam');
  });

  it('enriches the location with address + geo when a circuit matched', () => {
    const loc = ld.location as Json;
    expect(loc['@type']).toBe('Place');
    expect((loc.address as Json).addressCountry).toBe('GB');
    expect((loc.geo as Json).latitude).toBe(52.0786);
  });

  it('keeps location name-only (no address/geo/performer) without extras', () => {
    const bare = asJson(
      sportsEventLd({
        weekend, series, slug: 'f1', round: 9, title: 't',
        startDate: new Date('2026-07-05'), endDate: new Date('2026-07-05'),
      }),
    );
    const loc = bare.location as Json;
    expect(loc.name).toBe('Silverstone Circuit');
    expect(loc.address).toBeUndefined();
    expect(loc.geo).toBeUndefined();
    expect(bare.performer).toBeUndefined();
  });
});
