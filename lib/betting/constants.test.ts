import { describe, it, expect } from 'vitest';
import { formatBetSelection } from './constants';

// Regression guard for the "/play bets render as raw JSON" bug: composite
// selections (exact_position / forecast) used to fall through to
// JSON.stringify(selection). formatBetSelection must always return readable text.
describe('formatBetSelection', () => {
  it('winner / podium / top10 → the driver name', () => {
    expect(formatBetSelection('winner', { winner: 'Verstappen' })).toBe('Verstappen');
    expect(formatBetSelection('podium', { driver: 'Norris' })).toBe('Norris');
    expect(formatBetSelection('top10', { driver: 'Albon' })).toBe('Albon');
  });

  it('exact_position → "<driver> P<position>"', () => {
    expect(formatBetSelection('exact_position', { driver: 'Hamilton', position: 3 })).toBe('Hamilton P3');
  });

  it('forecast → legs joined as "<driver> P<pos>, …"', () => {
    expect(
      formatBetSelection('forecast', {
        legs: [
          { driver: 'Verstappen', position: 1 },
          { driver: 'Norris', position: 2 },
        ],
      }),
    ).toBe('Verstappen P1, Norris P2');
  });

  it('never returns raw JSON — composite/garbage/missing degrade to readable text or a dash', () => {
    expect(formatBetSelection('exact_position', { driver: 'X', position: 2 })).not.toContain('{');
    expect(
      formatBetSelection('forecast', {
        legs: [
          { driver: 'A', position: 1 },
          { driver: 'B', position: 2 },
        ],
      }),
    ).not.toContain('{');
    expect(formatBetSelection('podium', {})).toBe('—');
    expect(formatBetSelection('mystery', { foo: 'bar' })).toBe('—');
    // exact_position missing its position still shows the driver, never JSON
    expect(formatBetSelection('exact_position', { driver: 'Leclerc' })).toBe('Leclerc');
  });
});
