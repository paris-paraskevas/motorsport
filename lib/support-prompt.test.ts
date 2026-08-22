import { describe, it, expect } from 'vitest';
import {
  createEngagedClock,
  dueAsk,
  isQuietRoute,
  parseVisit,
  serializeVisit,
  parseThresholds,
  hasOptedOut,
  EMPTY_VISIT,
  IDLE_TIMEOUT_MS,
  THRESHOLDS_MS,
  OPT_OUT_KEY,
  OPT_OUT_VALUE,
  type VisitState,
} from './support-prompt';

// Every clock test drives `at` by hand — no fake timers, no real waiting.
const T0 = 1_000_000;

describe('createEngagedClock', () => {
  it('accrues while visible and interacted with', () => {
    const c = createEngagedClock({ startedAt: T0 });
    expect(c.tick(T0 + 10_000)).toBe(10_000);
    c.activity(T0 + 10_000);
    expect(c.tick(T0 + 20_000)).toBe(20_000);
  });

  it('accrues nothing while the tab is hidden', () => {
    const c = createEngagedClock({ startedAt: T0 });
    c.setVisible(false, T0 + 5_000);
    expect(c.total()).toBe(5_000); // the visible 5 s counted
    expect(c.tick(T0 + 605_000)).toBe(5_000); // ten hidden minutes earn nothing
  });

  it('resumes on return to the tab', () => {
    const c = createEngagedClock({ startedAt: T0 });
    c.setVisible(false, T0 + 1_000);
    c.setVisible(true, T0 + 500_000);
    expect(c.tick(T0 + 510_000)).toBe(11_000);
  });

  it('stops after the idle timeout and restarts on interaction', () => {
    const c = createEngagedClock({ startedAt: T0 });
    // One long tick spanning well past the idle window: credited only to the
    // idle cutoff, not for the whole span.
    expect(c.tick(T0 + IDLE_TIMEOUT_MS * 3)).toBe(IDLE_TIMEOUT_MS);
    c.activity(T0 + IDLE_TIMEOUT_MS * 3);
    expect(c.tick(T0 + IDLE_TIMEOUT_MS * 3 + 7_000)).toBe(IDLE_TIMEOUT_MS + 7_000);
  });

  it('cannot reach the first threshold from a single abandoned landing', () => {
    const c = createEngagedClock({ startedAt: T0 });
    // Visible tab, nobody touching it, an hour of ticks.
    for (let i = 1; i <= 60; i++) c.tick(T0 + i * 60_000);
    expect(c.total()).toBe(IDLE_TIMEOUT_MS);
    expect(c.total()).toBeLessThan(THRESHOLDS_MS[0]);
  });

  it('resumes from a restored total (a reload does not reset the clock)', () => {
    const c = createEngagedClock({ startedAt: T0, initialMs: 110_000 });
    expect(c.tick(T0 + 10_000)).toBe(120_000);
  });

  it('ignores a clock that jumps backwards', () => {
    const c = createEngagedClock({ startedAt: T0 });
    c.tick(T0 + 10_000);
    expect(c.tick(T0 - 50_000)).toBe(10_000);
    expect(c.tick(T0 + 15_000)).toBe(15_000);
  });

  it('starts hidden without accruing', () => {
    const c = createEngagedClock({ startedAt: T0, visible: false });
    expect(c.tick(T0 + 30_000)).toBe(0);
  });
});

