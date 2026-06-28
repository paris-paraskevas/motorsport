import { describe, it, expect } from 'vitest';
import { buildMoments } from './moments';

const iso = (sec: number) => new Date(Date.UTC(2024, 0, 1, 12, 0, sec)).toISOString();

describe('buildMoments', () => {
  it('classifies race-control flags + severities in chronological order', () => {
    const moments = buildMoments({
      raceControl: [
        { date: iso(10), category: 'Flag', flag: 'RED', scope: 'Track', sector: null, message: 'RED FLAG', driver_number: null, lap_number: 5, session_key: 1 },
        { date: iso(5), category: 'Flag', flag: 'YELLOW', scope: 'Sector', sector: 3, message: 'YELLOW IN TRACK SECTOR 3', driver_number: null, lap_number: 4, session_key: 1 },
        { date: iso(20), category: 'Other', flag: null, scope: null, sector: null, message: 'CAR 1 (VER) 5 SECOND TIME PENALTY', driver_number: 1, lap_number: 8, session_key: 1 },
      ],
    });
    expect(moments.map(m => m.kind)).toEqual(['flag', 'flag', 'penalty']);
    expect(moments[0].severity).toBe('notice'); // yellow @5
    expect(moments[1].severity).toBe('alert'); // red @10
    expect(moments[2].severity).toBe('alert'); // penalty @20
  });

  it('maps overtakes, pit stops and team radio (with audio)', () => {
    const moments = buildMoments({
      overtakes: [{ date: iso(1), overtaking_driver_number: 4, overtaken_driver_number: 16, position: 3, session_key: 1 }],
      pit: [{ date: iso(2), driver_number: 4, lap_number: 12, stop_duration: 2.4, session_key: 1 }],
      radio: [{ date: iso(3), driver_number: 1, recording_url: 'https://x/r.mp3', session_key: 1 }],
    });
    const radio = moments.find(m => m.kind === 'radio');
    expect(radio?.audioUrl).toBe('https://x/r.mp3');
    expect(radio?.severity).toBe('notice');
    expect(moments.find(m => m.kind === 'pit')?.detail).toContain('2.4s');
    expect(moments.find(m => m.kind === 'overtake')?.detail).toContain('#4 passed #16');
  });
});
