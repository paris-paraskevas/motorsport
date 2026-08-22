// Engaged-time accumulator + ask-ladder state for the dwell-triggered support
// prompt (components/SupportPrompt.tsx).
//
// Everything here is pure and clock-injected: no Date.now(), no timers, no
// storage calls. That is deliberate — a ten-minute ladder cannot be exercised
// with real timers, so the component owns the browser and this module owns the
// arithmetic and the decisions, which tests can walk in microseconds.

/** Ask 1 at two minutes of engaged time, ask 2 at five. TOTAL engaged time in
 *  both cases, not spacing, so the real gap between them is about three
 *  minutes. Decided by the operator 2026-08-21 (two asks, never a third). */
export const THRESHOLDS_MS: readonly [number, number] = [120_000, 300_000];

/** No pointerdown / keydown / scroll for this long and the clock stops.
 *  Deliberately shorter than the first threshold: a visible tab that someone
 *  walked away from can therefore bank at most 60 s and never reach ask 1 on
 *  its own. */
export const IDLE_TIMEOUT_MS = 60_000;

/** sessionStorage — per tab, gone when the tab closes, which is exactly the
 *  lifetime of "this visit". Holds the engaged total AND the ladder position,
 *  so a reload restarts neither. */
export const VISIT_KEY = 'paddock:support-prompt';

/** Clerk `unsafeMetadata` key + value for the permanent, signed-in opt-out.
 *  A version marker rather than a bare `true` so a future campaign can
 *  deliberately reset it while nothing accidental can. */
export const OPT_OUT_KEY = 'supportPromptOptOut';
export const OPT_OUT_VALUE = 'v1';

export interface EngagedClock {
  /** Credit engaged time up to `at`, then return the running total. */
  tick(at: number): number;
  /** A real interaction (pointerdown / keydown / scroll) happened at `at`. */
  activity(at: number): void;
  /** Tab visibility flipped at `at`. */
  setVisible(visible: boolean, at: number): void;
  /** Engaged milliseconds banked so far. */
  total(): number;
}

/**
 * Accumulates ENGAGED time, not wall-clock: it advances only while the tab is
 * visible AND the last interaction is younger than `idleTimeoutMs`. A tab left
 * open in the background earns nothing, so the prompt can never fire at
 * somebody who walked away.
 *
 * `startedAt` seeds both the tick and the idle window — arriving on the page is
 * itself an interaction (the reader just clicked or typed to get here).
 */
export function createEngagedClock({
  startedAt,
  initialMs = 0,
  visible = true,
  idleTimeoutMs = IDLE_TIMEOUT_MS,
}: {
  startedAt: number;
  initialMs?: number;
  visible?: boolean;
  idleTimeoutMs?: number;
}): EngagedClock {
  let total = Math.max(0, initialMs);
  let lastTickAt = startedAt;
  let lastActivityAt = startedAt;
  let isVisible = visible;

  const credit = (at: number) => {
    const from = lastTickAt;
    lastTickAt = Math.max(at, from);
    if (!isVisible || at <= from) return;
    // Engaged only up to idleTimeoutMs past the last interaction, so a long
    // untouched stretch inside one tick is partially credited, not wholly.
    const engagedUntil = lastActivityAt + idleTimeoutMs;
    total += Math.max(0, Math.min(at, engagedUntil) - from);
  };

  return {
    tick(at) {
      credit(at);
      return total;
    },
    activity(at) {
      credit(at); // settle the old idle window before opening a new one
      lastActivityAt = Math.max(at, lastActivityAt);
    },
    setVisible(next, at) {
      credit(at); // settle time under the old visibility before flipping
      isVisible = next;
      // Coming back to the tab is an interaction in itself; without this a
      // reader who returns and reads without scrolling banks nothing.
      if (next) lastActivityAt = Math.max(at, lastActivityAt);
    },
    total() {
      return total;
    },
  };
}

/** Which ask has been shown this visit: 0 none, 1 or 2 the ladder position. */
export type AskShown = 0 | 1 | 2;
export type AskStage = 1 | 2;

export interface VisitState {
  /** Engaged ms banked this visit. */
  ms: number;
  /** Highest ask shown this visit. */
  shown: AskShown;
  /** The visit is finished with the prompt: supported, dismissed for good, or
   *  ask 2 closed by any route. */
  done: boolean;
}

export const EMPTY_VISIT: VisitState = { ms: 0, shown: 0, done: false };

/**
 * The ask that is due, or null. Three rules, all of them load-bearing:
 *  - `done` ends it for the visit on every path, so there is no third ask.
 *  - ask 2 requires ask 1 to have been SHOWN, so someone landing with five
 *    minutes already banked (a restored tab, a late mount) gets ask 1 rather
 *    than "last time I'll ask" out of nowhere.
 *  - thresholds are compared against TOTAL engaged time.
 */
export function dueAsk(
  state: VisitState,
  thresholds: readonly [number, number] = THRESHOLDS_MS,
): AskStage | null {
  if (state.done) return null;
  if (state.shown === 0) return state.ms >= thresholds[0] ? 1 : null;
  if (state.shown === 1) return state.ms >= thresholds[1] ? 2 : null;
  return null;
}

/** Tolerant parse of the stored visit blob — anything unexpected reads as a
 *  fresh visit rather than throwing at a reader mid-page. */
export function parseVisit(raw: string | null | undefined): VisitState {
  if (!raw) return { ...EMPTY_VISIT };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ...EMPTY_VISIT };
  }
  if (typeof data !== 'object' || data === null) return { ...EMPTY_VISIT };
  const { ms, shown, done } = data as Record<string, unknown>;
  return {
    ms: typeof ms === 'number' && Number.isFinite(ms) && ms > 0 ? ms : 0,
    shown: shown === 1 || shown === 2 ? shown : 0,
    done: done === true,
  };
}

export function serializeVisit(state: VisitState): string {
  // Rounded to the second: the blob is rewritten on every tick and the
  // thresholds are minutes, so sub-second precision is noise.
  return JSON.stringify({
    ms: Math.round(state.ms / 1000) * 1000,
    shown: state.shown,
    done: state.done,
  });
}

/**
 * `?supportPromptMs=3000,6000` shortens the ladder so the whole two-ask flow
 * can be walked in seconds instead of five minutes. Both values are required,
 * positive and ascending; anything else falls back to the real thresholds
 * (returns null) rather than half-applying.
 */
export function parseThresholds(raw: string | null | undefined): [number, number] | null {
  if (!raw) return null;
  const parts = raw.split(',').map(p => Number(p.trim()));
  if (parts.length !== 2) return null;
  const [first, second] = parts;
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
  if (first <= 0 || second <= first) return null;
  return [first, second];
}

/** True when this account has silenced the prompt for good. Any non-empty
 *  string counts, so bumping OPT_OUT_VALUE does NOT re-prompt existing
 *  opt-outs by accident — resetting them is a deliberate migration, not a
 *  side effect of a version bump. */
export function hasOptedOut(unsafeMetadata: unknown): boolean {
  if (typeof unsafeMetadata !== 'object' || unsafeMetadata === null) return false;
  const value = (unsafeMetadata as Record<string, unknown>)[OPT_OUT_KEY];
  return typeof value === 'string' && value.length > 0;
}
