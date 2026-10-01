import { describe, expect, it } from 'vitest';
import { DESTINATIONS, PAGE_DEST, SERIES_DESTINATION_SLUGS, SINGLE_EVENT_SLUGS, isActivePath, pageDest, pageIdOf, resolveDestination, resolveEntry, seriesDestinationOptions, type PageDestinations } from './destinations';
import { SERIES_OPTIONS } from './sources';
import { tabsFor } from '@/lib/tabs';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
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

// The series tabs as destinations (R18): a rule, as page keys are, over the fifteen series and the tabs they render, so a
// list the operator authors can point at a championship's standings or champions; the slug list is local (this module rides
// every page's client JS and imports nothing from the catalogue) and held equal to the catalogue's and the content's.
describe('series destinations (R18)', () => {
  it('resolves series:<slug> to the hub and series:<slug>:<tab> to the tab’s page, labelled with the series’ name and the tab’s; a single-event series offers its own tabs and Past Winners; anything else is nothing', () => {
    expect(resolveDestination('series:f1')).toEqual({ kind: 'route', href: '/series/f1', label: 'Formula 1' });
    expect(resolveDestination('series:f1:champions')).toEqual({ kind: 'route', href: '/series/f1/champions', label: 'Formula 1 · Champions' });
    expect(resolveDestination('series:f2:blog')).toEqual({ kind: 'route', href: '/series/f2/blog', label: 'Formula 2 · Blog' });
    expect(resolveDestination('series:adac-ravenol-24h:champions')).toEqual({ kind: 'route', href: '/series/adac-ravenol-24h/champions', label: 'ADAC Ravenol 24h Nürburgring · Past Winners' });
    expect(resolveDestination('series:adac-ravenol-24h:standings')).toBeNull();
    expect(resolveDestination('series:f1:tracks')).toBeNull();
    expect(resolveDestination('series:f1:calendar')).toBeNull();
    expect(resolveDestination('series:nope:standings')).toBeNull();
    expect(resolveDestination('series:')).toBeNull();
    expect(resolveDestination('series:f1:champions:x')).toBeNull();
    // Object's own keys are no series and no tab (the maps are plain objects).
    expect(resolveDestination('series:constructor')).toBeNull();
    expect(resolveDestination('series:f1:constructor')).toBeNull();
    expect(resolveDestination('series:f1:hasOwnProperty')).toBeNull();
    // The catalogue's own keys still win, and a page key still resolves against the map.
    expect(resolveDestination('series')).toEqual(DESTINATIONS.series);
    expect(resolveEntry({ label: 'F1 champions', dest: 'series:f1:champions' })).toEqual({ kind: 'route', href: '/series/f1/champions', label: 'Formula 1 · Champions' });
  });

  it('holds the local slug list equal to the catalogue’s and the single-event list to the content’s meta files; every generated option resolves to a tab that series renders', () => {
    expect(Object.keys(SERIES_DESTINATION_SLUGS).sort()).toEqual(SERIES_OPTIONS.map(o => o.key).sort());
    for (const o of SERIES_OPTIONS) expect(SERIES_DESTINATION_SLUGS[o.key], o.key).toBe(o.label);
    const content = path.join(process.cwd(), 'content', 'series');
    const single = readdirSync(content).filter(slug => (JSON.parse(readFileSync(path.join(content, slug, 'meta.json'), 'utf8')) as { singleEvent?: boolean }).singleEvent === true);
    expect([...SINGLE_EVENT_SLUGS].sort()).toEqual(single.sort());
    const options = seriesDestinationOptions();
    expect(options.length).toBe(15 + 14 * 6 + 2);
    for (const o of options) {
      const d = resolveDestination(o.key);
      expect(d, o.key).not.toBeNull();
      expect(d!.kind).toBe('route');
      expect(d!.label).toBe(o.label);
      const [, slug, tab] = o.key.split(':');
      if (tab) expect(tabsFor(SINGLE_EVENT_SLUGS.has(slug), slug).map(t => t.key), o.key).toContain(tab);
    }
    expect(options.find(o => o.key === 'series:f1:champions')).toEqual({ key: 'series:f1:champions', label: 'Formula 1 · Champions', href: '/series/f1/champions' });
  });
});
