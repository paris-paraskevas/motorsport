'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const GRID = 24;
const CONSENT_KEY = 'paddock:consent';

// Anonymous click-heatmap capture: buckets each click into a GRIDxGRID viewport
// cell for the current path, batches them, and ships via sendBeacon on a timer,
// on tab-hide, and on route change. Consent-gated (analytics) + honours Do Not
// Track. No cookies, no PII — only a path + coarse cell counts leave the browser.
export function HeatmapTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.doNotTrack === '1') return;
    let analytics = false;
    try {
      analytics = JSON.parse(localStorage.getItem(CONSENT_KEY) || '{}')?.analytics === true;
    } catch {
      /* no/blocked storage → no consent → don't track */
    }
    if (!analytics) return;

    const counts = new Map<number, number>();

    const onClick = (e: MouseEvent) => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (!vw || !vh) return;
      const gx = Math.min(GRID - 1, Math.max(0, Math.floor((e.clientX / vw) * GRID)));
      const gy = Math.min(GRID - 1, Math.max(0, Math.floor((e.clientY / vh) * GRID)));
      const c = gy * GRID + gx;
      counts.set(c, (counts.get(c) ?? 0) + 1);
    };

    const flush = () => {
      if (counts.size === 0) return;
      const cells = [...counts.entries()].map(([c, n]) => ({ c, n }));
      counts.clear();
      try {
        const blob = new Blob([JSON.stringify({ path: pathname, cells })], { type: 'application/json' });
        navigator.sendBeacon('/api/heatmap', blob);
      } catch {
        /* ignore */
      }
    };

    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };

    document.addEventListener('click', onClick, { capture: true });
    document.addEventListener('visibilitychange', onHide);
    const timer = window.setInterval(flush, 15000);

    return () => {
      flush(); // attribute this path's clicks before it changes
      document.removeEventListener('click', onClick, { capture: true } as EventListenerOptions);
      document.removeEventListener('visibilitychange', onHide);
      window.clearInterval(timer);
    };
  }, [pathname]);

  return null;
}
