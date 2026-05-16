import { SeriesRoundsFile, Weekend } from './types';

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Returns true when the rounds.json entry covers a weekend whose sessions
// fall within [startDate, endDate] inclusive (date-key comparison).
function rangeCovers(startDate: string, endDate: string, weekendStart: Date, weekendEnd: Date): boolean {
  const ws = dateKey(weekendStart);
  const we = dateKey(weekendEnd);
  return startDate <= we && endDate >= ws;
}

export function assignRoundsToWeekends(
  weekends: Weekend[],
  rounds: SeriesRoundsFile | undefined,
): Weekend[] {
  if (!rounds) {
    return weekends.map((w, i) => ({ ...w, round: i + 1 }));
  }
  return weekends.map((w, i) => {
    const start = w.sessions[0]?.start;
    const end = w.sessions[w.sessions.length - 1]?.start;
    if (!start || !end) return { ...w, round: i + 1 };
    const match = rounds.rounds.find(r =>
      !r.cancelled && rangeCovers(r.startDate, r.endDate, start, end),
    );
    if (!match) return { ...w, round: i + 1 };
    return {
      ...w,
      round: match.round,
      roundName: match.name,
      previousStartDate: match.previousStartDate,
      previousEndDate: match.previousEndDate,
      rescheduleNote: match.rescheduleNote,
    };
  });
}
