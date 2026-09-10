// The browser half of the Debug helper (APEX: apex.debug): what a running page
// records once it has arrived, the dynamic actions bound and each one fired, kept
// here for the Debug panel to read through useSyncExternalStore. A handful of
// entries per page, no network, nothing unless the panel looks.
import type { DebugEntry } from './debug';

let entries: readonly DebugEntry[] = [];
const listeners = new Set<() => void>();

export const NO_ENTRIES: readonly DebugEntry[] = [];

/** One line, timed from the page's start (performance.now()). */
export function record(phase: string, text: string): void {
  entries = [...entries, { at: Math.round(performance.now()), level: 4, phase, text }];
  listeners.forEach(l => l());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The same array until the next record, as useSyncExternalStore wants it. */
export function clientEntries(): readonly DebugEntry[] {
  return entries;
}

/** For the tests. */
export function resetClientEntries(): void {
  entries = [];
}
