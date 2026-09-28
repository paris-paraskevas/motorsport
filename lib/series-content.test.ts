import { describe, expect, it } from 'vitest';
import { hasWeekendNote, weekendNoteKey, type WeekendNotesFile } from './series-content';

// R14 (2026-09-28): a race-weekend page is indexed, and the sitemap advertises
// it, only when the weekend carries an authored note with text. One predicate
// for the route's robots rule and the sitemap, so they cannot drift.

const notes: WeekendNotesFile = {
  [weekendNoteKey(2026, 1)]: { lead: 'Russell won the opener from pole', note: 'He lost the lead to Leclerc on the opening lap and took it back on lap ten.' },
  [weekendNoteKey(2026, 2)]: { lead: 'A lead alone', note: '   ' },
};

describe('hasWeekendNote', () => {
  it('is true for a season and round whose note carries text', () => {
    expect(hasWeekendNote(notes, 2026, 1)).toBe(true);
  });

  it('is false for a missing round, an empty note, another season, or no notes file at all', () => {
    expect(hasWeekendNote(notes, 2026, 3)).toBe(false);
    expect(hasWeekendNote(notes, 2026, 2)).toBe(false);
    expect(hasWeekendNote(notes, 2025, 1)).toBe(false);
    expect(hasWeekendNote(null, 2026, 1)).toBe(false);
    expect(hasWeekendNote(undefined, 2026, 1)).toBe(false);
  });
});
