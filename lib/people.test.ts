import { describe, it, expect } from 'vitest';
import { disambiguateDriverSlugs, type DriverDetail } from './people';

function d(slug: string, seriesSlug: string): DriverDetail {
  return {
    slug,
    name: slug,
    team: 't',
    teamSlug: 't',
    seriesSlug,
    seriesName: seriesSlug,
    seriesColor: '#000',
  };
}

describe('disambiguateDriverSlugs', () => {
  it('gives F1 the bare slug and suffixes colliding entries by series token', () => {
    // Max Verstappen races F1, the ADAC Ravenol 24h and NLS.
    const out = disambiguateDriverSlugs([
      d('max-verstappen', 'adac-ravenol-24h'),
      d('max-verstappen', 'f1'),
      d('max-verstappen', 'nls'),
    ]);
    const bySeries = Object.fromEntries(out.map(x => [x.seriesSlug, x.slug]));
    expect(bySeries['f1']).toBe('max-verstappen');
    expect(bySeries['adac-ravenol-24h']).toBe('max-verstappen-24h');
    expect(bySeries['nls']).toBe('max-verstappen-nls');
  });

  it('leaves non-colliding slugs untouched', () => {
    const out = disambiguateDriverSlugs([
      d('lando-norris', 'f1'),
      d('charles-leclerc', 'f1'),
    ]);
    expect(out.map(x => x.slug)).toEqual(['lando-norris', 'charles-leclerc']);
  });

  it('breaks non-F1 collisions by listing order (first seen keeps the base slug)', () => {
    const out = disambiguateDriverSlugs([
      d('john-doe', 'f2'),
      d('john-doe', 'f3'),
    ]);
    const bySeries = Object.fromEntries(out.map(x => [x.seriesSlug, x.slug]));
    expect(bySeries['f2']).toBe('john-doe');
    expect(bySeries['f3']).toBe('john-doe-f3');
  });
});
