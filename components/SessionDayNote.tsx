'use client';
import { useSyncExternalStore } from 'react';
import { dayNoteLabel } from '@/lib/date';

// false during SSR *and* the hydration render (so server and first client render
// agree — no mismatch), true immediately after. Same effect-free client probe as
// components/LocalTime.tsx.
const subscribe = () => () => {};
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

/** The viewer's own calendar date, as YYYY-MM-DD in their timezone. */
function deviceToday(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Names the day a group of sessions falls on: "Also today" only when it really
 * is today, otherwise "Also Saturday".
 *
 * Operator bug, 2026-08-22: the band said "ALSO TODAY" unconditionally, but the
 * rows under it are the siblings of the *next* session — which on a Friday
 * evening are Saturday's. It read as a lie by Friday night, every weekend.
 *
 * "Today" is decided in the BROWSER, never on the server. `/app` is
 * `revalidate = 300` and the Worker runs in UTC, so a server-baked "today" is
 * both up to five minutes stale and in the wrong timezone for most readers —
 * the same mistake as the server-baked live pill. Before hydration it renders
 * the weekday, which is always true; "today" can only appear once the device
 * clock has been consulted.
 */
export function SessionDayNote({ dayIso }: { dayIso: string }) {
  const hydrated = useHydrated();
  // Pre-hydration `todayIso` is null, so the label is the weekday — always
  // true, never a claim the server is not in a position to make.
  return <>{dayNoteLabel(dayIso, hydrated ? deviceToday() : null)}</>;
}
