import { describe, it, expect } from 'vitest';
import { formatRelative, isThisWeekend, isWithinNextNDays, formatLocal } from './date';

const NOW = new Date('2026-05-13T12:00:00Z');  // Wed
const FRI = new Date('2026-05-15T15:00:00Z');
const SAT = new Date('2026-05-16T14:00:00Z');
const SUN = new Date('2026-05-17T13:00:00Z');
const MON_NEXT = new Date('2026-05-18T10:00:00Z');
const FAR = new Date('2026-06-20T10:00:00Z');

describe('formatRelative', () => {
  it('returns "now" if within 1h', () => {
    expect(formatRelative(new Date('2026-05-13T12:30:00Z'), NOW)).toBe('now');
  });
  it('returns hours if same day', () => {
    expect(formatRelative(new Date('2026-05-13T18:00:00Z'), NOW)).toBe('in 6h');
  });
  it('returns "tomorrow" for next day', () => {
    expect(formatRelative(new Date('2026-05-14T12:00:00Z'), NOW)).toBe('tomorrow');
  });
  it('returns "in N days" for < 7 days', () => {
    expect(formatRelative(FRI, NOW)).toBe('in 2 days');
  });
  it('returns "in Nw" beyond 7 days', () => {
    expect(formatRelative(FAR, NOW)).toBe('in 5w');
  });
  it('returns "past" for past dates', () => {
    expect(formatRelative(new Date('2026-05-01T12:00:00Z'), NOW)).toBe('past');
  });
});

describe('isThisWeekend', () => {
  it('flags upcoming Fri/Sat/Sun', () => {
    expect(isThisWeekend(FRI, NOW)).toBe(true);
    expect(isThisWeekend(SAT, NOW)).toBe(true);
    expect(isThisWeekend(SUN, NOW)).toBe(true);
  });
  it('rejects mid-week', () => {
    expect(isThisWeekend(MON_NEXT, NOW)).toBe(false);
  });
  it('rejects dates more than 7 days out', () => {
    expect(isThisWeekend(FAR, NOW)).toBe(false);
  });
});

describe('isWithinNextNDays', () => {
  it('includes today and N days ahead', () => {
    expect(isWithinNextNDays(FRI, 7, NOW)).toBe(true);
    expect(isWithinNextNDays(MON_NEXT, 7, NOW)).toBe(true);
  });
  it('excludes past', () => {
    expect(isWithinNextNDays(new Date('2026-05-12T12:00:00Z'), 7, NOW)).toBe(false);
  });
  it('excludes beyond N days', () => {
    expect(isWithinNextNDays(FAR, 7, NOW)).toBe(false);
  });
});

describe('formatLocal', () => {
  it('formats in Europe/Athens by default', () => {
    // 2026-05-15T15:00:00Z = 18:00 Athens (EEST, UTC+3)
    expect(formatLocal(FRI)).toMatch(/Fri.*18:00/);
  });
});
