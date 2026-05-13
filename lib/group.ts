import { Session, SignificanceFlag, Weekend } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKEND_GAP_DAYS = 4;

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dateRangeLabel(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  if (dateKey(start) === dateKey(end)) return fmt(start);
  const startStr = start.toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'UTC' });
  const endStr = fmt(end);
  return `${startStr}–${endStr}`;
}

function pickBestSignificance(sessions: Session[]): SignificanceFlag | undefined {
  const order: Record<string, number> = { marquee: 4, finale: 3, weighted: 2, note: 1 };
  let best: SignificanceFlag | undefined;
  for (const s of sessions) {
    const f = s.significance;
    if (!f) continue;
    if (!best || (order[f.tier] ?? 0) > (order[best.tier] ?? 0)) best = f;
  }
  return best;
}

export function groupByWeekend(sessions: Session[], now: Date = new Date()): Weekend[] {
  if (sessions.length === 0) return [];
  const sorted = [...sessions].sort((a, b) => a.start.getTime() - b.start.getTime());

  const weekends: Session[][] = [];
  let current: Session[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = current[current.length - 1].start;
    const next = sorted[i].start;
    const gap = (next.getTime() - prev.getTime()) / DAY_MS;
    if (gap <= WEEKEND_GAP_DAYS) {
      current.push(sorted[i]);
    } else {
      weekends.push(current);
      current = [sorted[i]];
    }
  }
  weekends.push(current);

  return weekends.map(group => {
    const significance = pickBestSignificance(group);
    const startDate = group[0].start;
    const endDate = group[group.length - 1].start;
    return {
      key: dateKey(startDate),
      label: significance?.weekend,
      dateRangeLabel: dateRangeLabel(startDate, endDate),
      sessions: group,
      significance,
      isPast: endDate.getTime() < now.getTime() - DAY_MS,
    };
  });
}

export function groupByDay(sessions: Session[]): Array<{ label: string; sessions: Session[] }> {
  const buckets = new Map<string, Session[]>();
  for (const s of sessions) {
    const key = dateKey(s.start);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(s);
  }
  return Array.from(buckets.entries()).map(([key, bucket]) => ({
    label: new Date(key + 'T00:00:00Z').toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
    }),
    sessions: bucket,
  }));
}
