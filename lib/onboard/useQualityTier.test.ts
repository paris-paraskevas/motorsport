import { describe, it, expect } from 'vitest';
import { tierFor } from './useQualityTier';

describe('tierFor', () => {
  it('returns low for coarse-pointer + few cores (mobile)', () => {
    expect(tierFor({ coarsePointer: true, cores: 4, deviceMemory: 4 })).toBe('low');
  });
  it('returns high for fine-pointer desktop with many cores', () => {
    expect(tierFor({ coarsePointer: false, cores: 12, deviceMemory: 16 })).toBe('high');
  });
  it('returns low when memory is very constrained even on desktop', () => {
    expect(tierFor({ coarsePointer: false, cores: 8, deviceMemory: 2 })).toBe('low');
  });
  it('defaults to low when signals are unknown (safe)', () => {
    expect(tierFor({})).toBe('low');
  });
});
