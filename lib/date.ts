export function formatRelative(date: Date, now: Date = new Date()): string {
  const diffMs = date.getTime() - now.getTime();
  if (diffMs < 0) return 'past';
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffHours < 1) return 'now';
  if (diffHours < 24 && date.getUTCDate() === now.getUTCDate()) return `in ${diffHours}h`;
  if (diffDays < 1) return 'tomorrow';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays < 7) return `in ${diffDays} days`;
  return `in ${Math.floor(diffDays / 7)}w`;
}

export function isThisWeekend(date: Date, now: Date = new Date()): boolean {
  const day = date.getUTCDay();  // 0=Sun, 5=Fri, 6=Sat
  if (day !== 5 && day !== 6 && day !== 0) return false;
  const diffDays = (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= -1 && diffDays <= 7;
}

export function isWithinNextNDays(date: Date, n: number, now: Date = new Date()): boolean {
  const diffDays = (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= n;
}

export function formatLocal(date: Date, tz: string = 'Europe/Athens'): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

// Used for date-only ICS entries where we don't know the actual hour.
// Renders just "Sat 16 May · time TBC" instead of inventing a 03:00.
export function formatLocalDay(date: Date): string {
  const day = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date);
  return `${day} · time TBC`;
}
