import { describe, it, expect } from 'vitest';
import { highlightForRound, videoForSession, type MediaFile } from './media';

describe('highlightForRound', () => {
  const media: MediaFile = {
    '5': { highlight: 'abc123' },
    '6': {},
  };

  it('returns the curated highlight id for a round', () => {
    expect(highlightForRound(media, 5)).toBe('abc123');
  });

  it('returns undefined for a round with no highlight', () => {
    expect(highlightForRound(media, 6)).toBeUndefined();
  });

  it('returns undefined for an uncurated round', () => {
    expect(highlightForRound(media, 99)).toBeUndefined();
  });

  it('returns undefined when round is undefined', () => {
    expect(highlightForRound(media, undefined)).toBeUndefined();
  });

  it('treats an empty media file as no highlights', () => {
    expect(highlightForRound({}, 1)).toBeUndefined();
  });
});

describe('videoForSession', () => {
  const media: MediaFile = {
    '7': {
      highlight: 'race7',
      sessions: { qualifying: 'quali7', 'free-practice-1': 'fp1-7' },
    },
    '8': { sessions: { race: 'race8' } }, // explicit race clip, no highlight
  };

  it('returns a per-session clip', () => {
    expect(videoForSession(media, 7, 'qualifying', false)).toBe('quali7');
  });

  it('falls back to the round highlight for the race session', () => {
    expect(videoForSession(media, 7, 'race', true)).toBe('race7');
  });

  it('prefers an explicit session clip over the highlight fallback', () => {
    expect(videoForSession(media, 8, 'race', true)).toBe('race8');
  });

  it('returns undefined for a non-race session with no clip', () => {
    expect(videoForSession(media, 7, 'warm-up', false)).toBeUndefined();
  });

  it('returns undefined when round is undefined', () => {
    expect(videoForSession(media, undefined, 'race', true)).toBeUndefined();
  });

  it('returns undefined for an uncurated round', () => {
    expect(videoForSession(media, 99, 'race', true)).toBeUndefined();
  });
});
