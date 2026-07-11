import { describe, it, expect } from 'vitest';
import { splitSections, groupByWeek, mondayOf, weekLabel, type ReleaseEntry } from './releases';

describe('mondayOf', () => {
  it('returns the ISO Monday of the week (UTC)', () => {
    expect(mondayOf('2026-07-06')).toBe('2026-07-06'); // Monday → itself
    expect(mondayOf('2026-07-08')).toBe('2026-07-06'); // Wednesday
    expect(mondayOf('2026-07-12')).toBe('2026-07-06'); // Sunday → the prior Monday
    expect(mondayOf('2026-07-01')).toBe('2026-06-29'); // crosses back into June
  });
  it('always lands on a Monday and is idempotent', () => {
    const m = mondayOf('2026-07-12');
    expect(new Date(`${m}T00:00:00Z`).getUTCDay()).toBe(1);
    expect(mondayOf(m)).toBe(m);
  });
});

describe('weekLabel', () => {
  it('formats a same-month week compactly', () => {
    expect(weekLabel('2026-07-06')).toBe('6–12 Jul');
  });
  it('spells both months when the week spans two', () => {
    expect(weekLabel('2026-06-29')).toBe('29 Jun – 5 Jul');
  });
});

const entry = (version: string, dateISO: string | null): ReleaseEntry => ({ version, dateISO, bodyHtml: '' });

describe('groupByWeek', () => {
  it('buckets releases by calendar week, newest week first', () => {
    const weeks = groupByWeek([
      entry('0.3.0', '2026-07-12'), // week of 6 Jul
      entry('0.2.0', '2026-07-06'), // week of 6 Jul
      entry('0.1.0', '2026-06-30'), // week of 29 Jun
    ]);
    expect(weeks.map(w => w.key)).toEqual(['2026-07-06', '2026-06-29']);
    expect(weeks[0].label).toBe('6–12 Jul');
    expect(weeks[0].releases.map(r => r.version)).toEqual(['0.3.0', '0.2.0']);
    expect(weeks[1].releases.map(r => r.version)).toEqual(['0.1.0']);
  });
  it('collects undated releases into a trailing "Earlier" week', () => {
    const weeks = groupByWeek([entry('0.2.0', '2026-07-06'), entry('pre', null)]);
    const last = weeks[weeks.length - 1];
    expect(last.key).toBe('undated');
    expect(last.label).toBe('Earlier');
  });
  it('preserves the given (newest-first) order within a week', () => {
    const weeks = groupByWeek([entry('0.2.0', '2026-07-08'), entry('0.1.0', '2026-07-07')]);
    expect(weeks).toHaveLength(1);
    expect(weeks[0].releases.map(r => r.version)).toEqual(['0.2.0', '0.1.0']);
  });
});

describe('splitSections', () => {
  it('parses "## version — date" headers and discards the intro', () => {
    const md = [
      'Intro line (discarded).',
      '',
      '## 0.2.0 — 2026-07-08',
      '',
      'Body two.',
      '',
      '## 0.1.0 — 2026-07-01',
      '',
      'Body one.',
    ].join('\n');
    const secs = splitSections(md);
    expect(secs.map(s => s.version)).toEqual(['0.2.0', '0.1.0']);
    expect(secs[0].dateISO).toBe('2026-07-08');
    expect(secs[0].body).toBe('Body two.');
  });
  it('tolerates a version range (en-dash) and an undated header', () => {
    const md = '## 0.9.0–0.9.7 — 2026-05-16\n\nx\n\n## Pre-0.8.0\n\ny';
    const secs = splitSections(md);
    expect(secs[0].version).toBe('0.9.0–0.9.7');
    expect(secs[0].dateISO).toBe('2026-05-16');
    expect(secs[1].version).toBe('Pre-0.8.0');
    expect(secs[1].dateISO).toBeNull();
  });
});

describe('month clamping (cross-month weeks)', () => {
  it('weekLabel clamps to the containing month when monthKey is given', () => {
    expect(weekLabel('2026-06-29', '2026-07')).toBe('1–5 Jul'); // July portion only
    expect(weekLabel('2026-06-29', '2026-06')).toBe('29–30 Jun'); // June portion only
    expect(weekLabel('2026-07-06', '2026-07')).toBe('6–12 Jul'); // fully inside → unchanged
    expect(weekLabel('2026-06-29')).toBe('29 Jun – 5 Jul'); // no monthKey → full ISO week
  });
  it('groupByWeek applies the clamp to its week labels', () => {
    const jul = groupByWeek([entry('0.1.0', '2026-07-01')], '2026-07');
    expect(jul[0].label).toBe('1–5 Jul');
  });
});
