'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

// Crash/close protection for the two studio writing surfaces. The editor and the
// composer keep everything in component state until an explicit Save or Publish,
// so closing the tab, navigating away or crashing threw the work away — the
// operator lost a post that way on 2026-08-24, which is what this exists for.
//
// Deliberately localStorage ONLY, no server writes. A debounced PATCH would keep
// rewriting a row that may be sitting in the review queue, so a post could change
// under the person reading it. Recovery is per-browser, which is the right trade
// for "do not lose what I just typed".
//
// Two mechanisms, because they cover different failures:
//  - the debounced snapshot survives a crash or a closed tab (nothing runs);
//  - `beforeunload` catches the ordinary navigate-away, where a prompt is enough.

const PREFIX = 'paddock:draft:';
const DEBOUNCE_MS = 1000;

export interface DraftSnapshot<T> {
  values: T;
  ts: number;
}

// localStorage throws in private modes and when quota is exhausted; a backup that
// takes the editor down with it is worse than no backup.
function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

// Takes the values ALREADY serialised: the caller has to serialise them anyway to
// decide whether anything changed, and re-serialising an object it had to parse
// back out would be wasted work on every keystroke's debounce.
function writeSnapshot(key: string, serialisedValues: string): void {
  try {
    window.localStorage.setItem(key, `{"values":${serialisedValues},"ts":${Date.now()}}`);
  } catch {
    // Quota or a blocked store — nothing to do, and nothing worth breaking.
  }
}

function dropSnapshot(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // As above.
  }
}

function parseSnapshot<T>(raw: string | null): DraftSnapshot<T> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DraftSnapshot<T>;
    return parsed && typeof parsed.ts === 'number' && parsed.values ? parsed : null;
  } catch {
    return null;
  }
}

// The store is read through useSyncExternalStore rather than an effect, for two
// reasons. It is the API React provides for reading something outside React with
// server rendering in the picture, so hydration is handled instead of mismatching
// (the server has no localStorage and returns null). And it avoids setting state
// inside an effect, which this repo's lint rejects outright.
//
// The read is FROZEN after the first call on purpose: this hook's own debounced
// writes are constantly changing the stored value, and a live-reading snapshot
// would make the "unsaved draft found" banner reappear while the author types.
// What matters is what was in the store when the page opened. `subscribe` is
// therefore a no-op — nothing should ever push a new value in.
function makeStore<T>(key: string) {
  let read = false;
  let value: DraftSnapshot<T> | null = null;
  return {
    subscribe: () => () => {},
    getSnapshot: (): DraftSnapshot<T> | null => {
      if (!read) {
        read = true;
        value = parseSnapshot<T>(safeGet(key));
      }
      return value;
    },
    getServerSnapshot: (): DraftSnapshot<T> | null => null,
  };
}

/**
 * Back a form's fields up to localStorage while they differ from what the server
 * has, and offer whatever was left behind on the next mount.
 *
 * @param id     stable key for this draft — a post id, or 'new' for the composer.
 * @param values the CURRENT field values.
 * @param dirty  whether those differ from the saved/server copy. Only dirty state
 *               is snapshotted, so a pristine form never leaves a stale recovery
 *               banner behind.
 *
 * Returns whatever was recovered, plus `discard` (the author dealt with it) and
 * `clear` (the server has it now) to resolve the banner.
 */
export function useDraftBackup<T extends Record<string, string>>(
  id: string,
  values: T,
  dirty: boolean,
): {
  recovered: DraftSnapshot<T> | null;
  discard: () => void;
  clear: () => void;
} {
  const key = `${PREFIX}${id}`;
  const [store] = useState(() => makeStore<T>(key));
  const stored = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const [resolved, setResolved] = useState(false);
  const recovered = resolved ? null : stored;

  // Snapshot on a trailing debounce. The effect depends on the SERIALISED values
  // rather than the object, so a pure re-render (new object identity, same
  // contents) does not rewrite the store.
  const serialised = JSON.stringify(values);
  useEffect(() => {
    if (!dirty) {
      // A clean form normally means there is nothing worth keeping — EXCEPT while
      // an unresolved recovery is on screen. Both this effect and the first read
      // land in the same commit on mount, so without this guard the hook would
      // delete the very snapshot it just offered, and a second reload would find
      // nothing.
      if (!recovered) dropSnapshot(key);
      return;
    }
    const t = setTimeout(() => writeSnapshot(key, serialised), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [key, dirty, serialised, recovered]);

  // The ordinary case: someone hits back or closes the tab with unsaved work.
  // Browsers ignore any custom message and show their own wording; returning a
  // value is what triggers the prompt at all.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // Both resolve the banner and release the guard; they differ only in the
  // caller's intent, which is why both names exist.
  const resolve = useCallback(() => {
    dropSnapshot(key);
    setResolved(true);
  }, [key]);

  return { recovered, discard: resolve, clear: resolve };
}

/** "14:02" today, "23 Aug 14:02" otherwise — for the recovery banner. */
export function fmtRecoveredAt(ts: number): string {
  const d = new Date(ts);
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const sameDay = new Date().toDateString() === d.toDateString();
  return sameDay ? time : `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} ${time}`;
}
