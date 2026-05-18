export function monthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

export function currentMonthKey(now: Date = new Date()): string {
  return monthKey(now);
}

/**
 * Choose a sensible default from a sorted-ascending list of available month
 * keys. Prefers the current month if present, otherwise the nearest upcoming,
 * otherwise the most recent past.
 */
export function pickDefaultMonth(
  months: string[],
  now: Date = new Date(),
): string | null {
  if (months.length === 0) return null;
  const current = currentMonthKey(now);
  if (months.includes(current)) return current;
  const upcoming = months.find(m => m > current);
  if (upcoming) return upcoming;
  return months[months.length - 1];
}
