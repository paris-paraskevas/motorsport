import { describe, it, expect } from 'vitest';
import { parseIcs } from './ics';
import fs from 'fs';
import path from 'path';

const FIXTURE = fs.readFileSync(
  path.join(__dirname, '..', 'tests', 'fixtures', 'sample.ics'),
  'utf-8',
);

describe('parseIcs', () => {
  it('returns one Session per VEVENT', () => {
    const sessions = parseIcs(FIXTURE, 'test');
    expect(sessions).toHaveLength(2);
  });
  it('extracts title, start, end, location', () => {
    const [first] = parseIcs(FIXTURE, 'test');
    expect(first.title).toBe('Test GP - FP1');
    expect(first.start.toISOString()).toBe('2026-05-15T13:00:00.000Z');
    expect(first.end.toISOString()).toBe('2026-05-15T14:00:00.000Z');
    expect(first.location).toBe('Test Circuit');
    expect(first.seriesSlug).toBe('test');
    expect(first.uid).toBe('fp1-2026-05-15@test');
  });
  it('sorts by start time ascending', () => {
    const sessions = parseIcs(FIXTURE, 'test');
    expect(sessions[0].start.getTime()).toBeLessThan(sessions[1].start.getTime());
  });
  it('returns [] for empty input', () => {
    expect(parseIcs('', 'test')).toEqual([]);
  });
});
