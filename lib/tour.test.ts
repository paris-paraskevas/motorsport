import { beforeEach, describe, expect, it } from 'vitest';
import { readTourState, shouldShowTour, writeTourState } from './tour';

// Minimal localStorage stub — lib tests run in the node environment.
function installStorage(): void {
  const map = new Map<string, string>();
  const storage = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
  (globalThis as Record<string, unknown>).window = { localStorage: storage };
}

describe('tour storage', () => {
  beforeEach(() => {
    installStorage();
  });

  it('shows when nothing is recorded', () => {
    expect(shouldShowTour()).toBe(true);
  });

  it('does not show after any dismissal', () => {
    writeTourState({ dismissedAt: '2026-06-11T00:00:00Z', completedStep: 1, neverShow: false });
    expect(shouldShowTour()).toBe(false);
    expect(readTourState()?.completedStep).toBe(1);
  });

  it('shows on an unparseable key (read-failure default)', () => {
    window.localStorage.setItem('paddock:tour:main:v1', '{nope');
    expect(shouldShowTour()).toBe(true);
  });

  it('neverShow under an OLD version suppresses after a version bump', () => {
    window.localStorage.setItem(
      'paddock:tour:main:v0',
      JSON.stringify({ dismissedAt: 'x', completedStep: 4, neverShow: true }),
    );
    expect(shouldShowTour()).toBe(false);
  });

  it('a plain old-version dismissal does NOT suppress (version bump re-shows once)', () => {
    window.localStorage.setItem(
      'paddock:tour:main:v0',
      JSON.stringify({ dismissedAt: 'x', completedStep: 4, neverShow: false }),
    );
    expect(shouldShowTour()).toBe(true);
  });

  it('write cleans up prior-version keys', () => {
    window.localStorage.setItem('paddock:tour:main:v0', '{}');
    writeTourState({ dismissedAt: 'now', completedStep: 4, neverShow: true });
    expect(window.localStorage.getItem('paddock:tour:main:v0')).toBeNull();
    expect(readTourState()?.neverShow).toBe(true);
  });

  it('setItem throwing never breaks shouldShow (legacy private mode)', () => {
    (window.localStorage as unknown as { setItem: () => void }).setItem = () => {
      throw new Error('QuotaExceededError');
    };
    expect(() =>
      writeTourState({ dismissedAt: 'x', completedStep: 0, neverShow: false }),
    ).not.toThrow();
    expect(shouldShowTour()).toBe(true);
  });
});
