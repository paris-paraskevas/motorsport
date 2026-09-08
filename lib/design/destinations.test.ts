import { describe, expect, it } from 'vitest';
import { DESTINATIONS, isActivePath, resolveDestination } from './destinations';
import { DEFAULT_NAV } from './lists';

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
