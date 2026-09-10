// The browser half of the Debug helper (APEX: apex.debug): what a running page
// records once it has arrived, the dynamic actions bound and each one fired, kept
// here for the Debug panel to read through useSyncExternalStore. A handful of
// entries per page, no network, nothing unless the panel looks. The store is
// one per tab, so a change of page (the app router keeps the module) starts it
// over: the first record on a new address, or the toolbar noting the address,
// drops the last page's lines and restarts the clock.
import type { DebugEntry } from './debug';

let entries: readonly DebugEntry[] = [];
let currentPath: string | null = null;
let pageStart = 0;
const listeners = new Set<() => void>();

export const NO_ENTRIES: readonly DebugEntry[] = [];

const here = (): string => (typeof window === 'undefined' ? '' : window.location.pathname);
const now = (): number => (typeof performance === 'undefined' ? 0 : performance.now());

/** A new address: the last page's lines go, the clock restarts. Idempotent for the same address. */
export function noteNavigation(path: string = here()): void {
  if (path === currentPath) return;
  currentPath = path;
  pageStart = now();
  if (entries.length > 0) {
    entries = [];
    listeners.forEach(l => l());
  }
}

/** One line, timed from this page's start. */
export function record(phase: string, text: string): void {
  noteNavigation();
  entries = [...entries, { at: Math.round(now() - pageStart), level: 4, phase, text }];
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
  currentPath = null;
  pageStart = 0;
}
