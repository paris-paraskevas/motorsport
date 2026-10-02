import { describe, it, expect } from 'vitest';
import { buildPeopleIndex, disambiguateDriverSlugs, findDriverBySlug, findTeamBySlug, loadAllDrivers, peopleIndex, type DriverDetail, type TeamDetail } from './people';

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

// P2.4 PR B: the page a standings or results row links to, from the rosters the pages resolve (never a typed pattern).
describe('the people index', () => {
  const driver = (name: string, seriesSlug: string, slug = name.toLowerCase().replace(/\s+/g, '-')): DriverDetail => ({ slug, name, team: 't', teamSlug: 't', seriesSlug, seriesName: seriesSlug, seriesColor: '#000' });
  const team = (name: string, seriesSlug: string): TeamDetail => ({ slug: name.toLowerCase().replace(/\s+/g, '-'), name, seriesSlug, seriesName: seriesSlug, seriesColor: '#000', drivers: [] });

  it('answers a driver’s page by the site’s drift rule and the roster’s own slug, per series: one match or none', () => {
    const index = buildPeopleIndex(
      [driver('Kimi Antonelli', 'f1'), driver('Max Verstappen', 'f1'), driver('Max Verstappen', 'adac-ravenol-24h', 'max-verstappen-24h'), driver('Mick Schumacher', 'wec'), driver('Ralf Schumacher', 'wec')],
      [],
    );
    // The feeds say "Andrea Kimi Antonelli", the roster "Kimi Antonelli" (lib/slug.ts namesMatch).
    expect(index.driver('f1', 'Andrea Kimi Antonelli')).toBe('/drivers/kimi-antonelli');
    expect(index.driver('f1', 'Max Verstappen')).toBe('/drivers/max-verstappen');
    expect(index.driver('adac-ravenol-24h', 'Max Verstappen')).toBe('/drivers/max-verstappen-24h');
    expect(index.driver('f1', 'Lando Norris')).toBeNull();
    expect(index.driver('f2', 'Kimi Antonelli')).toBeNull();
    // Two roster names contain the feed's: a miss, never a guess.
    expect(index.driver('wec', 'Schumacher')).toBeNull();
    expect(index.driver('f1', '')).toBeNull();
  });

  it('answers a driver’s page across every roster (R18 PR E, the champions who race elsewhere now): the series’ own roster by the drift rule first, then an exact slug on any roster, the bare slug the owner holds; never a drift match across rosters', () => {
    const index = buildPeopleIndex(
      [
        driver('Kimi Antonelli', 'f1'),
        driver('Max Verstappen', 'f1'),
        driver('Max Verstappen', 'adac-ravenol-24h', 'max-verstappen-24h'),
        driver('Mick Schumacher', 'wec'),
        driver('Ralf Schumacher', 'wec'),
        driver('Nyck de Vries', 'formula-e'),
        driver('Nyck de Vries', 'wec', 'nyck-de-vries-wec'),
        driver('Timo Glock', 'dtm'),
        driver('Timo Glock', 'nls', 'timo-glock-nls'),
        driver('Emerson Fittipaldi Jr.', 'f2', 'emerson-fittipaldi-jr'),
      ],
      [],
    );
    expect(index.driverAnywhere('f2', 'Mick Schumacher')).toBe('/drivers/mick-schumacher');
    expect(index.driverAnywhere('f2', 'Nyck de Vries')).toBe('/drivers/nyck-de-vries');
    expect(index.driverAnywhere('f2', 'Timo Glock')).toBe('/drivers/timo-glock');
    expect(index.driverAnywhere('adac-ravenol-24h', 'Max Verstappen')).toBe('/drivers/max-verstappen-24h');
    expect(index.driverAnywhere('f2', 'Max Verstappen')).toBe('/drivers/max-verstappen');
    // The series' own roster takes the drift rule; another roster takes an exact slug alone.
    expect(index.driverAnywhere('f1', 'Andrea Kimi Antonelli')).toBe('/drivers/kimi-antonelli');
    expect(index.driverAnywhere('f2', 'Andrea Kimi Antonelli')).toBeNull();
    expect(index.driverAnywhere('f1', 'Emerson Fittipaldi')).toBeNull();
    expect(index.driverAnywhere('f2', 'Schumacher')).toBeNull();
    expect(index.driverAnywhere('f2', 'Lando Norris')).toBeNull();
    expect(index.driverAnywhere('f2', '')).toBeNull();
  });

  it('answers a team’s page only where its slug opens that series’ own team: a slug two series share opens the first listed', () => {
    const index = buildPeopleIndex([], [team('Campos Racing', 'f2'), team('Campos Racing', 'f3'), team('Mercedes', 'f1'), team('Red Bull Racing', 'f1')]);
    expect(index.team('f1', 'Mercedes')).toBe('/teams/mercedes');
    expect(index.team('f1', 'Red Bull')).toBe('/teams/red-bull-racing');
    expect(index.team('f2', 'Campos Racing')).toBe('/teams/campos-racing');
    expect(index.team('f3', 'Campos Racing')).toBeNull();
    expect(index.team('f1', 'Cadillac')).toBeNull();
  });

  it('over the site’s own rosters: the feeds’ “Andrea Kimi Antonelli” is /drivers/kimi-antonelli, every F1 driver’s page opens that driver, and the index is built once', async () => {
    const index = await peopleIndex();
    expect(index.driver('f1', 'Andrea Kimi Antonelli')).toBe('/drivers/kimi-antonelli');
    expect(await findDriverBySlug('kimi-antonelli')).toMatchObject({ seriesSlug: 'f1', name: 'Kimi Antonelli' });
    const f1 = (await loadAllDrivers()).filter(d => d.seriesSlug === 'f1');
    expect(f1.length).toBeGreaterThan(0);
    for (const d of f1) {
      const page = index.driver('f1', d.name);
      expect(page, d.name).toBe(`/drivers/${d.slug}`);
      expect(await findDriverBySlug(d.slug), d.name).toMatchObject({ seriesSlug: 'f1', name: d.name });
    }
    const mercedes = index.team('f1', 'Mercedes');
    expect(mercedes).toBe('/teams/mercedes');
    expect(await findTeamBySlug('mercedes')).toMatchObject({ seriesSlug: 'f1' });
    expect(await peopleIndex()).toBe(index);
  });
});
