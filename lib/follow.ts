const KEY = 'paddock:followed-series';

/**
 * Returns the user's followed-series slug list, or null if they haven't
 * configured any preference yet (null = follow everything, default).
 * Returns null on the server (no localStorage).
 */
export function getFollowedSeries(): string[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((s): s is string => typeof s === 'string');
  } catch {
    return null;
  }
}

export function setFollowedSeries(slugs: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(slugs));
  } catch {
    /* quota or denied — silently ignore */
  }
}

export function clearFollowedSeries(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
