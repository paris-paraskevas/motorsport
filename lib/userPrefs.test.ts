import { describe, it, expect, vi } from 'vitest';

// The pure helpers under test never touch KV, but the module imports
// @vercel/kv at top level — stub it so the import never needs real env.
vi.mock('@vercel/kv', () => ({ kv: {} }));

import {
  mergeNotifPrefs,
  sessionTypeAllowed,
  DEFAULT_NOTIF_PREFS,
  DEFAULT_SESSION_TYPE_PREFS,
} from './userPrefs';

describe('mergeNotifPrefs', () => {
  it('returns full defaults for an empty/absent stored row', () => {
    expect(mergeNotifPrefs(null)).toEqual(DEFAULT_NOTIF_PREFS);
    expect(mergeNotifPrefs(undefined)).toEqual(DEFAULT_NOTIF_PREFS);
    expect(mergeNotifPrefs({})).toEqual(DEFAULT_NOTIF_PREFS);
  });

  it('treats a pre-0.159 row (no sessionTypes field) as all session types on', () => {
    const merged = mergeNotifPrefs({ sessions: true, news: false, mutedSeries: ['wec'] });
    expect(merged.sessionTypes).toEqual({ practice: true, qualifying: true, race: true });
    expect(merged.news).toBe(false);
    expect(merged.mutedSeries).toEqual(['wec']);
  });

  it('keeps stored sessionTypes and fills missing keys with true', () => {
    const merged = mergeNotifPrefs({ sessionTypes: { practice: false } });
    expect(merged.sessionTypes).toEqual({ practice: false, qualifying: true, race: true });
  });

  it('preserves a fully-stored sessionTypes object', () => {
    const merged = mergeNotifPrefs({
      sessionTypes: { practice: false, qualifying: true, race: false },
    });
    expect(merged.sessionTypes).toEqual({ practice: false, qualifying: true, race: false });
  });

  it('does not mutate the defaults', () => {
    const merged = mergeNotifPrefs({ sessionTypes: { race: false } });
    merged.sessionTypes!.practice = false;
    expect(DEFAULT_NOTIF_PREFS.sessionTypes).toEqual({ practice: true, qualifying: true, race: true });
    expect(DEFAULT_SESSION_TYPE_PREFS).toEqual({ practice: true, qualifying: true, race: true });
  });
});

describe('sessionTypeAllowed', () => {
  const only = (on: 'practice' | 'qualifying' | 'race') => ({
    practice: on === 'practice',
    qualifying: on === 'qualifying',
    race: on === 'race',
  });

  it('allows everything when prefs are absent (pre-0.159 subscribers)', () => {
    expect(sessionTypeAllowed(undefined, 'Practice 1')).toBe(true);
    expect(sessionTypeAllowed(undefined, 'Qualifying')).toBe(true);
    expect(sessionTypeAllowed(undefined, 'Grand Prix')).toBe(true);
  });

  it('practice off blocks practice-family titles only', () => {
    const prefs = { practice: false, qualifying: true, race: true };
    expect(sessionTypeAllowed(prefs, 'Practice 1')).toBe(false);
    expect(sessionTypeAllowed(prefs, 'FP2')).toBe(false);
    expect(sessionTypeAllowed(prefs, 'Warm-up')).toBe(false);
    expect(sessionTypeAllowed(prefs, 'Qualifying')).toBe(true);
    expect(sessionTypeAllowed(prefs, 'Race')).toBe(true);
  });

  it('qualifying off blocks the qualifying family, including sprint qualifying', () => {
    const prefs = { practice: true, qualifying: false, race: true };
    expect(sessionTypeAllowed(prefs, 'Qualifying')).toBe(false);
    expect(sessionTypeAllowed(prefs, 'Sprint Qualifying')).toBe(false);
    expect(sessionTypeAllowed(prefs, 'Hyperpole')).toBe(false);
    expect(sessionTypeAllowed(prefs, 'Sprint')).toBe(true); // sprint race is race-classified
    expect(sessionTypeAllowed(prefs, 'FP3')).toBe(true);
  });

  it('race off blocks races, sprints and the grand prix', () => {
    const prefs = { practice: true, qualifying: true, race: false };
    expect(sessionTypeAllowed(prefs, 'Race')).toBe(false);
    expect(sessionTypeAllowed(prefs, 'Grand Prix')).toBe(false);
    expect(sessionTypeAllowed(prefs, 'Sprint')).toBe(false);
    expect(sessionTypeAllowed(prefs, 'Qualifying')).toBe(true);
  });

  it("never filters titles classified 'other'", () => {
    const allOff = { practice: false, qualifying: false, race: false };
    expect(sessionTypeAllowed(allOff, 'Driver Parade')).toBe(true);
    expect(sessionTypeAllowed(allOff, 'Autograph Session')).toBe(true);
  });

  it('a partial prefs object defaults missing keys to allowed', () => {
    expect(sessionTypeAllowed({ practice: false }, 'Qualifying')).toBe(true);
    expect(sessionTypeAllowed({ practice: false }, 'FP1')).toBe(false);
  });

  it('single-type prefs behave as an allowlist of one', () => {
    expect(sessionTypeAllowed(only('race'), 'Grand Prix')).toBe(true);
    expect(sessionTypeAllowed(only('race'), 'Qualifying')).toBe(false);
    expect(sessionTypeAllowed(only('race'), 'Practice 3')).toBe(false);
  });
});
