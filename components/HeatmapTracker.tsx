'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const CONSENT_KEY = 'paddock:consent';
const MAX_EVENTS = 250; // batch cap (well under sendBeacon's 64 KiB)
const MAX_IMPRESSION_TARGETS = 200; // cap observed elements per pageview
const DWELL_MS = 300; // element must stay >=50% visible this long to count as seen
const FLUSH_MS = 15000;

type Kind = 'click' | 'impression';
interface PendingEvent {
  kind: Kind;
  elementId?: string;
  selector?: string;
  relX?: number;
  relY?: number;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

// mobile <768, tablet 768-1023, desktop >=1024 (matches Tailwind md/lg breaks).
function bucket(w: number): 'mobile' | 'tablet' | 'desktop' {
  return w < 768 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop';
}

// Compact, stable-ish descriptor for a clicked element with no data-heatmap-id:
// tag + #id + first class + :nth-of-type. Not a resolvable selector — just a label
// so untagged hotspots still surface as candidates for future instrumentation.
function describe(el: Element): string {
  let sel = el.tagName.toLowerCase();
  if (el.id) sel += `#${el.id}`;
  const cls = el.classList[0];
  if (cls) sel += `.${cls}`;
  const parent = el.parentElement;
  if (parent) {
    const sameTag = Array.from(parent.children).filter(c => c.tagName === el.tagName);
    if (sameTag.length > 1) sel += `:nth-of-type(${sameTag.indexOf(el) + 1})`;
  }
  return sel.slice(0, 200);
}

// Anonymous element-relative heatmap capture. Per pageview it records: clicks
// (element-relative ratio inside the nearest [data-heatmap-id] ancestor, else a
// compact fallback selector) and one impression per tagged element that dwells
// >=50% visible for DWELL_MS. Batches both, ships via sendBeacon on a 15s timer,
// on tab-hide, and on route change. Consent-gated (analytics) + honours Do Not
// Track. No cookies, no PII, zero server imports — only the batch leaves the tab.
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

    const events: PendingEvent[] = [];
    const seen = new Set<string>(); // one impression per element id per pageview

    const push = (ev: PendingEvent) => {
      if (events.length < MAX_EVENTS) events.push(ev);
    };

    const onClick = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const el = target.closest('[data-heatmap-id]');
      if (el) {
        const id = el.getAttribute('data-heatmap-id');
        if (!id) return;
        const rect = el.getBoundingClientRect();
        push({
          kind: 'click',
          elementId: id,
          relX: rect.width > 0 ? clamp01((e.clientX - rect.left) / rect.width) : undefined,
          relY: rect.height > 0 ? clamp01((e.clientY - rect.top) / rect.height) : undefined,
        });
      } else {
        push({ kind: 'click', selector: describe(target) });
      }
    };

    // Impressions: observe the tagged elements present at mount / route change.
    // Feature-detected; older browsers simply skip impression capture.
    const dwellTimers = new Map<Element, number>();
    let io: IntersectionObserver | null = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(
        (entries, observer) => {
          for (const entry of entries) {
            const el = entry.target;
            if (entry.isIntersecting) {
              if (dwellTimers.has(el)) continue;
              const t = window.setTimeout(() => {
                dwellTimers.delete(el);
                observer.unobserve(el);
                const id = el.getAttribute('data-heatmap-id');
                if (id && !seen.has(id)) {
                  seen.add(id);
                  push({ kind: 'impression', elementId: id });
                }
              }, DWELL_MS);
              dwellTimers.set(el, t);
            } else {
              const t = dwellTimers.get(el);
              if (t !== undefined) {
                window.clearTimeout(t);
                dwellTimers.delete(el);
              }
            }
          }
        },
        { threshold: 0.5 },
      );
      const targets = document.querySelectorAll('[data-heatmap-id]');
      for (let i = 0; i < targets.length && i < MAX_IMPRESSION_TARGETS; i++) io.observe(targets[i]);
    }

    const flush = () => {
      if (events.length === 0) return;
      const batch = events.splice(0, events.length);
      const w = window.innerWidth;
      const h = window.innerHeight;
      const payload = {
        path: pathname,
        viewportW: w,
        viewportH: h,
        breakpoint: bucket(w),
        pointer: window.matchMedia?.('(pointer: coarse)').matches ? 'touch' : 'mouse',
        events: batch,
      };
      try {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon('/api/heatmap', blob);
      } catch {
        /* best-effort */
      }
    };

    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };

    document.addEventListener('click', onClick, { capture: true });
    document.addEventListener('visibilitychange', onHide);
    const timer = window.setInterval(flush, FLUSH_MS);

    return () => {
      flush(); // attribute this path's events before it changes
      document.removeEventListener('click', onClick, { capture: true } as EventListenerOptions);
      document.removeEventListener('visibilitychange', onHide);
      window.clearInterval(timer);
      io?.disconnect();
      for (const t of dwellTimers.values()) window.clearTimeout(t);
      dwellTimers.clear();
    };
  }, [pathname]);

  return null;
}