describe('dueAsk', () => {
  const state = (over: Partial<VisitState>): VisitState => ({ ...EMPTY_VISIT, ...over });

  it('holds until the first threshold', () => {
    expect(dueAsk(state({ ms: 119_999 }))).toBeNull();
    expect(dueAsk(state({ ms: 120_000 }))).toBe(1);
  });

  it('asks a second time only after ask 1 was shown', () => {
    expect(dueAsk(state({ ms: 999_999, shown: 0 }))).toBe(1);
    expect(dueAsk(state({ ms: 299_999, shown: 1 }))).toBeNull();
    expect(dueAsk(state({ ms: 300_000, shown: 1 }))).toBe(2);
  });

  it('never asks a third time', () => {
    expect(dueAsk(state({ ms: 10_000_000, shown: 2 }))).toBeNull();
  });

  it('is silent once the visit is done, at any ladder position', () => {
    for (const shown of [0, 1, 2] as const) {
      expect(dueAsk(state({ ms: 10_000_000, shown, done: true }))).toBeNull();
    }
  });

  it('honours overridden thresholds', () => {
    expect(dueAsk(state({ ms: 3_000 }), [3_000, 6_000])).toBe(1);
    expect(dueAsk(state({ ms: 6_000, shown: 1 }), [3_000, 6_000])).toBe(2);
  });
});

describe('visit state round-trip', () => {
  it('survives serialize + parse', () => {
    const s: VisitState = { ms: 187_000, shown: 1, done: false };
    expect(parseVisit(serializeVisit(s))).toEqual(s);
  });

  it('reads junk as a fresh visit', () => {
    for (const raw of [null, undefined, '', 'not json', '[]', '"x"', '42']) {
      expect(parseVisit(raw)).toEqual(EMPTY_VISIT);
    }
  });

  it('sanitises out-of-range fields', () => {
    expect(parseVisit('{"ms":-5,"shown":9,"done":"yes"}')).toEqual(EMPTY_VISIT);
    expect(parseVisit('{"ms":null,"shown":2,"done":true}')).toEqual({ ms: 0, shown: 2, done: true });
  });
});

describe('parseThresholds', () => {
  it('accepts an ascending pair', () => {
    expect(parseThresholds('3000,6000')).toEqual([3000, 6000]);
    expect(parseThresholds(' 1500 , 2500 ')).toEqual([1500, 2500]);
  });

  it('rejects anything half-formed', () => {
    for (const raw of [null, '', '3000', '3000,', 'a,b', '0,5000', '6000,3000', '3000,3000', '1,2,3']) {
      expect(parseThresholds(raw)).toBeNull();
    }
  });
});

describe('isQuietRoute', () => {
  it('silences auth flows and form pages, including their children', () => {
    for (const p of [
      '/sign-in',
      '/sign-in/factor-one',
      '/sign-up',
      '/studio',
      '/studio/abc-123',
      '/contact',
      '/settings',
      '/settings/series',
      '/write-for-us',
    ]) {
      expect(isQuietRoute(p)).toBe(true);
    }
  });

  it('leaves reading surfaces alone', () => {
    for (const p of [
      '/app',
      '/blog',
      '/blog/f1-dutch-grand-prix-2026-preview',
      '/series/f1/weekend/12',
      '/calendar',
      '/information/formula-1',
      null,
      undefined,
    ]) {
      expect(isQuietRoute(p)).toBe(false);
    }
  });

  it('does not match a route that merely starts with the same letters', () => {
    expect(isQuietRoute('/settings-guide')).toBe(false);
    expect(isQuietRoute('/contact-us-please')).toBe(false);
  });
});

describe('hasOptedOut', () => {
  it('reads the versioned marker', () => {
    expect(hasOptedOut({ [OPT_OUT_KEY]: OPT_OUT_VALUE })).toBe(true);
    expect(hasOptedOut({ [OPT_OUT_KEY]: 'v2' })).toBe(true);
  });

  it('ignores everything else', () => {
    expect(hasOptedOut(null)).toBe(false);
    expect(hasOptedOut(undefined)).toBe(false);
    expect(hasOptedOut({})).toBe(false);
    expect(hasOptedOut({ [OPT_OUT_KEY]: '' })).toBe(false);
    expect(hasOptedOut({ [OPT_OUT_KEY]: true })).toBe(false);
    expect(hasOptedOut({ other: 'v1' })).toBe(false);
  });
});
