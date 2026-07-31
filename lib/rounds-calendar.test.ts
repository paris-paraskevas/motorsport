import { describe, it, expect } from 'vitest';
import f1Rounds from '../content/series/f1/rounds.json';
import wecRounds from '../content/series/wec/rounds.json';
import wecSessions from '../content/series/wec/sessions.json';

// Data-integrity guards for the two 2026 calendars corrected on 2026-07-31, each
// verified against a primary source at the time:
//   F1  — formula1.com's 2026 calendar (23 rounds) plus the Malaysia announcement.
//   WEC — fiawec.com and the live Google-calendar ICS the app consumes, both of
//         which list Barcelona and Monza and NO Qatar or Bahrain.
// These are cheap invariants, not a substitute for re-checking upstream.

describe('F1 2026 calendar', () => {
  const rounds = f1Rounds.rounds;

  it('has 23 rounds, contiguous and chronological', () => {
    expect(rounds).toHaveLength(23);
    expect(rounds.map(r => r.round)).toEqual(Array.from({ length: 23 }, (_, i) => i + 1));
    const starts = rounds.map(r => r.startDate);
    expect([...starts].sort()).toEqual(starts);
  });

  // The trap: named after Bahrain, held in Malaysia. Without `venue`, circuit
  // resolution falls back to the name and returns Sakhir.
  it('carries the Sepang-hosted Bahrain Grand Prix at round 16 with its venue', () => {
    const r16 = rounds.find(r => r.round === 16);
    expect(r16?.name).toBe('Bahrain Grand Prix');
    expect(r16?.startDate).toBe('2026-10-02');
    expect(r16?.endDate).toBe('2026-10-04');
    expect(r16?.venue).toBe('Sepang International Circuit');
    expect(r16?.countryCode).toBe('MY');
  });

  it('keeps Singapore behind it and Abu Dhabi last', () => {
    expect(rounds.find(r => r.round === 17)?.name).toBe('Singapore Grand Prix');
    expect(rounds.at(-1)?.name).toBe('Abu Dhabi Grand Prix');
  });

  // It is not a new round: it is the round cancelled from 10-12 April over the
  // Middle East conflict, now confirmed in October at a different circuit. The
  // reschedule fields drive "Rescheduled from …" in WeekendBlock and
  // eventStatus=EventRescheduled in the SportsEvent markup.
  it('records where the round moved from', () => {
    const r16 = rounds.find(r => r.round === 16);
    expect(r16?.previousStartDate).toBe('2026-04-10');
    expect(r16?.previousEndDate).toBe('2026-04-12');
    expect(r16?.rescheduleNote).toMatch(/Sepang/);
  });

  // Leaving it in cancelledRounds would have the banner announce Bahrain as
  // cancelled while round 16 shows it scheduled.
  it('no longer lists Bahrain as cancelled, but keeps Saudi Arabia', () => {
    const cancelled = f1Rounds.cancelledRounds ?? [];
    expect(cancelled.map(c => c.name)).toEqual(['Saudi Arabian Grand Prix']);
  });
});

describe('WEC 2026 calendar', () => {
  const rounds = wecRounds.rounds;

  it('ends with Barcelona then Monza', () => {
    expect(rounds).toHaveLength(8);
    expect(rounds.find(r => r.round === 7)).toMatchObject({
      name: '6 Hours of Barcelona',
      startDate: '2026-10-16',
      endDate: '2026-10-18',
    });
    expect(rounds.find(r => r.round === 8)).toMatchObject({
      name: '6 Hours of Monza',
      startDate: '2026-11-06',
      endDate: '2026-11-08',
    });
  });

  it('no longer lists Qatar or Bahrain, which left the calendar', () => {
    expect(JSON.stringify(rounds)).not.toMatch(/Qatar|Bahrain/i);
  });

  // Overrides inject sessions by matchDate with a ±2 day window, so a leftover
  // Sakhir block on 5-7 Nov would have landed inside the Monza weekend (6-8 Nov).
  it('has no orphaned Lusail or Sakhir session overrides', () => {
    expect(JSON.stringify(wecSessions)).not.toMatch(/Lusail|Sakhir/i);
  });
});
