const KEY = 'paddock:onboarded';

export function isOnboarded(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return true;
  }
}

export function markOnboarded(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, '1');
  } catch {
    /* ignore */
  }
}

export function resetOnboarded(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
