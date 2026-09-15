import { describe, expect, it } from 'vitest';
import { DESTINATIONS, PAGE_DEST, isActivePath, pageDest, pageIdOf, resolveDestination, resolveEntry, type PageDestinations } from './destinations';
import { DEFAULT_NAV } from './lists';

const MONZA = 'a1b2c3d4-0000-4000-8000-000000000010';
const pages: PageDestinations = { [MONZA]: { path: '/history/monza', name: 'Monza, a history' } };

// Row pages as destinations (P1.12 B1): `page:<id>` keys resolve against the
// live pages the loader hands over; the shell's browser components take the
// href the loader carried on the entry instead of a map.
describe('page destinations', () => {
  it('shapes and reads the key', () => {
    expect(pageDest(MONZA)).toBe(`page:${MONZA}`);
    expect(PAGE_DEST.test(pageDest(MONZA))).toBe(true);
    expect(pageIdOf(pageDest(MONZA))).toBe(MONZA);
    expect(pageIdOf('page:not-a-uuid')).toBeNull();
    expect(pageIdOf('calendar')).toBeNull();
    expect(PAGE_DEST.test('page:')).toBe(false);
  });

  it('resolves a page key against the map as a route with the page’s path and name, and to nothing without the map or for a page not in it', () => {
    expect(resolveDestination(pageDest(MONZA), pages)).toEqual({ kind: 'route', href: '/history/monza', label: 'Monza, a history' });
    expect(resolveDestination(pageDest(MONZA))).toBeNull();
    expect(resolveDestination(pageDest('a1b2c3d4-0000-4000-8000-000000000099'), pages)).toBeNull();
    // The catalogue still wins for its own keys, map or not.
    expect(resolveDestination('calendar', pages)).toEqual(DESTINATIONS.calendar);
  });

  it('resolveEntry takes the catalogue, else the href the loader carried on a page entry, else nothing', () => {
    expect(resolveEntry({ label: 'Races', dest: 'calendar' })).toEqual(DESTINATIONS.calendar);
    expect(resolveEntry({ label: 'Monza', dest: pageDest(MONZA), href: '/history/monza' })).toEqual({ kind: 'route', href: '/history/monza', label: 'Monza' });
    expect(resolveEntry({ label: 'Monza', dest: pageDest(MONZA) })).toBeNull();
    expect(resolveEntry({ label: 'Monza', dest: pageDest(MONZA) }, pages)).toEqual({ kind: 'route', href: '/history/monza', label: 'Monza, a history' });
    // A carried href never rescues a key outside the catalogue that is not a page key.
    expect(resolveEntry({ label: 'Evil', dest: 'https://evil.example', href: 'https://evil.example' })).toBeNull();
  });
});

// The catalogue is the rail: a list entry can only point where the code knows.
describe('destinations catalogue', () => {
  it('resolves every entry of the default navigation', () => {
    for (const list of Object.values(DEFAULT_NAV)) {
      for (const entry of list) {
        expect(resolveDestination(entry.dest), entry.dest).not.toBeNull();
      }
    }
  });

  it('every route is root-relative and every external link is https', () => {
    for (const [key, dest] of Object.entries(DESTINATIONS)) {
      if (dest.kind === 'route') expect(dest.href, key).toMatch(/^\//);
      if (dest.kind === 'external') expect(dest.href, key).toMatch(/^https:\/\//);
    }
  });

  it('is null for anything outside the catalogue, including a typed URL and a prototype key', () => {
    expect(resolveDestination('https://evil.example')).toBeNull();
    expect(resolveDestination('/calendar')).toBeNull();
    expect(resolveDestination('constructor')).toBeNull();
    expect(resolveDestination('')).toBeNull();
  });
});

describe('isActivePath', () => {
  it('home matches itself only; other routes match themselves and their children', () => {
    expect(isActivePath('/', '/')).toBe(true);
    expect(isActivePath('/', '/calendar')).toBe(false);
    expect(isActivePath('/calendar', '/calendar')).toBe(true);
    expect(isActivePath('/calendar', '/calendar/2026-09')).toBe(true);
    expect(isActivePath('/calendar', '/calendars')).toBe(false);
    expect(isActivePath('/information', '/information/tracks/monza')).toBe(true);
  });
});
