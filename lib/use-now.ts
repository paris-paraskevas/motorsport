'use client';
import { useEffect, useState } from 'react';

/**
 * Hydration-safe "now". Seeds from a server-rendered ISO timestamp so SSR and
 * the first client render agree (no React #418 against up-to-5-min-stale ISR
 * HTML), then swaps to the device clock and ticks once a minute. `clock` flips
 * true after the first post-mount sync — gate any device-timezone display on it.
 *
 * Extracted from HomeContent (its second consumer is FilteredSessions /
 * SessionCard, whose live/past state was computed from a bare `new Date()` and
 * rendered finished sessions as "LIVE" off stale ISR HTML — heuristic walk
 * 2026-06 / code-audit 2-8).
 */
export function useNow(serverNow: string): { now: Date; clock: boolean } {
  const [now, setNow] = useState(() => new Date(serverNow));
  const [clock, setClock] = useState(false);
  useEffect(() => {
    const sync = () => {
      setNow(new Date());
      setClock(true);
    };
    const t = setTimeout(sync, 0);
    const id = setInterval(sync, 60_000);
    return () => {
      clearTimeout(t);
      clearInterval(id);
    };
  }, []);
  return { now, clock };
}
