import { describe, it, expect } from 'vitest';
import { applySessionsOverrides } from './sessions-overrides';
import { Session, SessionsOverridesFile } from './types';

function s(start: string, title: string, dateOnly = false): Session {
  return {
    uid: `${start}-${title}`,
    seriesSlug: 'formula-e',
    title,
    start: new Date(start),
    end: new Date(new Date(start).getTime() + 60 * 60 * 1000),
    ...(dateOnly ? { dateOnly: true } : {}),
  };
}

const MONACO_OVERRIDE: SessionsOverridesFile = {
  season: 2026,
  overrides: [
    {
      matchDate: '2026-05-16',
      matchTitle: 'Monaco',
      sessions: [
        { title: 'FP1', start: '2026-05-16T05:30:00Z', end: '2026-05-16T06:15:00Z' },
        { title: 'Race', start: '2026-05-16T13:05:00Z', end: '2026-05-16T14:00:00Z' },
      ],
    },
  ],
};

describe('applySessionsOverrides', () => {
  it('replaces matching date-only entries with curated timed sessions', () => {
    const incoming = [
      s('2026-05-16T00:00:00Z', 'Monaco E-Prix', true),
      s('2026-06-13T00:00:00Z', 'Jakarta E-Prix', true),
    ];
    const out = applySessionsOverrides('formula-e', incoming, MONACO_OVERRIDE);
    expect(out).toHaveLength(3);
    expect(out.find(s => s.title === 'Monaco E-Prix')).toBeUndefined();
    expect(out.find(s => s.title === 'FP1')).toBeDefined();
    expect(out.find(s => s.title === 'Race')?.dateOnly).toBeUndefined();
    expect(out.find(s => s.title === 'Jakarta E-Prix')).toBeDefined();
  });

  it('only replaces sessions matching matchTitle', () => {
    const incoming = [
      s('2026-05-16T00:00:00Z', 'Monaco E-Prix', true),
      s('2026-05-15T00:00:00Z', 'Unrelated Event', true),
    ];
    const out = applySessionsOverrides('formula-e', incoming, MONACO_OVERRIDE);
    // 'Unrelated Event' falls within ±2-day window but title doesn't match 'Monaco'.
    expect(out.find(s => s.title === 'Unrelated Event')).toBeDefined();
  });

  it('passes through unchanged when no overrides file', () => {
    const incoming = [s('2026-05-16T00:00:00Z', 'Monaco E-Prix', true)];
    const out = applySessionsOverrides('formula-e', incoming, undefined);
    expect(out).toEqual(incoming);
  });

  // A curated session can now say "the day is known, the hour is not" — F2's
  // Baku, Lusail and Yas Marina rounds are published as TBC by the FIA, and
  // before this the file had no way to say so, so invented hours rendered as
  // though they were facts. The flag has to survive expansion or the whole
  // thing fails silently, which is the failure mode being fixed.
  describe('dateOnly on a curated session', () => {
    const TBC: SessionsOverridesFile = {
      season: 2026,
      overrides: [
        {
          matchDate: '2026-05-16',
          matchTitle: 'Monaco',
          sessions: [
            { title: 'FP1', start: '2026-05-16T05:30:00Z', end: '2026-05-16T06:15:00Z' },
            {
              title: 'Race',
              start: '2026-05-16T13:05:00Z',
              end: '2026-05-16T14:00:00Z',
              dateOnly: true,
            },
          ],
        },
      ],
    };

    it('survives expansion', () => {
      const out = applySessionsOverrides(
        'formula-e',
        [s('2026-05-16T00:00:00Z', 'Monaco E-Prix', true)],
        TBC,
      );
      expect(out.find(x => x.title === 'Race')?.dateOnly).toBe(true);
    });

    it('is absent, not false, on an ordinary session', () => {
      const out = applySessionsOverrides(
        'formula-e',
        [s('2026-05-16T00:00:00Z', 'Monaco E-Prix', true)],
        TBC,
      );
      // `dateOnly: false` would be a behaviour change for every existing
      // curated session; the flag is only ever set when true.
      expect(out.find(x => x.title === 'FP1')).not.toHaveProperty('dateOnly');
    });

    it('still carries a real instant, because the pipeline sorts on it', () => {
      const out = applySessionsOverrides(
        'formula-e',
        [s('2026-05-16T00:00:00Z', 'Monaco E-Prix', true)],
        TBC,
      );
      const race = out.find(x => x.title === 'Race');
      expect(race?.start.getTime()).toBe(Date.parse('2026-05-16T13:05:00Z'));
    });
  });
});
