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

  it('emits every field Search Console flagged as missing', () => {
    expect(ld['@type']).toBe('SportsEvent');
    expect(ld.description).toBeTruthy();
    // Stable absolute image (the brand logo) — the OG route URL is build-hashed
    // and not safe to hard-reference in structured data.
    expect(ld.image).toBe('https://paddock-tracker.com/icons/icon-512.png');
    expect((ld.organizer as Json).url).toBe('https://www.formula1.com');
    expect(ld.eventStatus).toBe('https://schema.org/EventScheduled');
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

  it('defaults performer to the series SportsOrganization when no roster', () => {
    const bare = asJson(
      sportsEventLd({
        weekend, series, slug: 'f1', round: 9, title: 't',
        startDate: new Date('2026-07-05'), endDate: new Date('2026-07-05'),
      }),
    );
    const loc = bare.location as Json;
    // Location stays name-only without a circuit match.
    expect(loc.name).toBe('Silverstone Circuit');
    expect(loc.address).toBeUndefined();
    expect(loc.geo).toBeUndefined();
    // performer is ALWAYS present now (GSC flagged its absence): the series org.
    const performer = bare.performer as Json[];
    expect(performer).toHaveLength(1);
    expect(performer[0]['@type']).toBe('SportsOrganization');
    expect(performer[0].name).toBe('Formula 1');
    // organizer.url falls back to the on-site series hub when no official site.
    const noSite = asJson(
      sportsEventLd({
        weekend,
        series: { ...series, meta: { ...series.meta, officialSite: undefined } },
        slug: 'f1', round: 9, title: 't',
        startDate: new Date('2026-07-05'), endDate: new Date('2026-07-05'),
      }),
    );
    expect((noSite.organizer as Json).url).toBe('https://paddock-tracker.com/series/f1');
  });

  it('emits a watch Offer only when a watch link exists (no fabricated price)', () => {
    const withWatch = asJson(
      sportsEventLd({
        weekend, series, slug: 'f1', round: 9, title: 't',
        startDate: new Date('2026-07-05'), endDate: new Date('2026-07-05'),
        watch: { service: 'F1 TV', url: 'https://f1tv.formula1.com' },
      }),
    );
    const offer = withWatch.offers as Json;
    expect(offer['@type']).toBe('Offer');
    expect(offer.url).toBe('https://f1tv.formula1.com');
    expect(offer.availability).toBe('https://schema.org/InStock');
    expect(offer.price).toBeUndefined();
    // Absent watch link → no offers key at all (clean skip).
    expect(ld.offers).toBeUndefined();
  });

  it('sets eventStatus to Cancelled / Rescheduled from the round flags', () => {
    const cancelled = asJson(
      sportsEventLd({
        weekend, series, slug: 'f1', round: 9, title: 't',
        startDate: new Date('2026-07-05'), endDate: new Date('2026-07-05'),
        cancelled: true,
      }),
    );
    expect(cancelled.eventStatus).toBe('https://schema.org/EventCancelled');
    const moved = asJson(
      sportsEventLd({
        weekend, series, slug: 'f1', round: 9, title: 't',
        startDate: new Date('2026-07-05'), endDate: new Date('2026-07-05'),
        previousStartDate: '2026-04-12',
      }),
    );
    expect(moved.eventStatus).toBe('https://schema.org/EventRescheduled');
    expect(moved.previousStartDate).toBe('2026-04-12T00:00:00+00:00');
  });

  it('carries the enrichment onto every sub-event so each validates', () => {
    const withSubs = asJson(
      sportsEventLd({
        weekend, series, slug: 'f1', round: 9, title: 'Formula 1 — British Grand Prix',
        startDate: new Date('2026-07-05T14:00:00Z'),
        endDate: new Date('2026-07-05T16:00:00Z'),
        organizerUrl: 'https://www.formula1.com',
        addressCountry: 'GB',
        geo: { lat: 52.0786, lon: -1.0169 },
        watch: { service: 'F1 TV', url: 'https://f1tv.formula1.com' },
        subEvents: [{
          name: 'Race',
          startDate: new Date('2026-07-05T14:00:00Z'),
          endDate: new Date('2026-07-05T16:00:00Z'),
          url: 'https://paddock-tracker.com/series/f1/weekend/9/race',
        }],
      }),
    );
    const sub = (withSubs.subEvent as Json[])[0];
    expect(sub['@type']).toBe('SportsEvent');
    expect(sub.description).toBeTruthy();
    expect(sub.image).toBeTruthy();
    expect(sub.eventStatus).toBe('https://schema.org/EventScheduled');
    expect((sub.organizer as Json).url).toBe('https://www.formula1.com');
    expect((sub.performer as Json[])[0]['@type']).toBe('SportsOrganization');
    expect((sub.location as Json).address).toBeTruthy();
    expect((sub.offers as Json).url).toBe('https://f1tv.formula1.com');
  });
});
