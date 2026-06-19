import { describe, it, expect } from 'vitest';
import { highlightForRound, type MediaFile } from './media';

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
