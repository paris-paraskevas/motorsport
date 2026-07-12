'use client';
import { useSyncExternalStore } from 'react';
import { formatLocal } from '@/lib/date';

// false during SSR *and* the hydration render (so server + first client render
// agree — no mismatch), true immediately after. The effect-free, lint-clean way
// to detect the client (React reuses getServerSnapshot during hydration).
const subscribe = () => () => {};
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

// Device-local time, e.g. "Fri 14:00". No zone label: this renders in the
// VIEWER's own timezone, so their own abbreviation ("EEST", "GMT", …) is noise,
// not information (operator feedback: "it says EEST and should just have time").
// The SSR fallback (formatLocal, fixed Athens) DOES keep its label — an
// unlabelled Athens time would misread as local for a non-Athens no-JS viewer
// (audit 2-1); post-hydration this device-local value replaces it.
function formatDevice(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/**
 * A session time in the VIEWER's local timezone. Before hydration (and in the
 * SSR HTML) it renders the fixed-Athens `formatLocal` value, so server and the
 * first client render agree; immediately after hydration it swaps to the
 * device's own timezone. Mirrors HomeContent's GMT→device-local upgrade, but
 * self-contained (no serverNow plumbing needed) via useSyncExternalStore — so it
 * drops into any `<time>` across the calendar / weekend / session surfaces.
 */
export function LocalTime({ instant }: { instant: number }) {
  const hydrated = useHydrated();
  const d = new Date(instant);
  return <>{hydrated ? formatDevice(d) : formatLocal(d)}</>;
}
