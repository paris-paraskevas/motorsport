import { describe, it, expect } from 'vitest';
import { mergeSignificance } from './significance';
import { Session, SignificanceMap } from './types';

const sessions: Session[] = [
  {
    uid: 'a', seriesSlug: 'test', title: 'FP1',
    start: new Date('2026-05-15T13:00:00Z'),
    end: new Date('2026-05-15T14:00:00Z'),
  },
  {
    uid: 'b', seriesSlug: 'test', title: 'Race',
    start: new Date('2026-05-17T13:00:00Z'),
    end: new Date('2026-05-17T15:00:00Z'),
  },
];

const map: SignificanceMap = {
  '2026-05-17': { tier: 'marquee', note: 'Marquee round' },
};

describe('mergeSignificance', () => {
  it('attaches flag to sessions whose UTC date matches', () => {
    const out = mergeSignificance(sessions, map);
    expect(out[0].significance).toBeUndefined();
    expect(out[1].significance).toEqual({ tier: 'marquee', note: 'Marquee round' });
  });
  it('does not mutate input', () => {
    const out = mergeSignificance(sessions, map);
    expect(out[1]).not.toBe(sessions[1]);
    expect(sessions[1].significance).toBeUndefined();
  });
  it('handles empty map', () => {
    const out = mergeSignificance(sessions, {});
    expect(out.every(s => s.significance === undefined)).toBe(true);
  });
});
