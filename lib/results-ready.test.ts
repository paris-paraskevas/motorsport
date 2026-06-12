import { describe, it, expect } from 'vitest';
import { looksLikeRaceSession, seriesSupportsResultsReady } from './results-ready';

describe('looksLikeRaceSession', () => {
  it('matches deciders', () => {
    expect(looksLikeRaceSession('F1 - Race')).toBe(true);
    expect(looksLikeRaceSession('Monaco Grand Prix')).toBe(true);
    expect(looksLikeRaceSession('Indianapolis 500')).toBe(true);
    expect(looksLikeRaceSession('MotoGP - Race')).toBe(true);
    expect(looksLikeRaceSession('Formula E | Berlin ePrix Race')).toBe(true);
  });

  it('rejects support sessions, including race-day ones', () => {
    expect(looksLikeRaceSession('F1 - Practice 1')).toBe(false);
    expect(looksLikeRaceSession('F1 - Qualifying')).toBe(false);
    expect(looksLikeRaceSession('Grand Prix Practice')).toBe(false);
    expect(looksLikeRaceSession('NASCAR - Warm-up')).toBe(false);
    expect(looksLikeRaceSession('WEC - Le Mans Hyperpole 1 (Hypercar)')).toBe(false);
    expect(looksLikeRaceSession('IndyCar - 500 Qualifying Shootout')).toBe(false);
  });
});

describe('seriesSupportsResultsReady', () => {
  it('covers the supported set and nothing else silently', () => {
    expect(seriesSupportsResultsReady('f1')).toBe(true);
    expect(seriesSupportsResultsReady('motogp')).toBe(true);
    expect(seriesSupportsResultsReady('wec')).toBe(true); // 0.36.0
    expect(seriesSupportsResultsReady('nascar-cup')).toBe(false);
  });
});
