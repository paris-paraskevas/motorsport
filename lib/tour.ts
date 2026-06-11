// Onboarding-tour persistence (design: docs/research/onboarding-tour-2026-06.md).
// Device-scoped, no account needed: a versioned localStorage flag. Auto-show
// happens once per device (any dismissal records it); the "don't show again"
// checkbox sets `neverShow`, whose extra meaning is surviving TOUR VERSION
// BUMPS — a redesign may bump the version to re-show the tour once, but never
// for users who explicitly opted out.

export const TOUR_VERSION = 'v1';
const KEY_PREFIX = 'paddock:tour:main:';
const KEY = `${KEY_PREFIX}${TOUR_VERSION}`;

export interface TourState {
  dismissedAt: string;
  completedStep: number;
  neverShow: boolean;
}

// Legacy Safari private mode exposes localStorage but throws on setItem —
// feature-detect by test-writing. Storage failure must never block render.
function storageAvailable(): boolean {
  try {
    const probe = '__paddock_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export function readTourState(): TourState | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TourState>;
    if (typeof parsed.dismissedAt !== 'string') return null;
    return {
      dismissedAt: parsed.dismissedAt,
      completedStep: typeof parsed.completedStep === 'number' ? parsed.completedStep : 0,
      neverShow: parsed.neverShow === true,
    };
  } catch {
    return null;
  }
}

export function writeTourState(state: TourState): void {
  if (!storageAvailable()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
    // Version-bump hygiene: drop prior-version keys, but never drop an old
    // key carrying neverShow before its opt-out has been copied forward.
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(KEY_PREFIX) && k !== KEY) {
        window.localStorage.removeItem(k);
      }
    }
  } catch {
    /* ephemeral in private modes — acceptable degradation */
  }
}

/**
 * Show when nothing recorded. A read failure or missing key shows the tour
 * (a dismissible tour appearing twice beats never appearing). An opt-out
 * under ANY version suppresses — neverShow survives version bumps.
 */
export function shouldShowTour(): boolean {
  try {
    if (readTourState()) return false;
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith(KEY_PREFIX)) continue;
      try {
        const old = JSON.parse(window.localStorage.getItem(k) ?? 'null') as
          | Partial<TourState>
          | null;
        if (old?.neverShow === true) return false;
      } catch {
        /* unparseable old key — ignore */
      }
    }
    return true;
  } catch {
    return true;
  }
}
