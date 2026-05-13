import { Session, SignificanceMap } from './types';

function utcDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function mergeSignificance(
  sessions: Session[],
  map: SignificanceMap,
): Session[] {
  return sessions.map(s => {
    const flag = map[utcDateKey(s.start)];
    return flag ? { ...s, significance: flag } : { ...s };
  });
}
