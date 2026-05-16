import { describe, it, expect } from 'vitest';
import { parseIcs } from './ics';
import fs from 'fs';
import path from 'path';

const FIXTURE = fs.readFileSync(
  path.join(__dirname, '..', 'tests', 'fixtures', 'sample.ics'),
  'utf-8',
);
const DATE_ONLY_FIXTURE = fs.readFileSync(
  path.join(__dirname, '..', 'tests', 'fixtures', 'sample-dateonly.ics'),
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
  it('does not set dateOnly for normal date-time entries', () => {
    const [first] = parseIcs(FIXTURE, 'test');
    expect(first.dateOnly).toBeUndefined();
  });
  it('flags dateOnly for VALUE=DATE entries', () => {
    const [only] = parseIcs(DATE_ONLY_FIXTURE, 'test');
    expect(only.dateOnly).toBe(true);
    expect(only.title).toBe('Test GP - Race (day-only)');
  });
  it('flags dateOnly for midnight-UTC entries (effectively date-only)', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:race-midnight@test',
      'SUMMARY:Race weekend (midnight UTC)',
      'DTSTART:20260613T000000Z',
      'DTEND:20260614T000000Z',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const [only] = parseIcs(ics, 'test');
    expect(only.dateOnly).toBe(true);
  });
  it('does not flag dateOnly when a midnight-UTC start has a real end time', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:race-asia-prime@test',
      'SUMMARY:Real session ending at 02:00Z',
      'DTSTART:20260613T000000Z',
      'DTEND:20260613T020000Z',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const [only] = parseIcs(ics, 'test');
    expect(only.dateOnly).toBeUndefined();
  });
});
